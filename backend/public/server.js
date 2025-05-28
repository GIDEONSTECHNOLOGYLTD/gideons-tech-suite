import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Verify required environment variables
const requiredEnvVars = ['VERCEL_CLIENT_ID', 'VERCEL_CLIENT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and try again.');
  process.exit(1);
}

console.log('✅ Environment variables verified');

// Enable CORS for all routes
const corsOptions = {
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Auth endpoint to exchange Vercel OAuth code for an access token
app.post('/api/auth/vercel', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    if (!code) {
      console.error('No authorization code provided');
      return res.status(400).json({ 
        error: 'invalid_request',
        error_description: 'Authorization code is required' 
      });
    }

    if (!redirect_uri) {
      console.error('No redirect_uri provided');
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Redirect URI is required'
      });
    }

    console.log('Exchanging code for token. Redirect URI:', redirect_uri);
    
    try {
      // Exchange the authorization code for an access token
      const tokenResponse = await axios({
        method: 'post',
        url: 'https://api.vercel.com/v2/oauth/access_token',
        data: new URLSearchParams({
          client_id: process.env.VERCEL_CLIENT_ID,
          client_secret: process.env.VERCEL_CLIENT_SECRET,
          code: code,
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code'
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        validateStatus: status => status < 500 // Don't throw on 4xx errors
      });

      if (tokenResponse.data.error) {
        console.error('Vercel token exchange error:', tokenResponse.data);
        return res.status(400).json({
          error: tokenResponse.data.error || 'token_exchange_failed',
          error_description: tokenResponse.data.error_description || 'Failed to exchange authorization code for access token'
        });
      }


      // Get user info
      const userResponse = await axios.get('https://api.vercel.com/v2/user', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.data.access_token}`,
          'Accept': 'application/json'
        },
        validateStatus: status => status < 500
      });

      if (userResponse.data.error) {
        console.error('Failed to fetch user info:', userResponse.data);
        // Still return the token even if user info fetch fails
        return res.json({
          access_token: tokenResponse.data.access_token,
          token_type: tokenResponse.data.token_type || 'bearer',
          expires_in: tokenResponse.data.expires_in || 3600,
          scope: tokenResponse.data.scope || '',
          user: null,
          warning: 'Failed to fetch user profile'
        });
      }

      console.log('Authentication successful for user:', userResponse.data.user?.email);
      
      // Return the access token and user data
      res.json({
        access_token: tokenResponse.data.access_token,
        token_type: tokenResponse.data.token_type || 'bearer',
        expires_in: tokenResponse.data.expires_in || 3600,
        scope: tokenResponse.data.scope || '',
        user: userResponse.data.user || null
      });
      
    } catch (error) {
      console.error('Error during Vercel API call:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data || {};
      
      res.status(statusCode).json({
        error: errorData.error || 'authentication_error',
        error_description: errorData.error_description || error.message || 'Authentication failed',
        details: errorData
      });
    }
    
  } catch (error) {
    console.error('Unexpected error in auth endpoint:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'server_error',
      error_description: 'An unexpected error occurred during authentication',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
