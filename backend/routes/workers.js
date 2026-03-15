// routes/workers.js
const express = require('express');
const router = express.Router();
const Worker = require('../models/Workers');
const authMiddleware = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

const protect = [authMiddleware, resolveBusiness];

const ensureAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// GET all workers (scoped to business)
router.get('/', protect, async (req, res) => {
  try {
    const workers = await Worker.find({ businessId: req.businessId }).sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// GET a single worker (scoped to business)
router.get('/:id', protect, async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST create new worker
router.post('/', protect, async (req, res) => {
  try {
    const { name, email, phone, role, hourlyRate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const newEmployee = new Worker({
      name,
      email,
      phone,
      role: role || 'staff',
      hourlyRate: hourlyRate || 0,
      createdBy: req.user.id,
      businessId: req.businessId,
      clockedIn: false,
      password: '',
    });

    await newEmployee.save();
    const { password, ...employeeWithoutPassword } = newEmployee.toObject();
    res.status(201).json(employeeWithoutPassword);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH toggle clock in/out (scoped to business)
router.patch('/:id/clock', protect, async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    worker.clockedIn = !worker.clockedIn;
    await worker.save();
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle clock status' });
  }
});

// POST reset worker password (admin only, scoped to business)
const generateTempPassword = () => crypto.randomBytes(8).toString('base64url');

router.post('/:id/reset-password', protect, ensureAdmin, async (req, res) => {
  try {
    const { notify = false } = req.body || {};
    const worker = await Worker.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const temporaryPassword = generateTempPassword();
    worker.password = temporaryPassword;
    await worker.save();

    let emailed = false;
    if (notify && worker.email) {
      try {
        await sendEmail({
          to: worker.email,
          subject: 'Your password has been reset',
          html: `
            <p>Hi ${worker.name || 'there'},</p>
            <p>An administrator reset your password.</p>
            <p>Your temporary password is:</p>
            <p style="font-size:16px;"><b>${temporaryPassword}</b></p>
            <p>Please log in and change it immediately.</p>
          `,
        });
        emailed = true;
      } catch (e) {
        console.warn('sendEmail failed:', e?.message || e);
      }
    }

    return res.json({ temporaryPassword, emailed });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'Could not reset password' });
  }
});

// PUT update a worker (scoped to business)
router.put('/:id', protect, async (req, res) => {
  try {
    const updated = await Worker.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Worker not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE worker (scoped to business)
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Worker.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!deleted) return res.status(404).json({ error: 'Worker not found' });
    res.json({ message: 'Worker deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
