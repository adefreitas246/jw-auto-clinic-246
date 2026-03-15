// routes/jobs.js
// Staff-facing job management endpoints.
//
//   GET  /api/jobs               — today's jobs for this business (staff/admin)
//   GET  /api/jobs/:id           — single job detail
//   PATCH /api/jobs/:id/status   — advance job status + optional notes (staff/admin)
//   PUT  /api/jobs/:id/location  — update technician GPS (staff/admin)
//   POST /api/jobs/:id/photos    — upload a before/after photo (staff/admin)
const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const Booking         = require('../models/Booking');
const User            = require('../models/Users');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const { awardLoyaltyPoints } = require('../utils/loyaltyUtils');

const protect = [authMiddleware, resolveBusiness];

// ── Status constants ──────────────────────────────────────────────────────────

const VALID_JOB_STATUSES = [
  'assigned', 'in_progress', 'completed', 'quality_check', 'finished',
];

const JOB_STATUS_LABELS = {
  assigned:      'Booking Confirmed',
  in_progress:   'Vehicle Being Washed',
  completed:     'Wash Completed',
  quality_check: 'Quality Check',
  finished:      'Ready for Pickup',
};

// Status advance order
const NEXT_STATUS = {
  assigned:      'in_progress',
  in_progress:   'completed',
  completed:     'quality_check',
  quality_check: 'finished',
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs
// Returns bookings for the given date (default: today).
// Admin sees all non-cancelled; staff sees only confirmed (still active jobs).
// Query: date (YYYY-MM-DD), status (optional filter), staffId (optional filter)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const date     = req.query.date     || new Date().toISOString().slice(0, 10);
    const isAdmin  = req.user.role === 'admin';

    const filter = {
      businessId:      req.businessId,
      appointmentDate: date,
      // Admin sees confirmed + completed (finished jobs); staff sees only active
      status: { $in: isAdmin ? ['confirmed', 'completed'] : ['confirmed'] },
    };

    // Optional jobStatus filter (admin use)
    if (req.query.jobStatus && isAdmin) {
      filter.jobStatus = req.query.jobStatus;
    }

    // Optional staffId filter (admin use)
    if (req.query.staffId && isAdmin) {
      filter.assignedStaffId = req.query.staffId === 'unassigned'
        ? null
        : req.query.staffId;
    }

    const jobs = await Booking.find(filter)
      .select(
        '_id serviceLabel vehicleLabel appointmentTime locationType ' +
        'bayLabel mobileAddress jobStatus assignedStaffId technicianName ' +
        'totalPrice durationMinutes status'
      )
      .sort({ appointmentTime: 1 })
      .lean();

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/:id
// Customer sees their own booking; staff/admin see any in their business.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const filter = { _id: req.params.id, businessId: req.businessId };
    if (!['admin', 'staff'].includes(req.user.role)) {
      filter.userId = req.user.id;
    }

    const booking = await Booking.findOne(filter)
      .select(
        'jobStatus assignedStaffId technicianName technicianLat technicianLng ' +
        'staffNotes photos ' +
        'serviceLabel vehicleLabel locationType bayLabel bayAddress ' +
        'mobileAddress mobileLat mobileLng ' +
        'appointmentDate appointmentTime totalPrice durationMinutes status'
      )
      .lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/jobs/:id/status
// Advance the job status and optionally update notes / technician name.
// Marks booking.status = 'completed' when jobStatus = 'finished'.
// Fires an Expo push notification to the customer on every status change.
// Body: { jobStatus, notes?, technicianName? }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { jobStatus, notes, technicianName } = req.body;
    if (!VALID_JOB_STATUSES.includes(jobStatus)) {
      return res.status(400).json({
        error: `jobStatus must be one of: ${VALID_JOB_STATUSES.join(', ')}`,
      });
    }

    const update = { jobStatus };
    if (notes        !== undefined) update.staffNotes    = notes;
    if (technicianName)             update.technicianName = technicianName;

    // Self-assign when picking up a job
    if (jobStatus === 'in_progress') {
      update.assignedStaffId = req.user.id;
    }

    // Terminal state: mark booking completed
    if (jobStatus === 'finished') update.status = 'completed';

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true }
    );

    if (!booking) return res.status(404).json({ error: 'Job not found.' });

    await sendJobStatusPush(booking, jobStatus);

    if (jobStatus === 'finished') {
      // Award loyalty points (fire-and-forget — errors logged inside helper)
      awardLoyaltyPoints(
        booking.userId,
        booking.customerId ?? null,
        booking.businessId,
        booking.totalPrice ?? 0,
        booking._id
      ).catch(() => {});

      // Send review request push
      sendReviewRequestPush(booking).catch(() => {});
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job status.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/jobs/:id/assign
// Admin assigns (or reassigns) a technician to a job.
// Body: { staffId: string, technicianName: string }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/assign', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { staffId, technicianName } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId is required.' });

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      {
        assignedStaffId: staffId,
        technicianName:  technicianName || '',
      },
      { new: true }
    )
      .select('assignedStaffId technicianName jobStatus')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign technician.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/jobs/:id/location
// Staff app broadcasts the technician's live GPS position (mobile wash jobs).
// Body: { lat: number, lng: number }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/location', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { technicianLat: lat, technicianLng: lng },
      { new: true }
    )
      .select('technicianLat technicianLng technicianName jobStatus')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/:id/photos
// Staff uploads a before/after photo.
// Body: { label: 'before'|'after', photoBase64: string }
//
// NOTE: Stores base64 data URL in MongoDB for this MVP.
// In production, upload to cloud storage (S3 / Cloudinary) and store the URL.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/photos', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { label, photoBase64 } = req.body;
    if (!['before', 'after'].includes(label)) {
      return res.status(400).json({ error: "label must be 'before' or 'after'." });
    }
    if (!photoBase64) {
      return res.status(400).json({ error: 'photoBase64 is required.' });
    }

    const photo = {
      label,
      data:    photoBase64,
      staffId: req.user.id,
      takenAt: new Date(),
    };

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $push: { photos: photo } },
      { new: true }
    )
      .select('photos')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });

    // Return only the newly added photo (last element)
    const saved = booking.photos[booking.photos.length - 1];
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload photo.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/:id/voice-notes
// Staff uploads a voice note recording (base64 audio).
// Body: { audioBase64: string, mimeType?: string, duration?: number, label?: string }
//
// NOTE: Stores base64 data URI in MongoDB for this MVP.
// In production, upload to cloud storage (S3 / Cloudinary) and store the URL.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/voice-notes', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { audioBase64, mimeType = 'audio/m4a', duration = 0, label = '' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required.' });
    }

    const note = {
      data:     audioBase64,
      mimeType,
      duration,
      label,
      staffId:  req.user.id,
      takenAt:  new Date(),
    };

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $push: { voiceNotes: note } },
      { new: true }
    )
      .select('voiceNotes')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });

    const saved = booking.voiceNotes[booking.voiceNotes.length - 1];
    // Strip data from list response — client uses the GET endpoint for playback
    const { data: _d, ...meta } = saved;
    res.status(201).json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload voice note.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/jobs/:id/voice-notes
// Returns voice note metadata for a job (admin/staff).
// Includes audio data for playback via ?include_data=1
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/voice-notes', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const booking = await Booking.findOne(
      { _id: req.params.id, businessId: req.businessId },
      'voiceNotes'
    ).lean();

    if (!booking) return res.status(404).json({ error: 'Job not found.' });

    const includeData = req.query.include_data === '1';
    const notes = (booking.voiceNotes || []).map(n => {
      const { data, ...meta } = n;
      return includeData ? { ...meta, data } : meta;
    });

    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voice notes.' });
  }
});

// ─── Review request push ──────────────────────────────────────────────────────
async function sendReviewRequestPush(booking) {
  try {
    const user  = await User.findById(booking.userId).select('expoPushToken').lean();
    const token = user?.expoPushToken;
    if (!token?.startsWith('ExponentPushToken')) return;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title: '⭐ How was your wash?',
        body:  'Tap to rate your experience and help us improve.',
        data:  {
          type:      'review_request',
          bookingId: booking._id.toString(),
          screen:    `/(customer)/rate/${booking._id}`,
        },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Push] Review request push failed:', err.message);
  }
}

// ─── Push notification helper ─────────────────────────────────────────────────
async function sendJobStatusPush(booking, jobStatus) {
  try {
    const user  = await User.findById(booking.userId).select('expoPushToken').lean();
    const token = user?.expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    const title = jobStatus === 'finished'
      ? '✅ Your vehicle is ready!'
      : '🚗 Job Update';

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title,
        body:  JOB_STATUS_LABELS[jobStatus] ?? jobStatus,
        data:  { bookingId: booking._id.toString(), type: 'job_status_update', jobStatus },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Push] Job status push failed:', err.message);
  }
}

module.exports = router;
