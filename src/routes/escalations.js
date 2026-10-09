const express = require('express');
const router = express.Router();
const {
  showEscalationForm,
  handleEscalationResponse,
} = require('../controllers/escalationResponseController');

// GET  = escalation email link → message form with Reply / Forward buttons
// POST = form submission → sends the message on
router.get('/:token/respond', showEscalationForm);
router.post('/:token/respond', handleEscalationResponse);

module.exports = router;
