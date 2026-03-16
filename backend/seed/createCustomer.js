// seed/createCustomer.js
// Run once: node backend/seed/createCustomer.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/Users');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existing = await User.findOne({ email: 'customer@jw.com' });
    if (existing) {
      console.log('Customer account already exists:', existing.email);
      process.exit(0);
    }

    const user = new User({
      name: 'Test Customer',
      email: 'customer@jw.com',
      password: 'customer123',
      role: 'customer',
      phone: '+12460000001',
    });

    await user.save();
    console.log('Customer account created: customer@jw.com / customer123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
