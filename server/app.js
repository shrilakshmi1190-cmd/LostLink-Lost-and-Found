// server/app.js
// Builds the Express application: security middleware, routes, error handling.
// (server.js is the file that actually starts listening on a port.)

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./config/db');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- Security headers -------------------------------------------------
// crossOriginResourcePolicy is relaxed so the React app (port 5173) can
// display images that are served by this API (port 5000).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// --- CORS: only the Vite frontend may call this API from a browser -----
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-passcode'],
  })
);

// --- Rate limiting ------------------------------------------------------
const jsonLimitMessage = { message: 'Too many requests. Please try again later.' };

// General limit for every API call
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonLimitMessage,
});

// Stricter limit for public POST requests (new reports and claims) to reduce spam
const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: jsonLimitMessage,
});

app.use('/api', generalLimiter);
app.use('/api', postLimiter);

// --- Body parsing (JSON only; image uploads are handled by multer) -----
app.use(express.json({ limit: '100kb' }));

// --- Uploaded images are served from /uploads/<filename> ---------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Health check ---------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (err) {
    console.error('Health check: database unreachable:', err.code || err.message);
    res.status(503).json({ status: 'error', database: 'unreachable', time: new Date().toISOString() });
  }
});

// --- API routes -------------------------------------------------------------
app.use('/api/items', itemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', claimRoutes); // /items/:id/claims and /claims/:id

// --- 404 and central error handler (must be LAST) -------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
