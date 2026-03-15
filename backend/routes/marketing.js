// routes/marketing.js
// Marketing tools: broadcast push campaigns, coupon codes, referrals, SMS scaffold.
//
// Push campaigns:
//   GET    /api/marketing/campaigns                    — list (admin)
//   POST   /api/marketing/campaigns                    — create campaign (admin)
//   PATCH  /api/marketing/campaigns/:id                — update draft (admin)
//   DELETE /api/marketing/campaigns/:id                — delete draft (admin)
//   POST   /api/marketing/campaigns/:id/send           — send now or queue (admin)
//   GET    /api/marketing/campaigns/:id/report         — delivery report (admin)
//   POST   /api/marketing/campaigns/process-scheduled  — cron trigger: fire due campaigns
//
// Coupons:
//   GET    /api/marketing/coupons                      — list (admin)
//   POST   /api/marketing/coupons                      — create (admin)
//   PATCH  /api/marketing/coupons/:id                  — update (admin)
//   DELETE /api/marketing/coupons/:id                  — deactivate (admin)
//   POST   /api/marketing/coupons/validate             — validate code (customer)
//
// Referrals:
//   GET    /api/marketing/referral/my                  — get/create my referral code (customer)
//   GET    /api/marketing/referral/stats               — all referral stats (admin)
//
// SMS:
//   POST   /api/marketing/sms/send-reminders           — cron: 24h appointment reminders
const express        = require('express');
const router         = express.Router();
const axios          = require('axios');

const PushCampaign    = require('../models/PushCampaign');
const CouponCode      = require('../models/CouponCode');
const ReferralCode    = require('../models/ReferralCode');
const LoyaltyAccount  = require('../models/LoyaltyAccount');
const CustomerSubscription = require('../models/CustomerSubscription');
const Booking         = require('../models/Booking');
const User            = require('../models/Users');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─── Expo Push API batch helper ───────────────────────────────────────────────
const PUSH_BATCH = 100; // Expo limit per request

async function sendPushBatch(tokens, title, body, data = {}) {
  let sent = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += PUSH_BATCH) {
    const batch = tokens.slice(i, i + PUSH_BATCH);
    const messages = batch.map(to => ({ to, title, body, data, sound: 'default' }));
    try {
      const res = await axios.post(
        'https://exp.host/--/api/v2/push/send',
        messages,
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );
      // Expo returns { data: [{ status, id?, message? }] }
      const results = Array.isArray(res.data?.data) ? res.data.data : [];
      for (const r of results) {
        if (r.status === 'ok') sent++;
        else failed++;
      }
    } catch {
      failed += batch.length;
    }
  }
  return { sent, failed };
}

// ─── Audience resolver ────────────────────────────────────────────────────────
async function resolveTokens(businessId, audience) {
  let userIds = [];

  if (audience === 'all_customers') {
    const users = await User.find({ role: 'customer', businessId }).select('_id').lean();
    userIds = users.map(u => u._id);
  } else if (audience === 'loyalty_members') {
    const accts = await LoyaltyAccount.find({ businessId }).select('userId').lean();
    userIds = accts.map(a => a.userId);
  } else if (audience === 'subscribers') {
    const subs = await CustomerSubscription.find({ businessId, status: 'active' }).select('userId').lean();
    userIds = subs.map(s => s.userId);
  } else if (audience === 'inactive_30d') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    // Find customers who have bookings BUT none in last 30 days
    const recentBookers = await Booking.distinct('userId', {
      businessId,
      status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: cutoff },
    });
    const allBookers = await Booking.distinct('userId', { businessId });
    const inactiveIds = allBookers.filter(
      id => !recentBookers.some(r => r.toString() === id.toString())
    );
    userIds = inactiveIds;
  }

  if (userIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: userIds },
    expoPushToken: { $regex: /^ExponentPushToken/ },
  }).select('expoPushToken').lean();

  return users.map(u => u.expoPushToken).filter(Boolean);
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

router.get('/campaigns', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const campaigns = await PushCampaign
      .find({ businessId: req.businessId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name')
      .lean();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
});

router.post('/campaigns', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { title, body, audience, scheduledAt, screen } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required.' });
    if (!body?.trim())  return res.status(400).json({ error: 'body is required.' });
    if (!audience)      return res.status(400).json({ error: 'audience is required.' });

    const campaign = await PushCampaign.create({
      businessId:  req.businessId,
      createdBy:   req.user.id,
      title:       title.trim(),
      body:        body.trim(),
      audience,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      screen:      screen ?? '',
      status:      'draft',
    });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
});

router.patch('/campaigns/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const allowed = ['title', 'body', 'audience', 'scheduledAt', 'screen'];
    const update  = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];

    const campaign = await PushCampaign.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId, status: 'draft' },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Draft campaign not found.' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update campaign.' });
  }
});

router.delete('/campaigns/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const campaign = await PushCampaign.findOneAndDelete(
      { _id: req.params.id, businessId: req.businessId, status: 'draft' }
    );
    if (!campaign) return res.status(404).json({ error: 'Draft campaign not found.' });
    res.json({ message: 'Campaign deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete campaign.' });
  }
});

// POST /campaigns/:id/send — send immediately or queue for scheduledAt
router.post('/campaigns/:id/send', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const campaign = await PushCampaign.findOne({
      _id: req.params.id, businessId: req.businessId,
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status === 'sent') return res.status(409).json({ error: 'Campaign already sent.' });
    if (campaign.status === 'sending') return res.status(409).json({ error: 'Campaign is already sending.' });

    // If scheduled for the future, just mark as queued
    if (campaign.scheduledAt && campaign.scheduledAt > new Date()) {
      campaign.status = 'queued';
      await campaign.save();
      return res.json({ queued: true, scheduledAt: campaign.scheduledAt });
    }

    // Send now
    campaign.status = 'sending';
    await campaign.save();

    // Resolve tokens async — don't block response
    const tokens = await resolveTokens(req.businessId, campaign.audience);
    const { sent, failed } = await sendPushBatch(
      tokens,
      campaign.title,
      campaign.body,
      { type: 'campaign', screen: campaign.screen || '/(customer)/home' }
    );

    campaign.status      = 'sent';
    campaign.sentCount   = sent;
    campaign.failedCount = failed;
    campaign.sentAt      = new Date();
    await campaign.save();

    res.json({ sent, failed, total: tokens.length });
  } catch (err) {
    await PushCampaign.findByIdAndUpdate(req.params.id, { status: 'failed', errorMessage: err.message });
    res.status(500).json({ error: 'Failed to send campaign.' });
  }
});

// GET /campaigns/:id/report
router.get('/campaigns/:id/report', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const campaign = await PushCampaign.findOne({ _id: req.params.id, businessId: req.businessId }).lean();
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

    // Estimate audience size for preview (even for unsent campaigns)
    const audienceSize = (await resolveTokens(req.businessId, campaign.audience)).length;
    res.json({ ...campaign, audienceSize });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report.' });
  }
});

// POST /campaigns/process-scheduled — cron trigger, called by external cron or task manager
router.post('/campaigns/process-scheduled', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const now      = new Date();
    const due      = await PushCampaign.find({
      businessId:  req.businessId,
      status:      'queued',
      scheduledAt: { $lte: now },
    });

    let processed = 0;
    for (const campaign of due) {
      try {
        campaign.status = 'sending';
        await campaign.save();
        const tokens = await resolveTokens(campaign.businessId, campaign.audience);
        const { sent, failed } = await sendPushBatch(tokens, campaign.title, campaign.body, {
          type: 'campaign', screen: campaign.screen || '/(customer)/home',
        });
        campaign.status      = 'sent';
        campaign.sentCount   = sent;
        campaign.failedCount = failed;
        campaign.sentAt      = new Date();
        await campaign.save();
        processed++;
      } catch (e) {
        campaign.status       = 'failed';
        campaign.errorMessage = e.message;
        await campaign.save();
      }
    }

    res.json({ processed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process scheduled campaigns.' });
  }
});

// ─── Coupons ──────────────────────────────────────────────────────────────────

router.get('/coupons', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const coupons = await CouponCode
      .find({ businessId: req.businessId })
      .sort({ createdAt: -1 })
      .lean();
    // Strip usedBy details for list view (privacy + perf)
    res.json(coupons.map(c => ({ ...c, usedBy: undefined, usedCount: c.usedCount })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupons.' });
  }
});

router.post('/coupons', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { code, type, value, minOrderValue, expiresAt, maxUses } = req.body;
    if (!code?.trim())           return res.status(400).json({ error: 'code is required.' });
    if (!['percent','fixed'].includes(type)) return res.status(400).json({ error: 'type must be percent or fixed.' });
    if (value == null || value < 0) return res.status(400).json({ error: 'value must be >= 0.' });

    const coupon = await CouponCode.create({
      businessId:    req.businessId,
      code:          code.trim().toUpperCase(),
      type,
      value:         Number(value),
      minOrderValue: Number(minOrderValue) || 0,
      expiresAt:     expiresAt ? new Date(expiresAt) : null,
      maxUses:       maxUses   ? Number(maxUses)     : null,
    });
    res.status(201).json(coupon);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A coupon with this code already exists.' });
    res.status(500).json({ error: 'Failed to create coupon.' });
  }
});

router.patch('/coupons/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const allowed = ['value', 'minOrderValue', 'expiresAt', 'maxUses', 'active'];
    const update  = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];

    const coupon = await CouponCode.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $set: update },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update coupon.' });
  }
});

router.delete('/coupons/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const coupon = await CouponCode.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { active: false },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
    res.json({ message: 'Coupon deactivated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate coupon.' });
  }
});

// POST /coupons/validate — customer validates a code before submit
// Body: { code, orderValue }
// Returns: { valid, discountAmount, type, value, message? }
router.post('/coupons/validate', protect, async (req, res) => {
  try {
    const { code, orderValue } = req.body;
    if (!code) return res.status(400).json({ error: 'code is required.' });

    const coupon = await CouponCode.findOne({
      businessId: req.businessId,
      code:       code.trim().toUpperCase(),
      active:     true,
    });

    if (!coupon) return res.json({ valid: false, message: 'Invalid or expired coupon code.' });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.json({ valid: false, message: 'This coupon has expired.' });
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return res.json({ valid: false, message: 'This coupon has reached its usage limit.' });
    }
    if (coupon.minOrderValue > 0 && Number(orderValue) < coupon.minOrderValue) {
      return res.json({
        valid: false,
        message: `Minimum order value of $${coupon.minOrderValue.toFixed(2)} required.`,
      });
    }

    const order = Number(orderValue) || 0;
    const discountAmount = coupon.type === 'percent'
      ? Math.min(order, (order * coupon.value) / 100)
      : Math.min(order, coupon.value);

    res.json({
      valid: true,
      couponId:       coupon._id,
      type:           coupon.type,
      value:          coupon.value,
      discountAmount: Math.round(discountAmount * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate coupon.' });
  }
});

// ─── Referrals ────────────────────────────────────────────────────────────────

function generateRefCode(name) {
  const prefix = (name || 'USR').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3);
  const rand   = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${prefix}-${rand}`;
}

// GET /referral/my — get (or auto-create) the customer's referral code
router.get('/referral/my', protect, async (req, res) => {
  try {
    let ref = await ReferralCode.findOne({ businessId: req.businessId, userId: req.user.id });
    if (!ref) {
      const user = await User.findById(req.user.id).select('name').lean();
      // Generate a unique code (retry on collision)
      let code, attempts = 0;
      do {
        code = generateRefCode(user?.name ?? '');
        attempts++;
      } while (
        attempts < 5 &&
        await ReferralCode.exists({ code, businessId: req.businessId })
      );

      ref = await ReferralCode.create({
        businessId: req.businessId,
        userId:     req.user.id,
        code,
      });
    }
    res.json(ref);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referral code.' });
  }
});

// GET /referral/stats — admin: all referral codes + stats
router.get('/referral/stats', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const refs = await ReferralCode
      .find({ businessId: req.businessId })
      .sort({ totalReferrals: -1 })
      .populate('userId', 'name email')
      .lean();
    res.json(refs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referral stats.' });
  }
});

// ─── SMS Reminders ────────────────────────────────────────────────────────────
// Scaffold — wire up Twilio (or a local provider) by filling in the TODOs below.
//
// POST /sms/send-reminders — triggered by daily cron job
// Finds bookings with appointmentDate tomorrow that haven't received a reminder.
router.post('/sms/send-reminders', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    // ── Tomorrow's date ───────────────────────────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    const bookings = await Booking.find({
      businessId:       req.businessId,
      appointmentDate:  tomorrowISO,
      status:           'confirmed',
      reminderScheduled: false,
    }).populate('userId', 'name phone').lean();

    let sent = 0;
    const errors = [];

    for (const booking of bookings) {
      const phone = booking.userId?.phone;
      if (!phone) continue;

      const message =
        `Hi ${booking.userId?.name ?? 'there'}! Your ${booking.serviceLabel} wash is tomorrow at ` +
        `${booking.appointmentTime}. See you at Wash Hub!`;

      try {
        // ── TODO: Replace this block with your SMS provider ───────────────────
        // Option A — Twilio:
        //   const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        //   await twilio.messages.create({
        //     body: message,
        //     from: process.env.TWILIO_FROM_NUMBER,  // e.g. '+18685551234'
        //     to:   phone,                           // customer's phone
        //   });
        //
        // Option B — Digicel/Flow Barbados SMS gateway (HTTP API):
        //   await axios.post(process.env.SMS_GATEWAY_URL, {
        //     apiKey:  process.env.SMS_API_KEY,
        //     from:    process.env.SMS_SENDER_ID,
        //     to:      phone,
        //     message,
        //   });
        //
        // ── END TODO ─────────────────────────────────────────────────────────
        console.log(`[SMS SCAFFOLD] Would send to ${phone}: ${message}`);
        // ─────────────────────────────────────────────────────────────────────

        // Mark as reminded so we don't resend
        await Booking.findByIdAndUpdate(booking._id, { reminderScheduled: true });
        sent++;
      } catch (smsErr) {
        errors.push({ bookingId: booking._id, phone, error: smsErr.message });
      }
    }

    res.json({ sent, errors, total: bookings.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process SMS reminders.' });
  }
});

module.exports = router;
