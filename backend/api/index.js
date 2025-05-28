const express = require('express');
const { createServer } = require('http');

// Create a simple Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Gideon\'s Tech Suite API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      root: '/'
    }
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Handle all other routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: ['/', '/api/health', '/api/test']
  });
});

// Create HTTP server
const server = createServer(app);

// Export the Vercel serverless function
module.exports = async (req, res) => {
  // Fix for Vercel serverless functions
  req.url = req.url.replace(/^\/api/, '');
  if (!req.url.startsWith('/')) {
    req.url = `/${req.url}`;
  }
  
  // Handle request
  await new Promise((resolve) => {
    const { end: originalEnd } = res;
    res.end = function() {
      originalEnd.apply(this, arguments);
      resolve();
    };
    
    server.emit('request', req, res);
  });
};
