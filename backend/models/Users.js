// models/Users.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, trim: true },
  avatar: { type: String },
  notificationsEnabled: { type: Boolean, default: true },
  role: { type: String },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },

  // OAuth provider IDs — sparse so null values don't collide on the unique index
  googleId: { type: String, default: null },
  appleId:  { type: String, default: null },
  // 'local' | 'google' | 'apple'  (accounts may have multiple — stored as first provider used)
  provider: { type: String, enum: ['local', 'google', 'apple'], default: 'local' },

  // Expo push token for this device — updated on each login / booking confirmation
  expoPushToken: { type: String, default: '' },

  // ── Live GPS tracking (mobile wash technicians) ───────────────────────────
  isTracking:        { type: Boolean, default: false },
  currentLat:        { type: Number,  default: null  },
  currentLng:        { type: Number,  default: null  },
  locationAccuracy:  { type: Number,  default: null  }, // metres
  locationUpdatedAt: { type: Date,    default: null  },
}, { timestamps: true });

async function hashIfNeeded(doc) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(doc.password, salt);
}

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hashIfNeeded({ password: this.password });
  next();
});

UserSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate() || {};
    const nextPwd = update.password ?? update.$set?.password;
    if (nextPwd) {
      const hashed = await hashIfNeeded({ password: nextPwd });
      if (update.$set?.password) update.$set.password = hashed;
      else update.password = hashed;
      this.setUpdate(update);
    }
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Sparse so documents where googleId/appleId is null don't conflict
UserSchema.index({ googleId: 1 }, { sparse: true });
UserSchema.index({ appleId: 1 },  { sparse: true });

module.exports = mongoose.model('User', UserSchema);