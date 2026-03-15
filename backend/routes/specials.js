// routes/specials.js
const express = require('express');
const router = express.Router();
const Specials = require('../models/Specials');
const authMiddleware = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// Create
router.post('/', protect, async (req, res) => {
  const { name, discountPercent } = req.body;
  if (!name || discountPercent == null) return res.status(400).json({ error: 'Name and discount % are required.' });
  try {
    const special = new Specials({ name, discountPercent, businessId: req.businessId });
    await special.save();
    res.json(special);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create special' });
  }
});

// Get all (scoped to business)
router.get('/', protect, async (req, res) => {
  try {
    const specials = await Specials.find({ businessId: req.businessId });
    res.json(specials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch specials' });
  }
});

// Update
router.put('/:id', protect, async (req, res) => {
  const { name, discountPercent } = req.body;
  try {
    const special = await Specials.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { name, discountPercent },
      { new: true }
    );
    if (!special) return res.status(404).json({ error: 'Special not found' });
    res.json(special);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Specials.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!deleted) return res.status(404).json({ error: 'Special not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
