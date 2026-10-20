// server/routes/itemRoutes.js
// Mounted in app.js at /api/items
// (The claim routes /items/:id/claims live in claimRoutes.js.)

const express = require('express');
const { uploadImage } = require('../middleware/upload');
const { adminAuth } = require('../middleware/adminAuth');
const {
  handleValidation,
  validateIdParam,
  validateListQuery,
  validateCreateItem,
  validateStatusUpdate,
} = require('../middleware/validate');
const { listItems, getItem, createItem, updateItemStatus } = require('../controllers/itemController');

const router = express.Router();

// GET /api/items?type=&status=&category=&search=&date_from=&date_to=&page=&limit=
router.get('/', validateListQuery, handleValidation, listItems);

// POST /api/items  (multipart/form-data with optional "image", or plain JSON)
router.post('/', uploadImage, validateCreateItem, handleValidation, createItem);

// GET /api/items/:id
router.get('/:id', validateIdParam, handleValidation, getItem);

// PATCH /api/items/:id/status  (admin only)
router.patch('/:id/status', adminAuth, validateIdParam, validateStatusUpdate, handleValidation, updateItemStatus);

module.exports = router;
