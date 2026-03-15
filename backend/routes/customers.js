// routes/customers.js
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const norm = (s = '') => String(s || '').trim();

// Convenience: auth + tenant on every request
const protect = [authMiddleware, resolveBusiness];

/* ── GET by email ───────────────────────────────────────────────── */
router.get('/by-email', protect, async (req, res) => {
  try {
    const email = norm(req.query.email);
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const customer = await Customer.findOne({
      businessId: req.businessId,
      email: new RegExp(`^${email}$`, 'i'),
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching customer by email' });
  }
});

/* ── Find-or-create (ensure) ────────────────────────────────────── */
router.post('/ensure', protect, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      vehicleDetails,
      discount,
      specials,
      customerCode,
      ...rest
    } = req.body || {};

    const cleanName    = norm(name);
    const cleanVehicle = norm(vehicleDetails);
    const cleanEmail   = norm(email);

    if (!cleanName)    return res.status(400).json({ error: 'Name is required' });
    if (!cleanVehicle) return res.status(400).json({ error: 'Vehicle details are required' });

    const bid = req.businessId;

    // 1) Try by email within this business
    let found = null;
    if (cleanEmail) {
      found = await Customer.findOne({
        businessId: bid,
        email: new RegExp(`^${cleanEmail}$`, 'i'),
      });
    }

    // 2) Fallback: (name, vehicleDetails) within this business
    if (!found) {
      found = await Customer.findOne({
        businessId: bid,
        name: new RegExp(`^${cleanName}$`, 'i'),
        vehicleDetails: new RegExp(`^${cleanVehicle}$`, 'i'),
      });
    }

    if (found) {
      if (cleanName    && found.name           !== cleanName)    found.name           = cleanName;
      if (cleanVehicle && found.vehicleDetails !== cleanVehicle) found.vehicleDetails = cleanVehicle;
      if (cleanEmail)      found.email    = cleanEmail;
      if (phone != null)   found.phone    = phone;
      if (discount != null) found.discount = discount;
      if (specials != null) found.specials = specials;
      Object.assign(found, rest);
      await found.save();
      return res.json(found);
    }

    // 3) Create
    try {
      const created = await Customer.create({
        name: cleanName,
        vehicleDetails: cleanVehicle,
        ...(cleanEmail      ? { email: cleanEmail } : {}),
        ...(phone           ? { phone }             : {}),
        ...(discount != null ? { discount }          : {}),
        ...(specials != null ? { specials }          : {}),
        ...(customerCode    ? { customerCode }       : {}),
        ...rest,
        businessId: bid,
      });
      return res.status(201).json(created);
    } catch (e) {
      if (e?.code === 11000) {
        const again = await Customer.findOne({
          businessId: bid,
          name: new RegExp(`^${cleanName}$`, 'i'),
          vehicleDetails: new RegExp(`^${cleanVehicle}$`, 'i'),
        });
        if (again) return res.json(again);
      }
      throw e;
    }
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to ensure customer' });
  }
});

/* ── GET all ────────────────────────────────────────────────────── */
router.get('/', protect, async (req, res) => {
  try {
    const customers = await Customer.find({ businessId: req.businessId }).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/* ── SEARCH ─────────────────────────────────────────────────────── */
router.get('/search', protect, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    const q = String(name).trim();
    const matches = await Customer.find({
      businessId: req.businessId,
      $or: [
        { name:           { $regex: new RegExp(q, 'i') } },
        { vehicleDetails: { $regex: new RegExp(q, 'i') } },
        { email:          { $regex: new RegExp(q, 'i') } },
      ],
    })
      .limit(6)
      .sort({ name: 1 });

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Error searching for customer' });
  }
});

/* ── GET by id ──────────────────────────────────────────────────── */
router.get('/:id', protect, async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── CREATE ─────────────────────────────────────────────────────── */
router.post('/', protect, async (req, res) => {
  try {
    const newCustomer = new Customer({ ...req.body, businessId: req.businessId });
    await newCustomer.save();
    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── UPDATE ─────────────────────────────────────────────────────── */
router.put('/:id', protect, async (req, res) => {
  try {
    const updated = await Customer.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── DELETE ─────────────────────────────────────────────────────── */
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Customer.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
