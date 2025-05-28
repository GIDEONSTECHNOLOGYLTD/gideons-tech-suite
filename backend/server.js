// Load and initialize environment configuration
const env = require('./config/env');
env.load();

const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { logger } = require('./middleware/logger');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const { errorHandler, notFound } = require('./middleware/error');
const { connectDB } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');

// Create Express app
const app = express();

// Log startup information
console.log(`\n=== Gideon's Tech Suite API v1.0.0 ===`.blue.bold);
console.log(`Environment: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION'.red.bold : 'development'.yellow.bold}`);
console.log(`Node.js: ${process.version}`);
console.log(`Platform: ${process.platform} ${process.arch}`);

// Log environment summary
console.log('\n=== Environment Summary ==='.blue);
console.log(`MongoDB: ${process.env.MONGODB_URI ? 'Configured'.green : 'Not configured'.red}`);
console.log(`JWT: ${process.env.JWT_SECRET ? 'Configured'.green : 'Not configured'.red}`);
console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'Not set'.yellow}`);
console.log('===========================\n'.blue);

// Set security headers
app.use(helmet());

// Remove static file serving - frontend is served separately
// app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://gideons-tech-suite.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      /^https:\/\/gideons-tech-suite-.*\.vercel\.app$/, // Vercel preview URLs
      /^https:\/\/gideons-tech-frontend-.*\.vercel\.app$/ // Legacy Vercel URLs
    ];
    
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed origins or matches a pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Rate limiting
app.use(apiLimiter);

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// File uploading
app.use(fileupload());

// Sanitize data
app.use(mongoSanitize());

// Prevent XSS attacks
app.use(xss());

// Prevent http param pollution
app.use(hpp());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Mount routers
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/documents', require('./routes/documents'));
app.use('/api/v1/folders', require('./routes/folders'));
app.use('/api/v1/projects', require('./routes/projects'));
app.use('/api/v1/tasks', require('./routes/tasks'));
app.use('/api/v1/search', require('./routes/search'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/health', require('./routes/health'));

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize server
const initServer = async () => {
  try {
    // Set default values for required variables
    if (!process.env.JWT_SECRET) {
      console.warn('Warning: JWT_SECRET not set. Using a default value. This is NOT secure for production!'.yellow);
      process.env.JWT_SECRET = 'insecure-default-secret-change-in-production';
    }

    if (!process.env.FRONTEND_URL) {
      console.warn('Warning: FRONTEND_URL not set. Using default value.'.yellow);
      process.env.FRONTEND_URL = 'https://gideons-tech-suite.onrender.com';
    }

    // Check for MONGODB_URI as it's critical
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is required but not set'.red);
      
      // In production, try to use Render's internal MongoDB if available
      if (process.env.NODE_ENV === 'production' && process.env.MONGODB_INTERNAL_URI) {
        console.warn('Using MONGODB_INTERNAL_URI from Render environment'.yellow);
        process.env.MONGODB_URI = process.env.MONGODB_INTERNAL_URI;
      } else if (process.env.NODE_ENV === 'production') {
        console.warn('Warning: Starting without MongoDB connection. Some features may not work.'.yellow);
      } else {
        console.warn('Using default MongoDB connection for development'.yellow);
        process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite';
      }
    }

    // Connect to database
    await connectDB();

    // Create HTTP server for both Express and WebSockets
    const server = http.createServer(app);
    
    // Initialize WebSocket server
    const setupWebSocket = require('./websocket');
    const wsServer = setupWebSocket(server);
    
    // Store WebSocket server instance on app for use in routes
    app.wsServer = wsServer;
    
    // Start the server if this file is run directly (not when imported)
    if (require.main === module) {
      const PORT = process.env.PORT || 5000;
      server.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
        console.log(`WebSocket server available at ws://localhost:${PORT}/ws`.cyan);
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (err, promise) => {
        console.log(`Error: ${err.message}`.red);
        // Close server & exit process
        server.close(() => process.exit(1));
      });
    }
    
    // Store HTTP server instance on app for serverless function
    app.httpServer = server;
    
    return app;
  } catch (error) {
    console.error(`Error initializing server: ${error.message}`.red);
    process.exit(1);
  }
};

// Export the app and init function
module.exports = async (req, res) => {
  try {
    // Initialize the server if not already done
    if (!app._initialized) {
      await initServer();
      app._initialized = true;
    }
    
    // Special handling for WebSocket upgrade requests
    if (req.method === 'GET' && req.url.startsWith('/ws')) {
      // For WebSocket connections in Vercel environment
      // Note: This is handled differently in production by the WebSocket server
      if (app.httpServer) {
        console.log('WebSocket connection request received');
        app.httpServer.emit('upgrade', req, res.socket, Buffer.from([]));
        return;
      } else {
        console.error('WebSocket server not initialized');
      }
    }
    
    // Forward the request to the Express app
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};

// Start the server if this file is run directly (for local development)
if (require.main === module) {
  initServer().then(() => {
    console.log('Server started in standalone mode');
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
