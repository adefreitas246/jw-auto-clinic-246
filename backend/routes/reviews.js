// routes/reviews.js
// Customer review endpoints.
//
//   POST /api/reviews/                   — submit a review (customer)
//   GET  /api/reviews/                   — admin: list all reviews with filters
//   GET  /api/reviews/stats              — per-technician aggregated stats (admin)
//   GET  /api/reviews/booking/:bookingId — fetch review for a specific booking
//   PATCH /api/reviews/:id/reply         — admin reply to a review
//   DELETE /api/reviews/:id              — admin hide review (isPublic = false)
const express        = require('express');
const router         = express.Router();
const Review         = require('../models/Review');
const Booking        = require('../models/Booking');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ── POST / — submit review ────────────────────────────────────────────────────
// Body: { bookingId, stars, comment? }
router.post('/', protect, async (req, res) => {
  try {
    const { bookingId, stars, comment } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' });
    if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: 'stars must be 1-5.' });

    // Verify booking belongs to this user + business, and is finished
    const booking = await Booking.findOne({
      _id:        bookingId,
      businessId: req.businessId,
      userId:     req.user.id,
      status:     'completed',
    }).lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found or not yet completed.' });

    // One review per booking (unique constraint on schema)
    const review = await Review.create({
      bookingId,
      businessId:  req.businessId,
      userId:      req.user.id,
      customerId:  booking.customerId ?? null,
      staffId:     booking.assignedStaffId ?? null,
      staffName:   booking.technicianName  ?? '',
      stars:       Number(stars),
      comment:     comment ?? '',
    });

    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Review already submitted for this booking.' });
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// ── GET / — admin list ────────────────────────────────────────────────────────
// Query: staffId?, minStars?, page?, limit?
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Number(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const filter = { businessId: req.businessId };

    if (req.query.staffId)  filter.staffId  = req.query.staffId;
    if (req.query.minStars) filter.stars     = { $gte: Number(req.query.minStars) };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit)
        .populate('userId', 'name email')
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({ reviews, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// ── GET /stats — per-technician aggregation ───────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const stats = await Review.aggregate([
      { $match: { businessId: req.businessId, isPublic: true } },
      {
        $group: {
          _id:         '$staffId',
          staffName:   { $first: '$staffName' },
          avgStars:    { $avg: '$stars' },
          totalReviews: { $sum: 1 },
          distribution: {
            $push: '$stars',
          },
        },
      },
      { $sort: { avgStars: -1 } },
    ]);

    // Compute star distribution 1-5 for each technician
    const result = stats.map(s => {
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const star of s.distribution) dist[star] = (dist[star] || 0) + 1;
      return {
        staffId:      s._id,
        staffName:    s.staffName,
        avgStars:     Math.round(s.avgStars * 10) / 10,
        totalReviews: s.totalReviews,
        distribution: dist,
      };
    });

    // Overall business stats
    const overall = await Review.aggregate([
      { $match: { businessId: req.businessId, isPublic: true } },
      {
        $group: {
          _id:          null,
          avgStars:     { $avg: '$stars' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    res.json({
      overall:      overall[0] ? { avgStars: Math.round(overall[0].avgStars * 10) / 10, totalReviews: overall[0].totalReviews } : { avgStars: 0, totalReviews: 0 },
      byTechnician: result,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ── GET /booking/:bookingId ───────────────────────────────────────────────────
router.get('/booking/:bookingId', protect, async (req, res) => {
  try {
    const filter = { bookingId: req.params.bookingId, businessId: req.businessId };
    if (req.user.role !== 'admin') filter.userId = req.user.id;

    const review = await Review.findOne(filter).lean();
    res.json(review ?? null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch review.' });
  }
});

// ── PATCH /:id/reply — admin reply ────────────────────────────────────────────
router.patch('/:id/reply', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ error: 'reply is required.' });

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { adminReply: reply.trim(), adminRepliedAt: new Date() },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save reply.' });
  }
});

// ── DELETE /:id — hide review ─────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { isPublic: false },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review hidden.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to hide review.' });
  }
});

module.exports = router;
