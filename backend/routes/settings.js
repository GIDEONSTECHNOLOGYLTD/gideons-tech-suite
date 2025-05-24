const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
  testEmailConnection
} = require('../controllers/settingsController');

// All routes in this file are protected and require admin access
router.use(protect);
router.use(authorize('admin'));

// Email settings routes
router.route('/email')
  .get(getEmailSettings)
  .put(updateEmailSettings);

// Test email routes
router.post('/email/test', sendTestEmail);
router.post('/email/test-connection', testEmailConnection);

module.exports = router;
