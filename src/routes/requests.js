const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createRequest,
  getMyRequests,
  getRequestById,
  getRequestByTicketId,
  adminGetAllRequests,
} = require('../controllers/requestController');

router.get('/admin/all', protectAdmin, adminGetAllRequests);
router.post('/', protect, upload.array('attachments', 5), createRequest);
router.get('/', protect, getMyRequests);
router.get('/ticket/:ticketId', protect, getRequestByTicketId);
router.get('/:id', protect, getRequestById);

module.exports = router;
