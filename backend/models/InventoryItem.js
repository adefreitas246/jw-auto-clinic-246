// models/InventoryItem.js
// Tracks consumable supplies and materials used in car wash operations.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CATEGORIES = [
  'Soaps & Chemicals',
  'Wax & Polish',
  'Interior Care',
  'Towels & Cloths',
  'Disposables',
  'Equipment',
  'Other',
];

const InventoryItemSchema = new Schema(
  {
    businessId: {
      type:     Schema.Types.ObjectId,
      ref:      'Business',
      required: true,
      index:    true,
    },

    name:     { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: 'Other' },

    // Current quantity on hand (can go negative to flag discrepancies)
    currentStock: { type: Number, required: true, default: 0 },

    // Display unit (ml, L, kg, g, units, rolls, sheets, bottles)
    unit: { type: String, required: true, trim: true, default: 'units' },

    // Push notification fires when currentStock drops below this value
    lowStockThreshold: { type: Number, required: true, default: 10, min: 0 },

    notes: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

// One item name per business
InventoryItemSchema.index({ businessId: 1, name: 1 }, { unique: true });
// Fast low-stock queries
InventoryItemSchema.index({ businessId: 1, currentStock: 1 });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
module.exports.CATEGORIES = CATEGORIES;
