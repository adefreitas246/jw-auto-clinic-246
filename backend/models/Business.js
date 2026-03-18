// models/Business.js
const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  label:   { type: String, trim: true },
  address: { type: String, trim: true },
  lat:     { type: Number },
  lng:     { type: Number },
  phone:   { type: String, trim: true },
}, { _id: false });

const BusinessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // URL-safe identifier used in subdomain routing (e.g. "jw-auto-clinic")
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  logo: { type: String },   // CDN URL or base64 data URI

  locations: [LocationSchema],

  settings: {
    currency:        { type: String, default: 'TTD' },
    timezone:        { type: String, default: 'America/Port_of_Spain' },
    // Enabled payment gateways for this tenant
    paymentGateways: { type: [String], default: ['cash'] },  // 'wipay' | 'bimpay' | 'cash'
    primaryColor:    { type: String, default: '#6a0dad' },
  },

  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'pro'],
    default: 'trial',
  },

  // Expo push tokens registered by admin/staff devices for this business
  pushTokens: [{ type: String }],

  active: { type: Boolean, default: true },
}, { timestamps: true });

// slug already has a unique index declared inline above

module.exports = mongoose.model('Business', BusinessSchema);
