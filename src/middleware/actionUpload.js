// Parses the approval action form (which may carry files when resolving).
//
// Files are held in memory rather than streamed straight to S3: the form still
// has to be validated, and a rejected submission (blank message, used link)
// must not leave orphaned objects in the bucket. The controller uploads them
// only once the action is going ahead.
//
// Upload problems are attached to the request instead of thrown, so the
// controller can re-show the form with a readable message rather than the
// generic JSON 500 an unhandled multer error would produce.
const multer = require('multer');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_FILES } = require('../config/attachments');

const parse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error('Unsupported file type');
    err.code = 'UNSUPPORTED_TYPE';
    cb(err);
  },
}).array('attachments', MAX_FILES);

const MESSAGES = {
  LIMIT_FILE_SIZE: 'Each file must be 10 MB or smaller.',
  LIMIT_FILE_COUNT: `You can attach up to ${MAX_FILES} files.`,
  LIMIT_UNEXPECTED_FILE: `You can attach up to ${MAX_FILES} files.`,
  UNSUPPORTED_TYPE: 'Only JPG, PNG, PDF, Word, Excel or text files can be attached.',
};

module.exports = (req, res, next) =>
  parse(req, res, (err) => {
    if (err) {
      req.uploadError = MESSAGES[err.code] || 'The attached file could not be read. Please try again.';
      req.files = [];
    }
    next();
  });
