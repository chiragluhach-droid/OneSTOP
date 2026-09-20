const express = require('express');
const router = express.Router();
const { protectStaff } = require('../middleware/auth');
const upload = require('../middleware/upload');
const staffRequestController = require('../controllers/staffRequestController');

router.use(protectStaff);

router.get('/requests/queue', staffRequestController.getMyQueue);
router.get('/requests/history', staffRequestController.getMyHistory);
router.get('/requests/all', staffRequestController.getAllRequests);
router.get('/requests/:id', staffRequestController.getRequestDetail);
router.post('/requests/:id/action', upload.array('attachments', 3), staffRequestController.staffAction);
router.get('/directory', staffRequestController.getDirectory);

module.exports = router;
