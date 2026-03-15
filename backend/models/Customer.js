//models/Customer.js
const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    customerCode: { type: String, unique: true, default: () => `CUST-${Date.now()}` },
    name: { type: String, required: true, trim: true },
    vehicleDetails: { type: String, required: true, trim: true },

    // Optional fields
    phone: { type: String, trim: true },
    email: { type: String, trim: true },

    // New fields
    discount: { type: Number, default: 0 },
    specials: { type: String, trim: true },

    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  },
  { timestamps: true }
);

// Uniqueness scoped per business
CustomerSchema.index({ businessId: 1, name: 1, vehicleDetails: 1 }, { unique: true });

module.exports = mongoose.model('Customer', CustomerSchema);
