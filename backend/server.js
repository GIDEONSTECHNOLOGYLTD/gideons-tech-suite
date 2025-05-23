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

// Load env vars based on environment
const envFile = process.env.NODE_ENV === 'production' 
  ? './config/config.prod.env' 
  : './config/config.env';

dotenv.config({ path: envFile });

// Log environment for debugging
console.log(`Running in ${process.env.NODE_ENV} mode`.yellow.bold);

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const projects = require('./routes/projects');
const tasks = require('./routes/tasks');
const users = require('./routes/users');
const documents = require('./routes/documents');
const folders = require('./routes/folders');
const search = require('./routes/search');
const health = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 5000;

// Set security headers
const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives();
delete cspDefaults['upgrade-insecure-requests'];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...cspDefaults,
        'connect-src': ["'self'", process.env.FRONTEND_URL, 'ws:'].concat(
          process.env.NODE_ENV === 'development' ? ['ws://localhost:*'] : []
        ),
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enable CORS with production/development settings
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Trust proxy (important for rate limiting and secure cookies in production)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 10 minutes'
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Prevent XSS attacks
app.use(xss());

// Sanitize data
app.use(mongoSanitize());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

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

// Mount routers
app.use('/api/v1/health', health); // Health check endpoint
app.use('/api/v1/auth', auth);
app.use('/api/v1/projects', projects);
app.use('/api/v1/tasks', tasks);
app.use('/api/v1/users', users);
app.use('/api/v1/documents', documents);
app.use('/api/v1/folders', folders);
app.use('/api/v1/search', search);

// 404 handler for API routes
app.use('/api', notFound);

// Basic route
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
      '/api/v1/folders'
    ]
  });
});

// Serve static assets in production if frontend build exists
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  const indexHtmlPath = path.join(frontendBuildPath, 'index.html');
  
  // Only serve frontend if build directory exists
  if (require('fs').existsSync(frontendBuildPath)) {
    console.log('Serving frontend build from:', frontendBuildPath);
    app.use(express.static(frontendBuildPath));
    
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
          '/api/v1/folders'
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
