// server/utils/helpers.js
// Three small helpers shared by all controllers.

const { pool } = require('../config/db');

// Express 4 does not catch errors thrown inside async functions by itself.
// Wrapping a controller with asyncHandler sends any error to errorHandler.js.
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Creates an error that errorHandler.js turns into a clean JSON response.
// Example: throw httpError(404, 'Item not found.');
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Runs several SQL statements as ONE unit: either all succeed (commit)
// or none are saved (rollback). Use it for work that touches more than one table.
//   await withTransaction(async (conn) => { await conn.execute(...); ... });
async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { asyncHandler, httpError, withTransaction };
