// server/routes/statsRoutes.js
// Mounted in app.js at /api/stats

const express = require('express');
const { getStats } = require('../controllers/statsController');

const router = express.Router();

// GET /api/stats
router.get('/', getStats);

module.exports = router;
