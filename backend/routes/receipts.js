// routes/receipts.js
const express = require('express');
const router  = express.Router();

const Transaction     = require('../models/Transaction');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');
const sendEmail       = require('../utils/sendEmail');

const protect = [authMiddleware, resolveBusiness];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isEmail = (s = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
const currency = (n) => Number(n || 0).toFixed(2);

function base64ToAttachment(base64, filename) {
  if (!base64) return null;
  const raw = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  try {
    const buf = Buffer.from(raw, 'base64');
    return buf.length ? { filename, content: buf, contentType: 'application/pdf' } : null;
  } catch { return null; }
}

function buildReceiptHtml(t, businessName = 'Wash Hub') {
  const date = new Date(t.serviceDate).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const discountRow = t.discountLabel && t.discountLabel !== 'No discount'
    ? `<tr><td style="padding:6px 0;color:#555">Discount</td><td style="text-align:right">${t.discountLabel}</td></tr>`
    : '';
  const notesRow = t.notes
    ? `<p style="margin-top:16px;font-size:13px;color:#666;border-top:1px solid #eee;padding-top:12px">${t.notes}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1f1f1f">
  <h2 style="margin:0 0 4px;font-size:20px">${businessName}</h2>
  <p style="margin:0 0 24px;color:#888;font-size:13px">Receipt &middot; ${date}</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
    <tr><td style="padding:7px 0;color:#555;border-bottom:1px solid #f0f0f0">Customer</td>
        <td style="text-align:right;padding:7px 0;border-bottom:1px solid #f0f0f0;font-weight:600">${t.customerName}</td></tr>
    <tr><td style="padding:7px 0;color:#555;border-bottom:1px solid #f0f0f0">Vehicle</td>
        <td style="text-align:right;padding:7px 0;border-bottom:1px solid #f0f0f0">${t.vehicleDetails}</td></tr>
    <tr><td style="padding:7px 0;color:#555;border-bottom:1px solid #f0f0f0">Service</td>
        <td style="text-align:right;padding:7px 0;border-bottom:1px solid #f0f0f0">${t.serviceType}</td></tr>
    <tr><td style="padding:7px 0;color:#555;border-bottom:1px solid #f0f0f0">Payment</td>
        <td style="text-align:right;padding:7px 0;border-bottom:1px solid #f0f0f0">${t.paymentMethod}</td></tr>
    ${discountRow}
  </table>

  <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #222;padding-top:14px">
    <span style="font-weight:700;font-size:17px">Total</span>
    <span style="font-weight:800;font-size:20px">$${currency(t.finalPrice)}</span>
  </div>

  ${notesRow}

  <p style="margin-top:28px;font-size:11px;color:#bbb;text-align:center">
    Thank you for your business &mdash; ${businessName}
  </p>
</body>
</html>`;
}

// ── GET /api/receipts ─────────────────────────────────────────────────────────
// List receipts for the business. Supports ?from=&to=&limit=&skip=

router.get('/', ...protect, async (req, res) => {
  try {
    const { limit = 50, skip = 0, from, to } = req.query;

    const filter = { businessId: req.business._id };
    if (from || to) {
      filter.serviceDate = {};
      if (from) filter.serviceDate.$gte = new Date(from);
      if (to)   filter.serviceDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const receipts = await Transaction
      .find(filter)
      .select('serviceType serviceDate vehicleDetails customerName paymentMethod finalPrice discountLabel email receiptFileName createdAt')
      .sort({ serviceDate: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200));

    res.json(receipts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/receipts/:transactionId ─────────────────────────────────────────
// Return full receipt data for one transaction, including the stored PDF base64.

router.get('/:transactionId', ...protect, async (req, res) => {
  try {
    const t = await Transaction.findOne({
      _id:        req.params.transactionId,
      businessId: req.business._id,
    }).select(
      'serviceType serviceDate vehicleDetails customerName paymentMethod ' +
      'finalPrice originalPrice discountLabel discountAmount discountPercent ' +
      'receiptPdfBase64 receiptFileName email notes createdAt'
    );

    if (!t) return res.status(404).json({ message: 'Receipt not found.' });

    res.json({
      _id:             t._id,
      serviceType:     t.serviceType,
      serviceDate:     t.serviceDate,
      vehicleDetails:  t.vehicleDetails,
      customerName:    t.customerName,
      paymentMethod:   t.paymentMethod,
      finalPrice:      t.finalPrice,
      originalPrice:   t.originalPrice,
      discountLabel:   t.discountLabel,
      email:           t.email,
      notes:           t.notes,
      receiptFileName: t.receiptFileName,
      hasAttachment:   !!t.receiptPdfBase64,
      receiptPdfBase64: t.receiptPdfBase64 || null,
      createdAt:       t.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/receipts/:transactionId/email ───────────────────────────────────
// Re-send the receipt email for a transaction.
// Body: { email? }  — optional override; falls back to the address on the transaction.

router.post('/:transactionId/email', ...protect, async (req, res) => {
  try {
    const t = await Transaction.findOne({
      _id:        req.params.transactionId,
      businessId: req.business._id,
    });

    if (!t) return res.status(404).json({ message: 'Transaction not found.' });

    const to = ((req.body.email || t.email || '').trim()).toLowerCase();
    if (!to || !isEmail(to)) {
      return res.status(400).json({ message: 'A valid recipient email address is required.' });
    }

    const businessName = req.business?.name || 'Wash Hub';
    const html         = buildReceiptHtml(t, businessName);
    const filename     = t.receiptFileName || `Receipt-${t._id}.pdf`;
    const attachment   = base64ToAttachment(t.receiptPdfBase64, filename);

    await sendEmail({
      to,
      subject:     `Your ${businessName} Receipt`,
      html,
      attachments: attachment ? [attachment] : [],
    });

    // Persist the address if it was changed
    if (req.body.email && to !== (t.email || '').toLowerCase()) {
      await Transaction.findByIdAndUpdate(t._id, { email: to });
    }

    res.json({ message: 'Receipt sent.', to });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/receipts/:transactionId/attachment ────────────────────────────
// Strip the stored PDF base64 from a transaction to free up space.

router.delete('/:transactionId/attachment', ...protect, async (req, res) => {
  try {
    const t = await Transaction.findOneAndUpdate(
      { _id: req.params.transactionId, businessId: req.business._id },
      { receiptPdfBase64: '', receiptFileName: '' },
      { new: true }
    );

    if (!t) return res.status(404).json({ message: 'Transaction not found.' });

    res.json({ message: 'Attachment removed.', _id: t._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
