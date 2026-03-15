// routes/reports.js
// Admin reporting endpoints.
//
//   GET /api/reports/dashboard   — KPI + 7-day chart + top services
//   GET /api/reports/revenue     — Transaction rows + daily/service aggregates
//   GET /api/reports/employees   — Staff performance
//   GET /api/reports/customers   — Customer list + spend
//   GET /api/reports/services    — Service breakdown
//
// All detail endpoints require admin role.
// Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
const express    = require('express');
const router     = express.Router();
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const Transaction = require('../models/Transaction');
const Worker      = require('../models/Workers');
const Customer    = require('../models/Customer');
const Booking     = require('../models/Booking');

const protect = [authMiddleware, resolveBusiness];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a UTC-midnight-aligned { start, end } Date range.
 * Falls back to current calendar month if params omitted.
 */
function dateRange(startStr, endStr) {
  let start, end;

  if (startStr) {
    start = new Date(startStr);
  } else {
    start = new Date();
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);

  if (endStr) {
    end = new Date(endStr);
  } else {
    end = new Date();
  }
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// ── GET /api/reports/dashboard ────────────────────────────────────────────────
// Returns KPI totals + chart data for the revenue dashboard.
router.get('/dashboard', protect, async (req, res) => {
  try {
    const bid = req.businessId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // 7-day window for bar chart
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    // 28-day window for weekly line chart (4 weeks)
    const twentyEightDaysAgo = new Date(today);
    twentyEightDaysAgo.setDate(today.getDate() - 27);

    const [
      totalRevenueAgg,
      totalServices,
      totalEmployees,
      activeNow,
      todayCount,
      todayRevenueAgg,
      dailyRaw,
      weeklyRaw,
      serviceRaw,
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { businessId: bid } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$finalPrice' } } } },
      ]),
      Transaction.countDocuments({ businessId: bid }),
      Worker.countDocuments({ businessId: bid }),
      Worker.countDocuments({ businessId: bid, clockedIn: true }),
      Transaction.countDocuments({
        businessId: bid,
        serviceDate: { $gte: today, $lt: tomorrow },
      }),
      Transaction.aggregate([
        { $match: { businessId: bid, serviceDate: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$finalPrice' } } } },
      ]),
      // Daily for last 7 days
      Transaction.aggregate([
        { $match: { businessId: bid, serviceDate: { $gte: sevenDaysAgo, $lt: tomorrow } } },
        {
          $group: {
            _id:     { $dateToString: { format: '%Y-%m-%d', date: '$serviceDate' } },
            revenue: { $sum: { $toDouble: '$finalPrice' } },
            count:   { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Weekly for last 4 weeks (28 days)
      Transaction.aggregate([
        { $match: { businessId: bid, serviceDate: { $gte: twentyEightDaysAgo, $lt: tomorrow } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%V',   // ISO year-week
                date:   '$serviceDate',
              },
            },
            revenue: { $sum: { $toDouble: '$finalPrice' } },
            count:   { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 4 },
      ]),
      // Top 5 services by revenue
      Transaction.aggregate([
        { $match: { businessId: bid } },
        {
          $group: {
            _id:     '$serviceType',
            revenue: { $sum: { $toDouble: '$finalPrice' } },
            count:   { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Fill missing days so the chart always has 7 points
    const dailyChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso  = d.toISOString().slice(0, 10);
      const hit  = dailyRaw.find(x => x._id === iso);
      dailyChart.push({ date: iso, revenue: round2(hit?.revenue ?? 0), count: hit?.count ?? 0 });
    }

    // Pad/label weekly data to 4 slots
    const weeklyChart = weeklyRaw.slice(-4).map((w, i) => ({
      label:   `W${i + 1}`,
      revenue: round2(w.revenue),
      count:   w.count,
    }));
    while (weeklyChart.length < 4) {
      weeklyChart.unshift({ label: `W${weeklyChart.length + 1}`, revenue: 0, count: 0 });
    }

    res.json({
      totalRevenue:      round2(totalRevenueAgg[0]?.total),
      totalServices,
      totalEmployees,
      activeNow,
      todayRevenue:      round2(todayRevenueAgg[0]?.total),
      todayTransactions: todayCount,
      dailyChart,
      weeklyChart,
      serviceChart: serviceRaw.map(s => ({
        name:    s._id || 'Other',
        revenue: round2(s.revenue),
        count:   s.count,
      })),
    });
  } catch (err) {
    console.error('[Reports] dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ── GET /api/reports/revenue ──────────────────────────────────────────────────
router.get('/revenue', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const bid = req.businessId;
    const { start, end } = dateRange(req.query.startDate, req.query.endDate);

    const txns = await Transaction
      .find({ businessId: bid, serviceDate: { $gte: start, $lte: end } })
      .sort({ serviceDate: 1 })
      .lean();

    const totalRevenue  = txns.reduce((s, t) => s + (Number(t.finalPrice) || 0), 0);
    const totalDiscount = txns.reduce((s, t) => s + (Number(t.discountAmount) || 0), 0);

    // By day
    const dayMap = {};
    for (const t of txns) {
      const d = (t.serviceDate || t.createdAt).toISOString().slice(0, 10);
      if (!dayMap[d]) dayMap[d] = { date: d, revenue: 0, count: 0 };
      dayMap[d].revenue += Number(t.finalPrice) || 0;
      dayMap[d].count++;
    }

    // By service
    const svcMap = {};
    for (const t of txns) {
      const k = t.serviceType || 'Unknown';
      if (!svcMap[k]) svcMap[k] = { serviceType: k, revenue: 0, count: 0 };
      svcMap[k].revenue += Number(t.finalPrice) || 0;
      svcMap[k].count++;
    }

    res.json({
      summary: {
        totalRevenue:  round2(totalRevenue),
        totalJobs:     txns.length,
        avgPerJob:     txns.length ? round2(totalRevenue / txns.length) : 0,
        totalDiscount: round2(totalDiscount),
      },
      byDay: Object.values(dayMap)
        .map(d => ({ ...d, revenue: round2(d.revenue) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byService: Object.values(svcMap)
        .map(s => ({ ...s, revenue: round2(s.revenue) }))
        .sort((a, b) => b.revenue - a.revenue),
      rows: txns.map(t => ({
        _id:            t._id.toString(),
        date:           (t.serviceDate || t.createdAt).toISOString().slice(0, 10),
        serviceType:    t.serviceType || '',
        customerName:   t.customerName || '',
        vehicleDetails: t.vehicleDetails || '',
        originalPrice:  round2(t.originalPrice),
        discountLabel:  t.discountLabel || 'None',
        finalPrice:     round2(t.finalPrice),
        paymentMethod:  t.paymentMethod || '',
      })),
    });
  } catch (err) {
    console.error('[Reports] revenue:', err);
    res.status(500).json({ error: 'Failed to generate revenue report.' });
  }
});

// ── GET /api/reports/employees ────────────────────────────────────────────────
router.get('/employees', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const bid = req.businessId;
    const { start, end } = dateRange(req.query.startDate, req.query.endDate);

    const [workers, txnAgg, bookingAgg] = await Promise.all([
      Worker.find({ businessId: bid }).select('_id name role').lean(),
      Transaction.aggregate([
        { $match: { businessId: bid, serviceDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id:     '$createdBy',
            revenue: { $sum: { $toDouble: '$finalPrice' } },
            jobs:    { $sum: 1 },
          },
        },
      ]),
      Booking.aggregate([
        {
          $match: {
            businessId:      bid,
            jobStatus:       { $in: ['completed', 'quality_check', 'finished'] },
            updatedAt:       { $gte: start, $lte: end },
            assignedStaffId: { $ne: null },
          },
        },
        {
          $group: {
            _id:           '$assignedStaffId',
            bookings:      { $sum: 1 },
            totalDuration: { $sum: '$durationMinutes' },
          },
        },
      ]),
    ]);

    const rows = workers.map(w => {
      const sid  = w._id.toString();
      const txn  = txnAgg.find(t => t._id?.toString() === sid);
      const bkng = bookingAgg.find(b => b._id?.toString() === sid);
      return {
        _id:         sid,
        name:        w.name,
        role:        w.role,
        transactions: txn?.jobs       || 0,
        bookings:    bkng?.bookings   || 0,
        totalJobs:   (txn?.jobs || 0) + (bkng?.bookings || 0),
        revenue:     round2(txn?.revenue || 0),
        avgDuration: bkng?.bookings
          ? Math.round(bkng.totalDuration / bkng.bookings)
          : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    res.json(rows);
  } catch (err) {
    console.error('[Reports] employees:', err);
    res.status(500).json({ error: 'Failed to generate employee report.' });
  }
});

// ── GET /api/reports/customers ────────────────────────────────────────────────
router.get('/customers', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const bid = req.businessId;
    const { start, end } = dateRange(req.query.startDate, req.query.endDate);

    const [customers, spendAgg] = await Promise.all([
      Customer.find({ businessId: bid }).sort({ name: 1 }).lean(),
      Transaction.aggregate([
        { $match: { businessId: bid, serviceDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id:       '$customer',
            totalSpend:{ $sum: { $toDouble: '$finalPrice' } },
            visits:    { $sum: 1 },
            lastVisit: { $max: '$serviceDate' },
          },
        },
      ]),
    ]);

    const rows = customers.map(c => {
      const spend = spendAgg.find(s => s._id?.toString() === c._id.toString());
      return {
        _id:       c._id.toString(),
        code:      c.customerCode || '',
        name:      c.name,
        phone:     c.phone  || '',
        email:     c.email  || '',
        vehicle:   c.vehicleDetails,
        discount:  c.discount || 0,
        totalSpend:round2(spend?.totalSpend || 0),
        visits:    spend?.visits || 0,
        lastVisit: spend?.lastVisit?.toISOString().slice(0, 10) ?? 'Never',
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('[Reports] customers:', err);
    res.status(500).json({ error: 'Failed to generate customer report.' });
  }
});

// ── GET /api/reports/services ─────────────────────────────────────────────────
router.get('/services', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const bid = req.businessId;
    const { start, end } = dateRange(req.query.startDate, req.query.endDate);

    const agg = await Transaction.aggregate([
      { $match: { businessId: bid, serviceDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id:          '$serviceType',
          revenue:      { $sum: { $toDouble: '$finalPrice' } },
          count:        { $sum: 1 },
          totalOriginal:{ $sum: { $toDouble: '$originalPrice' } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const rows = agg.map(s => ({
      serviceType:   s._id || 'Unknown',
      count:         s.count,
      revenue:       round2(s.revenue),
      avgPrice:      round2(s.revenue / s.count),
      totalOriginal: round2(s.totalOriginal),
      discountSaved: round2(s.totalOriginal - s.revenue),
    }));

    res.json(rows);
  } catch (err) {
    console.error('[Reports] services:', err);
    res.status(500).json({ error: 'Failed to generate services report.' });
  }
});

module.exports = router;
