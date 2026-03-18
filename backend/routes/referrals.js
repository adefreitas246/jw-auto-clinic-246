// routes/referrals.js
const express = require('express');
const router  = express.Router();
const ReferralCode    = require('../models/ReferralCode');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const protect = [authMiddleware, resolveBusiness];

// GET /api/referrals/my — get current user's referral code
router.get('/my', ...protect, async (req, res) => {
  try {
    let ref = await ReferralCode.findOne({ businessId: req.business._id, userId: req.user.id });
    if (!ref) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      ref = await ReferralCode.create({ businessId: req.business._id, userId: req.user.id, code });
    }
    res.json(ref);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/referrals — list all referral codes (admin)
router.get('/', ...protect, async (req, res) => {
  try {
    const refs = await ReferralCode.find({ businessId: req.business._id }).sort({ totalReferrals: -1 });
    res.json(refs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
