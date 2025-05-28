require('dotenv').config();
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const axios = require('axios');

// Validate required environment variables
const requiredEnvVars = ['VERCEL_CLIENT_ID', 'VERCEL_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file and try again.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: true, // Allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Parse JSON bodies
app.use(express.json());

// Handle preflight requests
app.options('*', cors());

// Auth endpoint to exchange Vercel token for a session
app.post('/api/auth/vercel', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Exchange the code for an access token
    const response = await axios.post('https://api.vercel.com/v2/oauth/access_token', {
      client_id: process.env.VERCEL_CLIENT_ID,
      client_secret: process.env.VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: req.headers.referer || `${req.protocol}://${req.get('host')}/test.html`
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Return the access token to the client
    res.json({ token: response.data.access_token });
  } catch (error) {
    console.error('Auth error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Authentication failed',
      details: error.response?.data || error.message
    });
  }
});

// Proxy configuration for API requests
const apiProxy = createProxyMiddleware({
  target: 'https://backend-q5fm7v2v5-gideonstechnologyltds-projects.vercel.app',
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward the authorization header if it exists
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: err.message,
      code: err.code
    });
  },
  logLevel: 'debug'
});

// Proxy route for API requests
app.use('/api/proxy', apiProxy);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
  console.log(`Access the test page at http://localhost:${PORT}/test.html`);
  console.log(`API proxy is available at http://localhost:${PORT}/api/proxy`);
  
  // Log environment info
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('CORS enabled for all origins');
});
