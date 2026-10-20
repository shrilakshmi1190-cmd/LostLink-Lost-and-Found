// server/controllers/statsController.js
// Dashboard numbers. Counts only: no names, emails or phone numbers.

const { pool } = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

// GET /api/stats  (public)
const getStats = asyncHandler(async (req, res) => {
  // SUM() returns text in mysql2, so every value is wrapped in Number() below.
  const [itemResult, claimResult, categoryResult, recentResult] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(type = 'lost'), 0)       AS lost,
             COALESCE(SUM(type = 'found'), 0)      AS found,
             COALESCE(SUM(status = 'open'), 0)     AS open_count,
             COALESCE(SUM(status = 'claimed'), 0)  AS claimed_count,
             COALESCE(SUM(status = 'returned'), 0) AS returned_count,
             COALESCE(SUM(status = 'closed'), 0)   AS closed_count
      FROM items`),
    pool.query(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(claim_status = 'pending'), 0)  AS pending,
             COALESCE(SUM(claim_status = 'approved'), 0) AS approved,
             COALESCE(SUM(claim_status = 'rejected'), 0) AS rejected
      FROM claims`),
    pool.query(`
      SELECT c.id, c.name, COUNT(i.id) AS item_count
      FROM categories c
      LEFT JOIN items i ON i.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY item_count DESC, c.name`),
    pool.query(`SELECT COUNT(*) AS n FROM items WHERE created_at >= NOW() - INTERVAL 7 DAY`),
  ]);

  const items = itemResult[0][0];
  const claims = claimResult[0][0];
  const total = Number(items.total);
  const returned = Number(items.returned_count);

  res.json({
    data: {
      items: {
        total,
        lost: Number(items.lost),
        found: Number(items.found),
        by_status: {
          open: Number(items.open_count),
          claimed: Number(items.claimed_count),
          returned,
          closed: Number(items.closed_count),
        },
      },
      claims: {
        total: Number(claims.total),
        pending: Number(claims.pending),
        approved: Number(claims.approved),
        rejected: Number(claims.rejected),
      },
      recovery: {
        returned,
        // Share of all reports that ended with the item returned to its owner.
        rate_percent: total > 0 ? Math.round((returned / total) * 1000) / 10 : 0,
      },
      recent: { last_7_days: Number(recentResult[0][0].n) },
      by_category: categoryResult[0].map((row) => ({
        id: row.id,
        name: row.name,
        item_count: Number(row.item_count),
      })),
    },
  });
});

module.exports = { getStats };
