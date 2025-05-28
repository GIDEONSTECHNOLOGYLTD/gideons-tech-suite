// Load the main server application
const serverModule = require('../server');

// Export the Vercel serverless function
module.exports = async (req, res) => {
  try {
    // Log request for debugging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // Forward the request to the main server application
    return await serverModule(req, res);
  } catch (error) {
    console.error('API route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
};
