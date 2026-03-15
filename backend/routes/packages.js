// routes/packages.js
const express = require('express');
const router  = express.Router();
const Package         = require('../models/Package');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/packages/catalog
// Returns active packages with their services populated — customer sync target.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/catalog', protect, async (req, res) => {
  try {
    const packages = await Package.find({
      businessId: req.businessId,
      active: true,
    })
      .populate('serviceIds', 'name price duration category')
      .sort({ name: 1 });
    res.json(packages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch package catalog.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/packages — all (admin, includes inactive)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const packages = await Package.find({ businessId: req.businessId })
      .populate('serviceIds', 'name price duration category active')
      .sort({ name: 1 });
    res.json(packages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch packages.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/packages — create
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const { name, description, price, serviceIds, active } = req.body;
  if (!name) return res.status(400).json({ error: 'Package name is required.' });
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return res.status(400).json({ error: 'A package must include at least one service.' });
  }
  try {
    const pkg = await Package.create({
      businessId:  req.businessId,
      name,
      description: description ?? '',
      price:       price ?? null,
      serviceIds,
      active:      active ?? true,
    });
    const populated = await pkg.populate('serviceIds', 'name price duration category');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create package.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/packages/:id — update
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  const { name, description, price, serviceIds, active } = req.body;
  const update = {};
  if (name        !== undefined) update.name        = name;
  if (description !== undefined) update.description = description;
  if (price       !== undefined) update.price       = price;
  if (serviceIds  !== undefined) update.serviceIds  = serviceIds;
  if (active      !== undefined) update.active      = active;

  try {
    const pkg = await Package.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true, runValidators: true }
    ).populate('serviceIds', 'name price duration category active');
    if (!pkg) return res.status(404).json({ error: 'Package not found.' });
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Update failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/packages/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Package.findOneAndDelete({
      _id:        req.params.id,
      businessId: req.businessId,
    });
    if (!deleted) return res.status(404).json({ error: 'Package not found.' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;
