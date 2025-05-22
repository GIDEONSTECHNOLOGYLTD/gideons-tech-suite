/**
 * Success Response Handler
 * @param {Object} res - Express response object
 * @param {*} data - Data to send in the response
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} pagination - Pagination information (if applicable)
 * @returns {Object} JSON response
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200, pagination = null) => {
  const response = {
    success: true,
    message,
    data
  };

  // Add pagination info if provided
  if (pagination) {
    response.pagination = pagination;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error Response Handler
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Array of validation errors (if any)
 * @param {string} errorCode - Custom error code (if any)
 * @returns {Object} JSON response
 */
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null, errorCode = null) => {
  const response = {
    success: false,
    message,
    ...(errorCode && { errorCode }),
    ...(errors && { errors })
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.stack = new Error().stack;
  }

  return res.status(statusCode).json(response);
};

/**
 * Validation Error Response Handler
 * @param {Object} res - Express response object
 * @param {Array} errors - Array of validation errors
 * @param {string} message - Error message
 * @returns {Object} JSON response with 400 status code
 */
const validationError = (res, errors, message = 'Validation Error') => {
  return errorResponse(res, message, 400, errors, 'VALIDATION_ERROR');
};

/**
 * Not Found Response Handler
 * @param {Object} res - Express response object
 * @param {string} resource - Name of the resource not found
 * @returns {Object} JSON response with 404 status code
 */
const notFound = (res, resource = 'Resource') => {
  return errorResponse(res, `${resource} not found`, 404, null, 'NOT_FOUND');
};

/**
 * Unauthorized Response Handler
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} JSON response with 401 status code
 */
const unauthorized = (res, message = 'Not authorized to access this route') => {
  return errorResponse(res, message, 401, null, 'UNAUTHORIZED');
};

/**
 * Forbidden Response Handler
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} JSON response with 403 status code
 */
const forbidden = (res, message = 'Forbidden') => {
  return errorResponse(res, message, 403, null, 'FORBIDDEN');
};

/**
 * Bad Request Response Handler
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Array} errors - Array of errors (if any)
 * @returns {Object} JSON response with 400 status code
 */
const badRequest = (res, message = 'Bad Request', errors = null) => {
  return errorResponse(res, message, 400, errors, 'BAD_REQUEST');
};

/**
 * Conflict Response Handler
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} JSON response with 409 status code
 */
const conflict = (res, message = 'Conflict') => {
  return errorResponse(res, message, 409, null, 'CONFLICT');
};

module.exports = {
  successResponse,
  errorResponse,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  badRequest,
  conflict
};
