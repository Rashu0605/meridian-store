const jwt = require('jsonwebtoken');

// Every token carries the user's id and role. The role is what the rest of
// the app trusts to decide whether someone can edit the store or not —
// it is set once at signup and never taken from anything the client sends.
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
