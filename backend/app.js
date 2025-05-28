const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const mongoSanitize = require('express-mongo-sanitize');
const colors = require('colors');
const dotenv = require('dotenv');
const { errorHandler, notFound } = require('./middleware/error');
const { logger, errorLogger } = require('./middleware/logger');
const connectDB = require('./config/db');

// Load env vars
const result = dotenv.config({ path: './config/config.env' });

if (result.error) {
  console.error('Error loading .env file'.red.bold);
  process.exit(1);
}

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const users = require('./routes/users');
const documents = require('./routes/documents');
const folders = require('./routes/folders');
const projects = require('./routes/projects');
const tasks = require('./routes/tasks');
const search = require('./routes/search');
const settings = require('./routes/settings');
const admin = require('./routes/admin');
const system = require('./routes/system');
const health = require('./routes/health');

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Set security headers with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'" // Required for some libraries like Material-UI
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.REACT_APP_API_URL],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false // Required for WebSockets
}));

// File uploading
app.use(fileupload());

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
  message: 'Too many requests from this IP, please try again in 10 minutes',
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable CORS
app.use(cors());

// Static file serving removed - frontend is served separately

// Logging middleware
app.use((req, res, next) => {
  logger(req, res, (err) => {
    if (err) {
      return next(err);
    }
    next();
  });
});

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/users', users);
app.use('/api/v1/documents', documents);
app.use('/api/v1/folders', folders);
app.use('/api/v1/projects', projects);
app.use('/api/v1/tasks', tasks);
app.use('/api/v1/search', search);
app.use('/api/v1/settings', settings);
app.use('/api/v1/admin', admin);
app.use('/api/v1/system', system);
app.use('/api/v1/health', health);

// Error handler middleware (must be after the controllers)
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  // server.close(() => process.exit(1));
});

module.exports = app;
