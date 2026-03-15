// routes/services.js
const express = require('express');
const router  = express.Router();
const Services        = require('../models/Services');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/services/catalog
// Public-ish: only needs auth + businessId resolution.
// Returns all *active* services — used by customer browse + SQLite sync.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/catalog', protect, async (req, res) => {
  try {
    const services = await Services.find({
      businessId: req.businessId,
      active: true,
    }).sort({ category: 1, name: 1 });
    res.json(services);
  } catch {
    res.status(500).json({ error: 'Failed to fetch catalog.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/services — all services (admin, includes inactive)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const services = await Services.find({ businessId: req.businessId })
      .sort({ category: 1, name: 1 });
    res.json(services);
  } catch {
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/services — create
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { name, price, duration, category, description, active } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }
  try {
    const service = await Services.create({
      businessId: req.businessId,
      name,
      price,
      duration:    duration    ?? 30,
      category:    category    ?? 'General',
      description: description ?? '',
      active:      active      ?? true,
    });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create service.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/services/:id — update
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const { name, price, duration, category, description, active } = req.body;
  const update = {};
  if (name        !== undefined) update.name        = name;
  if (price       !== undefined) update.price       = price;
  if (duration    !== undefined) update.duration    = duration;
  if (category    !== undefined) update.category    = category;
  if (description !== undefined) update.description = description;
  if (active      !== undefined) update.active      = active;

  try {
    const service = await Services.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ error: 'Service not found.' });
    res.json(service);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Update failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/services/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Services.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!deleted) return res.status(404).json({ error: 'Service not found.' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;
