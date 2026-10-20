// server/controllers/claimController.js
// Ownership claims. Claims can only be made on FOUND items that are still open.
// Claimant contact details are only ever returned to the admin.

const { pool } = require('../config/db');
const { asyncHandler, httpError, withTransaction } = require('../utils/helpers');

// POST /api/items/:id/claims  (public)
const createClaim = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const b = req.body;

  const claimId = await withTransaction(async (conn) => {
    // Lock the item row so its status cannot change while we insert the claim.
    const [items] = await conn.execute('SELECT type, status FROM items WHERE id = ? FOR UPDATE', [itemId]);
    if (items.length === 0) {
      throw httpError(404, 'Item not found.');
    }
    if (items[0].type !== 'found') {
      throw httpError(400, 'Claims can only be submitted for found items.');
    }
    if (items[0].status !== 'open') {
      throw httpError(409, 'This item is no longer open for claims.');
    }

    // Anti-spam: one pending claim per email address per item.
    const [duplicates] = await conn.execute(
      `SELECT id FROM claims
       WHERE item_id = ? AND claimant_email = ? AND claim_status = 'pending' LIMIT 1`,
      [itemId, b.claimant_email]
    );
    if (duplicates.length > 0) {
      throw httpError(409, 'You already have a pending claim for this item.');
    }

    const [result] = await conn.execute(
      `INSERT INTO claims (item_id, claimant_name, claimant_email, claimant_phone, proof_description)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, b.claimant_name, b.claimant_email, b.claimant_phone || null, b.proof_description]
    );
    return result.insertId;
  });

  // Reply with a minimal receipt only (no personal data echoed back).
  res.status(201).json({
    message: 'Claim submitted. An admin will review it.',
    data: { id: claimId, item_id: itemId, claim_status: 'pending' },
  });
});

// GET /api/items/:id/claims  (admin only)
const listClaimsForItem = asyncHandler(async (req, res) => {
  const itemId = req.params.id;

  const [items] = await pool.execute('SELECT id, type, title, status FROM items WHERE id = ?', [itemId]);
  if (items.length === 0) {
    throw httpError(404, 'Item not found.');
  }

  const [claims] = await pool.execute(
    `SELECT id, item_id, claimant_name, claimant_email, claimant_phone,
            proof_description, claim_status, created_at
     FROM claims
     WHERE item_id = ?
     ORDER BY created_at DESC, id DESC`,
    [itemId]
  );

  res.json({ item: items[0], data: claims });
});

// PATCH /api/claims/:id  (admin only)  body: { claim_status, note? }
//
// Rules:
//  * Only a pending claim can be decided.
//  * Approving: the item must still be "open". The item becomes "claimed",
//    the change is written to status_history, and any OTHER pending claims
//    for the same item are automatically rejected.
//  * Rejecting: only the claim changes.
// Several tables change together, so everything runs in one transaction.
const decideClaim = asyncHandler(async (req, res) => {
  const claimId = req.params.id;
  const decision = req.body.claim_status; // 'approved' or 'rejected'
  const note = req.body.note || null;

  const outcome = await withTransaction(async (conn) => {
    const [claims] = await conn.execute(
      'SELECT id, item_id, claim_status FROM claims WHERE id = ? FOR UPDATE',
      [claimId]
    );
    if (claims.length === 0) {
      throw httpError(404, 'Claim not found.');
    }
    const claim = claims[0];
    if (claim.claim_status !== 'pending') {
      throw httpError(409, `This claim was already ${claim.claim_status}.`);
    }

    const [items] = await conn.execute('SELECT status FROM items WHERE id = ? FOR UPDATE', [claim.item_id]);
    const item = items[0];

    let autoRejected = 0;

    if (decision === 'approved') {
      if (item.status !== 'open') {
        throw httpError(409, `This item is "${item.status}", so a claim can no longer be approved.`);
      }

      await conn.execute("UPDATE claims SET claim_status = 'approved' WHERE id = ?", [claimId]);

      const [rejected] = await conn.execute(
        `UPDATE claims SET claim_status = 'rejected'
         WHERE item_id = ? AND id <> ? AND claim_status = 'pending'`,
        [claim.item_id, claimId]
      );
      autoRejected = rejected.affectedRows;

      await conn.execute("UPDATE items SET status = 'claimed' WHERE id = ?", [claim.item_id]);
      await conn.execute(
        'INSERT INTO status_history (item_id, old_status, new_status, note) VALUES (?, ?, ?, ?)',
        [claim.item_id, item.status, 'claimed', note || `Claim #${claimId} approved.`]
      );
    } else {
      await conn.execute("UPDATE claims SET claim_status = 'rejected' WHERE id = ?", [claimId]);
    }

    return { itemId: claim.item_id, autoRejected };
  });

  const [claimRows] = await pool.execute(
    `SELECT id, item_id, claimant_name, claimant_email, claimant_phone,
            proof_description, claim_status, created_at
     FROM claims WHERE id = ?`,
    [claimId]
  );
  const [itemRows] = await pool.execute('SELECT status FROM items WHERE id = ?', [outcome.itemId]);

  res.json({
    message: `Claim ${decision}.`,
    data: { ...claimRows[0], item_status: itemRows[0].status },
    auto_rejected_claims: outcome.autoRejected,
  });
});

module.exports = { createClaim, listClaimsForItem, decideClaim };
