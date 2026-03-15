// models/Vehicle.js
const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true,
  },
  make:         { type: String, required: true, trim: true },
  model:        { type: String, required: true, trim: true },
  licensePlate: { type: String, trim: true, uppercase: true, default: '' },
  color:        { type: String, trim: true, default: '' },
  size: {
    type: String,
    enum: ['Sedan', 'SUV', 'Truck', 'Van', 'Other'],
    default: 'Sedan',
  },
  notes:         { type: String, trim: true, default: '' },
  platePhotoUrl: { type: String, default: '' },
}, { timestamps: true });

// Compound index for fast per-customer queries
VehicleSchema.index({ userId: 1, businessId: 1 });

module.exports = mongoose.model('Vehicle', VehicleSchema);
