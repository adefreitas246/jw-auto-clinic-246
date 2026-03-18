// seed/seedAll.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

// Models
const Business            = require('../models/Business');
const User                = require('../models/Users');
const Worker              = require('../models/Workers');
const Service             = require('../models/Services');
const Package             = require('../models/Package');
const Vehicle             = require('../models/Vehicle');
const WashBay             = require('../models/WashBay');
const Booking             = require('../models/Booking');
const Transaction         = require('../models/Transaction');
const Customer            = require('../models/Customer');
const InventoryItem       = require('../models/InventoryItem');
const SubscriptionPlan    = require('../models/SubscriptionPlan');
const LoyaltyConfig       = require('../models/LoyaltyConfig');
const LoyaltyAccount      = require('../models/LoyaltyAccount');
const CouponCode          = require('../models/CouponCode');
const QueueEntry          = require('../models/QueueEntry');
const Review              = require('../models/Review');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // ── Clear collections ──────────────────────────────────────────────────────
    await Promise.all([
      Business.deleteMany({}),
      User.deleteMany({}),
      Worker.deleteMany({}),
      Service.deleteMany({}),
      Package.deleteMany({}),
      Vehicle.deleteMany({}),
      WashBay.deleteMany({}),
      Booking.deleteMany({}),
      Transaction.deleteMany({}),
      Customer.deleteMany({}),
      InventoryItem.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      LoyaltyConfig.deleteMany({}),
      LoyaltyAccount.deleteMany({}),
      CouponCode.deleteMany({}),
      QueueEntry.deleteMany({}),
      Review.deleteMany({}),
    ]);
    console.log('Cleared all collections');

    // ── 1. Business ────────────────────────────────────────────────────────────
    const business = await Business.create({
      name:             'Wash Hub Demo',
      slug:             'washhub-demo',
      subscriptionPlan: 'pro',
      email:            'admin@washhub.com',
      phone:            '+1-868-555-0100',
    });
    const businessId = business._id;
    console.log(`Business created: ${business.name}`);

    // ── 2. Admin User ──────────────────────────────────────────────────────────
    // Pass plaintext — pre-save hook hashes it
    const admin = await User.create({
      name:       'Admin User',
      email:      'admin@washhub.com',
      password:   'Admin@1234',
      role:       'admin',
      businessId,
    });
    console.log(`Admin user created: ${admin.email}`);

    // ── 3. Staff Workers ───────────────────────────────────────────────────────
    // insertMany skips pre-save hooks, so hash manually for workers
    const staffPassword = await bcrypt.hash('Staff@1234', 10);
    const [carlos, maria, james] = await Worker.insertMany([
      { name: 'Carlos Mendez', email: 'carlos@washhub.com', password: staffPassword, role: 'staff', businessId },
      { name: 'Maria Santos',  email: 'maria@washhub.com',  password: staffPassword, role: 'staff', businessId },
      { name: 'James Lee',     email: 'james@washhub.com',  password: staffPassword, role: 'staff', businessId },
    ]);
    console.log('Staff workers created: Carlos, Maria, James');

    // ── 4. Customer Users ──────────────────────────────────────────────────────
    // Pass plaintext — pre-save hook hashes it
    const john  = await User.create({ name: 'John Smith',    email: 'john@example.com',  password: 'Customer@1234', role: 'customer', businessId });
    const sarah = await User.create({ name: 'Sarah Johnson', email: 'sarah@example.com', password: 'Customer@1234', role: 'customer', businessId });
    const mike  = await User.create({ name: 'Mike Davis',    email: 'mike@example.com',  password: 'Customer@1234', role: 'customer', businessId });
    console.log('Customers created: John, Sarah, Mike');

    // ── 5. WashBays ───────────────────────────────────────────────────────────
    const [bay1, bay2, bay3] = await WashBay.insertMany([
      { businessId, name: 'Bay 1', bayType: 'full' },
      { businessId, name: 'Bay 2', bayType: 'exterior' },
      { businessId, name: 'Bay 3', bayType: 'detail' },
    ]);
    console.log('WashBays created: Bay 1, Bay 2, Bay 3');

    // ── 6. Services ───────────────────────────────────────────────────────────
    const [basicWash, fullDetail, interiorClean, waxPolish, engineClean] = await Service.insertMany([
      { businessId, name: 'Basic Wash',    price: 15, duration: 20, category: 'wash',      active: true },
      { businessId, name: 'Full Detail',   price: 85, duration: 90, category: 'detail',    active: true },
      { businessId, name: 'Interior Clean',price: 45, duration: 45, category: 'interior',  active: true },
      { businessId, name: 'Wax & Polish',  price: 60, duration: 60, category: 'exterior',  active: true },
      { businessId, name: 'Engine Clean',  price: 40, duration: 40, category: 'specialty', active: true },
    ]);
    console.log('Services created: 5');

    // ── 7. Packages ───────────────────────────────────────────────────────────
    const [bronzePack, goldPack] = await Package.insertMany([
      { businessId, name: 'Bronze Pack', price: 49,  serviceIds: [basicWash._id, interiorClean._id], active: true },
      { businessId, name: 'Gold Pack',   price: 129, serviceIds: [fullDetail._id, waxPolish._id, interiorClean._id], active: true },
    ]);
    console.log('Packages created: Bronze, Gold');

    // ── 8. Customer records (for Transactions) ─────────────────────────────────
    const custJohn  = await Customer.create({ name: 'John Smith',    vehicleDetails: 'Toyota Camry · ABC-123',   email: 'john@example.com',  businessId });
    const custSarah = await Customer.create({ name: 'Sarah Johnson', vehicleDetails: 'Honda CR-V · XYZ-456',     email: 'sarah@example.com', businessId });
    const custMike  = await Customer.create({ name: 'Mike Davis',    vehicleDetails: 'Ford Mustang · DEF-789',   email: 'mike@example.com',  businessId });

    // ── 9. Vehicles ───────────────────────────────────────────────────────────
    const [vJohn, vSarah, vMike] = await Vehicle.insertMany([
      { userId: john._id,  businessId, make: 'Toyota', model: 'Camry',   year: 2021, licensePlate: 'ABC-123', color: 'Silver', size: 'Sedan', notes: '' },
      { userId: sarah._id, businessId, make: 'Honda',  model: 'CR-V',    year: 2020, licensePlate: 'XYZ-456', color: 'Blue',   size: 'SUV',   notes: '' },
      { userId: mike._id,  businessId, make: 'Ford',   model: 'Mustang', year: 2019, licensePlate: 'DEF-789', color: 'Red',    size: 'Sedan', notes: '' },
    ]);
    console.log('Vehicles created: 3');

    // ── 10. Transactions ──────────────────────────────────────────────────────
    const txnsToInsert = [
      {
        serviceType: 'Basic Wash', originalPrice: 15, finalPrice: 15, discountPercent: 0, discountAmount: 0,
        paymentMethod: 'Cash', vehicleDetails: 'Toyota Camry · ABC-123', customerName: 'John Smith',
        customer: custJohn._id, createdBy: admin._id, businessId, serviceDate: daysAgo(2),
      },
      {
        serviceType: 'Full Detail', originalPrice: 85, finalPrice: 85, discountPercent: 0, discountAmount: 0,
        paymentMethod: 'Mobile Payment', vehicleDetails: 'Honda CR-V · XYZ-456', customerName: 'Sarah Johnson',
        customer: custSarah._id, createdBy: admin._id, businessId, serviceDate: daysAgo(5),
      },
      {
        serviceType: 'Interior Clean', originalPrice: 45, finalPrice: 40, discountPercent: 0, discountAmount: 5,
        paymentMethod: 'Cash', vehicleDetails: 'Ford Mustang · DEF-789', customerName: 'Mike Davis',
        customer: custMike._id, createdBy: admin._id, businessId, serviceDate: daysAgo(10),
      },
      {
        serviceType: 'Wax & Polish', originalPrice: 60, finalPrice: 54, discountPercent: 10, discountAmount: 0,
        paymentMethod: 'Cash', vehicleDetails: 'Toyota Camry · ABC-123', customerName: 'John Smith',
        customer: custJohn._id, createdBy: admin._id, businessId, serviceDate: daysAgo(15),
      },
      {
        serviceType: 'Engine Clean', originalPrice: 40, finalPrice: 40, discountPercent: 0, discountAmount: 0,
        paymentMethod: 'Mobile Payment', vehicleDetails: 'Honda CR-V · XYZ-456', customerName: 'Sarah Johnson',
        customer: custSarah._id, createdBy: admin._id, businessId, serviceDate: daysAgo(25),
      },
    ];
    await Transaction.insertMany(txnsToInsert, { ordered: false });
    console.log('Transactions created: 5');

    // ── 11. Bookings ──────────────────────────────────────────────────────────
    const today    = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    await Booking.insertMany([
      {
        businessId, userId: john._id, customerId: custJohn._id, vehicleId: vJohn._id,
        vehicleLabel: 'Toyota Camry · ABC-123', serviceLabel: 'Basic Wash',
        totalPrice: 15, durationMinutes: 20, appointmentDate: today, appointmentTime: '09:00',
        locationType: 'bay', bayLabel: 'Bay 1', paymentMethod: 'cash', status: 'confirmed', jobStatus: 'assigned',
      },
      {
        businessId, userId: sarah._id, customerId: custSarah._id, vehicleId: vSarah._id,
        vehicleLabel: 'Honda CR-V · XYZ-456', serviceLabel: 'Full Detail',
        totalPrice: 85, durationMinutes: 90, appointmentDate: today, appointmentTime: '10:00',
        locationType: 'bay', bayLabel: 'Bay 2', paymentMethod: 'cash', status: 'confirmed', jobStatus: 'in_progress',
      },
      {
        businessId, userId: mike._id, customerId: custMike._id, vehicleId: vMike._id,
        vehicleLabel: 'Ford Mustang · DEF-789', serviceLabel: 'Interior Clean',
        totalPrice: 45, durationMinutes: 45, appointmentDate: tomorrow, appointmentTime: '11:00',
        locationType: 'bay', bayLabel: 'Bay 1', paymentMethod: 'cash', status: 'pending_payment', jobStatus: 'assigned',
      },
      {
        businessId, userId: john._id, customerId: custJohn._id, vehicleId: vJohn._id,
        vehicleLabel: 'Toyota Camry · ABC-123', serviceLabel: 'Wax & Polish',
        totalPrice: 60, durationMinutes: 60, appointmentDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), appointmentTime: '14:00',
        locationType: 'bay', bayLabel: 'Bay 3', paymentMethod: 'cash', status: 'completed', jobStatus: 'finished',
      },
      {
        businessId, userId: sarah._id, customerId: custSarah._id, vehicleId: vSarah._id,
        vehicleLabel: 'Honda CR-V · XYZ-456', serviceLabel: 'Engine Clean',
        totalPrice: 40, durationMinutes: 40, appointmentDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), appointmentTime: '09:30',
        locationType: 'bay', bayLabel: 'Bay 2', paymentMethod: 'cash', status: 'cancelled', jobStatus: 'assigned',
      },
    ]);
    console.log('Bookings created: 5');

    // ── 12. InventoryItems ────────────────────────────────────────────────────
    await InventoryItem.insertMany([
      { businessId, name: 'Car Shampoo',      category: 'Soaps & Chemicals', currentStock: 20, unit: 'bottles', lowStockThreshold: 5 },
      { businessId, name: 'Microfiber Cloths',category: 'Towels & Cloths',   currentStock: 50, unit: 'units',   lowStockThreshold: 10 },
      { businessId, name: 'Carnauba Wax',     category: 'Wax & Polish',      currentStock: 8,  unit: 'kg',      lowStockThreshold: 2 },
    ]);
    console.log('InventoryItems created: 3');

    // ── 13. SubscriptionPlans ─────────────────────────────────────────────────
    await SubscriptionPlan.insertMany([
      { businessId, name: 'Basic', price: 29, interval: 'monthly', jobQuota: 4,  highlighted: false, active: true },
      { businessId, name: 'Pro',   price: 59, interval: 'monthly', jobQuota: 10, highlighted: true,  active: true },
    ]);
    console.log('SubscriptionPlans created: Basic, Pro');

    // ── 14. LoyaltyConfig ─────────────────────────────────────────────────────
    await LoyaltyConfig.create({
      businessId,
      pointsPerDollar: 10,
      redeemValue:     0.01,
      minRedeem:       100,
      silverThreshold: 500,
      goldThreshold:   1500,
    });
    console.log('LoyaltyConfig created');

    // ── 15. CouponCodes ───────────────────────────────────────────────────────
    await CouponCode.insertMany([
      { businessId, code: 'WELCOME10', type: 'percent', value: 10, active: true },
      { businessId, code: 'FLAT5',     type: 'fixed',   value: 5,  active: true },
    ]);
    console.log('CouponCodes created: WELCOME10, FLAT5');

    // ── 16. QueueEntries ──────────────────────────────────────────────────────
    const now = new Date();
    await QueueEntry.insertMany([
      {
        businessId, customerName: 'Walk-in Alice', serviceLabel: 'Basic Wash',
        price: 15, durationMinutes: 20, queueNumber: 1, status: 'waiting',
        serviceId: basicWash._id, joinedAt: new Date(now.getTime() - 10 * 60000),
      },
      {
        businessId, customerName: 'Walk-in Bob', serviceLabel: 'Interior Clean',
        price: 45, durationMinutes: 45, queueNumber: 2, status: 'called',
        serviceId: interiorClean._id, joinedAt: new Date(now.getTime() - 20 * 60000),
        calledAt: new Date(now.getTime() - 5 * 60000),
      },
      {
        businessId, customerName: 'Walk-in Carol', serviceLabel: 'Full Detail',
        price: 85, durationMinutes: 90, queueNumber: 3, status: 'completed',
        serviceId: fullDetail._id, joinedAt: new Date(now.getTime() - 120 * 60000),
        calledAt: new Date(now.getTime() - 115 * 60000),
        completedAt: new Date(now.getTime() - 30 * 60000),
      },
    ]);
    console.log('QueueEntries created: 3');

    // ── 17. LoyaltyAccount for John ───────────────────────────────────────────
    await LoyaltyAccount.create({
      businessId,
      userId:      john._id,
      customerId:  custJohn._id,
      points:      250,
      totalEarned: 250,
      tier:        'silver',
    });
    console.log('LoyaltyAccount created for John');

    // ── 18. Reviews ───────────────────────────────────────────────────────────
    // Reviews require bookingId with unique constraint — fetch the completed booking
    const completedBookings = await Booking.find({ businessId, status: 'completed' }).lean();
    if (completedBookings.length > 0) {
      await Review.create({
        bookingId:  completedBookings[0]._id,
        businessId,
        userId:     completedBookings[0].userId,
        customerId: completedBookings[0].customerId,
        stars:      5,
        comment:    'Great service!',
      });
      console.log('Review created: 1 (additional reviews need distinct booking IDs)');
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n=== SEED COMPLETE ===');
    console.log(`Business:           Wash Hub Demo (slug: washhub-demo)`);
    console.log(`Admin:              admin@washhub.com / Admin@1234`);
    console.log(`Staff:              carlos@washhub.com, maria@washhub.com, james@washhub.com / Staff@1234`);
    console.log(`Customers:          john@example.com, sarah@example.com, mike@example.com / Customer@1234`);
    console.log(`WashBays:           3 (Bay 1, Bay 2, Bay 3)`);
    console.log(`Services:           5`);
    console.log(`Packages:           2 (Bronze, Gold)`);
    console.log(`Vehicles:           3`);
    console.log(`Transactions:       5`);
    console.log(`Bookings:           5`);
    console.log(`InventoryItems:     3`);
    console.log(`SubscriptionPlans:  2 (Basic, Pro)`);
    console.log(`CouponCodes:        WELCOME10, FLAT5`);
    console.log(`QueueEntries:       3`);
    console.log(`LoyaltyAccount:     John (250 pts, silver)`);
    console.log(`Reviews:            1`);

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
