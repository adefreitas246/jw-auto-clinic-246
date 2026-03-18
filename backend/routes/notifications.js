// routes/notifications.js
const express = require('express');
const router  = express.Router();
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const protect = [authMiddleware, resolveBusiness];

// In-memory store per business (production would use DB collection)
// GET /api/notifications — list latest notifications
router.get('/', ...protect, async (req, res) => {
  // placeholder — return empty list until a Notification model is added
  res.json([]);
});

// POST /api/notifications/push — send push to all business tokens
router.post('/push', ...protect, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ message: 'title and body required' });
  // Expo push would go here
  res.json({ message: 'Push notification queued (stub).', title, body });
});

module.exports = router;
