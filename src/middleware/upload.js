const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'onestop/attachments',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
    resource_type: 'auto',
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('File type not allowed'), false);
  },
});

module.exports = upload;
