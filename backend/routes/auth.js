const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  logout,
  confirmEmail,
  resendConfirmationEmail
} = require('../controllers/auth');

const router = express.Router();

const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/confirmemail/:confirmtoken', confirmEmail);
router.post('/resendconfirmation', resendConfirmationEmail);

// Protected routes
router.use(protect);
router.get('/logout', logout);

// Re-route into user router
router.use('/', require('./users'));

module.exports = router;
