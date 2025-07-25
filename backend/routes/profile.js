//routes/profile.js
const express = require('express');
const router = express.Router();
const User = require('../models/Users'); // update path if different
const authenticate = require('../middleware/authMiddleware'); // JWT middleware

// PUT /api/profile
router.put('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { name, email, phone, avatar, notificationsEnabled } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        name,
        email,
        phone,
        avatar, // store image as base64 or URL if you're using cloud storage
        notificationsEnabled,
      },
      { new: true }
    );
    res.json({
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || '', // fallback if null
        avatar: updated.avatar || '',
        role: updated.role,
        notificationsEnabled: updated.notificationsEnabled ?? true,
      });
      
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET /api/profile
router.get('/', authenticate, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        'name email phone avatar role notificationsEnabled'
      );
      res.json(user);
    } catch (err) {
      console.error('Fetch profile error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  

module.exports = router;
