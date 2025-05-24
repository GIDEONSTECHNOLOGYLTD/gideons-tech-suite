const AuditLogService = require('../services/auditLogService');

const auditLogger = (options = {}) => {
  return async (req, res, next) => {
    // Skip logging for these paths
    const excludedPaths = ['/health', '/metrics', '/favicon.ico'];
    if (excludedPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Get request details
    const startTime = Date.now();
    const { method, originalUrl, user, ip, headers } = req;
    
    // Store the original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Create a response interceptor
    res.send = function (body) {
      logRequest(req, res, startTime, body);
      return originalSend.call(this, body);
    };
    
    res.json = function (body) {
      logRequest(req, res, startTime, body);
      return originalJson.call(this, body);
    };
    
    next();
  };
};

async function logRequest(req, res, startTime, responseBody) {
  try {
    const { method, originalUrl, user, ip, headers, body, params, query } = req;
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Skip logging for successful health checks and metrics
    if (originalUrl === '/health' || originalUrl === '/metrics') {
      return;
    }

    // Determine entity type and action based on route and method
    let entity = 'SYSTEM';
    let action = 'ACCESS';
    let entityId = null;
    
    // Map HTTP methods to actions
    const methodActions = {
      'GET': 'READ',
      'POST': 'CREATE',
      'PUT': 'UPDATE',
      'PATCH': 'UPDATE',
      'DELETE': 'DELETE'
    };
    
    action = methodActions[method] || 'ACCESS';
    
    // Extract entity type from URL
    const pathParts = originalUrl.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      entity = pathParts[0].toUpperCase();
      // If there's an ID in the URL, capture it
      if (pathParts.length > 1 && /^[0-9a-fA-F]{24}$/.test(pathParts[1])) {
        entityId = pathParts[1];
      }
    }
    
    // Special cases for authentication routes
    if (originalUrl.includes('/auth/')) {
      entity = 'AUTH';
      if (originalUrl.includes('/login')) {
        action = 'LOGIN';
      } else if (originalUrl.includes('/logout')) {
        action = 'LOGOUT';
      } else if (originalUrl.includes('/register')) {
        action = 'REGISTER';
      }
    }
    
    // Prepare metadata
    const metadata = {
      method,
      url: originalUrl,
      statusCode,
      responseTime: `${responseTime}ms`
    };
    
    // Add request body for non-GET requests (except sensitive data)
    if (method !== 'GET' && body) {
      const sensitiveFields = ['password', 'token', 'refreshToken', 'apiKey'];
      const cleanBody = { ...body };
      
      // Remove sensitive data
      sensitiveFields.forEach(field => {
        if (cleanBody[field]) {
          cleanBody[field] = '***REDACTED***';
        }
      });
      
      metadata.requestBody = cleanBody;
    }
    
    // Add error details if present
    if (statusCode >= 400) {
      metadata.error = responseBody?.message || 'Unknown error';
    }
    
    // Log the action
    await AuditLogService.log({
      action,
      entity,
      entityId,
      userId: user?._id,
      userRole: user?.role || 'anonymous',
      ipAddress: ip || req.connection.remoteAddress,
      userAgent: headers['user-agent'] || '',
      metadata,
      status: statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      error: statusCode >= 400 ? (responseBody?.message || 'Request failed') : null
    });
    
  } catch (error) {
    console.error('Error in audit logger:', error);
    // Don't let logging errors affect the main application
  }
}

module.exports = auditLogger;
