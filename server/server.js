// server/server.js
// Entry point: loads environment variables, checks the database, starts Express.

require('dotenv').config();
const app = require('./app');
const { pool, testConnection } = require('./config/db');

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, async () => {
  console.log(`LostLink API running at http://localhost:${PORT}`);

  try {
    await testConnection();
    console.log(`MySQL connected: database "${process.env.DB_NAME}" on ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
  } catch (err) {
    // The server keeps running so that GET /api/health can report the problem.
    console.error('\nCould NOT connect to MySQL.');
    console.error(`   Reason: ${err.code || 'UNKNOWN'} - ${err.message}`);
    console.error('   Check the DB_* values in server/.env and make sure the MySQL80 service is running.\n');
  }
});

// Stop cleanly when you press Ctrl + C
function shutdown() {
  console.log('\nShutting down...');
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
