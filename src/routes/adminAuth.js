const express = require('express');
const router = express.Router();
const { protectAdminSession } = require('../middleware/auth');
const { adminLogin, adminRefresh, adminLogout, superAdminLogin } = require('../controllers/adminAuthController');

router.post('/login', adminLogin);
router.post('/super-login', superAdminLogin);
router.post('/refresh', adminRefresh);
// Either console signs out through here.
router.post('/logout', protectAdminSession, adminLogout);

module.exports = router;
