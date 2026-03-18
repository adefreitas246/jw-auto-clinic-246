// models/WashBay.js
const mongoose = require('mongoose');

const washBaySchema = new mongoose.Schema({
  businessId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name:        { type: String, required: true },            // e.g. "Bay 1"
  bayType:     { type: String, enum: ['interior', 'exterior', 'full', 'detail'], default: 'full' },
  active:      { type: Boolean, default: true },
  currentJob:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
}, { timestamps: true });

washBaySchema.index({ businessId: 1 });
module.exports = mongoose.model('WashBay', washBaySchema);
