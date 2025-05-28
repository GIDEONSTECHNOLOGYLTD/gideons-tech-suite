// A simple serverless function that doesn't require authentication
module.exports = (req, res) => {
  // Set CORS headers
  const allowedOrigins = ['https://frontend-t73t.onrender.com', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Hello from serverless function!',
      timestamp: new Date().toISOString()
    });
  }

  // Handle other HTTP methods
  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
};
