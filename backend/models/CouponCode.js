// models/CouponCode.js
// Admin-created discount codes redeemable at booking checkout.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CouponCodeSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },

    // e.g. "SUMMER20", "WELCOME10" — case-insensitive on lookup
    code: { type: String, required: true, trim: true, uppercase: true },

    // 'percent' deducts a % of totalPrice; 'fixed' deducts a flat TTD amount
    type:  { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },    // e.g. 20 for 20% or 10 for $10

    // Optional: restrict to minimum order value
    minOrderValue: { type: Number, default: 0 },

    // null = never expires
    expiresAt: { type: Date, default: null },

    // null = unlimited uses
    maxUses:  { type: Number, default: null },
    usedCount: { type: Number, default: 0 },

    // Track which bookings used this coupon (for admin stats)
    usedBy: [
      {
        userId:    { type: Schema.Types.ObjectId, ref: 'User' },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        usedAt:    { type: Date, default: Date.now },
      },
    ],

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Case-insensitive unique code per business
CouponCodeSchema.index({ businessId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('CouponCode', CouponCodeSchema);
