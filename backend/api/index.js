// Import the server initialization function
const { init } = require('../server');

// Initialize the server
let serverInitialized = false;
let app;

// Export the Vercel serverless function
module.exports = async (req, res) => {
  try {
    // Initialize the server on first request if not already done
    if (!serverInitialized) {
      app = await init();
      serverInitialized = true;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Forward the request to the Express app
    return app(req, res);
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};
