// models/PushCampaign.js
// Scheduled or immediate broadcast push notification campaigns.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PushCampaignSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    createdBy:  { type: Schema.Types.ObjectId, ref: 'User',     required: true },

    title:   { type: String, required: true, trim: true, maxlength: 100 },
    body:    { type: String, required: true, trim: true, maxlength: 500 },
    // Optional deep-link screen to open on tap
    screen:  { type: String, default: '' },

    // Who to target
    audience: {
      type: String,
      enum: ['all_customers', 'loyalty_members', 'subscribers', 'inactive_30d'],
      required: true,
    },

    // null = send immediately; future date = scheduled
    scheduledAt: { type: Date, default: null },

    // Lifecycle: draft → queued → sending → sent | failed
    status: {
      type:    String,
      enum:    ['draft', 'queued', 'sending', 'sent', 'failed'],
      default: 'draft',
      index:   true,
    },

    // Delivery report
    sentCount:    { type: Number, default: 0 },
    failedCount:  { type: Number, default: 0 },
    sentAt:       { type: Date, default: null },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

PushCampaignSchema.index({ businessId: 1, status: 1 });
PushCampaignSchema.index({ status: 1, scheduledAt: 1 }); // for cron: find due queued campaigns

module.exports = mongoose.model('PushCampaign', PushCampaignSchema);
