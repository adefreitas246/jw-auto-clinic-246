// models/Shifts.js
const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  employee: String,
  date: String,
  clockIn: String,
  clockOut: String,
  hours: String,
  status: String, // "Active" or "Completed"
});

module.exports = mongoose.model('Shift', shiftSchema);
