const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { logger } = require('../middleware/logger');

// @desc    Make a user admin
// @route   POST /api/v1/admin/make-admin
// @access  Private/Admin
exports.makeUserAdmin = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const requestingUser = req.user;

  // Log the admin promotion attempt
  logger.info('Admin promotion attempt', {
    action: 'makeUserAdmin',
    targetEmail: email,
    requestedBy: requestingUser ? requestingUser._id : 'unknown',
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Validate input
  if (!email) {
    logger.warn('No email provided for admin promotion', { requestedBy: requestingUser?._id });
    return next(new ErrorResponse('Please provide an email address', 400));
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.warn('Invalid email format provided', { email, requestedBy: requestingUser?._id });
    return next(new ErrorResponse('Please provide a valid email address', 400));
  }

  try {
    // Find user by email (case-insensitive)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (!user) {
      logger.warn('User not found for admin promotion', { email, requestedBy: requestingUser?._id });
      return next(new ErrorResponse(`User not found with email ${email}`, 404));
    }

    // Check if user is already an admin
    if (user.role === 'admin') {
      logger.info('User is already an admin', { userId: user._id, email });
      return res.status(200).json({
        success: true,
        message: 'User is already an admin',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    }

    // Prevent self-modification
    if (user._id.toString() === requestingUser._id.toString()) {
      logger.warn('Attempted self-modification of admin status', { userId: user._id });
      return next(new ErrorResponse('You cannot modify your own admin status', 400));
    }

    // Update user role to admin
    user.role = 'admin';
    user.updatedAt = Date.now();
    
    await user.save({ validateBeforeSave: false });
    
    // Log the successful admin promotion
    logger.info('User promoted to admin', {
      userId: user._id,
      email: user.email,
      promotedBy: requestingUser._id,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'User successfully promoted to admin',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error in makeUserAdmin', {
      error: error.message,
      stack: error.stack,
      email,
      requestedBy: requestingUser?._id
    });
    next(new ErrorResponse('Server error while processing admin promotion', 500));
  }
});

// @desc    Get all users with filtering and pagination (admin only)
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = '', role = '', sort = '-createdAt' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Log the request
  logger.info('Admin user list request', {
    action: 'getUsers',
    requestedBy: req.user?._id,
    ip: req.ip,
    query: { page, limit, search, role }
  });

  try {
    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Get paginated users
    const users = await User.find(query)
      .select('-password -__v')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      totalPages,
      hasNextPage,
      hasPreviousPage,
      data: users
    });

  } catch (error) {
    logger.error('Error in getUsers', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user?._id
    });
    next(new ErrorResponse('Server error while retrieving users', 500));
  }
});

// @desc    Delete user (admin only)
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const requestingUser = req.user;

  // Log the delete attempt
  logger.info('User deletion attempt', {
    action: 'deleteUser',
    targetUserId: userId,
    requestedBy: requestingUser?._id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Validate user ID format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    logger.warn('Invalid user ID format', { userId, requestedBy: requestingUser?._id });
    return next(new ErrorResponse('Invalid user ID format', 400));
  }

  try {
    // Find the user to be deleted
    const user = await User.findById(userId);

    if (!user) {
      logger.warn('User not found for deletion', { userId, requestedBy: requestingUser?._id });
      return next(new ErrorResponse(`User not found with id ${userId}`, 404));
    }

    // Prevent self-deletion
    if (user._id.toString() === requestingUser._id.toString()) {
      logger.warn('Attempted self-deletion', { userId });
      return next(new ErrorResponse('You cannot delete your own account', 400));
    }

    // Prevent deleting other admins (only super admins should be able to do this)
    if (user.role === 'admin' && requestingUser.role !== 'superadmin') {
      logger.warn('Unauthorized attempt to delete admin user', {
        targetUserId: userId,
        targetRole: user.role,
        requesterRole: requestingUser.role
      });
      return next(new ErrorResponse('Not authorized to delete admin users', 403));
    }

    // Log the user data before deletion for audit purposes
    logger.info('Deleting user', {
      userId: user._id,
      email: user.email,
      role: user.role,
      deletedBy: requestingUser._id,
      timestamp: new Date().toISOString()
    });

    // Perform soft delete by marking as inactive instead of removing
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletedBy = requestingUser._id;
    await user.save({ validateBeforeSave: false });

    // Alternatively, to completely remove the user:
    // await user.remove();

    logger.info('User successfully deactivated', {
      userId: user._id,
      email: user.email,
      action: 'deactivate',
      performedBy: requestingUser._id
    });

    res.status(200).json({
      success: true,
      message: 'User account deactivated successfully',
      data: {
        userId: user._id,
        email: user.email,
        deactivatedAt: user.deletedAt,
        deactivatedBy: user.deletedBy
      }
    });

  } catch (error) {
    logger.error('Error in deleteUser', {
      error: error.message,
      stack: error.stack,
      userId,
      requestedBy: requestingUser?._id
    });
    next(new ErrorResponse('Server error while processing user deletion', 500));
  }
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
