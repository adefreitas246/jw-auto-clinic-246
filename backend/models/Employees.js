const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'Staff',
    },
    hourlyRate: { type: Number, default: 0 },
    clockedIn: { type: Boolean, default: false },
    password: { type: String},
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// ADD THIS BELOW THE SCHEMA
employeeSchema.pre('save', async function (next) {
  // Only set default if no password provided
  if (!this.password) {
    this.password = this.role === 'Admin' ? 'Jw@admin1!' : 'Jw@staff1!';
  }

  // Hash only if password is not already hashed
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    return next(err);
  }
});

// OPTIONAL: Add a method for comparing passwords later
employeeSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Employee', employeeSchema);
