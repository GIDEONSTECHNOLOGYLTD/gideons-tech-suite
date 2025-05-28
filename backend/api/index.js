// Import the server initialization function
const { init } = require('../server');
const express = require('express');
const router = express.Router();

// Import test routes
const testRoutes = require('./test');

// Initialize the server
let serverInitialized = false;
let app;

// Create a simple test endpoint
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Export the Vercel serverless function
module.exports = async (req, res) => {
  try {
    // Initialize the server on first request if not already done
    if (!serverInitialized) {
      app = await init();
      
      // Mount test routes
      app.use('/api', testRoutes);
      
      // Add a simple test route
      app.get('/api/test', (req, res) => {
        res.status(200).json({
          success: true,
          message: 'API is working!',
          timestamp: new Date().toISOString()
        });
      });
      
      serverInitialized = true;
    }

    // Set CORS headers
    const allowedOrigins = ['https://frontend-t73t.onrender.com', 'http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Forward the request to the Express app
    return app(req, res);
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};
