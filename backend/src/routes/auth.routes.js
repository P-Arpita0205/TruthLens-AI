const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/send-email-otp', authController.sendEmailOTP);
router.post('/verify-email-otp', authController.verifyEmailOTP);
router.post('/reset-password', authController.resetPassword);
router.post('/login', authController.login);
router.post('/change-password', authController.changePassword);
router.post('/delete-profile', authController.deleteProfile);

// Phone OTP logic is explicitly handled by Firebase on the frontend,
// so no backend routes are strictly necessary for it in this architecture.

module.exports = router;
