const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');
const Employee = require('../models/Employees');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const nodemailer = require('nodemailer');
const sendEmail = require('../utils/sendEmail');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Temporary in-memory token store (for demo)
const resetTokens = {};

// POST /api/auth/register (User only)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = new User({ name, email, password, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login (User or Employee)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Try User model first
    let user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      const token = jwt.sign(
        { userId: user._id, role: user.role, name: user.name, type: 'User' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
        type: 'User',
      });
    }

    // Try Employee model next
    const employee = await Employee.findOne({ email });
    if (employee && (await employee.comparePassword(password))) {
      const token = jwt.sign(
        { userId: employee._id, role: employee.role, name: employee.name, type: 'Employee' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        token,
        type: 'Employee',
      });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /api/auth/forgot-password (User or Employee)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    resetTokens[token] = {
      userId: user._id,
      expires: Date.now() + 15 * 60 * 1000,
    };

    const resetUrl = `http://192.168.1.29:8081/auth/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Password Reset',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset. Click the link below:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    });

    res.json({ message: 'Reset link sent to your email.' });
  } catch (err) {
    console.error('SMTP error:', err);
    res.status(500).json({ error: 'Server error while sending email' });
  }
});


router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  const record = resetTokens[token];

  if (!record || record.expires < Date.now()) {
    return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
  }

  try {
    const user = await User.findById(record.userId);
    if (!user) {
      delete resetTokens[token];
      return res.status(404).json({ error: 'User not found.' });
    }

    user.password = password; // plain password — let schema hash it
    await user.save();        // schema will hash it using pre-save hook

    delete resetTokens[token];

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server error while resetting password.' });
  }
});


module.exports = router;
