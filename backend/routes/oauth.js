// routes/oauth.js
// POST /api/auth/google  — verify Google accessToken, return Wash Hub JWT
// POST /api/auth/apple   — verify Apple identityToken, return Wash Hub JWT
//
// No extra packages needed:
//   - axios           (already in package.json) — calls Google userinfo & Apple JWKS
//   - jsonwebtoken    (already in package.json) — verifies Apple JWT + signs our JWT
//   - crypto          (Node built-in)           — JWK→PEM + random passwords

const crypto  = require('crypto');
const express = require('express');
const jwt     = require('jsonwebtoken');
const axios   = require('axios');

const User = require('../models/Users');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build the standard auth response payload (matches existing /login shape). */
function buildAuthPayload(user, token) {
  return {
    _id:        user._id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    businessId: user.businessId ?? null,
    token,
    type: 'User',
  };
}

/** Sign a 7-day JWT for a User document. */
function signToken(user) {
  return jwt.sign(
    {
      userId:     user._id,
      role:       user.role,
      name:       user.name,
      type:       'User',
      businessId: user.businessId ?? null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Apple JWKS cache ──────────────────────────────────────────────────────────
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_KEYS_TTL = 24 * 60 * 60 * 1000; // 24 h

let _appleKeysCache   = null;
let _appleKeysCachedAt = 0;

/**
 * Fetch Apple's public JWKS and return the key matching `kid`.
 * Result is cached for 24 hours to avoid hammering Apple's endpoint.
 */
async function getApplePublicPem(kid) {
  if (!_appleKeysCache || Date.now() - _appleKeysCachedAt > APPLE_KEYS_TTL) {
    const { data } = await axios.get(APPLE_JWKS_URL);
    _appleKeysCache    = data.keys;
    _appleKeysCachedAt = Date.now();
  }

  const jwk = _appleKeysCache.find((k) => k.kid === kid);
  if (!jwk) {
    // Cache may be stale — force a refresh and try once more
    const { data } = await axios.get(APPLE_JWKS_URL);
    _appleKeysCache    = data.keys;
    _appleKeysCachedAt = Date.now();

    const refreshedJwk = _appleKeysCache.find((k) => k.kid === kid);
    if (!refreshedJwk) throw new Error(`Apple JWK not found for kid: ${kid}`);
    return jwkToPem(refreshedJwk);
  }

  return jwkToPem(jwk);
}

/** Convert a JWK object to a PEM string using Node.js built-in crypto (Node ≥15.9). */
function jwkToPem(jwk) {
  const keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return keyObj.export({ type: 'spki', format: 'pem' });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google
// Body: { accessToken: string }
//
// Flow:
//   1. Call Google userinfo with the accessToken
//   2. Find user by googleId OR email
//   3. If found but not linked → link googleId to existing account
//   4. If not found → create new customer account with random password
//   5. Return signed JWT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required.' });
    }

    // 1. Verify token and fetch profile from Google
    let googleProfile;
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      googleProfile = data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return res.status(401).json({ error: 'Invalid or expired Google access token.' });
      }
      throw err;
    }

    const { sub: googleId, email, name, picture } = googleProfile;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google did not return a valid profile.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Find existing user by googleId (most reliable) or email
    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }],
    });

    if (!user) {
      // 3. New user — create as customer
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = new User({
        name:     name || normalizedEmail.split('@')[0],
        email:    normalizedEmail,
        password: randomPassword,
        role:     'customer',
        googleId,
        provider: 'google',
        avatar:   picture || null,
      });
      await user.save();
    } else if (!user.googleId) {
      // 4. Existing account found by email — link Google to it
      user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
      await user.save();
    }

    // 5. Issue JWT
    const token = signToken(user);
    return res.json(buildAuthPayload(user, token));

  } catch (err) {
    console.error('[OAuth] Google sign-in error:', err.message);
    res.status(500).json({ error: 'Server error during Google sign-in.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/apple
// Body: { identityToken: string, fullName?: string }
//
// Flow:
//   1. Decode JWT header to extract kid
//   2. Fetch Apple's matching public key (JWKS), convert to PEM
//   3. Verify and decode identityToken with jwt.verify
//   4. Validate iss + aud claims
//   5. Find user by appleId OR email (if provided)
//   6. If found but not linked → link appleId
//   7. If not found → create new customer account
//   8. Return signed JWT
//
// Note: Apple only returns email on the VERY FIRST sign-in. Subsequent sign-ins
// only carry `sub` (appleId). Always store appleId on first login so you can
// find the user on return visits without email.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken is required.' });
    }

    // 1. Decode JWT header (no verify yet — just need kid)
    const [headerB64] = identityToken.split('.');
    let header;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed Apple identity token.' });
    }

    if (!header.kid) {
      return res.status(400).json({ error: 'Apple identity token missing key ID.' });
    }

    // 2. Get matching Apple public key as PEM
    let pem;
    try {
      pem = await getApplePublicPem(header.kid);
    } catch (err) {
      console.error('[OAuth] Apple JWKS fetch failed:', err.message);
      return res.status(502).json({ error: 'Could not fetch Apple public keys.' });
    }

    // 3. Verify the identity token
    const APPLE_BUNDLE_ID =
      process.env.APPLE_BUNDLE_ID || 'com.adefreitas.jwautoclinic';

    let claims;
    try {
      claims = jwt.verify(identityToken, pem, {
        algorithms: ['RS256'],
        issuer:     'https://appleid.apple.com',
        audience:   APPLE_BUNDLE_ID,
      });
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError'
          ? 'Apple identity token has expired.'
          : 'Apple identity token verification failed.';
      return res.status(401).json({ error: msg });
    }

    // 4. Extract claims
    const { sub: appleId, email } = claims;

    if (!appleId) {
      return res.status(400).json({ error: 'Apple token missing subject claim.' });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    // 5. Find existing user
    const query = normalizedEmail
      ? { $or: [{ appleId }, { email: normalizedEmail }] }
      : { appleId };

    let user = await User.findOne(query);

    if (!user && !normalizedEmail) {
      // Subsequent sign-in but user record not found — can't create without email
      return res.status(404).json({
        error: 'No account found. Please sign in with Apple on a fresh install to link your account.',
      });
    }

    if (!user) {
      // 6. First sign-in — create new customer account
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = new User({
        name:     fullName || normalizedEmail.split('@')[0],
        email:    normalizedEmail,
        password: randomPassword,
        role:     'customer',
        appleId,
        provider: 'apple',
      });
      await user.save();
    } else if (!user.appleId) {
      // 7. Existing account found by email — link Apple ID
      user.appleId = appleId;
      if (fullName && !user.name) user.name = fullName;
      await user.save();
    }

    // 8. Issue JWT
    const token = signToken(user);
    return res.json(buildAuthPayload(user, token));

  } catch (err) {
    console.error('[OAuth] Apple sign-in error:', err.message);
    res.status(500).json({ error: 'Server error during Apple sign-in.' });
  }
});

module.exports = router;
