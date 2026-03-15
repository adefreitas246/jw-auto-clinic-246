// routes/vehicles.js
// GET/POST/PUT/DELETE /api/vehicles  — customer vehicle profiles
// POST /api/vehicles/ocr-plate       — license plate OCR (Google Vision)
const express        = require('express');
const router         = express.Router();
const axios          = require('axios');
const Vehicle        = require('../models/Vehicle');
const authMiddleware = require('../middleware/authMiddleware');
const resolveBusiness = require('../middleware/resolveBusiness');

const protect = [authMiddleware, resolveBusiness];

// ─────────────────────────────────────────────────────────────────────────────
// OCR helper
// Uses Google Cloud Vision TEXT_DETECTION.
// Set GOOGLE_VISION_API_KEY in env; if absent the endpoint returns { plate: '' }.
// ─────────────────────────────────────────────────────────────────────────────
const PLATE_REGEX = /\b([A-Z0-9]{2,8}(?:[- ][A-Z0-9]{1,4})?)\b/g;

async function detectPlateText(imageBase64) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return '';

  const { data } = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      requests: [{
        image:    { content: imageBase64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 10 }],
      }],
    },
    { timeout: 10_000 }
  );

  const fullText = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!fullText) return '';

  // Find the longest token that looks like a plate (2–8 uppercase alnum chars)
  const candidates = [...fullText.toUpperCase().matchAll(PLATE_REGEX)].map(m => m[1]);
  if (!candidates.length) return '';

  // Prefer the longest match
  return candidates.reduce((a, b) => (a.length >= b.length ? a : b), '');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehicles/ocr-plate
// Body: { imageBase64: string }  (raw base64, no data-URL prefix)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ocr-plate', protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required.' });

    // Strip data-URL prefix if the client accidentally included it
    const raw = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    const plate = await detectPlateText(raw);
    return res.json({ plate });
  } catch (err) {
    console.error('[OCR] plate detection failed:', err.message);
    // Never fail the client request — just return empty so the user can type manually
    return res.json({ plate: '' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles  — list vehicles for the authenticated customer
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      userId:     req.user.id,
      businessId: req.businessId,
    }).sort({ createdAt: -1 });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vehicles.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehicles  — create a new vehicle
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { make, model, licensePlate, color, size, notes, platePhotoUrl } = req.body;

    if (!make?.trim())  return res.status(400).json({ error: 'Make is required.' });
    if (!model?.trim()) return res.status(400).json({ error: 'Model is required.' });

    const vehicle = await Vehicle.create({
      userId:       req.user.id,
      businessId:   req.businessId,
      make:         make.trim(),
      model:        model.trim(),
      licensePlate: (licensePlate ?? '').trim(),
      color:        (color ?? '').trim(),
      size:         size ?? 'Sedan',
      notes:        (notes ?? '').trim(),
      platePhotoUrl: platePhotoUrl ?? '',
    });

    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create vehicle.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/vehicles/:id  — update a vehicle (must belong to requesting user)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const { make, model, licensePlate, color, size, notes, platePhotoUrl } = req.body;

    const update = {};
    if (make        !== undefined) update.make         = make.trim();
    if (model       !== undefined) update.model        = model.trim();
    if (licensePlate !== undefined) update.licensePlate = licensePlate.trim();
    if (color       !== undefined) update.color        = color.trim();
    if (size        !== undefined) update.size         = size;
    if (notes       !== undefined) update.notes        = notes.trim();
    if (platePhotoUrl !== undefined) update.platePhotoUrl = platePhotoUrl;

    const updated = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, businessId: req.businessId },
      update,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: 'Vehicle not found.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update vehicle.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/vehicles/:id  — delete a vehicle
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Vehicle.findOneAndDelete({
      _id:        req.params.id,
      userId:     req.user.id,
      businessId: req.businessId,
    });
    if (!deleted) return res.status(404).json({ error: 'Vehicle not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vehicle.' });
  }
});

module.exports = router;
