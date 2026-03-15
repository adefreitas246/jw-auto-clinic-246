// models/Booking.js
// A Booking is a scheduled appointment created by a customer.
// Staff convert completed bookings into Transactions when the service is done.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const BookingSchema = new Schema(
  {
    businessId:  { type: Schema.Types.ObjectId, ref: 'Business',  required: true, index: true },
    userId:      { type: Schema.Types.ObjectId, ref: 'User',       required: true },
    customerId:  { type: Schema.Types.ObjectId, ref: 'Customer',   required: true },
    vehicleId:   { type: Schema.Types.ObjectId, ref: 'Vehicle',    default: null },
    vehicleLabel: { type: String, default: '' }, // "Toyota Corolla · PBM 1234"

    // What was booked
    packageId:         { type: Schema.Types.ObjectId, ref: 'Package', default: null },
    packageName:       { type: String,   default: '' },
    addonServiceIds:   [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    addonServiceNames: [{ type: String }],
    serviceLabel:      { type: String,   required: true }, // human-readable summary
    totalPrice:        { type: Number,   required: true, min: 0 },
    durationMinutes:   { type: Number,   required: true, min: 1 },

    // When
    appointmentDate: { type: String, required: true }, // YYYY-MM-DD
    appointmentTime: { type: String, required: true }, // HH:MM 24h

    // Where
    locationType:  { type: String, enum: ['bay', 'mobile'], required: true },
    bayLabel:      { type: String, default: '' },
    bayAddress:    { type: String, default: '' },
    mobileAddress: { type: String, default: '' },
    mobileLat:     { type: Number, default: null },
    mobileLng:     { type: Number, default: null },

    // Status lifecycle:
    //   pending_payment → confirmed → completed
    //                   ↘ cancelled
    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled', 'completed'],
      default: 'pending_payment',
      index: true,
    },

    // Payment
    paymentMethod:    { type: String, enum: ['wipay', 'bimpay', 'cash'], required: true },
    paymentReference: { type: String, default: '' }, // gateway transaction ID
    paidAt:           { type: Date,   default: null },

    // Push notifications
    expoPushToken:     { type: String, default: '' }, // customer token at booking time
    reminderScheduled: { type: Boolean, default: false },

    notes: { type: String, default: '' },

    // Marketing discounts applied at booking time
    originalPrice:  { type: Number, default: null },  // before discount
    discountAmount: { type: Number, default: 0 },
    couponId:       { type: Schema.Types.ObjectId, ref: 'CouponCode', default: null },

    // ── Live job tracking (staff lifecycle) ──────────────────────────────────
    // Staff:    assigned → in_progress → completed → quality_check → finished
    // Customer: "Confirmed"  "Being Washed"  "Wash Completed"  "QC"  "Ready"
    jobStatus: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed', 'quality_check', 'finished'],
      default: 'assigned',
      index: true,
    },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    technicianName:  { type: String, default: '' },
    technicianLat:   { type: Number, default: null },
    technicianLng:   { type: Number, default: null },

    // QR check-in
    checkedInAt: { type: Date, default: null },

    // Staff-side notes and before/after photos
    staffNotes: { type: String, default: '' },
    photos: [
      {
        label:    { type: String, enum: ['before', 'after'], required: true },
        data:     { type: String }, // base64 data URL — swap for cloud URL in production
        staffId:  { type: Schema.Types.ObjectId, ref: 'User' },
        takenAt:  { type: Date, default: Date.now },
      },
    ],

    // Staff voice notes (audio recordings attached to a job)
    voiceNotes: [
      {
        data:     { type: String }, // base64 audio data URI — swap for cloud URL in production
        mimeType: { type: String, default: 'audio/m4a' },
        duration: { type: Number, default: 0 }, // seconds
        label:    { type: String, default: '' },
        staffId:  { type: Schema.Types.ObjectId, ref: 'User' },
        takenAt:  { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Fast queries: all bookings on a date for a business (availability check)
BookingSchema.index({ businessId: 1, appointmentDate: 1, status: 1 });
// Customer's own booking list
BookingSchema.index({ userId: 1, businessId: 1, appointmentDate: -1 });

module.exports = mongoose.model('Booking', BookingSchema);
