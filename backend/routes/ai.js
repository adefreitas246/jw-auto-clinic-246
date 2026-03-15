// routes/ai.js
// Backend proxy for Claude AI features.
// The Anthropic API key is added server-side — never sent to the mobile app.
//
// POST   /ai/claude                     — main inference proxy
// GET    /ai/claude/schedule-context    — aggregated booking + staff data for scheduling
// GET    /ai/claude/demand-context      — 90-day aggregated booking matrix
// GET    /ai/claude/pricing-context     — current queue + historical slot average
const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const Booking         = require('../models/Booking');
const Worker          = require('../models/Workers');
const authMiddleware  = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL  = 'claude-sonnet-4-6';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Claude call helper ───────────────────────────────────────────────────────

async function callClaude(systemPrompt, userContent) {
  const resp = await axios.post(
    ANTHROPIC_URL,
    {
      model:      CLAUDE_MODEL,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    },
    {
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
    }
  );

  const text = resp.data.content?.[0]?.text ?? '';

  // Strip markdown code fences if present, then parse JSON
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude response did not contain valid JSON');
  return JSON.parse(match[0]);
}

// ─── Prompt templates ─────────────────────────────────────────────────────────

// ── Feature 1: Smart Scheduling ───────────────────────────────────────────────
function buildSchedulingPrompt(payload) {
  const { date, duration, existingBookings, workers, availableSlots } = payload;

  const system = `You are a scheduling assistant for a professional car wash business.
Your job is to recommend the optimal appointment time and technician based on current workload and staff availability.
Always return a single JSON object — no prose, no explanation outside the JSON.`;

  const user =
`Date: ${date}
Service duration: ${duration} minutes
Available time slots: ${JSON.stringify(availableSlots)}
Today's bookings already scheduled:
${JSON.stringify(existingBookings, null, 2)}
Available staff members:
${JSON.stringify(workers, null, 2)}

Given this schedule, recommend the optimal time slot and the best staff member to assign.
Consider: even workload distribution across staff, avoiding back-to-back bookings, and staff skill fit.

Return ONLY this JSON structure (no other text):
{
  "recommendedTime": "HH:MM",
  "staffId": "mongodb_id_or_null",
  "staffName": "display name or Unassigned",
  "reason": "one sentence explanation of why this slot and staff member were chosen"
}`;

  return { system, user };
}

// ── Feature 2: Demand Prediction ──────────────────────────────────────────────
function buildDemandPrompt(payload) {
  const { bookingsByDayHour, totalBookings, period } = payload;

  const system = `You are a business analytics consultant specialising in service businesses.
Analyse booking demand patterns and return structured, actionable staffing recommendations.
Return only a JSON object — no markdown, no prose outside the JSON.`;

  const user =
`Booking demand data for the last ${period} days (${totalBookings} total confirmed/completed bookings).
Top booking slots ranked by frequency:
${JSON.stringify(bookingsByDayHour, null, 2)}

Identify the peak hours, the slowest days of the week, and produce exactly 3 actionable staffing recommendations.
Keep each recommendation concise and business-specific (staff scheduling, opening hours, promotions timing).

Return ONLY this JSON structure:
{
  "peakHours": ["HH:00", "HH:00"],
  "slowDays": ["DayName", "DayName"],
  "recommendations": [
    { "title": "short action title", "detail": "one-to-two sentence actionable recommendation" },
    { "title": "...", "detail": "..." },
    { "title": "...", "detail": "..." }
  ]
}`;

  return { system, user };
}

// ── Feature 3: Dynamic Pricing ────────────────────────────────────────────────
function buildPricingPrompt(payload) {
  const { currentHour, dayOfWeek, queueLength, historicalAvgForSlot, date } = payload;

  const system = `You are a dynamic pricing strategist for a car wash business.
Evaluate current demand versus historical baseline and suggest whether to apply a surcharge, discount, or keep standard pricing.
Return only a JSON object.`;

  const user =
`Current business conditions on ${date}:
- Time: ${currentHour}:00
- Day of week: ${dayOfWeek}
- Vehicles currently in queue today: ${queueLength}
- Historical average bookings for this same day/hour slot: ${historicalAvgForSlot}

Should we apply a peak surcharge, an off-peak discount, or keep standard pricing right now?
Consider: if queue > 150% of historical avg → surcharge; if queue < 50% of historical avg → discount; otherwise none.

Return ONLY this JSON structure:
{
  "suggestion": "surcharge" | "discount" | "none",
  "percentage": <integer 0-30>,
  "reason": "one sentence business justification"
}`;

  return { system, user };
}

// ─── POST /ai/claude — main inference proxy ───────────────────────────────────

router.post('/claude', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { feature, payload } = req.body;
  if (!feature || !payload) {
    return res.status(400).json({ error: 'feature and payload are required.' });
  }

  let prompt;
  try {
    switch (feature) {
      case 'smart_scheduling':  prompt = buildSchedulingPrompt(payload);  break;
      case 'demand_prediction': prompt = buildDemandPrompt(payload);       break;
      case 'dynamic_pricing':   prompt = buildPricingPrompt(payload);      break;
      default:
        return res.status(400).json({ error: `Unknown feature: ${feature}` });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid payload for feature.' });
  }

  try {
    const result = await callClaude(prompt.system, prompt.user);
    res.json({ result });
  } catch (err) {
    const apiErr = err.response?.data ?? err.message;
    console.error('[AI] Claude error:', apiErr);
    res.status(502).json({ error: 'AI request failed. Please try again.' });
  }
});

// ─── GET /ai/claude/schedule-context ─────────────────────────────────────────
// Returns today's bookings + staff list ready for the scheduling prompt.
// Query: date (YYYY-MM-DD), duration (minutes)

router.get('/claude/schedule-context', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { date, duration } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD).' });
  }

  const dur = Math.max(15, parseInt(duration ?? '30', 10));

  try {
    const [bookings, workers] = await Promise.all([
      Booking.find({
        businessId:      req.businessId,
        appointmentDate: date,
        status:          { $in: ['pending_payment', 'confirmed'] },
      }).select('appointmentTime durationMinutes serviceLabel technicianName assignedStaffId').lean(),

      Worker.find({ businessId: req.businessId })
        .select('_id name role')
        .lean(),
    ]);

    // Build available slots (08:00–17:30 grid, 30-min intervals)
    const availableSlots = [];
    for (let m = 8 * 60; m + dur <= 17 * 60 + 30; m += 30) {
      const time = `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
      const slotEnd = m + dur;
      const blocked = bookings.some(bk => {
        const [bh, bm] = bk.appointmentTime.split(':').map(Number);
        const bkStart  = bh * 60 + bm;
        const bkEnd    = bkStart + (bk.durationMinutes || 30);
        return bkStart < slotEnd && bkEnd > m;
      });
      if (!blocked) availableSlots.push(time);
    }

    res.json({
      date,
      duration: dur,
      availableSlots,
      existingBookings: bookings.map(b => ({
        time:     b.appointmentTime,
        duration: b.durationMinutes,
        service:  b.serviceLabel,
        staff:    b.technicianName || 'Unassigned',
        staffId:  b.assignedStaffId ?? null,
      })),
      workers: workers.map(w => ({ id: w._id, name: w.name, role: w.role })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build schedule context.' });
  }
});

// ─── GET /ai/claude/demand-context ───────────────────────────────────────────
// Aggregates last-90-days booking frequency by day-of-week + hour.

router.get('/claude/demand-context', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const bookings = await Booking.find({
      businessId:      req.businessId,
      appointmentDate: { $gte: cutoffStr },
      status:          { $in: ['confirmed', 'completed'] },
    }).select('appointmentDate appointmentTime').lean();

    // Build day × hour frequency matrix
    const matrix = {};
    for (const bk of bookings) {
      const d   = new Date(bk.appointmentDate + 'T12:00:00Z'); // noon avoids DST edge
      const day  = DAY_NAMES[d.getUTCDay()];
      const hour = bk.appointmentTime.split(':')[0] + ':00';
      const key  = `${day} ${hour}`;
      matrix[key] = (matrix[key] || 0) + 1;
    }

    // Sort by frequency, return top 30 slots
    const bookingsByDayHour = Object.entries(matrix)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30)
      .map(([slot, count]) => ({ slot, count }));

    res.json({ period: 90, totalBookings: bookings.length, bookingsByDayHour });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build demand context.' });
  }
});

// ─── GET /ai/claude/pricing-context ──────────────────────────────────────────
// Returns today's live queue + same-slot historical average (last 12 weeks).

router.get('/claude/pricing-context', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const now         = new Date();
    const todayISO    = now.toISOString().slice(0, 10);
    const currentHour = now.getHours();
    const dayOfWeek   = DAY_NAMES[now.getDay()];

    const [queueLength, historicalBookings] = await Promise.all([
      Booking.countDocuments({
        businessId:      req.businessId,
        appointmentDate: todayISO,
        status:          { $in: ['pending_payment', 'confirmed'] },
      }),
      (() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 84); // 12 weeks
        return Booking.find({
          businessId:      req.businessId,
          appointmentDate: { $gte: cutoff.toISOString().slice(0, 10) },
          status:          { $in: ['confirmed', 'completed'] },
        }).select('appointmentDate appointmentTime').lean();
      })(),
    ]);

    // Count bookings in the same day-of-week + hour slot across the 12 weeks
    let sameSlotCount = 0;
    const hourPad = currentHour.toString().padStart(2, '0');
    for (const bk of historicalBookings) {
      const d      = new Date(bk.appointmentDate + 'T12:00:00Z');
      const bkDay  = DAY_NAMES[d.getUTCDay()];
      const bkHour = bk.appointmentTime.split(':')[0];
      if (bkDay === dayOfWeek && bkHour === hourPad) sameSlotCount++;
    }
    const historicalAvgForSlot = Math.round((sameSlotCount / 12) * 10) / 10;

    res.json({ date: todayISO, currentHour, dayOfWeek, queueLength, historicalAvgForSlot });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build pricing context.' });
  }
});

module.exports = router;
