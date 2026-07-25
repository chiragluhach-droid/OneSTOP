const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { getFeatures, updateFeatures } = require('../controllers/settingController');

router.get('/features', getFeatures);
router.patch('/features', protectAdmin, updateFeatures);

module.exports = router;
