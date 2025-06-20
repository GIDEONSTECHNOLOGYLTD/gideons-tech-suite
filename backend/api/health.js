// Health check endpoint for local development
const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../services/healthService');
const rateLimit = require('express-rate-limit');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint with detailed system information
 * @access  Public
 */

// Apply rate limiting in production
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', process.env.NODE_ENV === 'production' ? healthLimiter : (req, res, next) => next(), async (req, res) => {
  try {
    const health = await getHealthStatus();
    // Return a detailed health check response
    // Return 503 if DB is DOWN
    if (health.database.status === 'DOWN') {
      return res.status(503).json(health);
    }
    return res.status(200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
});

module.exports = router;
