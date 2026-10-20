// server/middleware/upload.js
// Handles optional image uploads with multer.
// Safety rules: only JPG/PNG/WEBP, max 3 MB, random filenames, and the
// real file content (first bytes) is checked, not just the file extension.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB

// The extension is chosen by US from the mime type. The user's original
// filename is never used.
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const randomPart = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${randomPart}${EXTENSIONS[file.mimetype]}`);
  },
});

function fileFilter(req, file, cb) {
  if (EXTENSIONS[file.mimetype]) {
    return cb(null, true);
  }
  const err = new Error('Only JPG, PNG or WEBP images are allowed.');
  err.status = 400;
  cb(err);
}

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

// Deletes an uploaded file (used when validation or the database fails).
function removeUploadedFile(file) {
  if (file && file.path) {
    fs.unlink(file.path, () => {}); // ignore errors
  }
}

// Checks the first bytes of the saved file to confirm it is really an image.
function checkImageSignature(req, res, next) {
  if (!req.file) return next(); // image is optional

  fs.open(req.file.path, 'r', (openErr, fd) => {
    if (openErr) return next(openErr);

    const header = Buffer.alloc(12);
    fs.read(fd, header, 0, 12, 0, (readErr) => {
      fs.close(fd, () => {});
      if (readErr) return next(readErr);

      const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      const isPng = header.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isWebp = header.slice(0, 4).toString('ascii') === 'RIFF' && header.slice(8, 12).toString('ascii') === 'WEBP';

      if (isJpeg || isPng || isWebp) return next();

      removeUploadedFile(req.file);
      const err = new Error('The uploaded file is not a valid image.');
      err.status = 400;
      next(err);
    });
  });
}

// Use in a route as:  router.post('/', uploadImage, ...)
// The form field that holds the file must be named "image".
const uploadImage = [multerUpload.single('image'), checkImageSignature];

module.exports = { uploadImage, removeUploadedFile };
