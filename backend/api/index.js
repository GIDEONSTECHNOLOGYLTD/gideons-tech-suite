// Simple, reliable API endpoint for Vercel serverless environment
module.exports = (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Basic health check endpoint
  if (req.url === '/api/health' || req.url === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      message: 'API is healthy!',
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.NOW_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown',
        env: process.env.VERCEL_ENV || 'unknown'
      }
    });
  }
  
  // Root API endpoint
  if (req.url === '/api' || req.url === '/') {
    return res.status(200).json({
      success: true,
      message: 'Welcome to Gideon\'s Tech Suite API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: ['/api/health']
    });
  }
  
  // Fallback for all other routes
  return res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
};
