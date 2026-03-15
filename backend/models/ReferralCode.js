// models/ReferralCode.js
// One referral code per customer per business.
// Referrer earns loyalty points when a referee completes their first booking.
// Referee gets a one-time discount coupon applied to their first booking.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReferralCodeSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId:     { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },

    // e.g. "REF-JOH-4K2P"
    code: { type: String, required: true, uppercase: true, trim: true },

    // Points the referrer earns per successful referral
    pointsPerReferral: { type: Number, default: 50 },
    // Discount value given to the referee on their first booking
    refereeDiscountType:  { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    refereeDiscountValue: { type: Number, default: 10 }, // e.g. 10%

    // Track completed referrals
    referrals: [
      {
        refereeUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        bookingId:     { type: Schema.Types.ObjectId, ref: 'Booking' },
        pointsAwarded: { type: Number, default: 0 },
        completedAt:   { type: Date, default: Date.now },
      },
    ],

    totalReferrals:    { type: Number, default: 0 },
    totalPointsEarned: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One code per user per business
ReferralCodeSchema.index({ businessId: 1, userId: 1 }, { unique: true });
// Lookup by code (global scan must also filter by businessId)
ReferralCodeSchema.index({ code: 1 });

module.exports = mongoose.model('ReferralCode', ReferralCodeSchema);
