const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createRequest,
  getMyRequests,
  getRequestById,
  getRequestByTicketId,
  reopenRequest,
  getReopenEligibility,
  adminGetAllRequests,
  adminDeleteDemoRequests,
  adminGetRequestDetail,
} = require('../controllers/requestController');

router.get('/admin/all', protectAdmin, adminGetAllRequests);
router.get('/admin/detail/:id', protectAdmin, adminGetRequestDetail);
router.delete('/admin/demo-cleanup', protectAdmin, adminDeleteDemoRequests);
router.post('/', protect, upload.array('attachments', 5), createRequest);
router.get('/', protect, getMyRequests);
router.get('/ticket/:ticketId', protect, getRequestByTicketId);
// Declared before '/:id' so "reopen-eligibility" is never read as an id.
router.get('/:id/reopen-eligibility', protect, getReopenEligibility);
router.post('/:id/reopen', protect, reopenRequest);
router.get('/:id', protect, getRequestById);

module.exports = router;
