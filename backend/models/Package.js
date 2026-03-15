// models/Package.js
// A Package is a named bundle of Services with an optional override price.
// If price is omitted (null), the customer browse screen sums the individual service prices.
const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    // Explicit bundle price — null means "sum of included services"
    price:       { type: Number, default: null, min: 0 },
    serviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PackageSchema.index({ businessId: 1, active: 1 });

module.exports = mongoose.model('Package', PackageSchema);
