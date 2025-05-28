const mongoose = require('mongoose');
const { testMongoConnection } = require('../config/db');
const env = require('../config/env');

/**
 * Database connection test endpoint
 * This endpoint is publicly accessible and does not require authentication
 * It tests the MongoDB connection and returns detailed information
 */
module.exports = async (req, res) => {
  // Set CORS headers to allow access from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get MongoDB URI from environment
    const mongoUri = env.get('MONGODB_URI');
    
    if (!mongoUri) {
      return res.status(500).json({
        success: false,
        message: 'MongoDB URI is not configured',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    }

    // Mask sensitive information in the connection string
    const maskedUri = mongoUri.replace(/(\/\/[^:]+:)[^@]+(@)/, '$1*****$2');
    
    // Get current connection status
    const connectionState = mongoose.connection.readyState;
    const connectionStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    // Basic connection info without testing
    const basicInfo = {
      success: connectionState === 1,
      connectionState: connectionStates[connectionState] || 'unknown',
      maskedUri,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.VERCEL_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown'
      }
    };

    // If query param 'test=true', perform a detailed connection test
    if (req.query.test === 'true') {
      try {
        const testResult = await testMongoConnection(mongoUri);
        return res.status(200).json({
          ...basicInfo,
          testResult
        });
      } catch (testError) {
        return res.status(500).json({
          ...basicInfo,
          success: false,
          error: testError.message,
          stack: process.env.NODE_ENV === 'development' ? testError.stack : undefined
        });
      }
    }

    // Return basic connection info
    return res.status(200).json(basicInfo);
  } catch (err) {
    console.error('Database test endpoint error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error testing database connection',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};
