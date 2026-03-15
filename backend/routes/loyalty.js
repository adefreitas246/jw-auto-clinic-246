// routes/loyalty.js
// Customer loyalty programme endpoints.
//
//   GET  /api/loyalty/me          — customer's own account + config
//   GET  /api/loyalty/config      — active config (admin or customer)
//   POST /api/loyalty/config      — create/update config (admin)
//   POST /api/loyalty/redeem      — redeem points for a discount (customer)
//   GET  /api/loyalty/leaderboard — top-10 earners in the business (admin)
//   GET  /api/loyalty/accounts    — all accounts paginated (admin)
const express       = require('express');
const router        = express.Router();
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyConfig  = require('../models/LoyaltyConfig');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

const DEFAULTS = {
  pointsPerDollar: 1,
  redeemValue:     0.01,
  minRedeem:       50,
  silverThreshold: 500,
  goldThreshold:   1000,
  milestones: [
    { points: 100,  label: 'First Reward',  emoji: '🎉' },
    { points: 500,  label: 'Silver Member', emoji: '🥈' },
    { points: 1000, label: 'Gold Member',   emoji: '🥇' },
  ],
  enabled: true,
};

// ── GET /api/loyalty/me ───────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const cfg  = await LoyaltyConfig.findOne({ businessId: req.businessId }).lean() ?? DEFAULTS;
    let   acct = await LoyaltyAccount.findOne({ businessId: req.businessId, userId: req.user.id }).lean();

    if (!acct) {
      acct = {
        points: 0, totalEarned: 0, totalRedeemed: 0,
        tier: 'bronze', history: [],
      };
    }

    // Compute progress to next milestone
    const milestones   = cfg.milestones ?? DEFAULTS.milestones;
    const sortedM      = [...milestones].sort((a, b) => a.points - b.points);
    const nextMilestone = sortedM.find(m => m.points > acct.totalEarned) ?? null;
    const prevMilestone = [...sortedM].reverse().find(m => m.points <= acct.totalEarned) ?? null;

    const progress = nextMilestone
      ? (acct.totalEarned - (prevMilestone?.points ?? 0)) /
        (nextMilestone.points   - (prevMilestone?.points ?? 0))
      : 1;

    res.json({
      account: acct,
      config:  cfg,
      nextMilestone,
      progress: Math.min(1, Math.max(0, progress)),
      redeemValueCents: Math.floor((acct.points) * ((cfg.redeemValue ?? 0.01) * 100)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch loyalty account.' });
  }
});

// ── GET /api/loyalty/config ───────────────────────────────────────────────────
router.get('/config', protect, async (req, res) => {
  try {
    const cfg = await LoyaltyConfig.findOne({ businessId: req.businessId }).lean() ?? DEFAULTS;
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config.' });
  }
});

// ── POST /api/loyalty/config ──────────────────────────────────────────────────
router.post('/config', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const {
      pointsPerDollar, redeemValue, minRedeem,
      silverThreshold, goldThreshold, milestones, enabled,
    } = req.body;

    const update = {};
    if (pointsPerDollar !== undefined) update.pointsPerDollar = Number(pointsPerDollar);
    if (redeemValue      !== undefined) update.redeemValue     = Number(redeemValue);
    if (minRedeem        !== undefined) update.minRedeem        = Number(minRedeem);
    if (silverThreshold  !== undefined) update.silverThreshold  = Number(silverThreshold);
    if (goldThreshold    !== undefined) update.goldThreshold    = Number(goldThreshold);
    if (enabled          !== undefined) update.enabled          = Boolean(enabled);
    if (Array.isArray(milestones))      update.milestones       = milestones;

    const cfg = await LoyaltyConfig.findOneAndUpdate(
      { businessId: req.businessId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save config.' });
  }
});

// ── POST /api/loyalty/redeem ──────────────────────────────────────────────────
// Body: { points: number, bookingId?: string }
// Returns: { discountAmount, remainingPoints }
router.post('/redeem', protect, async (req, res) => {
  try {
    const { points, bookingId } = req.body;
    const toRedeem = Math.floor(Number(points) || 0);
    if (toRedeem <= 0) return res.status(400).json({ error: 'points must be > 0.' });

    const cfg = await LoyaltyConfig.findOne({ businessId: req.businessId }).lean() ?? DEFAULTS;
    if (!cfg.enabled && cfg.enabled !== undefined) {
      return res.status(400).json({ error: 'Loyalty programme is disabled.' });
    }

    const minRedeem = cfg.minRedeem ?? 50;
    if (toRedeem < minRedeem) {
      return res.status(400).json({ error: `Minimum redemption is ${minRedeem} points.` });
    }

    const acct = await LoyaltyAccount.findOne({ businessId: req.businessId, userId: req.user.id });
    if (!acct) return res.status(404).json({ error: 'No loyalty account found.' });
    if (acct.points < toRedeem) {
      return res.status(400).json({ error: `Insufficient points. You have ${acct.points}.` });
    }

    const discountAmount = toRedeem * (cfg.redeemValue ?? 0.01);
    acct.points        -= toRedeem;
    acct.totalRedeemed += toRedeem;
    acct.history.push({
      type:        'redeem',
      points:      toRedeem,
      description: `Redeemed for $${discountAmount.toFixed(2)} discount`,
      bookingId:   bookingId ?? null,
    });
    if (acct.history.length > 200) acct.history = acct.history.slice(acct.history.length - 200);

    await acct.save();
    res.json({ discountAmount, remainingPoints: acct.points });
  } catch (err) {
    res.status(500).json({ error: 'Failed to redeem points.' });
  }
});

// ── GET /api/loyalty/leaderboard ─────────────────────────────────────────────
router.get('/leaderboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const top = await LoyaltyAccount
      .find({ businessId: req.businessId })
      .sort({ totalEarned: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .lean();

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// ── GET /api/loyalty/accounts ─────────────────────────────────────────────────
router.get('/accounts', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
      LoyaltyAccount.find({ businessId: req.businessId })
        .sort({ totalEarned: -1 })
        .skip(skip).limit(limit)
        .populate('userId', 'name email')
        .lean(),
      LoyaltyAccount.countDocuments({ businessId: req.businessId }),
    ]);

    res.json({ accounts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
});

module.exports = router;
