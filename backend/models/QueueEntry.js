// models/QueueEntry.js
// A QueueEntry represents a walk-in customer who joined the service queue
// directly at the kiosk — no user account required.
//
// Status lifecycle:
//   waiting → called → in_service → completed
//          ↘ skipped
//          ↘ cancelled
const mongoose = require('mongoose');
const { Schema } = mongoose;

const QueueEntrySchema = new Schema(
  {
    businessId: {
      type:     Schema.Types.ObjectId,
      ref:      'Business',
      required: true,
      index:    true,
    },

    // Walk-in customer info — no account needed
    customerName: { type: String, required: true, trim: true },
    phoneNumber:  { type: String, trim: true, default: '' },

    // What they want
    serviceId:       { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    packageId:       { type: Schema.Types.ObjectId, ref: 'Package', default: null },
    serviceLabel:    { type: String, required: true },
    price:           { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1, default: 30 },

    // Payment preference chosen at kiosk
    paymentMethod: {
      type:    String,
      enum:    ['cash', 'counter', 'wipay', 'bimpay'],
      default: 'counter',
    },

    // Stable per-business-per-day queue number — never reassigned
    queueNumber: { type: Number, required: true },

    status: {
      type:    String,
      enum:    ['waiting', 'called', 'in_service', 'completed', 'skipped', 'cancelled'],
      default: 'waiting',
      index:   true,
    },

    // Timestamps for each lifecycle transition
    joinedAt:       { type: Date, default: Date.now },
    calledAt:       { type: Date, default: null },
    serviceStartAt: { type: Date, default: null },
    completedAt:    { type: Date, default: null },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Efficient query: all active entries for a business on a given day
QueueEntrySchema.index({ businessId: 1, status: 1, joinedAt: 1 });
// Queue number uniqueness check per business
QueueEntrySchema.index({ businessId: 1, queueNumber: 1 });

module.exports = mongoose.model('QueueEntry', QueueEntrySchema);
