// server/controllers/itemController.js
// Logic for lost/found reports: list, view one, create, change status.
//
// PRIVACY RULE: reporter_name / reporter_email / reporter_phone are only
// returned to a request that carries the correct admin passcode.

const { pool } = require('../config/db');
const { isAdminRequest } = require('../middleware/adminAuth');
const { asyncHandler, httpError, withTransaction } = require('../utils/helpers');

const DEFAULT_LIMIT = 12;

// These column lists are fixed text written by us (never user input),
// so putting them into the SQL string is safe.
const PUBLIC_COLUMNS = `
  i.id, i.type, i.title, i.description, i.category_id, c.name AS category_name,
  i.location, i.date_occurred, i.image_path, i.status, i.created_at, i.updated_at`;
const PRIVATE_COLUMNS = `, i.reporter_name, i.reporter_email, i.reporter_phone`;
const FROM_CLAUSE = `FROM items i JOIN categories c ON c.id = i.category_id`;

// Makes % and _ typed by a visitor behave as normal characters in LIKE.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

// GET /api/items  -> filters, search, pagination (public, no contact details)
const listItems = asyncHandler(async (req, res) => {
  const { type, status, category, date_from, date_to } = req.query;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;

  if (date_from && date_to && date_from > date_to) {
    throw httpError(400, 'date_from cannot be later than date_to.');
  }

  // Build the WHERE clause. Values go into "params", never into the SQL text.
  const conditions = [];
  const params = [];

  if (type) {
    conditions.push('i.type = ?');
    params.push(type);
  }
  if (status) {
    conditions.push('i.status = ?');
    params.push(status);
  }
  if (category) {
    conditions.push('i.category_id = ?');
    params.push(parseInt(category, 10));
  }
  if (date_from) {
    conditions.push('i.date_occurred >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('i.date_occurred <= ?');
    params.push(date_to);
  }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)');
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  // pool.query (not pool.execute) is used here because some MySQL 8 versions
  // reject numbers for LIMIT/OFFSET in prepared statements. Values are still
  // escaped safely by the driver.
  const [countResult, rowsResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total ${FROM_CLAUSE} ${where}`, params),
    pool.query(
      `SELECT ${PUBLIC_COLUMNS} ${FROM_CLAUSE} ${where}
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
  ]);

  const total = Number(countResult[0][0].total);

  res.json({
    data: rowsResult[0],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/items/:id  -> one item + its status timeline
// Admin callers (correct x-admin-passcode header) also get contact details
// and the private admin notes.
const getItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const admin = isAdminRequest(req);

  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS}${admin ? PRIVATE_COLUMNS : ''} ${FROM_CLAUSE} WHERE i.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw httpError(404, 'Item not found.');
  }

  const historyColumns = admin
    ? 'old_status, new_status, note, changed_at'
    : 'old_status, new_status, changed_at'; // notes may contain private details
  const [history] = await pool.execute(
    `SELECT ${historyColumns} FROM status_history WHERE item_id = ? ORDER BY changed_at ASC, id ASC`,
    [id]
  );

  res.json({ data: { ...rows[0], status_history: history } });
});

// POST /api/items  -> create a lost/found report (image is optional)
// Runs after: uploadImage, validateCreateItem, handleValidation.
// If anything fails, errorHandler.js deletes the uploaded image for us.
const createItem = asyncHandler(async (req, res) => {
  const b = req.body;
  const imagePath = req.file ? `uploads/${req.file.filename}` : null;

  const [result] = await pool.execute(
    `INSERT INTO items
       (type, title, description, category_id, location, date_occurred,
        image_path, reporter_name, reporter_email, reporter_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.type,
      b.title,
      b.description || null,
      b.category_id,
      b.location,
      b.date_occurred,
      imagePath,
      b.reporter_name,
      b.reporter_email,
      b.reporter_phone || null,
    ]
  );

  // Send back the public view only (no reporter contact details).
  const [rows] = await pool.execute(`SELECT ${PUBLIC_COLUMNS} ${FROM_CLAUSE} WHERE i.id = ?`, [
    result.insertId,
  ]);

  res.status(201).json({ message: 'Report submitted successfully.', data: rows[0] });
});

// PATCH /api/items/:id/status  (admin only)
// Two tables change together (items + status_history), so we use a transaction.
const updateItemStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const newStatus = req.body.status;
  const note = req.body.note || null;

  await withTransaction(async (conn) => {
    // FOR UPDATE locks the row so two admins cannot change it at the same moment.
    const [rows] = await conn.execute('SELECT status FROM items WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw httpError(404, 'Item not found.');
    }

    const oldStatus = rows[0].status;
    if (oldStatus === newStatus) {
      throw httpError(409, `Item already has the status "${newStatus}".`);
    }

    await conn.execute('UPDATE items SET status = ? WHERE id = ?', [newStatus, id]);
    await conn.execute(
      'INSERT INTO status_history (item_id, old_status, new_status, note) VALUES (?, ?, ?, ?)',
      [id, oldStatus, newStatus, note]
    );
  });

  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS}${PRIVATE_COLUMNS} ${FROM_CLAUSE} WHERE i.id = ?`,
    [id]
  );

  res.json({ message: `Status changed to "${newStatus}".`, data: rows[0] });
});

module.exports = { listItems, getItem, createItem, updateItemStatus };
