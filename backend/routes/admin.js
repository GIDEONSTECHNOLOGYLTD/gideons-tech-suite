const express = require('express');
const { 
  makeUserAdmin,
  removeAdminRoute
} = require('../controllers/adminController');

const router = express.Router();

// WARNING: These routes are temporary and should be removed after use
// They are only for initial admin setup

// @route   POST /api/v1/admin/make-admin
// @desc    Make a user admin by email
// @access  Public (temporary)
router.post('/make-admin', makeUserAdmin);

// @route   DELETE /api/v1/admin/remove-admin-route
// @desc    Reminder to remove admin routes after use
// @access  Public (temporary)
router.delete('/remove-admin-route', removeAdminRoute);

module.exports = router;
