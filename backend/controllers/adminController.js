const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Make a user admin
// @route   POST /api/v1/admin/make-admin
// @access  Private/Admin
exports.makeUserAdmin = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse('Please provide an email', 400));
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorResponse(`User not found with email ${email}`, 404));
  }

  // Prevent demoting yourself
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ErrorResponse('You cannot modify your own admin status', 400));
  }

  // Update user role to admin
  user.role = 'admin';
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// @desc    Get all users (admin only)
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find().select('-password');
  
  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

// @desc    Delete user (admin only)
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
  }

  // Prevent deleting yourself
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ErrorResponse('You cannot delete your own account', 400));
  }

  await user.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get user by ID (admin only)
// @route   GET /api/v1/admin/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});
