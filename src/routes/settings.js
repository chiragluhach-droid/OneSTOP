const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const {
  getFeatures, updateFeatures,
  getRouting,
  getEscalation, updateEscalation,
  getReopen, updateReopen,
  getAppVersion, updateAppVersion,
  getWorkingTime, updateWorkingTime,
  getAutoReply, updateAutoReply,
} = require('../controllers/settingController');

// GET is public — the mobile app reads feature flags (and the minimum app
// version) before a user logs in. PATCH is admin-only.
router.get('/features', getFeatures);
router.patch('/features', protectAdmin, updateFeatures);
router.get('/routing', protectAdmin, getRouting);

// Escalation / SLA settings — admin only
router.get('/escalation', protectAdmin, getEscalation);
router.patch('/escalation', protectAdmin, updateEscalation);

// Reopen policy — admin only
router.get('/reopen', protectAdmin, getReopen);
router.patch('/reopen', protectAdmin, updateReopen);

// Minimum app version — admin only
router.get('/app-version', protectAdmin, getAppVersion);
router.patch('/app-version', protectAdmin, updateAppVersion);

// Working days — admin only. Response windows skip whatever is set here.
router.get('/working-time', protectAdmin, getWorkingTime);
router.patch('/working-time', protectAdmin, updateWorkingTime);

// Automatic acknowledgement to the student — admin only
router.get('/auto-reply', protectAdmin, getAutoReply);
router.patch('/auto-reply', protectAdmin, updateAutoReply);

module.exports = router;
