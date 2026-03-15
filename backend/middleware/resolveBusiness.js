// middleware/resolveBusiness.js
//
// Resolves the current tenant's businessId and attaches it to req.businessId.
//
// Resolution order (first match wins):
//   1. x-business-id header       — used by mobile apps (stored in SecureStore)
//   2. Subdomain                  — e.g. "acme.washhub.com" → slug "acme"
//   3. JWT claim (req.user)       — fallback if auth middleware already ran
//
// Routes that require a resolved business should call this AFTER authMiddleware.

const Business = require('../models/Business');

const resolveBusiness = async (req, res, next) => {
  try {
    let business = null;

    // 1. Explicit header (highest priority — mobile clients always send this)
    const headerId = req.headers['x-business-id'];
    if (headerId) {
      business = await Business.findById(headerId).lean();
    }

    // 2. Subdomain routing (web / white-label domains)
    if (!business) {
      const host = req.headers.host || '';
      const subdomain = host.split('.')[0];
      // Ignore generic subdomains like "www", "api", "staging", IP addresses
      if (subdomain && !/^(www|api|staging|localhost|\d+)$/.test(subdomain)) {
        business = await Business.findOne({ slug: subdomain, active: true }).lean();
      }
    }

    // 3. JWT claim fallback (req.user set by authMiddleware)
    if (!business && req.user?.businessId) {
      business = await Business.findById(req.user.businessId).lean();
    }

    if (!business) {
      return res.status(400).json({ error: 'Unable to resolve business tenant.' });
    }

    req.businessId = business._id;
    req.business   = business;   // full doc available for settings, branding, etc.
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = resolveBusiness;
