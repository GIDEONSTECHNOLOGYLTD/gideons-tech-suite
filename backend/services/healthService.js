// Health check logic extracted for reuse
const mongoose = require('mongoose');
const { version } = require('../../package.json');
const { connectDB } = require('../config/db');

async function getHealthStatus() {
  let dbStatus = 'UNKNOWN';
  let dbError = null;

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      dbStatus = 'UP';
    } else {
      await connectDB();
      dbStatus = 'UP';
    }
  } catch (error) {
    dbStatus = 'DOWN';
    dbError = error.message;
  }

  return {
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: "Gideon's Tech Suite API",
    version: version,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      error: dbError,
      name: mongoose.connection.name || 'Not connected',
    },
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
    },
  };
}

module.exports = { getHealthStatus };