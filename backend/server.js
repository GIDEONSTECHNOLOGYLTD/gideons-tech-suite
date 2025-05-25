require('dotenv').config();
const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { logger, requestLogger } = require('./config/monitoring');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const { errorHandler, notFound } = require('./middleware/error');
const connectDB = require('./config/db');
const setupWebSocket = require('./websocket/server');
const { apiLimiter, authLimiter, adminLimiter } = require('./middleware/rateLimiter');
const setupSwagger = require('./config/swagger');
const { validateId } = require('./validators/requestValidator');
const auditLogger = require('./middleware/auditLogger');

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Load environment variables
dotenv.config({ path: './config/config.env' });

// Log environment info
logger.info(`Starting ${process.env.npm_package_name} v${process.env.npm_package_version}`);
logger.info(`Environment: ${process.env.NODE_ENV}`);
logger.info(`Node version: ${process.version}`);
logger.info(`Platform: ${process.platform} ${process.arch}`);

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Error: The following required environment variables are missing:'.red.bold);
  missingVars.forEach(varName => console.error(`- ${varName}`.red));
  process.exit(1);
}

// Log environment info (without sensitive data)
console.log(`Environment: ${process.env.NODE_ENV}`.cyan.bold);
console.log(`Server running in ${process.env.NODE_ENV} mode`.yellow.bold);
console.log(`MongoDB connected: ${process.env.MONGODB_URI ? 'Yes' : 'No'}`);
console.log(`JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not set'}`.grey);

// Log environment for debugging
console.log(`Running in ${process.env.NODE_ENV} mode`.yellow.bold);

const app = require('./app');

// Connect to database
connectDB();

const http = require('http');
const server = http.createServer(app);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Set security headers
const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives();
delete cspDefaults['upgrade-insecure-requests'];

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...cspDefaults,
        'connect-src': [
          "'self'",
          'https://gideons-tech-suite.onrender.com',
          'wss://gideons-tech-suite.onrender.com',
          ...(process.env.NODE_ENV === 'development' ? ['ws:', 'http://localhost:*'] : []),
        ],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// Enable CORS with multiple allowed origins
// List of allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:3001',
  'https://frontend-t73t.onrender.com',
  'https://gideons-tech-suite.onrender.com',
  'https://gideons-tech-suite-frontend.onrender.com',
  'https://gideons-tech-suite.vercel.app',
  'https://gideons-tech-suite-frontend.vercel.app'
];

// Log allowed origins for debugging
console.log('Allowed CORS origins:', allowedOrigins);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalize the origin by removing protocols and trailing slashes
    const normalizeUrl = (url) => {
      return url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    };
    
    const normalizedOrigin = normalizeUrl(origin);
    
    // Check if the origin is in the allowed list or is a subdomain of the allowed origins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      try {
        const normalizedAllowed = normalizeUrl(allowedOrigin);
        const originDomain = normalizedAllowed.split('/')[0];
        const requestDomain = normalizedOrigin.split('/')[0];
        
        // Check exact match or subdomain match
        return (
          requestDomain === originDomain ||
          (requestDomain.endsWith(`.${originDomain}`) && 
           originDomain.split('.').length <= requestDomain.split('.').length)
        );
      } catch (e) {
        console.error('Error checking CORS origin:', e);
        return false;
      }
    });
    
    if (isAllowed) {
      return callback(null, true);
    } else {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      console.warn(msg);
      console.warn('Allowed origins:', allowedOrigins);
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'X-Access-Token',
    'X-Refresh-Token',
    'X-Requested-With',
    'X-XSRF-TOKEN',
    'X-Requested-By',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method',
    'X-Forwarded-For',
    'X-Forwarded-Proto',
    'X-Forwarded-Port',
    'X-Forwarded-Host',
    'X-Real-IP',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'X-Request-Id'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'X-Total-Count',
    'X-Request-Id',
    'X-Response-Time'
  ],
  maxAge: 600, // 10 minutes
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Handle preflight requests first
  if (req.method === 'OPTIONS') {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-XSRF-TOKEN',
      'X-Request-Id',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
      'If-Modified-Since',
      'Range',
      'DNT',
      'User-Agent'
    ].join(', '));
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Content-Length', '0');
    return res.status(204).end();
  }
  
  // For non-OPTIONS requests, apply CORS headers
  if (origin) {
    const isAllowed = allowedOrigins.some(o => {
      try {
        const normalizedOrigin = origin.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
        const normalizedAllowed = o.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
        return (
          normalizedOrigin === normalizedAllowed ||
          normalizedOrigin.endsWith(`.${normalizedAllowed}`)
        );
      } catch (e) {
        console.error('Error checking CORS origin:', e);
        return false;
      }
    });
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
      next();
    } else {
      next(new ErrorResponse('Not allowed by CORS', 403));
    }
  } else {
    // For non-preflight requests, use the standard CORS middleware
    cors(corsOptions)(req, res, next);
  }
});

// Trust proxy (important for rate limiting and secure cookies in production)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
}

// Prevent http param pollution
app.use(hpp());

// Sanitize data
app.use(mongoSanitize());

// Prevent XSS attacks
app.use(xss());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (process.env.NODE_ENV === 'development') {
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// File uploading
app.use(fileupload({
  limits: { fileSize: process.env.MAX_FILE_UPLOAD || 5 * 1024 * 1024 }, // 5MB default
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Apply the regular api limiter to all routes
app.use(apiLimiter);

// Mount API routes first to ensure they take precedence
app.use('/api/v1/auth', auth);
app.use('/api/v1/admin', adminLimiter);
app.use('/api/v1/admin/system', auditLogger()); // Apply audit logging middleware

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter, auth);

// Set static folders - only in development
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.join(__dirname, '../frontend/public')));
}

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API welcome route
app.get('/api', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Welcome to Gideon\'s Tech Suite API',
    version: '1.0.0',
    status: 'running',
    documentation: 'https://docs.gideonstechsuite.com',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/projects',
      '/api/v1/tasks',
      '/api/v1/users',
      '/api/v1/documents',
      '/api/v1/folders',
      '/api/v1/health'
    ]
  });
});

// Create and mount the API v1 router
const apiV1Router = express.Router();

// Mount routers
apiV1Router.use('/auth', auth);
apiV1Router.use('/users', users);
apiV1Router.use('/projects', projects);
apiV1Router.use('/tasks', tasks);
apiV1Router.use('/documents', documents);
apiV1Router.use('/folders', folders);
apiV1Router.use('/search', search);
apiV1Router.use('/dashboard', dashboard);
apiV1Router.use('/admin', admin);
apiV1Router.use('/audit-logs', auditLogs);
apiV1Router.use('/system', system);
apiV1Router.use('/admin/settings', settings);

// Mount the v1 router
app.use('/api/v1', apiV1Router);

// Health check endpoints (legacy)
app.use('/health', health);
app.use('/api/health', health);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  console.log('Configuring production static file serving...');
  
  // Try multiple possible paths for the frontend build
  const possibleBuildPaths = [
    path.join(__dirname, '../../frontend/build'),  // Local development (from backend directory)
    path.join(__dirname, '../frontend/build'),   // Alternative path
    path.join(__dirname, 'frontend/build'),      // Alternative path
    path.join(__dirname, 'client/build'),        // Alternative path
    path.join(process.cwd(), 'frontend/build')   // Absolute path from project root
  ];
  
  // Log the current working directory for debugging
  console.log('Current working directory:', process.cwd());
  console.log('__dirname:', __dirname);
  
  let clientBuildPath = '';
  
  // Find the first existing build path
  for (const buildPath of possibleBuildPaths) {
    if (fs.existsSync(buildPath)) {
      clientBuildPath = buildPath;
      console.log(`Found frontend build at: ${clientBuildPath}`);
      break;
    }
  }
  
  if (clientBuildPath) {
    console.log(`Configuring static file serving from: ${clientBuildPath}`);
    
    // Serve static files from the React app
    app.use(express.static(clientBuildPath, { 
      index: false,
      fallthrough: true // Allow falling through to other routes
    }));
    
    // Explicitly serve the favicon and other static assets
    app.get('/favicon.ico', (req, res) => {
      console.log('Serving favicon.ico');
      res.sendFile(path.join(clientBuildPath, 'favicon.ico'));
    });
    
    app.get('/manifest.json', (req, res) => {
      console.log('Serving manifest.json');
      res.sendFile(path.join(clientBuildPath, 'manifest.json'));
    });
    
    // Serve index.html for all other GET requests that don't match API routes
    app.get('*', (req, res, next) => {
      // Skip API routes and static files
      if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
      }
      console.log(`Serving index.html for path: ${req.path}`);
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  } else {
    console.warn('Could not find frontend build directory. API will still function but frontend will not be served.');
    
    // Basic API info if frontend not found
    app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Gideon\'s Tech Suite API is running',
        documentation: 'https://docs.gideonstechsuite.com',
        endpoints: [
          '/api/v1/health',
          '/api/v1/auth',
          '/api/v1/projects',
          '/api/v1/tasks',
          '/api/v1/users',
          '/api/v1/documents',
          '/api/v1/folders',
          '/api/v1/admin'
        ]
      });
    });
  }
} else {
  // In development, just provide API info at root
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Gideon\'s Tech Suite API is running in development mode',
      endpoints: [
        '/api/v1/health',
        '/api/v1/auth',
        '/api/v1/projects',
        '/api/v1/tasks',
        '/api/v1/users',
        '/api/v1/documents',
        '/api/v1/folders',
        '/api/v1/admin'
      ]
    });
  });
}

// Error handler middleware (must be after the controllers)
app.use(errorHandler);

const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

// Start the server if this file is run directly (not when imported)
if (require.main === module) {
  const HOST = '0.0.0.0';
  const PORT = process.env.PORT || 5005;
  
  // Load env vars
  const result = dotenv.config({ path: './config/config.env' });

  if (result.error) {
    console.error('Error loading .env file'.red.bold);
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Set up WebSocket server
  setupWebSocket(server);

  // Error handler
  server.on('error', onError);
  
  // Listening handler
  server.on('listening', () => {
    const addr = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log(`\n=== Server Started ===`.green.bold);
    console.log(`Environment: ${process.env.NODE_ENV}`.cyan);
    console.log(`Server running on: http://${HOST}:${PORT}`.yellow);
    console.log(`API Base URL: http://${HOST}:${PORT}/api/v1`.yellow);
    console.log(`WebSocket: ws://${HOST}:${PORT}`.yellow);
    console.log(`Press Ctrl+C to stop\n`.dim);
  });

  // Start listening
  server.listen(PORT, HOST);
}

// Export the server for testing
module.exports = server;

// Set up WebSocket server
const { broadcast, sendToUser } = setupWebSocket(server);

// Make WebSocket utilities available in the app
app.set('broadcast', broadcast);
app.set('sendToUser', sendToUser);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...'.red);
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle SIGTERM (for Render)
process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully'.yellow);
  server.close(() => {
    console.log('Process terminated!');
  });
});
