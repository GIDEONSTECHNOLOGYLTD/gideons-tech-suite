// Health check endpoint for local development
const express = require('express');
const router = express.Router();
const os = require('os');
const mongoose = require('mongoose');
const { version } = require('../../package.json');
const { connectDB } = require('../config/db');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint with detailed system information
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Check database connection
    let dbStatus = 'UNKNOWN';
    let dbError = null;
    
    try {
      if (mongoose.connection.readyState === 1) {
        // Connection is already established
        await mongoose.connection.db.admin().ping();
        dbStatus = 'UP';
      } else {
        // Try to connect
        await connectDB();
        dbStatus = 'UP';
      }
    } catch (error) {
      dbStatus = 'DOWN';
      dbError = error.message;
    }
    
    // Return a detailed health check response
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'Gideon\'s Tech Suite API',
      version: version,
      environment: process.env.NODE_ENV || 'development',
      
      // Database status
      database: {
        status: dbStatus,
        error: dbError,
        name: mongoose.connection.name || 'Not connected'
      },
      
      // System information
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(process.memoryUsage().external / 1024 / 1024)} MB`,
        }
      }
    });
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
