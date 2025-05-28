// Simple public test endpoint that doesn't require authentication
module.exports = (req, res) => {
  // Set CORS headers to allow access from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Add cache control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Return a simple response
  return res.status(200).json({
    success: true,
    message: 'Public API endpoint is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: {
      isVercel: process.env.VERCEL === '1',
      region: process.env.VERCEL_REGION || 'unknown',
      url: process.env.VERCEL_URL || 'unknown'
    },
    headers: {
      // Return the request headers for debugging
      request: Object.entries(req.headers).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value) : value;
        return acc;
      }, {})
    }
  });
};
