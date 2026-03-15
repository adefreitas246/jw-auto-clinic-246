// routes/bookings.js
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const crypto  = require('crypto');

const Booking         = require('../models/Booking');
const Customer        = require('../models/Customer');
const User            = require('../models/Users');
const CouponCode      = require('../models/CouponCode');
const ReferralCode    = require('../models/ReferralCode');
const { awardLoyaltyPoints } = require('../utils/loyaltyUtils');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─── Business hours & slot helpers ───────────────────────────────────────────
// Defaults — can be overridden in Business.settings later
const DEFAULT_START   = '08:00';
const DEFAULT_END     = '17:30';
const DEFAULT_SLOT    = 30;          // minutes

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  const h  = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function generateSlots(startTime, endTime, slotMins) {
  const slots = [];
  let cur = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (cur + slotMins <= end) {
    slots.push(minutesToTime(cur));
    cur += slotMins;
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/availability
// Query: date (YYYY-MM-DD), duration (minutes, default 30)
// Returns: [{ time: 'HH:MM', available: boolean }]
// ─────────────────────────────────────────────────────────────────────────────
router.get('/availability', protect, async (req, res) => {
  try {
    const { date, duration } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD).' });
    }

    const slotDur = parseInt(duration ?? DEFAULT_SLOT, 10) || DEFAULT_SLOT;

    // Pull all active bookings for this date
    const bookings = await Booking.find({
      businessId:      req.businessId,
      appointmentDate: date,
      status:          { $in: ['pending_payment', 'confirmed'] },
    }).select('appointmentTime durationMinutes').lean();

    const allSlots = generateSlots(DEFAULT_START, DEFAULT_END, DEFAULT_SLOT);

    const result = allSlots.map(slot => {
      const slotStart = timeToMinutes(slot);
      const slotEnd   = slotStart + slotDur;

      const blocked = bookings.some(bk => {
        const bkStart = timeToMinutes(bk.appointmentTime);
        const bkEnd   = bkStart + (bk.durationMinutes || DEFAULT_SLOT);
        // Overlap: booking starts before this slot ends AND ends after this slot starts
        return bkStart < slotEnd && bkEnd > slotStart;
      });

      return { time: slot, available: !blocked };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch availability.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/my
// Returns the authenticated customer's bookings (most recent first)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId:     req.user.id,
      businessId: req.businessId,
    })
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .lean();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings
// Creates a booking and — for wipay/bimpay — returns a payment URL.
// Body: {
//   vehicleId?, vehicleLabel,
//   packageId?, packageName,
//   addonServiceIds[], addonServiceNames[],
//   serviceLabel, totalPrice, durationMinutes,
//   appointmentDate, appointmentTime,
//   locationType, bayLabel?, bayAddress?, mobileAddress?, mobileLat?, mobileLng?,
//   paymentMethod, notes?,
//   expoPushToken?
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const {
      vehicleId, vehicleLabel,
      packageId, packageName, addonServiceIds, addonServiceNames,
      serviceLabel, totalPrice, durationMinutes,
      appointmentDate, appointmentTime,
      locationType, bayLabel, bayAddress, mobileAddress, mobileLat, mobileLng,
      paymentMethod, notes, expoPushToken,
      couponCode, referralCode,
    } = req.body;

    // Validate required fields
    if (!serviceLabel)    return res.status(400).json({ error: 'serviceLabel is required.' });
    if (totalPrice == null) return res.status(400).json({ error: 'totalPrice is required.' });
    if (!appointmentDate) return res.status(400).json({ error: 'appointmentDate is required.' });
    if (!appointmentTime) return res.status(400).json({ error: 'appointmentTime is required.' });
    if (!locationType)    return res.status(400).json({ error: 'locationType is required.' });
    if (!paymentMethod)   return res.status(400).json({ error: 'paymentMethod is required.' });

    // Validate + apply coupon (if provided)
    let appliedCouponId      = null;
    let couponDiscountAmount  = 0;
    let finalPrice           = Number(totalPrice);

    if (couponCode) {
      const coupon = await CouponCode.findOne({
        businessId: req.businessId,
        code:       couponCode.trim().toUpperCase(),
        active:     true,
      });

      if (!coupon) {
        return res.status(400).json({ error: 'Invalid or expired coupon code.' });
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        return res.status(400).json({ error: 'This coupon has expired.' });
      }
      if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ error: 'This coupon has reached its usage limit.' });
      }
      if (coupon.minOrderValue > 0 && finalPrice < coupon.minOrderValue) {
        return res.status(400).json({
          error: `Minimum order value of $${coupon.minOrderValue.toFixed(2)} required for this coupon.`,
        });
      }

      couponDiscountAmount = coupon.type === 'percent'
        ? Math.min(finalPrice, (finalPrice * coupon.value) / 100)
        : Math.min(finalPrice, coupon.value);
      couponDiscountAmount = Math.round(couponDiscountAmount * 100) / 100;
      finalPrice           = Math.max(0, finalPrice - couponDiscountAmount);
      appliedCouponId      = coupon._id;
    }

    // Validate referral code if provided (referee first booking discount)
    let appliedReferralCode = null;
    let referralDiscount    = 0;

    if (referralCode && !couponCode) {
      const ref = await ReferralCode.findOne({
        businessId: req.businessId,
        code:       referralCode.trim().toUpperCase(),
        active:     true,
      });
      if (ref && ref.userId.toString() !== req.user.id) {
        // Check this user hasn't booked before (first booking only)
        const prevBookings = await Booking.countDocuments({
          businessId: req.businessId,
          userId:     req.user.id,
          status:     { $in: ['confirmed', 'completed'] },
        });
        if (prevBookings === 0) {
          // Apply referee discount
          referralDiscount = ref.refereeDiscountType === 'percent'
            ? Math.min(finalPrice, (finalPrice * ref.refereeDiscountValue) / 100)
            : Math.min(finalPrice, ref.refereeDiscountValue);
          referralDiscount = Math.round(referralDiscount * 100) / 100;
          finalPrice       = Math.max(0, finalPrice - referralDiscount);
          appliedReferralCode = ref._id;
        }
      }
    }

    // Ensure customer profile exists for this user
    const userDoc = await User.findById(req.user.id).lean();
    if (!userDoc) return res.status(401).json({ error: 'User not found.' });

    let customerId = null;
    if (userDoc) {
      let cust = await Customer.findOne({ businessId: req.businessId, email: userDoc.email }).lean();
      if (!cust) {
        cust = await Customer.create({
          name:           userDoc.name,
          vehicleDetails: vehicleLabel || 'N/A',
          email:          userDoc.email,
          phone:          userDoc.phone || '',
          businessId:     req.businessId,
        });
      }
      customerId = cust._id;
    }

    const booking = await Booking.create({
      businessId:   req.businessId,
      userId:       req.user.id,
      customerId,
      vehicleId:    vehicleId   || null,
      vehicleLabel: vehicleLabel || '',
      packageId:    packageId   || null,
      packageName:  packageName || '',
      addonServiceIds:   addonServiceIds   || [],
      addonServiceNames: addonServiceNames || [],
      serviceLabel,
      totalPrice:      finalPrice,
      originalPrice:   Number(totalPrice),
      discountAmount:  couponDiscountAmount + referralDiscount,
      couponId:        appliedCouponId,
      durationMinutes: durationMinutes || 30,
      appointmentDate,
      appointmentTime,
      locationType,
      bayLabel:      bayLabel      || '',
      bayAddress:    bayAddress    || '',
      mobileAddress: mobileAddress || '',
      mobileLat:     mobileLat     ?? null,
      mobileLng:     mobileLng     ?? null,
      paymentMethod,
      notes:         notes || '',
      expoPushToken: expoPushToken || '',
      status: paymentMethod === 'cash' ? 'confirmed' : 'pending_payment',
      paidAt: paymentMethod === 'cash' ? new Date() : null,
    });

    // Record coupon usage (fire-and-forget)
    if (appliedCouponId) {
      CouponCode.findByIdAndUpdate(appliedCouponId, {
        $inc:  { usedCount: 1 },
        $push: { usedBy: { userId: req.user.id, bookingId: booking._id, usedAt: new Date() } },
      }).catch(() => {});
    }

    // Record referral + award points to referrer (fire-and-forget)
    if (appliedReferralCode) {
      ReferralCode.findByIdAndUpdate(appliedReferralCode, {
        $inc:  { totalReferrals: 1, totalPointsEarned: 50 },
        $push: { referrals: { refereeUserId: req.user.id, bookingId: booking._id, pointsAwarded: 50 } },
      }).catch(() => {});

      // Award loyalty points to referrer
      const refDoc = await ReferralCode.findById(appliedReferralCode).select('userId').lean();
      if (refDoc) {
        awardLoyaltyPoints(refDoc.userId, null, req.businessId, 0, booking._id)
          .catch(() => {});
        // Directly add bonus points since awardLoyaltyPoints uses amountSpent
        const LoyaltyAccount = require('../models/LoyaltyAccount');
        LoyaltyAccount.findOneAndUpdate(
          { businessId: req.businessId, userId: refDoc.userId },
          { $inc: { points: 50, totalEarned: 50 } },
          { upsert: true }
        ).catch(() => {});
      }
    }

    // For cash: mark paid immediately
    if (paymentMethod === 'cash') {
      await sendBookingConfirmationPush(booking, req.businessId);
      return res.status(201).json({ booking, paymentUrl: null });
    }

    // For wipay / bimpay: generate payment URL
    const paymentUrl = await buildPaymentUrl(booking, paymentMethod, userDoc, req);
    res.status(201).json({ booking, paymentUrl });
  } catch (err) {
    console.error('[Booking] create error:', err);
    res.status(500).json({ error: err.message || 'Failed to create booking.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/confirm
// Called after payment gateway redirect confirms payment.
// Body: { paymentReference }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/confirm', protect, async (req, res) => {
  try {
    const { paymentReference } = req.body;

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, businessId: req.businessId },
      {
        status:           'confirmed',
        paymentReference: paymentReference || '',
        paidAt:           new Date(),
      },
      { new: true }
    );

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    await sendBookingConfirmationPush(booking, req.businessId);
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to confirm booking.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, businessId: req.businessId, status: { $in: ['pending_payment', 'confirmed'] } },
      { status: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found or cannot be cancelled.' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/push-token
// Saves or updates the customer's Expo push token against their User record.
// Body: { token }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/push-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required.' });

    await User.findByIdAndUpdate(req.user.id, { expoPushToken: token });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save push token.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Payment URL builders
// ─────────────────────────────────────────────────────────────────────────────

const RETURN_BASE = process.env.API_BASE_URL || 'https://jw-auto-clinic-246.onrender.com';

async function buildPaymentUrl(booking, gateway, userDoc, req) {
  const orderId     = booking._id.toString();
  const amount      = booking.totalPrice.toFixed(2);
  const returnUrl   = `${RETURN_BASE}/api/bookings/payment-return?booking_id=${orderId}&gateway=${gateway}`;
  const cancelUrl   = `${RETURN_BASE}/api/bookings/payment-return?booking_id=${orderId}&gateway=${gateway}&cancelled=1`;
  const customerName = userDoc?.name  || 'Customer';
  const email        = userDoc?.email || '';

  if (gateway === 'wipay') {
    return buildWiPayUrl({ orderId, amount, returnUrl, cancelUrl, customerName, email });
  }
  if (gateway === 'bimpay') {
    return buildBimPayUrl({ orderId, amount, returnUrl, customerName });
  }
  throw new Error(`Unsupported gateway: ${gateway}`);
}

function buildWiPayUrl({ orderId, amount, returnUrl, customerName, email }) {
  const accountNumber = process.env.WIPAY_ACCOUNT_NUMBER || '';
  const environment   = process.env.NODE_ENV === 'production' ? '0' : '1';

  if (!accountNumber) {
    console.warn('[WiPay] WIPAY_ACCOUNT_NUMBER not set — returning sandbox URL');
  }

  // WiPay checkout form — POST these fields to their payment page.
  // We encode as a query string and redirect via a GET-compatible checkout URL
  // (WiPay also accepts GET for their hosted checkout).
  const params = new URLSearchParams({
    account_number: accountNumber,
    avs:            '0',
    currency:       'TTD',
    environment,
    fee_structure:  'customer_pays',
    order_id:       orderId,
    return_url:     returnUrl,
    total:          amount,
    tax:            '0',
    name:           customerName,
    email,
  });

  return `https://wipayfinancial.com/v1/checkout?${params.toString()}`;
}

function buildBimPayUrl({ orderId, amount, returnUrl, customerName }) {
  const merchantId = process.env.BIMPAY_MERCHANT_ID || '';
  // BIMPay hosted checkout — adjust endpoint/params per BPTT integration docs
  const params = new URLSearchParams({
    merchant_id: merchantId,
    order_id:    orderId,
    amount,
    return_url:  returnUrl,
    name:        customerName,
    currency:    'TTD',
  });
  return `https://bimpay.tt/checkout?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/payment-return
// Browser-facing redirect handler — after gateway redirect.
// Serves a minimal page that sends the result back to the app via deep link.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payment-return', async (req, res) => {
  const { booking_id, gateway, cancelled, status } = req.query;
  const scheme    = process.env.CLIENT_SCHEME || 'washhub';
  const success   = !cancelled && (status !== 'failed');
  const deepLink  = success
    ? `${scheme}://book/confirmed?booking_id=${booking_id}&gateway=${gateway}`
    : `${scheme}://book/payment?booking_id=${booking_id}&gateway=${gateway}&error=payment_failed`;

  if (success && booking_id) {
    // Mark the booking confirmed (best-effort — client will also call /confirm)
    try {
      await Booking.findByIdAndUpdate(booking_id, {
        status: 'confirmed',
        paymentReference: String(req.query.transaction_id || req.query.reference || ''),
        paidAt: new Date(),
      });
    } catch (_) {}
  }

  res.send(`<!doctype html><html><head><meta charset="utf-8">
    <script>window.location.href = ${JSON.stringify(deepLink)};</script>
    </head><body><p>Redirecting back to Wash Hub…</p></body></html>`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Push notification helper — sends via Expo Push API
// ─────────────────────────────────────────────────────────────────────────────
async function sendBookingConfirmationPush(booking, businessId) {
  try {
    // Fetch customer's push token
    const user = await User.findById(booking.userId).select('expoPushToken name').lean();
    const token = user?.expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    const appointmentStr = `${booking.appointmentDate} at ${booking.appointmentTime}`;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title: '✅ Booking Confirmed!',
        body:  `Your ${booking.serviceLabel} is booked for ${appointmentStr}.`,
        data:  { bookingId: booking._id.toString(), type: 'booking_confirmed' },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Push] Failed to send booking confirmation:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Code helpers
// QR_SECRET must be set in .env — never commit the real value.
// The payload stored in the QR is: JSON.stringify({ b: bookingId, h: hmac })
// ─────────────────────────────────────────────────────────────────────────────
const QR_SECRET = process.env.QR_SECRET || 'washhub-dev-secret-change-in-production';

function signBookingId(bookingId) {
  return crypto.createHmac('sha256', QR_SECRET).update(bookingId).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/:id/qr
// Returns the signed QR payload for display in the customer app.
// Accessible by the booking owner, staff, or admin.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/qr', protect, async (req, res) => {
  try {
    const filter = { _id: req.params.id, businessId: req.businessId };
    // Customers may only fetch their own booking's QR
    if (!['admin', 'staff'].includes(req.user.role)) {
      filter.userId = req.user.id;
    }

    const booking = await Booking.findOne(filter)
      .select('_id status jobStatus serviceLabel appointmentDate appointmentTime')
      .lean();

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'QR is only available for confirmed bookings.' });
    }

    const id      = booking._id.toString();
    const payload = JSON.stringify({ b: id, h: signBookingId(id) });

    res.json({
      payload,
      bookingId:       id,
      serviceLabel:    booking.serviceLabel,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/:id/checkin
// Staff scans the QR → server verifies HMAC → advances jobStatus to in_progress.
// Body: { h: string }  — the HMAC from the QR payload
// Returns booking summary for the confirmation overlay.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/checkin', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const { h } = req.body;
    if (!h) return res.status(400).json({ error: 'QR token (h) is required.' });

    // Verify HMAC — prevents forged QR codes
    const expected = signBookingId(req.params.id);
    if (h !== expected) {
      return res.status(400).json({ error: 'Invalid QR code. Please scan the customer\'s QR.' });
    }

    const booking = await Booking.findOne({
      _id:        req.params.id,
      businessId: req.businessId,
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (booking.status !== 'confirmed') {
      const msg = booking.status === 'cancelled'
        ? 'This booking has been cancelled.'
        : 'This booking is not active.';
      return res.status(409).json({ error: msg });
    }

    if (booking.jobStatus !== 'assigned') {
      return res.status(409).json({
        error: 'Customer already checked in.',
        jobStatus: booking.jobStatus,
      });
    }

    // Advance to in_progress + self-assign this staff member
    await Booking.findByIdAndUpdate(req.params.id, {
      jobStatus:       'in_progress',
      assignedStaffId: req.user.id,
      checkedInAt:     new Date(),
    });

    // Fetch customer push token for notification
    const customer = await User.findById(booking.userId)
      .select('name expoPushToken')
      .lean();

    // Fire "wash started" push to customer
    await sendCheckinPush(booking, customer);

    res.json({
      bookingId:       booking._id.toString(),
      customerName:    customer?.name  || 'Customer',
      vehicleLabel:    booking.vehicleLabel,
      serviceLabel:    booking.serviceLabel,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
      locationType:    booking.locationType,
      bayLabel:        booking.bayLabel,
    });
  } catch (err) {
    console.error('[Checkin]', err);
    res.status(500).json({ error: 'Check-in failed. Please try again.' });
  }
});

async function sendCheckinPush(booking, user) {
  try {
    const token = user?.expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to:    token,
        title: '🚗 Your wash has started!',
        body:  `Your ${booking.serviceLabel} is now underway. We'll notify you when it's ready.`,
        data:  {
          bookingId: booking._id.toString(),
          type:      'job_checkin',
          jobStatus: 'in_progress',
        },
        sound: 'default',
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Push] Checkin push failed:', err.message);
  }
}

module.exports = router;
