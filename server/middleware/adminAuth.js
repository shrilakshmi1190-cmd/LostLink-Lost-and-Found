// server/middleware/adminAuth.js
// Basic admin protection using a passcode stored in the .env file.
// The client sends it in the "x-admin-passcode" request header.
//
// NOTE: This is a simple prototype safeguard for a college project.
// It is NOT production-grade authentication (no users, sessions or tokens).

require('dotenv').config();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Compares two strings without leaking information through timing.
// Both values are hashed first so they always have equal length.
function passcodeMatches(provided) {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected || typeof provided !== 'string' || provided.length === 0) {
    return false;
  }
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Returns true/false without blocking the request.
// Used to show extra (private) details only when the caller is the admin.
function isAdminRequest(req) {
  return passcodeMatches(req.get('x-admin-passcode'));
}

// Limits wrong guesses: only FAILED requests (status 400+) are counted.
const failedAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many failed admin attempts. Please try again later.' },
});

function checkPasscode(req, res, next) {
  if (!process.env.ADMIN_PASSCODE) {
    return res.status(500).json({ message: 'Admin passcode is not configured on the server.' });
  }
  if (!isAdminRequest(req)) {
    return res.status(401).json({ message: 'Invalid or missing admin passcode.' });
  }
  next();
}

// Express accepts an array of middleware, so routes simply use: adminAuth
const adminAuth = [failedAttemptLimiter, checkPasscode];

module.exports = { adminAuth, isAdminRequest };
