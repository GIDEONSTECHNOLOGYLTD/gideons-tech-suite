const crypto = require('crypto');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// Mock sendEmail function - replace with your actual email sending logic
const sendEmail = async ({ email, subject, message }) => {
  console.log(`Sending email to ${email} with subject: ${subject}`);
  console.log(`Message: ${message}`);
  return Promise.resolve();
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Prevent any role assignment during registration
  if (role) {
    return next(new ErrorResponse('Role assignment is not allowed during registration', 403));
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorResponse('User already exists with this email', 400));
    }

    // Create user as regular user
    const user = await User.create({
      name,
      email,
      password,
      role: 'user' // Force role to be 'user'
    });

    console.log(`New user registered: ${user.email} (ID: ${user._id})`);
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Registration error:', error);
    next(new ErrorResponse('Registration failed', 500));
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email });

  // Validate email & password
  if (!email || !password) {
    console.log('Login failed: Missing email or password');
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  try {
    // Check for user with case-insensitive email search
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+password');

    console.log('User found:', user ? {
      _id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      passwordLength: user.password ? user.password.length : 0
    } : 'No user found');

    if (!user) {
      console.log('Login failed: User not found', { email });
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('Login failed: User account is inactive', { email });
      return next(new ErrorResponse('Account is inactive. Please contact support.', 401));
    }

    // Check if password matches
    console.log('Comparing password...');
    const isMatch = await user.matchPassword(password);
    console.log('Password match result:', isMatch, { 
      userId: user._id,
      passwordLength: password.length,
      hashedPasswordLength: user.password.length
    });

    if (!isMatch) {
      console.log('Login failed: Invalid password', { email });
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    console.log('Login successful, sending token response...');
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    return next(new ErrorResponse('Login failed', 500));
  }
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // Create reset URL
  const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.log(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Confirm Email
// @route   GET /api/v1/auth/confirmemail/:confirmtoken
// @access  Public
exports.confirmEmail = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const confirmEmailToken = crypto
    .createHash('sha256')
    .update(req.params.confirmtoken)
    .digest('hex');

  const user = await User.findOne({
    confirmEmailToken,
    isEmailConfirmed: false
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token or email already confirmed', 400));
  }

  // Update user
  user.isEmailConfirmed = true;
  user.confirmEmailToken = undefined;
  await user.save({ validateBeforeSave: false });

  // Return token
  sendTokenResponse(user, 200, res);
});

// @desc    Resend confirmation email
// @route   POST /api/v1/auth/resendconfirmation
// @access  Public
exports.resendConfirmationEmail = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('No user found with this email', 404));
  }

  if (user.isEmailConfirmed) {
    return next(new ErrorResponse('Email already confirmed', 400));
  }

  // Generate confirm token
  const confirmToken = user.getConfirmEmailToken();
  await user.save({ validateBeforeSave: false });

  // Create confirm email url
  const confirmUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/confirmemail/${confirmToken}`;

  const message = `You are receiving this email because you need to confirm your email address. Please make a GET request to: \n\n ${confirmUrl}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Email confirmation token',
      message
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.log(err);
    user.confirmEmailToken = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});
