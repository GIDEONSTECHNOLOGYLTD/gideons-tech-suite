// Minimal Vercel serverless function using CommonJS format
// This endpoint is public and does not require authentication
module.exports = (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Return a simple response
    return res.status(200).json({
      success: true,
      message: 'Status endpoint is working!',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.NOW_REGION || 'unknown',
        url: process.env.VERCEL_URL || 'unknown'
      }
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
