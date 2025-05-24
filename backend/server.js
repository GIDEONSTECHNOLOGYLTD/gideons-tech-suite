require('dotenv').config();
const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const morgan = require('morgan');
const path = require('path');
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

// Load env vars based on environment
const envFile = process.env.NODE_ENV === 'production' 
  ? './config/production.env' 
  : './config/config.env';

dotenv.config({ path: envFile });

console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
console.log(`JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not set'}`);

// Log environment for debugging
console.log(`Running in ${process.env.NODE_ENV} mode`.yellow.bold);

// Initialize Express app
const app = express();

// Connect to database
connectDB();

// Setup Swagger documentation
setupSwagger(app);

// Route files
const auth = require('./routes/auth');
const projects = require('./routes/projects');
const tasks = require('./routes/tasks');
const users = require('./routes/users');
const documents = require('./routes/documents');
const folders = require('./routes/folders');
const search = require('./routes/search');
const health = require('./routes/health');
const dashboard = require('./routes/dashboard');
const admin = require('./routes/admin');
const auditLogs = require('./routes/auditLogRoutes');
const system = require('./routes/system');
const settings = require('./routes/settings');

const PORT = process.env.PORT || 5005;

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
  'https://gideons-tech-suite.vercel.app'
];

// Log allowed origins for debugging
console.log('Allowed CORS origins:', allowedOrigins);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode - allowing all origins');
      return callback(null, true);
    }
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      console.log('No origin in CORS check, allowing');
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
      console.log(`CORS allowed for origin: ${origin}`);
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
    }
  }
  
  next();
});

// Apply standard CORS middleware for non-OPTIONS requests
app.use(cors(corsOptions));

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

// Body parser - must be before route handlers
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// File uploading
app.use(fileupload({
  limits: { fileSize: process.env.MAX_FILE_UPLOAD || 5 * 1024 * 1024 }, // 5MB default
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/admin', adminLimiter);
app.use('/api/v1/admin/system', auditLogger()); // Apply audit logging middleware

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter, auth);

// Apply the regular api limiter to all routes
app.use(apiLimiter);

// Set static folders
app.use(express.static(path.join(__dirname, 'public')));
// Also serve static files from frontend's public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

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
  // Path to the frontend build directory
  const frontendBuildPath = path.join(__dirname, '../../frontend/build');
  const indexHtmlPath = path.join(frontendBuildPath, 'index.html');
  
  // Check if frontend build exists
  if (require('fs').existsSync(frontendBuildPath)) {
    console.log('Serving frontend build from:', frontendBuildPath);
    
    // Serve static files from the React app
    app.use(express.static(frontendBuildPath));
    
    // Handle API requests first
    app.use('/api', (req, res, next) => {
      next();
    });
    
    // For all other requests, send back React's index.html file
    app.get('*', (req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    console.log('Frontend build not found. Only serving API endpoints.');
    
    // Handle root route with API info
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
}

// Error handler middleware (must be after the controllers)
app.use(errorHandler);

// Start server
const server = app.listen(
  process.env.PORT || 3000, // Use environment variable or default to 3000
  '0.0.0.0', // Listen on all network interfaces
  () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${process.env.PORT || 3000}`.yellow.bold);
    console.log(`Server URL: http://0.0.0.0:${process.env.PORT || 3000}`);
  }
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});

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
