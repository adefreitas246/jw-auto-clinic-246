// routes/inventory.js
//
//   GET    /api/inventory                        — list all items
//   POST   /api/inventory                        — create item (admin)
//   PATCH  /api/inventory/:id                    — edit item (admin)
//   PATCH  /api/inventory/:id/adjust             — quick stock delta (staff+)
//   DELETE /api/inventory/:id                    — delete (admin)
//
//   GET    /api/inventory/service-map            — list service→item mappings
//   POST   /api/inventory/service-map            — upsert mapping (admin)
//   DELETE /api/inventory/service-map/:mapId     — remove mapping (admin)
//
//   POST   /api/inventory/deduct-for-booking/:bookingId — auto-deduct on job finish
const express    = require('express');
const router     = express.Router();
const axios      = require('axios');

const InventoryItem      = require('../models/InventoryItem');
const ServiceInventory   = require('../models/ServiceInventory');
const Business           = require('../models/Business');
const Booking            = require('../models/Booking');
const authMiddleware     = require('../middleware/authMiddleware');
const resolveBusiness    = require('../middleware/resolveBusiness');

const protect      = [authMiddleware, resolveBusiness];
const adminProtect = [authMiddleware, resolveBusiness, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  next();
}];

// ── Push helper ───────────────────────────────────────────────────────────────

/**
 * Sends a low-stock push notification to all registered admin/staff devices
 * for this business. Uses Business.pushTokens (device tokens registered at login).
 */
async function notifyLowStock(business, item) {
  try {
    const tokens = (business.pushTokens || [])
      .filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));
    if (!tokens.length) return;

    const messages = tokens.map(to => ({
      to,
      title: '⚠️ Low Stock Alert',
      body:  `${item.name} is running low — ${item.currentStock} ${item.unit} remaining`,
      data:  { type: 'low_stock', itemId: item._id.toString(), itemName: item.name },
      sound: 'default',
      priority: 'high',
      badge: 1,
    }));

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      messages,
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
  } catch (err) {
    console.warn('[Inventory] Push failed:', err.message);
  }
}

/**
 * After any stock change: check threshold and fire push if needed.
 * Returns true if a low-stock alert was sent.
 */
async function checkAndNotify(businessId, item) {
  if (item.currentStock < item.lowStockThreshold) {
    const business = await Business.findById(businessId).select('pushTokens').lean();
    if (business) await notifyLowStock(business, item);
    return true;
  }
  return false;
}

// ── GET /api/inventory ────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const items = await InventoryItem
      .find({ businessId: req.businessId })
      .sort({ category: 1, name: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory.' });
  }
});

// ── GET /api/inventory/service-map (must precede /:id) ────────────────────────
router.get('/service-map', protect, async (req, res) => {
  try {
    const maps = await ServiceInventory
      .find({ businessId: req.businessId })
      .populate('serviceId',       'name category')
      .populate('packageId',       'name')
      .populate('inventoryItemId', 'name unit currentStock')
      .sort({ createdAt: 1 })
      .lean();
    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch service map.' });
  }
});

// ── GET /api/inventory/:id ────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      _id: req.params.id, businessId: req.businessId,
    }).lean();
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory item.' });
  }
});

// ── POST /api/inventory ───────────────────────────────────────────────────────
router.post('/', adminProtect, async (req, res) => {
  try {
    const {
      name, category, currentStock, unit, lowStockThreshold, notes,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
    if (!unit?.trim()) return res.status(400).json({ error: 'unit is required.' });

    const item = await InventoryItem.create({
      businessId:        req.businessId,
      name:              name.trim(),
      category:          category || 'Other',
      currentStock:      Number(currentStock) || 0,
      unit:              unit.trim(),
      lowStockThreshold: Number(lowStockThreshold) || 10,
      notes:             notes?.trim() ?? '',
    });

    // Notify immediately if new item is already below threshold
    await checkAndNotify(req.businessId, item);

    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An item with this name already exists.' });
    }
    console.error('[Inventory] create:', err);
    res.status(500).json({ error: 'Failed to create inventory item.' });
  }
});

// ── PATCH /api/inventory/:id ──────────────────────────────────────────────────
router.patch('/:id', adminProtect, async (req, res) => {
  try {
    const {
      name, category, currentStock, unit, lowStockThreshold, notes,
    } = req.body;

    const update = {};
    if (name          !== undefined) update.name              = name.trim();
    if (category      !== undefined) update.category          = category;
    if (currentStock  !== undefined) update.currentStock      = Number(currentStock);
    if (unit          !== undefined) update.unit              = unit.trim();
    if (lowStockThreshold !== undefined) update.lowStockThreshold = Number(lowStockThreshold);
    if (notes         !== undefined) update.notes             = notes.trim();

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      update,
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ error: 'Item not found.' });

    await checkAndNotify(req.businessId, item);
    res.json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An item with this name already exists.' });
    }
    console.error('[Inventory] update:', err);
    res.status(500).json({ error: 'Failed to update inventory item.' });
  }
});

// ── PATCH /api/inventory/:id/adjust ──────────────────────────────────────────
// Quick stock adjustment. Body: { delta: number } (positive or negative)
router.patch('/:id/adjust', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const delta = Number(req.body.delta);
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({ error: 'delta must be a non-zero number.' });
    }

    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $inc: { currentStock: delta } },
      { new: true }
    );

    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const alerted = await checkAndNotify(req.businessId, item);
    res.json({ ...item.toObject(), lowStockAlert: alerted });
  } catch (err) {
    console.error('[Inventory] adjust:', err);
    res.status(500).json({ error: 'Failed to adjust stock.' });
  }
});

// ── DELETE /api/inventory/:id ─────────────────────────────────────────────────
router.delete('/:id', adminProtect, async (req, res) => {
  try {
    const deleted = await InventoryItem.findOneAndDelete({
      _id: req.params.id, businessId: req.businessId,
    });
    if (!deleted) return res.status(404).json({ error: 'Item not found.' });

    // Clean up any service mappings that referenced this item
    await ServiceInventory.deleteMany({
      businessId:      req.businessId,
      inventoryItemId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[Inventory] delete:', err);
    res.status(500).json({ error: 'Failed to delete inventory item.' });
  }
});

// ── POST /api/inventory/service-map ──────────────────────────────────────────
router.post('/service-map', adminProtect, async (req, res) => {
  try {
    const { serviceId, packageId, inventoryItemId, amountPerUse } = req.body;

    if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required.' });
    if (!serviceId && !packageId) return res.status(400).json({ error: 'serviceId or packageId required.' });
    if (!amountPerUse || Number(amountPerUse) <= 0) {
      return res.status(400).json({ error: 'amountPerUse must be > 0.' });
    }

    // Upsert: update if mapping exists, else create
    const filter = {
      businessId:      req.businessId,
      inventoryItemId,
      ...(serviceId ? { serviceId } : { packageId }),
    };

    const map = await ServiceInventory.findOneAndUpdate(
      filter,
      { ...filter, amountPerUse: Number(amountPerUse) },
      { upsert: true, new: true, runValidators: true }
    ).populate('serviceId', 'name').populate('inventoryItemId', 'name unit');

    res.status(201).json(map);
  } catch (err) {
    console.error('[Inventory] service-map create:', err);
    res.status(500).json({ error: 'Failed to save service mapping.' });
  }
});

// ── DELETE /api/inventory/service-map/:mapId ──────────────────────────────────
router.delete('/service-map/:mapId', adminProtect, async (req, res) => {
  try {
    const deleted = await ServiceInventory.findOneAndDelete({
      _id: req.params.mapId, businessId: req.businessId,
    });
    if (!deleted) return res.status(404).json({ error: 'Mapping not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service mapping.' });
  }
});

// ── POST /api/inventory/deduct-for-booking/:bookingId ────────────────────────
// Call this after marking a job as finished to auto-deduct inventory.
// Can be called from frontend job-complete flow OR an internal backend hook.
router.post('/deduct-for-booking/:bookingId', protect, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Staff access required.' });
    }

    const booking = await Booking.findOne({
      _id:        req.params.bookingId,
      businessId: req.businessId,
    }).lean();

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    // Find all inventory mappings for this service / package
    const serviceFilter = booking.packageId
      ? { businessId: req.businessId, packageId: booking.packageId }
      : booking.addonServiceIds?.length
        ? { businessId: req.businessId, serviceId: { $in: [booking.packageId, ...booking.addonServiceIds] } }
        : null;

    // Also check by single serviceId from packageId
    const mappingFilter = {
      businessId: req.businessId,
      $or: [
        ...(booking.packageId         ? [{ packageId:  booking.packageId }]                            : []),
        ...(booking.addonServiceIds?.length ? [{ serviceId: { $in: booking.addonServiceIds } }]         : []),
      ],
    };

    if (!mappingFilter.$or.length) {
      return res.json({ deducted: [], message: 'No service/package mappings to deduct.' });
    }

    const maps = await ServiceInventory.find(mappingFilter).lean();
    if (!maps.length) {
      return res.json({ deducted: [], message: 'No inventory mappings configured for this service.' });
    }

    const deducted = [];
    const alerts   = [];

    for (const map of maps) {
      const item = await InventoryItem.findOneAndUpdate(
        { _id: map.inventoryItemId, businessId: req.businessId },
        { $inc: { currentStock: -map.amountPerUse } },
        { new: true }
      );
      if (!item) continue;

      deducted.push({
        itemId:   item._id.toString(),
        itemName: item.name,
        deducted: map.amountPerUse,
        remaining:item.currentStock,
        unit:     item.unit,
      });

      const alerted = await checkAndNotify(req.businessId, item);
      if (alerted) alerts.push(item.name);
    }

    res.json({ deducted, lowStockAlerts: alerts });
  } catch (err) {
    console.error('[Inventory] deduct-for-booking:', err);
    res.status(500).json({ error: 'Failed to deduct inventory.' });
  }
});

module.exports = router;
