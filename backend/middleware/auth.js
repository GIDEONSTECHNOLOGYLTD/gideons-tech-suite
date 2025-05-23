const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  console.log('Auth middleware - Headers:', JSON.stringify(req.headers, null, 2));

  // Get token from header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token found in Authorization header');
  } else if (req.cookies && req.cookies.token) {
    // Set token from cookie
    token = req.cookies.token;
    console.log('Token found in cookie');
  }

  // Make sure token exists
  if (!token) {
    console.error('No token provided');
    return next(new ErrorResponse('Not authorized to access this route - No token provided', 401));
  }

  try {
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return next(new ErrorResponse('Server configuration error', 500));
    }
    
    console.log('Verifying token...');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      console.error('Invalid token payload:', decoded);
      return next(new ErrorResponse('Invalid token payload', 401));
    }

    console.log('Token verified, looking up user with ID:', decoded.id);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.error('User not found for ID:', decoded.id);
      return next(new ErrorResponse('User not found', 404));
    }
    
    console.log('User found and authenticated:', user.email);
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    
    if (err.name === 'JsonWebTokenError') {
      return next(new ErrorResponse('Invalid token', 401));
    }
    
    if (err.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Token expired', 401));
    }
    
    console.error('Unexpected auth error:', err);
    console.error('Authentication error:', err.message);
    if (err.name === 'JsonWebTokenError') {
      return next(new ErrorResponse('Invalid token', 401));
    } else if (err.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Token expired', 401));
    }
    return next(new ErrorResponse('Authentication failed', 401));
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ErrorResponse('User not authenticated', 401)
      );
    }
    
    // Check if user has one of the required roles
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    
    // If the user is an admin, they have access to everything
    if (req.user.role === 'admin') {
      return next();
    }
    
    // For non-admin users, check if they own the resource they're trying to access
    if (req.params.userId && req.params.userId !== req.user.id) {
      return next(
        new ErrorResponse('Not authorized to access this resource', 403)
      );
    }
    
    next();
  };
};

// Check if user is the owner of the resource
exports.isOwner = (model) => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params.id);
      
      if (!resource) {
        return next(
          new ErrorResponse(`Resource not found with id of ${req.params.id}`, 404)
        );
      }
      
      // Check if user is the owner or admin
      if (resource.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(
          new ErrorResponse('Not authorized to update this resource', 403)
        );
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};
