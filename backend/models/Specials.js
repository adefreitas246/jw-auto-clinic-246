const mongoose = require('mongoose');

const SpecialSchema = new mongoose.Schema({
  name:            { type: String, required: true },
  discountPercent: { type: Number, required: true },
  businessId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
});

module.exports = mongoose.model('Special', SpecialSchema);
