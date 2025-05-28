// Dedicated health check endpoint for Vercel serverless environment
// This endpoint is public and does not require authentication
module.exports = (req, res) => {
  try {
    // Set CORS headers to allow access from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Return a detailed health check response
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'Gideon\'s Tech Suite API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // Vercel-specific information
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.NOW_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown',
        env: process.env.VERCEL_ENV || 'unknown'
      },
      
      // System information
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(process.memoryUsage().external / 1024 / 1024)} MB`,
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
}
