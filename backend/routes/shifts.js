// routes/shifts.js
const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const authMiddleware = require('../middleware/authMiddleware');

// GET all shifts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const shifts = await Shift.find().sort({ createdAt: -1 }).limit(100);
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// GET last active shift for an employee
router.get('/last/:name', authMiddleware, async (req, res) => {
  try {
    const shift = await Shift.findOne({
      employee: req.params.name,
      status: 'Active'
    }).sort({ createdAt: -1 });

    if (!shift) return res.status(404).json({ error: 'No active shift found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new clock-in
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { employee, date, clockIn } = req.body;

    const newShift = new Shift({
      employee,
      date,
      clockIn,
      clockOut: '',
      hours: '',
      status: 'Active',
    });

    await newShift.save();
    res.status(201).json(newShift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT clock-out and complete
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { clockOut, hours, status } = req.body;

    const updated = await Shift.findByIdAndUpdate(
      req.params.id,
      { clockOut, hours, status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Shift not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
