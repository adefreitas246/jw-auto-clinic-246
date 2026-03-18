// middleware/resolveBusiness.js
//
// Resolves the current tenant's businessId and attaches it to req.businessId.
//
// Resolution order (first match wins):
//   1. x-business-id header       — used by mobile apps (stored in SecureStore)
//   2. req.user?.businessId       — from JWT via authMiddleware
//   3. First active Business in DB — single-tenant fallback

const Business = require('../models/Business');

const resolveBusiness = async (req, res, next) => {
  try {
    let businessId =
      req.headers['x-business-id'] ||
      req.user?.businessId;

    if (!businessId) {
      // Fallback: use the first business in the database
      const business = await Business.findOne({ active: true });
      if (!business) {
        return res.status(404).json({ message: 'No business found' });
      }
      req.business = business;
      req.businessId = business._id;
      return next();
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    req.business = business;
    req.businessId = business._id;
    next();
  } catch (error) {
    console.error('resolveBusiness error:', error);
    res.status(500).json({ message: 'Error resolving business' });
  }
};

module.exports = resolveBusiness;
