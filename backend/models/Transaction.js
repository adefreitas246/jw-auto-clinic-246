//models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true,
  },
  originalPrice: {
    type: Number,
    required: [true, 'Original service price is required'],
    min: [0, 'Price must be positive'],
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  discountLabel: {
    type: String,
    default: '',
    trim: true,
  },
  serviceDate: {
    type: Date,
    default: Date.now,
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Mobile Payment'],
    required: [true, 'Payment method is required'],
  },
  vehicleDetails: {
    type: String,
    trim: true,
    required: [true, 'Vehicle details are required'],
  },
  customerName: {
    type: String,
    trim: true,
    required: [true, 'Customer or company name is required'],
  },
  notes: {
    type: String,
    trim: true,
  },
  specials: {
    type: String,
    trim: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required'],
  },
}, {
  timestamps: true,
});

TransactionSchema.pre('save', function (next) {
  const percentDiscount = (this.discountPercent || 0) / 100;
  const discountFromPercent = this.originalPrice * percentDiscount;
  const totalDiscount = discountFromPercent + (this.discountAmount || 0);

  // Final price
  const finalPrice = Math.max(0, this.originalPrice - totalDiscount);
  this.originalPrice = parseFloat(finalPrice.toFixed(2));

  // Human-readable discount label
  let label = '';
  if (this.discountPercent) label += `${this.discountPercent}%`;
  if (this.discountAmount) {
    if (label) label += ' + ';
    label += `$${this.discountAmount} off`;
  }
  this.discountLabel = label || 'No discount';

  next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);
