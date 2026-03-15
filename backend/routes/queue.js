// routes/queue.js
// Walk-in queue management for the self-service kiosk.
//
//   POST   /api/queue               — Add walk-in to queue (staff/admin auth)
//   GET    /api/queue               — Full queue for staff, with positions (staff/admin auth)
//   GET    /api/queue/display       — Public queue for TV display (no auth — x-business-id header)
//   POST   /api/queue/call-next     — Advance first 'waiting' entry to 'called' (staff/admin)
//   PATCH  /api/queue/:id/status    — Update a specific entry's status (staff/admin)
//   DELETE /api/queue/:id           — Remove / cancel an entry (admin)
const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const QueueEntry      = require('../models/QueueEntry');
const Business        = require('../models/Business');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect       = [authMiddleware, resolveBusiness];
// Public endpoints only need business resolution — no JWT required
const publicResolve = [resolveBusiness];

const ACTIVE_STATUSES = ['waiting', 'called', 'in_service'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Start and end of today in UTC (works for same-day scoping). */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Given an array of QueueEntry docs sorted by joinedAt ascending, attach
 * `position` and `estimatedWait` to each active entry in-place.
 * Completed / skipped / cancelled entries get null for both fields.
 */
function attachPositions(entries) {
  let pos = 0;
  let runningWait = 0;

  return entries.map(e => {
    const plain = typeof e.toObject === 'function' ? e.toObject() : { ...e };
    if (ACTIVE_STATUSES.includes(plain.status)) {
      pos++;
      plain.position      = pos;
      plain.estimatedWait = runningWait;
      runningWait        += plain.durationMinutes;
    } else {
      plain.position      = null;
      plain.estimatedWait = null;
    }
    return plain;
  });
}

/** Send a push notification to all staff devices registered to the business. */
async function notifyStaffNewWalkin(business, entry) {
  try {
    const tokens = (business.pushTokens || [])
      .filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));
    if (!tokens.length) return;

    const messages = tokens.map(to => ({
      to,
      title: '🚗 New Walk-in',
      body:  `${entry.customerName} — ${entry.serviceLabel} · Queue #${entry.queueNumber}`,
      data:  { type: 'new_walkin', queueEntryId: entry._id.toString() },
      sound: 'default',
    }));

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      messages,
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Queue] Staff push failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/queue
// Kiosk adds a walk-in customer to the queue.
// Body: { customerName, phoneNumber?, serviceId|packageId, serviceLabel,
//         price, durationMinutes, paymentMethod }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const {
      customerName, phoneNumber,
      serviceId, packageId,
      serviceLabel, price, durationMinutes,
      paymentMethod, notes,
    } = req.body;

    if (!customerName?.trim())  return res.status(400).json({ error: 'customerName is required.' });
    if (!serviceLabel?.trim())  return res.status(400).json({ error: 'serviceLabel is required.' });
    if (price == null)          return res.status(400).json({ error: 'price is required.' });
    if (!serviceId && !packageId) {
      return res.status(400).json({ error: 'serviceId or packageId is required.' });
    }

    const { start, end } = todayRange();

    // Assign the next sequential queue number for today
    const lastToday = await QueueEntry
      .findOne({ businessId: req.businessId, joinedAt: { $gte: start, $lte: end } })
      .sort({ queueNumber: -1 })
      .select('queueNumber')
      .lean();
    const queueNumber = (lastToday?.queueNumber ?? 0) + 1;

    const entry = await QueueEntry.create({
      businessId:      req.businessId,
      customerName:    customerName.trim(),
      phoneNumber:     phoneNumber?.trim() ?? '',
      serviceId:       serviceId  || null,
      packageId:       packageId  || null,
      serviceLabel:    serviceLabel.trim(),
      price:           Number(price),
      durationMinutes: Number(durationMinutes) || 30,
      paymentMethod:   paymentMethod || 'counter',
      queueNumber,
      notes:           notes || '',
    });

    // Compute position + estimatedWait for confirmation screen
    const aheadEntries = await QueueEntry.find({
      businessId: req.businessId,
      joinedAt:   { $gte: start, $lt: entry.joinedAt },
      status:     { $in: ACTIVE_STATUSES },
    }).select('durationMinutes').lean();

    const position      = aheadEntries.length + 1;
    const estimatedWait = aheadEntries.reduce((sum, e) => sum + e.durationMinutes, 0);

    // Notify all registered staff devices
    await notifyStaffNewWalkin(req.business, entry);

    res.status(201).json({
      _id:            entry._id.toString(),
      queueNumber,
      position,
      estimatedWait,
      customerName:   entry.customerName,
      serviceLabel:   entry.serviceLabel,
      price:          entry.price,
      durationMinutes: entry.durationMinutes,
      paymentMethod:  entry.paymentMethod,
      status:         entry.status,
      joinedAt:       entry.joinedAt,
    });
  } catch (err) {
    console.error('[Queue] create error:', err);
    res.status(500).json({ error: err.message || 'Failed to add to queue.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queue
// Returns today's full queue with dynamic position + estimatedWait.
// Staff see phone numbers; admin sees everything.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { start } = todayRange();
    const entries = await QueueEntry
      .find({ businessId: req.businessId, joinedAt: { $gte: start } })
      .sort({ joinedAt: 1 })
      .lean();

    res.json(attachPositions(entries));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queue/display
// Public endpoint — no JWT required. Resolves business via x-business-id header
// or ?slug= query param. Returns non-sensitive queue data for TV displays.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/display', async (req, res) => {
  try {
    // Resolve business manually (supports x-business-id header OR ?slug=)
    const headerId = req.headers['x-business-id'];
    const slug     = req.query.slug;

    let business = null;
    if (headerId) {
      business = await Business.findById(headerId).lean();
    } else if (slug) {
      business = await Business.findOne({ slug: String(slug), active: true }).lean();
    }
    if (!business) {
      return res.status(400).json({
        error: 'Business not found. Provide x-business-id header or ?slug= query param.',
      });
    }

    const { start } = todayRange();
    const raw = await QueueEntry
      .find({
        businessId: business._id,
        joinedAt:   { $gte: start },
        status:     { $in: [...ACTIVE_STATUSES, 'completed'] },
      })
      .sort({ joinedAt: 1 })
      .lean();

    // Strip phone numbers for public display
    const entries = attachPositions(raw).map(({ phoneNumber: _p, ...rest }) => rest);

    res.json({
      businessName: business.name,
      entries,
      activeCount:  entries.filter(e => ACTIVE_STATUSES.includes(e.status)).length,
      doneToday:    entries.filter(e => e.status === 'completed').length,
      fetchedAt:    new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch display queue.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/queue/call-next
// Advances the first 'waiting' entry to 'called'.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/call-next', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { start } = todayRange();
    const next = await QueueEntry.findOneAndUpdate(
      {
        businessId: req.businessId,
        joinedAt:   { $gte: start },
        status:     'waiting',
      },
      { status: 'called', calledAt: new Date() },
      { new: true, sort: { joinedAt: 1 } }
    ).lean();

    if (!next) return res.status(404).json({ error: 'No customers waiting in queue.' });
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: 'Failed to call next customer.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/queue/:id/status
// Update a specific entry's status. Allowed transitions:
//   waiting     → called | cancelled | skipped
//   called      → in_service | cancelled | skipped | waiting (requeue)
//   in_service  → completed | cancelled
// Body: { status, notes? }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { status, notes } = req.body;
    const validStatuses = ['waiting', 'called', 'in_service', 'completed', 'skipped', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = { status };
    if (notes !== undefined) update.notes = notes;

    // Set lifecycle timestamps
    if (status === 'called')      update.calledAt       = new Date();
    if (status === 'in_service')  update.serviceStartAt = new Date();
    if (status === 'completed')   update.completedAt    = new Date();

    const entry = await QueueEntry.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true }
    ).lean();

    if (!entry) return res.status(404).json({ error: 'Queue entry not found.' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update queue entry.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/queue/:id
// Hard-delete a queue entry (admin only). For soft-remove use PATCH .../status.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const deleted = await QueueEntry.findOneAndDelete({
      _id:        req.params.id,
      businessId: req.businessId,
    });

    if (!deleted) return res.status(404).json({ error: 'Queue entry not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete queue entry.' });
  }
});

module.exports = router;
