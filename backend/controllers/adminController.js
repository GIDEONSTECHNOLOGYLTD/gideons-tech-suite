const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Make a user admin
// @route   POST /api/v1/admin/make-admin
// @access  Public (temporarily)
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

// @desc    Remove this route after use for security
// @route   DELETE /api/v1/admin/remove-admin-route
// @access  Public (temporary)
exports.removeAdminRoute = asyncHandler(async (req, res, next) => {
  // This is a placeholder to remind you to remove this route after use
  res.status(200).json({
    success: true,
    message: 'Please remove the admin route after use for security',
    instructions: 'Remove the admin route from server.js after promoting a user to admin'
  });
});
