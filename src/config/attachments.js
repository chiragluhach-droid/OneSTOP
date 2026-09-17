// Shared by student uploads (raising a request) and staff uploads (resolving
// one), so both accept exactly the same files.
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

// The file-picker `accept` attribute for the same set.
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt';

module.exports = { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_FILES, ACCEPT_ATTR };
