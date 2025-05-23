const express = require('express');
const { 
  makeUserAdmin,
  getUsers,
  getUser,
  deleteUser
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes below are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/users', getUsers);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get('/users/:id', getUser);

/**
 * @route   POST /api/v1/admin/make-admin
 * @desc    Make a user admin by email
 * @access  Private/Admin
 */
router.post('/make-admin', makeUserAdmin);

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/users/:id', deleteUser);

module.exports = router;
