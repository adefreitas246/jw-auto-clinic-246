// models/LoyaltyAccount.js
// Tracks a customer's spendable points balance, lifetime earnings, and tier.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const HistoryEntrySchema = new Schema(
  {
    type:        { type: String, enum: ['earn', 'redeem', 'expire', 'bonus'], required: true },
    points:      { type: Number, required: true },
    description: { type: String, default: '' },
    bookingId:   { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const LoyaltyAccountSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId:     { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },

    // Current redeemable balance (decremented on redemption)
    points:        { type: Number, default: 0, min: 0 },
    // Lifetime total earned (used for tier calculation — never decremented)
    totalEarned:   { type: Number, default: 0 },
    totalRedeemed: { type: Number, default: 0 },

    tier: {
      type:    String,
      enum:    ['bronze', 'silver', 'gold'],
      default: 'bronze',
    },

    // Capped at 200 entries; oldest pruned server-side
    history: { type: [HistoryEntrySchema], default: [] },
  },
  { timestamps: true }
);

// One account per user per business
LoyaltyAccountSchema.index({ businessId: 1, userId: 1 }, { unique: true });

// Compute tier from totalEarned
LoyaltyAccountSchema.methods.refreshTier = function () {
  if (this.totalEarned >= 1000)      this.tier = 'gold';
  else if (this.totalEarned >= 500)  this.tier = 'silver';
  else                               this.tier = 'bronze';
};

module.exports = mongoose.model('LoyaltyAccount', LoyaltyAccountSchema);
