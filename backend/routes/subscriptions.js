// routes/subscriptions.js
// Subscription plan management + customer subscription endpoints.
//
// Admin plan management:
//   GET    /api/subscriptions/plans         — list active plans
//   POST   /api/subscriptions/plans         — create plan (admin)
//   PATCH  /api/subscriptions/plans/:id     — update plan (admin)
//   DELETE /api/subscriptions/plans/:id     — soft-delete (admin)
//
// Customer subscriptions:
//   GET  /api/subscriptions/my              — customer's active subscription
//   POST /api/subscriptions/subscribe       — subscribe to a plan
//   POST /api/subscriptions/renew           — renew / reactivate
//   POST /api/subscriptions/cancel          — cancel current subscription
//
// Cron trigger (admin / internal):
//   POST /api/subscriptions/send-reminders  — fire 3-day renewal push to all due subs
const express              = require('express');
const router               = express.Router();
const axios                = require('axios');
const SubscriptionPlan     = require('../models/SubscriptionPlan');
const CustomerSubscription = require('../models/CustomerSubscription');
const User                 = require('../models/Users');
const authMiddleware       = require('../middleware/authMiddleware');
const resolveBusiness      = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─── helpers ─────────────────────────────────────────────────────────────────

async function sendRenewalPush(userId, planName, renewalDate) {
  try {
    const user  = await User.findById(userId).select('expoPushToken').lean();
    const token = user?.expoPushToken;
    if (!token?.startsWith('ExponentPushToken')) return;

    const dateStr = new Date(renewalDate).toLocaleDateString('en-TT', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title: '🔄 Subscription Renewal Reminder',
        body:  `Your "${planName}" plan renews on ${dateStr}. Tap to renew early.`,
        data:  { type: 'subscription_renewal', screen: '/(customer)/subscriptions' },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Subscriptions] renewal push error:', err.message);
  }
}

// ─── Admin: plan CRUD ─────────────────────────────────────────────────────────

router.get('/plans', protect, async (req, res) => {
  try {
    const plans = await SubscriptionPlan
      .find({ businessId: req.businessId, active: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans.' });
  }
});

router.post('/plans', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const { name, description, price, currency, jobQuota, features, sortOrder, highlighted } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'name and price are required.' });

    const plan = await SubscriptionPlan.create({
      businessId: req.businessId,
      name, description, price,
      currency:    currency    ?? 'TTD',
      jobQuota:    jobQuota    ?? null,
      features:    features    ?? [],
      sortOrder:   sortOrder   ?? 0,
      highlighted: highlighted ?? false,
    });
    res.status(201).json(plan);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A plan with this name already exists.' });
    res.status(500).json({ error: 'Failed to create plan.' });
  }
});

router.patch('/plans/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const allowed = ['name','description','price','currency','jobQuota','features','sortOrder','highlighted','active'];
    const update  = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    const plan = await SubscriptionPlan.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan.' });
  }
});

router.delete('/plans/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const plan = await SubscriptionPlan.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { active: false },
      { new: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    res.json({ message: 'Plan deactivated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete plan.' });
  }
});

// ─── Customer: subscription endpoints ────────────────────────────────────────

// GET /api/subscriptions/my
router.get('/my', protect, async (req, res) => {
  try {
    const sub = await CustomerSubscription
      .findOne({ businessId: req.businessId, userId: req.user.id, status: { $in: ['active', 'paused'] } })
      .populate('planId')
      .lean();
    res.json(sub ?? null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
});

// POST /api/subscriptions/subscribe
// Body: { planId, paymentMethod?, paymentReference? }
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { planId, paymentMethod, paymentReference, customerId } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId is required.' });

    const plan = await SubscriptionPlan.findOne({ _id: planId, businessId: req.businessId, active: true }).lean();
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    // Cancel any existing active/paused subscription first
    await CustomerSubscription.updateMany(
      { businessId: req.businessId, userId: req.user.id, status: { $in: ['active', 'paused'] } },
      { status: 'cancelled' }
    );

    const now         = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const sub = await CustomerSubscription.create({
      businessId:       req.businessId,
      userId:           req.user.id,
      customerId:       customerId ?? null,
      planId:           plan._id,
      status:           'active',
      startDate:        now,
      renewalDate,
      usedJobs:         0,
      paymentMethod:    paymentMethod    ?? 'wipay',
      paymentReference: paymentReference ?? '',
      reminderSent:     false,
    });

    res.status(201).json(await sub.populate('planId'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// POST /api/subscriptions/renew
// Resets renewalDate +1 month and resets usedJobs/reminderSent.
router.post('/renew', protect, async (req, res) => {
  try {
    const { paymentReference } = req.body;

    const sub = await CustomerSubscription.findOne({
      businessId: req.businessId,
      userId:     req.user.id,
      status:     { $in: ['active', 'paused', 'expired'] },
    });
    if (!sub) return res.status(404).json({ error: 'No subscription found.' });

    const now         = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    sub.status           = 'active';
    sub.renewalDate      = renewalDate;
    sub.usedJobs         = 0;
    sub.reminderSent     = false;
    if (paymentReference) sub.paymentReference = paymentReference;
    await sub.save();

    res.json(await sub.populate('planId'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to renew subscription.' });
  }
});

// POST /api/subscriptions/cancel
router.post('/cancel', protect, async (req, res) => {
  try {
    const sub = await CustomerSubscription.findOneAndUpdate(
      { businessId: req.businessId, userId: req.user.id, status: { $in: ['active', 'paused'] } },
      { status: 'cancelled' },
      { new: true }
    );
    if (!sub) return res.status(404).json({ error: 'No active subscription to cancel.' });
    res.json({ message: 'Subscription cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
});

// ─── POST /api/subscriptions/send-reminders (cron trigger) ───────────────────
// Called by a cron job daily. Sends push to users whose renewalDate is ≤3 days away.
router.post('/send-reminders', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const now     = new Date();
    const cutoff  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const subs = await CustomerSubscription
      .find({
        businessId:   req.businessId,
        status:       'active',
        renewalDate:  { $lte: cutoff },
        reminderSent: false,
      })
      .populate('planId', 'name')
      .lean();

    let sent = 0;
    for (const sub of subs) {
      await sendRenewalPush(sub.userId, sub.planId?.name ?? 'your plan', sub.renewalDate);
      await CustomerSubscription.findByIdAndUpdate(sub._id, { reminderSent: true });
      sent++;
    }

    res.json({ sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reminders.' });
  }
});

module.exports = router;
