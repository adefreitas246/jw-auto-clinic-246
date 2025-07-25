const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

// GET all transactions (optionally protected if needed)
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('createdBy', 'name email') // populate creator info
      .populate('customer') // if you normalized customer
      .sort({ serviceDate: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST a new transaction (Protected)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      createdBy: req.user.id, // automatically assign the user from JWT
    };

    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    res.status(201).json(newTransaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// (Optional) GET a transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// (Optional) DELETE a transaction
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Transaction.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Transaction not found' });

    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
