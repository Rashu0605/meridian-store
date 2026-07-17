const { verifyToken } = require('../utils/jwt');

// Reads the "Authorization: Bearer <token>" header, checks it's a valid
// token we issued, and attaches the user info to req.user for every route
// after this one. If there's no valid token, the request is rejected here
// — it never reaches the actual route handler.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

// This is the actual security boundary for "only the store owner can edit."
// It runs after requireAuth, and it checks req.user.role — a value that
// came from OUR database and was signed into the token by OUR server, not
// anything the browser sent. A customer cannot fake this by editing
// JavaScript in their browser, because this check happens server-side.
function requireOwner(req, res, next) {
  if (req.user?.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only the store owner can do this.' });
  }
  next();
}

module.exports = { requireAuth, requireOwner };
