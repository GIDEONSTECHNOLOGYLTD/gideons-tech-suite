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
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const setupSwagger = require('./config/swagger');
const { validateId } = require('./validators/requestValidator');

// Load env vars based on environment
const envFile = process.env.NODE_ENV === 'production' 
  ? './config/config.prod.env' 
  : './config/config.env';

dotenv.config({ path: envFile });

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
    
    // Normalize the origin by removing trailing slashes and converting to lowercase
    const normalizedOrigin = origin.replace(/\/+$/, '').toLowerCase();
    
    // Check if the origin is in the allowed list or is a subdomain of the allowed origins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      try {
        const normalizedAllowed = allowedOrigin.replace(/\/+$/, '').toLowerCase();
        const originUrl = new URL(normalizedOrigin);
        const requestUrl = new URL(normalizedOrigin);
        
        // Check exact match or subdomain match
        return (
          normalizedOrigin === normalizedAllowed ||
          (requestUrl.hostname.endsWith(originUrl.hostname) && 
           originUrl.hostname.split('.').length <= requestUrl.hostname.split('.').length)
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
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'Range',
    'DNT',
    'User-Agent'
  ],
  exposedHeaders: [
    'Content-Type',
    'Authorization',
    'Content-Length',
    'X-Requested-With',
    'X-Total-Count',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.some(o => origin.includes(o.replace(/https?:\/\//, '')))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN, Accept, Origin, Cache-Control, Pragma, If-Modified-Since, Range, DNT, User-Agent');
    res.header('Access-Control-Expose-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Total-Count');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }
  
  next();
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

// Rate limiting
app.use('/api/v1/auth/', authLimiter);
app.use('/api/v1/', apiLimiter);

// Set static folders
app.use(express.static(path.join(__dirname, 'public')));
// Also serve static files from frontend's public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// File uploading
app.use(fileupload({
  limits: { fileSize: process.env.MAX_FILE_UPLOAD || 5 * 1024 * 1024 }, // 5MB default
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

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

// Mount all v1 routes
apiV1Router.use('/auth', auth);
apiV1Router.use('/projects', validateId, projects);
apiV1Router.use('/tasks', validateId, tasks);
apiV1Router.use('/users', validateId, users);
apiV1Router.use('/documents', validateId, documents);
apiV1Router.use('/folders', validateId, folders);
apiV1Router.use('/search', search);
apiV1Router.use('/health', health);
apiV1Router.use('/dashboard', dashboard);
apiV1Router.use('/admin', admin);

// Mount the v1 router
app.use('/api/v1', apiV1Router);

// Health check endpoints (legacy)
app.use('/health', health);
app.use('/api/health', health);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  const frontendPublicPath = path.join(__dirname, '../frontend/public');
  const indexHtmlPath = path.join(frontendBuildPath, 'index.html');
  
  // Serve static files from build directory if it exists
  if (require('fs').existsSync(frontendBuildPath)) {
    console.log('Serving frontend build from:', frontendBuildPath);
    
    // Serve static files from build directory
    app.use(express.static(frontendBuildPath));
    
    // Serve test-api.html from public directory
    app.get('/test-api.html', (req, res) => {
      const testApiPath = path.join(frontendPublicPath, 'test-api.html');
      if (require('fs').existsSync(testApiPath)) {
        res.sendFile(testApiPath);
      } else {
        res.status(404).json({
          success: false,
          error: 'Test API page not found'
        });
      }
    });
    
    // Handle SPA routing - return index.html for all other routes
    app.get('*', (req, res) => {
      if (require('fs').existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(404).json({
          success: false,
          error: 'Frontend build not found',
          message: 'The frontend application is not available at this time.'
        });
      }
    });
  } else {
    console.log('Frontend build not found. Only serving API endpoints.');
    
    // Serve test-api.html from public directory as fallback
    const testApiPath = path.join(frontendPublicPath, 'test-api.html');
    if (require('fs').existsSync(testApiPath)) {
      app.get('/test-api.html', (req, res) => {
        res.sendFile(testApiPath);
      });
    }
    
    // Handle root route
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

const server = app.listen(
  PORT,
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  )
);

// Set up WebSocket server
const { broadcast, sendToUser } = setupWebSocket(server);

// Make WebSocket utilities available in the app
app.set('broadcast', broadcast);
app.set('sendToUser', sendToUser);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
});
