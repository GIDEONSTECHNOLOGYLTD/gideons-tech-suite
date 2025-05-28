const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const { version } = require('../../package.json');

/**
 * @route   GET /*
 * @desc    Health check endpoint with detailed system information
 * @access  Public
 */
router.get('*', async (req, res) => {
  try {
    const startTime = process.hrtime();
    const healthCheck = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'Gideon\'s Tech Suite API',
      version: version,
      environment: process.env.NODE_ENV || 'development',
      requestPath: req.path,
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.NOW_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown',
        env: process.env.VERCEL_ENV || 'unknown'
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
      },
      cpu: {
        cores: os.cpus().length,
        loadavg: os.loadavg(),
        uptime: os.uptime(),
      },
      network: {
        hostname: os.hostname(),
        interfaces: Object.keys(os.networkInterfaces())
      }
    },
    
    // Database status
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      dbVersion: mongoose.version,
      collections: await getCollectionCounts()
    },
    
    // Application metrics
    metrics: {
      responseTime: null,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    }
  };

  // Calculate response time
  const diff = process.hrtime(startTime);
  healthCheck.metrics.responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3) + 'ms';

  // Set appropriate status code
  const statusCode = healthCheck.status === 'UP' ? 200 : 503;
  
  // Add cache headers
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('X-Health-Check-Timestamp', new Date().toISOString());
  
  res.status(statusCode).json(healthCheck);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
});

// Helper function to get collection counts
async function getCollectionCounts() {
  try {
    if (mongoose.connection.readyState !== 1) return [];
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const counts = {};
    
    for (const collection of collections) {
      try {
        counts[collection.name] = await mongoose.connection.db.collection(collection.name).countDocuments();
      } catch (err) {
        counts[collection.name] = 'error: ' + err.message;
      }
    }
    
    return counts;
  } catch (error) {
    console.error('Error getting collection counts:', error);
    return { error: error.message };
  }
}

module.exports = router;
