// models/CustomerSubscription.js
// A customer's active subscription to a plan.
// "Recurring" billing is handled manually via WiPay/BIMPay (no native subscriptions).
// Renewal reminders fire 3 days before renewalDate.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomerSubscriptionSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business',         required: true, index: true },
    userId:     { type: Schema.Types.ObjectId, ref: 'User',             required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer',         default: null },
    planId:     { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },

    status: {
      type:    String,
      enum:    ['active', 'paused', 'cancelled', 'expired'],
      default: 'active',
      index:   true,
    },

    startDate:   { type: Date, required: true },
    renewalDate: { type: Date, required: true },

    // How many quota jobs have been used in this billing cycle
    usedJobs: { type: Number, default: 0 },

    paymentMethod:    { type: String, enum: ['wipay', 'bimpay', 'cash'], default: 'wipay' },
    paymentReference: { type: String, default: '' },

    // Tracks whether the 3-day renewal reminder was sent for the current cycle
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Enforce one active subscription per user per business
CustomerSubscriptionSchema.index({ businessId: 1, userId: 1 });

module.exports = mongoose.model('CustomerSubscription', CustomerSubscriptionSchema);
