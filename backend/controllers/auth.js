const crypto = require('crypto');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const sendEmail = require('../utils/sendEmail');
const config = require('../config/config');

// Get WebSocket instance
let wsInstance;
const getWsInstance = () => {
  if (!global.wsInstance) {
    console.warn('WebSocket instance not available for auth notifications');
    return null;
  }
  return global.wsInstance;
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
  
  // Only log in development environment
  if (process.env.NODE_ENV === 'development') {
    console.log('Login attempt for:', email);
  }

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  try {
    // Check for user with case-insensitive email search
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new ErrorResponse('Account is inactive. Please contact support.', 401));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Send login notification via WebSocket if available
    const ws = getWsInstance();
    if (ws) {
      ws.broadcast(
        {
          type: 'USER_LOGIN',
          message: `User logged in: ${user.name || user.email}`,
          data: {
            userId: user._id,
            name: user.name,
            role: user.role,
            timestamp: new Date().toISOString()
          }
        },
        'auth'  // Channel name for authentication events
      );
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error.message);
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

  // Determine frontend URL from config or environment variable
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
  
  // Create reset URL that points to the frontend app, not the API
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  // Create HTML email with proper styling and button
  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You are receiving this email because a password reset was requested for your account.</p>
      <p>Please click the button below to reset your password. This link will expire in 10 minutes.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </div>
      <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
      <p>Regards,<br>Gideon's Tech Suite Team</p>
    </div>
  `;

  const textMessage = `You are receiving this email because you (or someone else) has requested the reset of a password. Please go to this link to reset your password: ${resetUrl}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset - Gideon\'s Tech Suite',
      text: textMessage,
      html: htmlMessage
    });

    // Send WebSocket notification if available
    const ws = getWsInstance();
    if (ws) {
      ws.broadcast(
        {
          type: 'PASSWORD_RESET_REQUESTED',
          message: `Password reset requested for: ${user.email}`,
          data: {
            userId: user._id,
            timestamp: new Date().toISOString()
          }
        },
        'auth'  // Channel name for authentication events
      );
    }

    res.status(200).json({ success: true, data: 'Password reset email sent' });
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse(`Email could not be sent: ${err.message}`, 500));
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

  // Send WebSocket notification for email confirmation
  const ws = getWsInstance();
  if (ws) {
    ws.broadcast(
      {
        type: 'EMAIL_CONFIRMED',
        message: `Email confirmed for user: ${user.name || user.email}`,
        data: {
          userId: user._id,
          name: user.name,
          email: user.email,
          timestamp: new Date().toISOString()
        }
      },
      'auth'  // Channel name for authentication events
    );
  }

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

  // Determine frontend URL from config or environment variable
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';

  // Create confirm email url pointing to frontend
  const confirmUrl = `${frontendUrl}/verify-email/${confirmToken}`;

  // Create HTML email with proper styling and button
  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Verify Your Email Address</h2>
      <p>Thank you for registering with Gideon's Tech Suite. Please verify your email address to activate your account.</p>
      <p>Click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" style="background-color: #4285F4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a>
      </div>
      <p>If you did not create an account with us, please ignore this email.</p>
      <p>Regards,<br>Gideon's Tech Suite Team</p>
    </div>
  `;

  const textMessage = `Please verify your email address by clicking the following link: ${confirmUrl}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Gideon\'s Tech Suite',
      text: textMessage,
      html: htmlMessage
    });

    // Send WebSocket notification if available
    const ws = getWsInstance();
    if (ws) {
      ws.broadcast(
        {
          type: 'EMAIL_VERIFICATION_SENT',
          message: `Email verification sent to: ${user.email}`,
          data: {
            userId: user._id,
            email: user.email,
            timestamp: new Date().toISOString()
          }
        },
        'auth'  // Channel name for authentication events
      );
    }

    res.status(200).json({ success: true, data: 'Verification email sent' });
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    user.confirmEmailToken = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse(`Email could not be sent: ${err.message}`, 500));
  }
});
