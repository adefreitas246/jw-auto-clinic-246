// models/SubscriptionPlan.js
// Admin-created recurring service plans (Basic / Unlimited / Premium).
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionPlanSchema = new Schema(
  {
    businessId:  { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name:        { type: String, required: true, trim: true },       // "Basic" | "Unlimited" | "Premium"
    description: { type: String, default: '', trim: true },
    price:       { type: Number, required: true, min: 0 },
    currency:    { type: String, default: 'TTD' },
    interval:    { type: String, enum: ['monthly'], default: 'monthly' },

    // null means unlimited washes per interval
    jobQuota:    { type: Number, default: null },

    // Feature bullet points shown on the plan card
    features:    [{ type: String, trim: true }],

    // Display order (lower = shown first)
    sortOrder:   { type: Number, default: 0 },

    // Highlighted as "Most Popular"
    highlighted: { type: Boolean, default: false },

    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ businessId: 1, active: 1 });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
