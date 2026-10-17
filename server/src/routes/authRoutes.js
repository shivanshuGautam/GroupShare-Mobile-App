const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Public authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.get('/logout', authController.logout);

// OTP routes & aliases
router.post('/send-otp', authController.resendVerification);
router.post('/verify-otp', authController.verifyEmail);
router.post('/reset-password', authController.resetPassword);

// Profile routes (Protected by token)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
