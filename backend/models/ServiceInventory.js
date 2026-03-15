// models/ServiceInventory.js
// Maps a service (or package) to the inventory items it consumes per use.
// When a job is marked finished, deduct amountPerUse from each linked item.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ServiceInventorySchema = new Schema(
  {
    businessId: {
      type:     Schema.Types.ObjectId,
      ref:      'Business',
      required: true,
      index:    true,
    },

    // Exactly one of serviceId / packageId must be set
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null },

    inventoryItemId: {
      type:     Schema.Types.ObjectId,
      ref:      'InventoryItem',
      required: true,
    },

    // How much of the item is consumed per single service/job
    amountPerUse: { type: Number, required: true, min: 0.001 },
  },
  { timestamps: true }
);

// Prevent duplicate mappings for the same service + item pair
ServiceInventorySchema.index(
  { businessId: 1, serviceId: 1, inventoryItemId: 1 },
  { unique: true, sparse: true }
);
ServiceInventorySchema.index(
  { businessId: 1, packageId: 1, inventoryItemId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('ServiceInventory', ServiceInventorySchema);
