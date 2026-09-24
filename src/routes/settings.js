const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { getFeatures, updateFeatures, getRouting, getEscalation, updateEscalation } = require('../controllers/settingController');

// GET is public — the mobile app reads feature flags before a user logs in.
// PATCH is admin-only — toggled from the admin dashboard.
router.get('/features', getFeatures);
router.patch('/features', protectAdmin, updateFeatures);
router.get('/routing', protectAdmin, getRouting);

// Escalation settings — admin only
router.get('/escalation', protectAdmin, getEscalation);
router.patch('/escalation', protectAdmin, updateEscalation);

module.exports = router;
