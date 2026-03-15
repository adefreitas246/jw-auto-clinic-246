// models/Review.js
// Customer review submitted after job status reaches 'finished'.
// One review per booking (unique constraint).
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReviewSchema = new Schema(
  {
    bookingId:  { type: Schema.Types.ObjectId, ref: 'Booking',  required: true, unique: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId:     { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    // The technician who performed the job
    staffId:    { type: Schema.Types.ObjectId, ref: 'User',     default: null },
    staffName:  { type: String, default: '' },

    stars:   { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 500 },

    // Admin can respond to the review
    adminReply:     { type: String, default: '' },
    adminRepliedAt: { type: Date,   default: null },

    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Fast lookups: per-technician ratings, recent reviews for a business
ReviewSchema.index({ businessId: 1, staffId: 1 });
ReviewSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', ReviewSchema);
