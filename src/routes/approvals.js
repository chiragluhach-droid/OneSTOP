const express = require('express');
const router = express.Router();
const { handleApprovalAction, showApprovalForm } = require('../controllers/approvalController');

// GET = email link click → renders confirmation form with message textarea
// POST = form submission → executes the action
router.get('/:token/action', showApprovalForm);
router.post('/:token/action', handleApprovalAction);

module.exports = router;
