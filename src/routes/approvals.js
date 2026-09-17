const express = require('express');
const router = express.Router();
const { handleApprovalAction, showApprovalForm } = require('../controllers/approvalController');
const actionUpload = require('../middleware/actionUpload');

// GET = email link click → renders confirmation form with message textarea
// POST = form submission → executes the action
router.get('/:token/action', showApprovalForm);
router.post('/:token/action', actionUpload, handleApprovalAction);

module.exports = router;
