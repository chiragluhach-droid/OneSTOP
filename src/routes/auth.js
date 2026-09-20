const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, protectAny } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  sendOtp, verifyOtp, refreshTokens, logout, updateProfile, getMe,
} = require('../controllers/authController');

// normalizeEmail's Gmail rules strip dots and +tags from the local part
// ("studios.revera@gmail.com" -> "studiosrevera@gmail.com"), which no longer
// matches the address as stored, so the lookup 404s with "not registered".
// Addresses are matched verbatim here, so only case folding is wanted.
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  }),
], validate, sendOtp);

router.post('/verify-otp', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
], validate, verifyOtp);

router.post('/refresh', refreshTokens);
router.post('/logout', protectAny, logout);
router.get('/me', protectAny, getMe);
router.patch('/profile', protectAny, updateProfile);

module.exports = router;
