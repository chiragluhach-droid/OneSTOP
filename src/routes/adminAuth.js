const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { adminLogin, adminRefresh, adminLogout } = require('../controllers/adminAuthController');

router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);
router.post('/logout', protectAdmin, adminLogout);

module.exports = router;
