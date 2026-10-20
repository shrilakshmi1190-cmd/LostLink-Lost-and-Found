// server/config/db.js
// Creates ONE shared MySQL connection pool for the whole app.
// All credentials come from environment variables (.env), never from code.

require('dotenv').config();
const mysql = require('mysql2/promise');

// Fail early with a clear message if the .env file is incomplete.
const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = requiredVars.filter((name) => !process.env[name]);
if (process.env.DB_PASSWORD === undefined) {
  missing.push('DB_PASSWORD');
}
if (missing.length > 0) {
  console.error('\n[config] Missing environment variables: ' + missing.join(', '));
  console.error('[config] Copy server/.env.example to server/.env and fill in your values.\n');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE columns (e.g. date_occurred) as plain 'YYYY-MM-DD' text.
  // This avoids confusing time-zone shifts in JavaScript Date objects.
  dateStrings: ['DATE'],
});

// Used at startup and by GET /api/health to confirm MySQL is reachable.
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = { pool, testConnection };
