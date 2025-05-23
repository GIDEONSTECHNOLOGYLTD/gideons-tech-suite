const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route   GET /*
 * @desc    Health check endpoint - matches all GET requests to this router
 * @access  Public
 */
router.get('*', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
      environment: process.env.NODE_ENV,
      requestPath: req.path
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'DOWN',
      error: error.message,
      timestamp: new Date().toISOString(),
      requestPath: req.path
    });
  }
});

module.exports = router;
