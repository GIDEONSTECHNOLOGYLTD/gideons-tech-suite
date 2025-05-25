const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../models/User');
const app = require('../../../server');

// Test suite for Basic Authentication
describe('Basic Authentication API', () => {
  let mongoServer;
  let testUser;
  
  // Run before all tests
  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    // Create a test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test123!',
      role: 'user',
      isActive: true
    });
  });

  // Run after all tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Run before each test
  beforeEach(async () => {
    // Clear all test data except the test user
    await User.deleteMany({ _id: { $ne: testUser._id } });
  });

  // Test user login
  describe('POST /api/v1/auth/login', () => {
    it('should authenticate a user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
    });

    it('should not authenticate with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  // Test getting current user
  describe('GET /api/v1/auth/me', () => {
    let token;

    beforeAll(async () => {
      // Login to get token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });
      
      token = loginRes.body.token;
    });

    it('should return current user data with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
      // Password should not be in the response
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('should not return user data without token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
