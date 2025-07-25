//middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// It is good practice to fail early if the secret is missing
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ Warning: JWT_SECRET is not set in your environment variables.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing or malformed.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify and decode the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to the request
    req.user = {
      id: decoded.userId,
      role: decoded.role || 'user', // optional: include other fields
      name: decoded.name || '',
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
