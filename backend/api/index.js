// Main API index route for Express application
const express = require('express');
const router = express.Router();
const { version } = require('../../package.json');

/**
 * @route   GET /api
 * @desc    Root API endpoint with available endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    console.log(`[API Request] ${req.method} ${req.originalUrl}`);
    
    return res.status(200).json({
      success: true,
      message: 'Welcome to Gideon\'s Tech Suite API',
      version: version,
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/health',
        '/api/auth',
        '/api/users',
        '/api/documents'
      ]
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
});

module.exports = router;
