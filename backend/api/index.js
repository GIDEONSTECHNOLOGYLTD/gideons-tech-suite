const { init } = require('../server');
const express = require('express');

// Initialize the server
let serverPromise;

async function getApp() {
  if (!serverPromise) {
    serverPromise = (async () => {
      try {
        const { app } = await init();
        console.log('Server initialized successfully');
        return app;
      } catch (error) {
        console.error('Failed to initialize server:', error);
        throw error;
      }
    })();
  }
  return serverPromise;
}

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
    // Set CORS headers
    const allowedOrigins = [
      'https://frontend-t73t.onrender.com', 
      'http://localhost:3000',
      'https://gideons-tech-suite.vercel.app'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Get the Express app
    const app = await getApp();
    
    // Forward the request to the Express app
    return app(req, res);
  } catch (error) {
    console.error('Error in serverless function:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
};
