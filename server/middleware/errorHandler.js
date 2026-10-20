// server/middleware/errorHandler.js
// One place that turns any error into a clean JSON response.
// Details are logged on the server; the client only gets safe messages.

const multer = require('multer');
const { removeUploadedFile } = require('./upload');

// Runs when no route matched the URL.
function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express recognises an error handler by its 4 parameters. Keep all four.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Never keep an uploaded image if the request ended in an error.
  removeUploadedFile(req.file);

  // 1. Image upload problems
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. The maximum size is 3 MB.'
        : 'Invalid file upload. Send a single image in the field named "image".';
    return res.status(400).json({ message });
  }

  // 2. Broken or oversized JSON bodies
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }

  // 3. MySQL problems
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'A related record does not exist (for example, an invalid category_id).' });
  }
  const connectionErrors = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'];
  if (connectionErrors.includes(err.code)) {
    console.error('Database connection problem:', err.code, err.message);
    return res.status(503).json({ message: 'The database is currently unavailable. Please try again later.' });
  }

  // 4. Errors we raised on purpose with a status (e.g. wrong file type)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  // 5. Everything else: log the details, send a generic message
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
}

module.exports = { notFound, errorHandler };
