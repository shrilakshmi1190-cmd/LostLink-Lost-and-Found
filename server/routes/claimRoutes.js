// server/routes/claimRoutes.js
// Mounted in app.js at /api, so the full paths are written out here.

const express = require('express');
const { adminAuth } = require('../middleware/adminAuth');
const {
  handleValidation,
  validateIdParam,
  validateCreateClaim,
  validateClaimDecision,
} = require('../middleware/validate');
const { createClaim, listClaimsForItem, decideClaim } = require('../controllers/claimController');

const router = express.Router();

// POST /api/items/:id/claims  (public, found items only)
router.post('/items/:id/claims', validateIdParam, validateCreateClaim, handleValidation, createClaim);

// GET /api/items/:id/claims  (admin only)
router.get('/items/:id/claims', adminAuth, validateIdParam, handleValidation, listClaimsForItem);

// PATCH /api/claims/:id  (admin only)
router.patch('/claims/:id', adminAuth, validateIdParam, validateClaimDecision, handleValidation, decideClaim);

module.exports = router;
