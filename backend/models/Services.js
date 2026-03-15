// models/Services.js
const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name:        { type: String, required: true, trim: true },
    price:       { type: Number, required: true, min: 0 },
    duration:    { type: Number, required: true, default: 30, min: 1 }, // minutes
    category:    { type: String, trim: true, default: 'General' },
    description: { type: String, trim: true, default: '' },
    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

ServiceSchema.index({ businessId: 1, active: 1 });

module.exports = mongoose.model('Service', ServiceSchema);
