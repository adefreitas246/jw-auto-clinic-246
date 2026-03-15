// models/LoyaltyConfig.js
// Per-business loyalty programme configuration.
// If no document exists, defaults are applied at the route layer.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const MilestoneSchema = new Schema(
  {
    points:  { type: Number, required: true },   // e.g. 100
    label:   { type: String, required: true },   // "First Reward!"
    reward:  { type: String, default: '' },       // internal code e.g. 'free_basic_wash'
    emoji:   { type: String, default: '🎉' },
  },
  { _id: true }
);

const LoyaltyConfigSchema = new Schema(
  {
    businessId: {
      type:     Schema.Types.ObjectId,
      ref:      'Business',
      required: true,
      unique:   true,
    },

    // Points earned per dollar spent (default: 1 pt / $1)
    pointsPerDollar: { type: Number, default: 1,    min: 0 },
    // Dollar value of one point when redeeming (default: $0.01)
    redeemValue:     { type: Number, default: 0.01, min: 0 },
    // Minimum points needed to redeem in one transaction
    minRedeem:       { type: Number, default: 50,   min: 1 },

    // Tier thresholds (lifetime points earned)
    silverThreshold: { type: Number, default: 500  },
    goldThreshold:   { type: Number, default: 1000 },

    milestones: { type: [MilestoneSchema], default: () => [
      { points: 100,  label: 'First Reward',   reward: '', emoji: '🎉' },
      { points: 500,  label: 'Silver Member',  reward: '', emoji: '🥈' },
      { points: 1000, label: 'Gold Member',    reward: '', emoji: '🥇' },
    ]},

    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyConfig', LoyaltyConfigSchema);
