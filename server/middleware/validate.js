// server/middleware/validate.js
// Input validation rules (express-validator) plus one helper that turns
// validation problems into a clear 400 response.
//
// Note: we trim text but do NOT HTML-escape it before saving. React escapes
// text automatically when displaying it, and escaping twice would show
// things like "&amp;" to users. SQL injection is handled separately by
// parameterized queries.

const { body, param, query, validationResult } = require('express-validator');
const { removeUploadedFile } = require('./upload');

const ITEM_TYPES = ['lost', 'found'];
const ITEM_STATUSES = ['open', 'claimed', 'returned', 'closed'];
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INT = 2147483647;

// ---- Shared helper: returns 400 with a list of problems --------------
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  removeUploadedFile(req.file); // do not keep an image for a rejected report

  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return res.status(400).json({ message: 'Validation failed.', errors });
}

// ---- Small reusable rule builders -------------------------------------
const idParam = param('id')
  .isInt({ min: 1, max: MAX_INT })
  .withMessage('id must be a positive whole number.')
  .toInt();

// Optional text query parameter; empty values (e.g. ?type=) are ignored.
const optionalQueryString = (name) =>
  query(name).optional({ values: 'falsy' }).isString().withMessage(`${name} must be text.`).bail();

// Date must look like YYYY-MM-DD, be a real calendar date, and not be
// more than 1 day in the future (1 day of tolerance for time zones).
function realDate(field, { allowFuture = false } = {}) {
  return (chain) =>
    chain
      .matches(DATE_PATTERN)
      .withMessage(`${field} must use the format YYYY-MM-DD.`)
      .bail()
      .isISO8601({ strict: true })
      .withMessage(`${field} is not a valid date.`)
      .bail()
      .custom((value) => {
        if (allowFuture) return true;
        const limit = new Date();
        limit.setDate(limit.getDate() + 1);
        const limitText = limit.toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (value > limitText) {
          throw new Error(`${field} cannot be in the future.`);
        }
        return true;
      });
}

// ---- Rule sets used by the routes ----------------------------------------
const validateIdParam = [idParam];

const validateListQuery = [
  optionalQueryString('type').isIn(ITEM_TYPES).withMessage('type must be "lost" or "found".'),
  optionalQueryString('status').isIn(ITEM_STATUSES).withMessage(`status must be one of: ${ITEM_STATUSES.join(', ')}.`),
  query('category').optional({ values: 'falsy' }).isInt({ min: 1, max: MAX_INT }).withMessage('category must be a positive whole number.'),
  optionalQueryString('search').isLength({ max: 100 }).withMessage('search can have at most 100 characters.'),
  optionalQueryString('date_from').matches(DATE_PATTERN).isISO8601({ strict: true }).withMessage('date_from must be a valid YYYY-MM-DD date.'),
  optionalQueryString('date_to').matches(DATE_PATTERN).isISO8601({ strict: true }).withMessage('date_to must be a valid YYYY-MM-DD date.'),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1, max: 100000 }).withMessage('page must be a whole number of 1 or more.'),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }).withMessage('limit must be a whole number from 1 to 50.'),
];

const validateCreateItem = [
  body('type').isString().bail().isIn(ITEM_TYPES).withMessage('type must be "lost" or "found".'),
  body('title').isString().bail().trim().notEmpty().withMessage('title is required.').isLength({ max: 120 }).withMessage('title can have at most 120 characters.'),
  body('description').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 2000 }).withMessage('description can have at most 2000 characters.'),
  body('category_id').isInt({ min: 1, max: MAX_INT }).withMessage('category_id must be a positive whole number.').toInt(),
  body('location').isString().bail().trim().notEmpty().withMessage('location is required.').isLength({ max: 150 }).withMessage('location can have at most 150 characters.'),
  realDate('date_occurred')(body('date_occurred').isString().bail().trim()),
  body('reporter_name').isString().bail().trim().notEmpty().withMessage('reporter_name is required.').isLength({ max: 100 }).withMessage('reporter_name can have at most 100 characters.'),
  body('reporter_email').isString().bail().trim().isEmail().withMessage('reporter_email must be a valid email address.').isLength({ max: 120 }).withMessage('reporter_email can have at most 120 characters.'),
  body('reporter_phone').optional({ values: 'falsy' }).isString().bail().trim().matches(PHONE_PATTERN).withMessage('reporter_phone must be 7-20 characters (digits, spaces, + - ( ) only).'),
];

const validateStatusUpdate = [
  body('status').isString().bail().isIn(ITEM_STATUSES).withMessage(`status must be one of: ${ITEM_STATUSES.join(', ')}.`),
  body('note').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 255 }).withMessage('note can have at most 255 characters.'),
];

const validateCreateClaim = [
  body('claimant_name').isString().bail().trim().notEmpty().withMessage('claimant_name is required.').isLength({ max: 100 }).withMessage('claimant_name can have at most 100 characters.'),
  body('claimant_email').isString().bail().trim().isEmail().withMessage('claimant_email must be a valid email address.').isLength({ max: 120 }).withMessage('claimant_email can have at most 120 characters.'),
  body('claimant_phone').optional({ values: 'falsy' }).isString().bail().trim().matches(PHONE_PATTERN).withMessage('claimant_phone must be 7-20 characters (digits, spaces, + - ( ) only).'),
  body('proof_description').isString().bail().trim().isLength({ min: 10, max: 2000 }).withMessage('proof_description must be between 10 and 2000 characters.'),
];

const validateClaimDecision = [
  body('claim_status').isString().bail().isIn(['approved', 'rejected']).withMessage('claim_status must be "approved" or "rejected".'),
  body('note').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 255 }).withMessage('note can have at most 255 characters.'),
];

module.exports = {
  handleValidation,
  validateIdParam,
  validateListQuery,
  validateCreateItem,
  validateStatusUpdate,
  validateCreateClaim,
  validateClaimDecision,
};
