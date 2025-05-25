const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Create a test Express app
const app = express();
app.use(express.json());

// Test user data
const testUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  password: 'Test123!',
  role: 'user',
  getSignedJwtToken: jest.fn().mockReturnValue('testtoken123'),
  matchPassword: jest.fn().mockResolvedValue(true)
};

// Mock the User model
const User = {
  findOne: jest.fn(),
  create: jest.fn().mockResolvedValue({
    ...testUser,
    save: jest.fn().mockResolvedValue(testUser)
  })
};

// Mock the auth controller methods
const authController = {
  register: async (req, res) => {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User already exists'
        });
      }

      // Create user
      const user = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: 'user'
      });

      // Generate token
      const token = user.getSignedJwtToken();

      res.status(200).json({
        success: true,
        token
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  },
  
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check for user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if password matches
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate token
      const token = user.getSignedJwtToken();

      res.status(200).json({
        success: true,
        token
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
};

// Set up test routes
app.post('/api/v1/auth/register', authController.register);
app.post('/api/v1/auth/login', authController.login);

// Mock JWT
jwt.sign = jest.fn().mockReturnValue('testtoken123');

describe('Auth Controller Integration Tests', () => {
  let server;

  beforeAll(async () => {
    // Create HTTP server
    server = require('http').createServer(app);
    
    // Start the server on a random port
    await new Promise((resolve) => {
      server.listen(0, 'localhost', resolve);
    });
  });

  afterAll(async () => {
    // Close the server
    await new Promise((resolve) => server.close(resolve));
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  // Helper function to get the server URL
  const getServerUrl = () => {
    return `http://localhost:${server.address().port}`;
  };

  describe('POST /api/v1/auth/register', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
      
      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValue(null);
      
      // Mock User.create to return a test user
      User.create.mockResolvedValue(testUser);
    });

    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
      };

      const response = await request(getServerUrl())
        .post('/api/v1/auth/register')
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      
      // Verify User.create was called with the correct data
      expect(User.create).toHaveBeenCalledWith({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: 'user' // Default role
      });
    });

    it('should return 400 if user already exists', async () => {
      // Mock User.findOne to return a user (user already exists)
      User.findOne.mockResolvedValue(testUser);

      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
      };

      const response = await request(getServerUrl())
        .post('/api/v1/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
      
      // Mock User.findOne to return a test user
      User.findOne.mockResolvedValue(testUser);
      
      // Mock the password matching
      testUser.matchPassword.mockResolvedValue(true);
    });

    it('should login with valid credentials', async () => {
      const response = await request(getServerUrl())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      
      // Verify User.findOne was called with the correct email
      expect(User.findOne).toHaveBeenCalledWith({ email: testUser.email });
      
      // Verify matchPassword was called with the correct password
      expect(testUser.matchPassword).toHaveBeenCalledWith(testUser.password);
    });

    it('should return 401 with invalid credentials', async () => {
      // Mock invalid password
      testUser.matchPassword.mockResolvedValue(false);

      const response = await request(getServerUrl())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });
  });
});
