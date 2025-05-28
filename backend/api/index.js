// Main API handler for Vercel serverless environment
module.exports = (req, res) => {
  try {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log(`[API Request] ${req.method} ${req.url}`);
    
    // Root API endpoint
    if (req.url === '/api' || req.url === '/') {
      return res.status(200).json({
        success: true,
        message: 'Welcome to Gideon\'s Tech Suite API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
          '/api/health',
          '/api/status',
          '/api/test'
        ]
      });
    }
    
    // Fallback for all other routes
    // Note: This should only be reached if the route wasn't matched by Vercel's routing
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.url}`,
      note: 'If you were expecting this endpoint to work, check the routes in vercel.json'
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
};
