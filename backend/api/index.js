const express = require('express');
const { createServer } = require('http');

// Create a simple Express app
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json());

// Simple test endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development',
    message: 'API is healthy!'
  });
});

// Public test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Public test endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/health', '/api/test']
  });
});

// Handle all other routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Create HTTP server
const server = createServer(app);

// Export the Vercel serverless function
module.exports = (req, res) => {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Handle request
  server.emit('request', req, res);
};
