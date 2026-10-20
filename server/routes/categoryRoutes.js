// server/routes/categoryRoutes.js
// Mounted in app.js at /api/categories

const express = require('express');
const { listCategories } = require('../controllers/categoryController');

const router = express.Router();

// GET /api/categories
router.get('/', listCategories);

module.exports = router;