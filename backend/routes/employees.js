// routes/employees.js
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employees');
const authMiddleware = require('../middleware/authMiddleware');

// GET all employees (sorted by creation)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET a single employee
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST create new employee
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, role, hourlyRate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const newEmployee = new Employee({
      name,
      email,
      phone,
      role: role || 'Staff',
      hourlyRate: hourlyRate || 0,
      createdBy: req.user.id,
      clockedIn: false,
      password: '', // triggers default in model
    });

    await newEmployee.save();
    const { password, ...employeeWithoutPassword } = newEmployee.toObject();
    res.status(201).json(employeeWithoutPassword);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// PATCH toggle clock in/out
router.patch('/:id/clock', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    employee.clockedIn = !employee.clockedIn;
    await employee.save();
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle clock status' });
  }
});

// PUT update an employee
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Employee not found' });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE employee
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Employee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Employee not found' });

    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
