const express = require('express');
const { createServer } = require('http');

// Create a simple Express app
const app = express();

// Simple test endpoint at the root
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Test endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Enable CORS for all routes
app.use((req, res, next) => {
  // Allow all origins for now (restrict in production)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple test endpoint (no auth required)
app.get('/api/health', (req, res) => {
  // Bypass any authentication for health check
  console.log('Health check called');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'API is healthy!',
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage()
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
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Gideon\'s Tech Suite API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      root: '/'
    }
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
module.exports = (req, res) => {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Fix for Vercel serverless functions
  req.url = req.url.replace(/^\/api/, '');
  if (!req.url.startsWith('/')) {
    req.url = `/${req.url}`;
  }
  
  // Handle request
  server.emit('request', req, res);
};
