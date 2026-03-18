// routes/stats.js
const express = require('express');
const router  = express.Router();
const Transaction    = require('../models/Transaction');
const Booking        = require('../models/Booking');
const Customer       = require('../models/Customer');
const Review         = require('../models/Review');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const protect = [authMiddleware, resolveBusiness];

router.get('/dashboard', ...protect, async (req, res) => {
  try {
    const businessId = req.business._id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [transactions, bookingCount, customerCount, reviews] = await Promise.all([
      Transaction.find({ businessId, serviceDate: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({ businessId }),
      Customer.countDocuments({ businessId }),
      Review.find({ businessId }),
    ]);

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.finalPrice || 0), 0);
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + (r.stars || 0), 0) / reviews.length).toFixed(1)
      : 0;

    // Revenue by day (last 7 days)
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day); next.setDate(next.getDate() + 1);
      const dayTxns = transactions.filter(t => {
        const d = new Date(t.serviceDate);
        return d >= day && d < next;
      });
      revenueByDay.push({
        date:    day.toISOString().split('T')[0],
        revenue: dayTxns.reduce((sum, t) => sum + (t.finalPrice || 0), 0),
        count:   dayTxns.length,
      });
    }

    res.json({
      totalRevenue,
      totalBookings:   bookingCount,
      totalCustomers:  customerCount,
      avgRating:       Number(avgRating),
      revenueByDay,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
