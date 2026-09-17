const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const s3 = require('../config/s3');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../config/attachments');

const storage = multerS3({
  s3,
  bucket: process.env.AWS_S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `onestop/attachments/${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('File type not allowed'), false);
  },
});

module.exports = upload;
