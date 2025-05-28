const { format } = require('date-fns');

// Log to console in all environments
const logToConsole = (logData) => {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  console.log(`[${timestamp}]`, JSON.stringify(logData));
};

// Request logger middleware
const logger = (req, res, next) => {
  // Capture the start time
  const start = Date.now();
  
  // Function to run when the response is finished
  const logRequest = () => {
    // Calculate response time
    const responseTime = Date.now() - start;
    
    // Create log data object
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${logData.timestamp}] ${logData.method} ${logData.url} - ${logData.status} (${logData.responseTime})`);
    }
    
    // Log to console in all environments
    logToConsole(logData);
    }
    
    // Clean up the event listener
    res.removeListener('finish', logRequest);
    res.removeListener('close', logRequest);
    res.removeListener('error', logError);
  };
  
  // Error handler for the response
  const logError = (error) => {
    console.error('Response error:', error);
    
    // Clean up the event listener
    res.removeListener('finish', logRequest);
    res.removeListener('close', logRequest);
    res.removeListener('error', logError);
  };
  
  // Add event listeners for response finish/close/error
  res.on('finish', logRequest);
  res.on('close', logRequest);
  res.on('error', logError);
  
  next();
};

// Error logger middleware
const errorLogger = (err, req, res, next) => {
  const errorLog = {
    message: err.message,
    stack: err.stack,
    status: err.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('\x1b[31m%s\x1b[0m', `[${errorLog.timestamp}] ${errorLog.method} ${errorLog.path} - ${errorLog.status} - ${errorLog.message}`);
    if (errorLog.stack) {
      console.error(errorLog.stack);
    }
  }
  
  // Always log errors to file in all environments
  logToFile({ type: 'error', ...errorLog });
  
  next(err);
};

module.exports = {
  logger,
  errorLogger,
  logToFile: logToConsole // Keep the same interface but use console logging
};
