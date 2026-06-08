const express = require('express');
const router = express.Router();
const { handleApprovalAction } = require('../controllers/approvalController');

// GET for clicking from email (browser redirect), POST for explicit action
router.get('/:token/action', handleApprovalAction);
router.post('/:token/action', handleApprovalAction);

module.exports = router;
