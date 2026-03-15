// routes/shifts.js
const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const authMiddleware = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const mongoose = require('mongoose');

const protect = [authMiddleware, resolveBusiness];

const formatDuration = (ms) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs  = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs}h ${mins}m ${secs}s`;
};

const parseDateTime = (dateISO, time12h) => {
  if (!dateISO || !time12h) return null;
  const [time, ampmRaw] = time12h.split(' ');
  if (!time || !ampmRaw) return null;
  const [hh, mm, ss] = time.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm) || Number.isNaN(ss)) return null;
  let H = hh % 12;
  if (ampmRaw.toUpperCase() === 'PM') H += 12;
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${dateISO}T${pad(H)}:${pad(mm)}:${pad(ss)}.000Z`);
};

const computeTotals = (shift, overrides = {}) => {
  const start = parseDateTime(shift.date, shift.clockIn);
  let end     = parseDateTime(shift.date, overrides.clockOut ?? shift.clockOut);
  if (!start || !end) return { hours: '', hoursDecimal: 0 };
  if (end < start) end = new Date(end.getTime() + 24 * 3600 * 1000);

  const lunchStartStr = (overrides.lunchStart ?? shift.lunchStart ?? '').trim();
  const lunchEndStr   = (overrides.lunchEnd   ?? shift.lunchEnd   ?? '').trim();
  let lunchMs = 0;
  if (lunchStartStr && lunchEndStr) {
    let lStart = parseDateTime(shift.date, lunchStartStr);
    let lEnd   = parseDateTime(shift.date, lunchEndStr);
    if (lStart && lEnd) {
      if (lEnd < lStart) lEnd = new Date(lEnd.getTime() + 24 * 3600 * 1000);
      const l0 = Math.max(start.getTime(), lStart.getTime());
      const l1 = Math.min(end.getTime(),   lEnd.getTime());
      if (l1 > l0) lunchMs = l1 - l0;
    }
  }

  const netMs = Math.max(0, end.getTime() - start.getTime() - lunchMs);
  return {
    hours:        formatDuration(netMs),
    hoursDecimal: Math.round((netMs / 3600000) * 100) / 100,
  };
};

// GET all shifts (scoped to business, exclude deleted)
router.get('/', protect, async (req, res) => {
  try {
    const shifts = await Shift.find({ businessId: req.businessId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// GET last active shift for a worker (scoped to business)
router.get('/last/:name', protect, async (req, res) => {
  try {
    const shift = await Shift.findOne({
      businessId: req.businessId,
      worker:     req.params.name,
      status:     'Active',
      deletedAt:  null,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!shift) return res.status(404).json({ error: 'No active shift found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new clock-in
router.post('/', protect, async (req, res) => {
  try {
    const { worker, date, clockIn } = req.body;

    const newShift = new Shift({
      worker,
      date,
      clockIn,
      clockOut:   '',
      lunchStart: '',
      lunchEnd:   '',
      hours:        '',
      hoursDecimal: 0,
      status:       'Active',
      businessId:   req.businessId,
    });

    await newShift.save();
    res.status(201).json(newShift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update shift (clock-out, lunch, status)
router.put('/:id', protect, async (req, res) => {
  try {
    const id = (req.params.id || '').toString().trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid shift ID' });
    }

    const { clockOut, status, lunchStart, lunchEnd } = req.body;

    // Scope the lookup to this business
    const shift = await Shift.findOne({ _id: id, businessId: req.businessId });
    if (!shift || shift.deletedAt) return res.status(404).json({ error: 'Shift not found' });

    const set = {};
    if (typeof lunchStart === 'string') set.lunchStart = lunchStart.trim();
    if (typeof lunchEnd   === 'string') set.lunchEnd   = lunchEnd.trim();
    if (typeof clockOut   === 'string') set.clockOut   = clockOut.trim();

    if (typeof clockOut === 'string' && clockOut.trim()) {
      const totals = computeTotals(shift, {
        clockOut:   clockOut.trim(),
        lunchStart: set.lunchStart ?? shift.lunchStart,
        lunchEnd:   set.lunchEnd   ?? shift.lunchEnd,
      });
      set.hours        = totals.hours;
      set.hoursDecimal = totals.hoursDecimal;
      set.status       = status || 'Completed';
    } else if (status) {
      set.status = status;
    }

    const updated = await Shift.findByIdAndUpdate(id, { $set: set }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Shift not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SOFT DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    let id = (req.params.id || '').toString().trim().replace(/\u200E|\u200F|\u202A|\u202C/g, '');
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid shift ID' });
    }

    const exists = await Shift.exists({ _id: id, businessId: req.businessId });
    if (!exists) return res.status(404).json({ error: 'Shift not found' });

    const updated = await Shift.findByIdAndUpdate(
      id,
      { deletedAt: new Date(), deletedBy: req.user?.name || req.user?.id || 'system' },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Shift not found' });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('Soft delete failed:', err);
    return res.status(500).json({ error: 'Failed to delete shift' });
  }
});

module.exports = router;
