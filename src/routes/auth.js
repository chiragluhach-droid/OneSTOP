const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  sendOtp, verifyOtp, refreshTokens, logout, updateProfile, getMe,
} = require('../controllers/authController');

router.post('/send-otp', [
  body('email').isEmail().normalizeEmail(),
], validate, sendOtp);

router.post('/verify-otp', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
], validate, verifyOtp);

router.post('/refresh', refreshTokens);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);

module.exports = router;
