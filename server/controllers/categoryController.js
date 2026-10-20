// server/controllers/categoryController.js
// Supplies the category list for dropdowns and filters.

const { pool } = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

// GET /api/categories  (public). Alphabetical, with "Other" always last.
const listCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, name FROM categories ORDER BY (name = 'Other'), name"
  );
  res.json({ data: rows });
});

module.exports = { listCategories };
