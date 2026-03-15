// routes/staff.js
// GPS-tracking endpoints for mobile wash technicians.
//
//   PATCH /api/staff/:id/location  — background task POSTs each position fix
//   PATCH /api/staff/:id/tracking  — start/end shift flag
//   GET   /api/staff/:id/location  — customer polls technician position
//   GET   /api/staff/fleet         — admin sees all active techs on a map
const express = require('express');
const router  = express.Router();

const User            = require('../models/Users');
const Booking         = require('../models/Booking');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ── /fleet must be registered before /:id routes ─────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/fleet
// Returns all currently-tracking staff members with their last-known position.
// Admin only.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fleet', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const techs = await User.find({
      businessId:  req.businessId,
      isTracking:  true,
      role:        { $in: ['staff', 'admin'] },
      currentLat:  { $ne: null },
      currentLng:  { $ne: null },
    })
      .select('_id name role currentLat currentLng locationAccuracy locationUpdatedAt')
      .lean();

    res.json(techs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fleet.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/:id/location
// Returns one technician's current position.
// Any authenticated user can call this (customer polling for mobile job).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/location', protect, async (req, res) => {
  try {
    const tech = await User.findOne({
      _id:        req.params.id,
      businessId: req.businessId,
    })
      .select('_id name currentLat currentLng locationAccuracy locationUpdatedAt isTracking')
      .lean();

    if (!tech) return res.status(404).json({ error: 'Technician not found.' });
    res.json(tech);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/:id/location
// Called by the background location task on every GPS fix.
// Staff can only update their own; admin can update anyone.
// Also propagates coordinates to any active Booking assigned to this tech.
// Body: { lat, lng, accuracy? }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/location', protect, async (req, res) => {
  try {
    const isSelf  = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Cannot update another user\'s location.' });
    }

    const { lat, lng, accuracy } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }

    const now = new Date();

    // Update user's live position
    const tech = await User.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      {
        currentLat:        lat,
        currentLng:        lng,
        locationAccuracy:  accuracy ?? null,
        locationUpdatedAt: now,
        isTracking:        true,
      },
      { new: true }
    )
      .select('_id currentLat currentLng locationUpdatedAt')
      .lean();

    if (!tech) return res.status(404).json({ error: 'Technician not found.' });

    // Propagate to active bookings assigned to this tech so the customer
    // tracking screen picks up real-time movement without any changes.
    await Booking.updateMany(
      {
        businessId:      req.businessId,
        assignedStaffId: req.params.id,
        status:          'confirmed',
      },
      {
        technicianLat: lat,
        technicianLng: lng,
      }
    );

    res.json(tech);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/:id/tracking
// Start / end shift.
// Body: { isTracking: boolean }
// On end-shift (false): clears stored coordinates.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/tracking', protect, async (req, res) => {
  try {
    const isSelf  = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Cannot update another user\'s tracking status.' });
    }

    const { isTracking } = req.body;
    if (typeof isTracking !== 'boolean') {
      return res.status(400).json({ error: 'isTracking (boolean) is required.' });
    }

    const update = { isTracking };
    if (!isTracking) {
      // Clear stale coordinates on end-shift
      update.currentLat        = null;
      update.currentLng        = null;
      update.locationAccuracy  = null;
      update.locationUpdatedAt = null;
    }

    const tech = await User.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true }
    )
      .select('_id isTracking currentLat currentLng')
      .lean();

    if (!tech) return res.status(404).json({ error: 'Technician not found.' });
    res.json(tech);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tracking status.' });
  }
});

module.exports = router;
