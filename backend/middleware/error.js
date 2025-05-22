const ErrorResponse = require('../utils/errorResponse');
const { logToFile } = require('./logger');

/**
 * Custom error handler middleware that provides detailed error responses
 * and logs errors appropriately based on the environment.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message || 'Server Error';
  error.statusCode = err.statusCode || 500;
  error.stack = err.stack;

  // Log the error details
  const errorDetails = {
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    user: req.user ? req.user.id : 'unauthenticated',
    timestamp: new Date().toISOString(),
    validationErrors: err.errors ? Object.values(err.errors).map(e => e.message) : undefined
  };

  // Log to console for development
  if (process.env.NODE_ENV === 'development') {
    console.error('\x1b[31m%s\x1b[0m', `[${errorDetails.timestamp}] ${errorDetails.method} ${errorDetails.path} - ${errorDetails.statusCode} - ${errorDetails.message}`);
    if (errorDetails.stack) {
      console.error(errorDetails.stack);
    }
  }

  // Log to file in all environments
  logToFile({ type: 'error', ...errorDetails });

  // Handle specific error types
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${value}. Please use another value.`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Not authorized, token failed';
    error = new ErrorResponse(message, 401);
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Your session has expired. Please log in again.';
    error = new ErrorResponse(message, 401);
  }

  // Send error response to client
  const response = {
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };

  // Include validation errors if they exist
  if (error.errors) {
    response.errors = error.errors;
  }

  res.status(error.statusCode || 500).json(response);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = new ErrorResponse(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Async handler to wrap async/await and catch errors
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - A middleware function that handles errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};
