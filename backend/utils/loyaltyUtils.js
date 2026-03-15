// utils/loyaltyUtils.js
// Shared helper called from jobs.js (and potentially transactions.js)
// after a job is marked finished to award points and fire milestone alerts.
const axios          = require('axios');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyConfig  = require('../models/LoyaltyConfig');
const User           = require('../models/Users');

// ── Default config if none exists for the business ───────────────────────────
const DEFAULTS = {
  pointsPerDollar: 1,
  redeemValue:     0.01,
  milestones: [
    { points: 100,  label: 'First Reward',   emoji: '🎉' },
    { points: 500,  label: 'Silver Member',  emoji: '🥈' },
    { points: 1000, label: 'Gold Member',    emoji: '🥇' },
  ],
};

/**
 * Award loyalty points for a completed job.
 * Creates the LoyaltyAccount if it doesn't exist yet.
 * Fires a push notification if a milestone is crossed.
 *
 * @param {ObjectId|string} userId
 * @param {ObjectId|string|null} customerId
 * @param {ObjectId|string} businessId
 * @param {number} amountSpent  — booking.totalPrice
 * @param {ObjectId|string} bookingId
 */
async function awardLoyaltyPoints(userId, customerId, businessId, amountSpent, bookingId) {
  try {
    const cfg = await LoyaltyConfig.findOne({ businessId }).lean() ?? DEFAULTS;
    if (!cfg.enabled && cfg.enabled !== undefined) return;

    const earned = Math.floor((Number(amountSpent) || 0) * (cfg.pointsPerDollar ?? 1));
    if (earned <= 0) return;

    // Upsert account
    let acct = await LoyaltyAccount.findOne({ businessId, userId });
    if (!acct) {
      acct = new LoyaltyAccount({ businessId, userId, customerId: customerId ?? null });
    }

    const prevTotal = acct.totalEarned;
    acct.points       += earned;
    acct.totalEarned  += earned;
    acct.customerId    = customerId ?? acct.customerId;

    // Refresh tier
    const { goldThreshold = 1000, silverThreshold = 500 } = cfg;
    if      (acct.totalEarned >= goldThreshold)   acct.tier = 'gold';
    else if (acct.totalEarned >= silverThreshold) acct.tier = 'silver';
    else                                          acct.tier = 'bronze';

    // Cap history at 200 entries (prune oldest)
    acct.history.push({
      type:        'earn',
      points:      earned,
      description: `Earned for completed wash`,
      bookingId:   bookingId ?? null,
    });
    if (acct.history.length > 200) {
      acct.history = acct.history.slice(acct.history.length - 200);
    }

    await acct.save();

    // Check if any milestone was just crossed
    const milestones = cfg.milestones ?? DEFAULTS.milestones;
    const crossed = milestones.filter(
      m => prevTotal < m.points && acct.totalEarned >= m.points
    );

    if (crossed.length > 0) {
      const m = crossed[crossed.length - 1]; // use highest milestone crossed
      await sendMilestoneNotification(userId, acct.points, m);
    }

  } catch (err) {
    console.warn('[LoyaltyUtils] awardPoints error:', err.message);
  }
}

/**
 * Send a push notification to the customer when a milestone is reached.
 */
async function sendMilestoneNotification(userId, currentPoints, milestone) {
  try {
    const user = await User.findById(userId).select('expoPushToken').lean();
    const token = user?.expoPushToken;
    if (!token?.startsWith('ExponentPushToken')) return;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title: `${milestone.emoji ?? '⭐'} ${milestone.label}!`,
        body:  `You've reached ${milestone.points} points — ${milestone.label}! You have ${currentPoints} pts total.`,
        data:  { type: 'loyalty_milestone', screen: '/(customer)/loyalty' },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[LoyaltyUtils] milestone push error:', err.message);
  }
}

module.exports = { awardLoyaltyPoints, sendMilestoneNotification };
