const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, createTestUser, createTestAdmin, getAuthToken } = require('../../utils/testHelpers');

// Test suite for Authentication
describe('Authentication API', () => {
  // Run before all tests
  beforeAll(async () => {
    await connectDB();
  });

  // Run after all tests
  afterAll(async () => {
    await clearDB();
    await mongoose.connection.close();
  });

  // Run before each test
  beforeEach(async () => {
    await clearDB();
  });

  // Test user registration
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'user'
      };

      const res = await request(require('../../server'))
        .post('/api/v1/auth/register')
        .send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
    });

    it('should not register with an existing email', async () => {
      // Create a test user first
      await createTestUser({ email: 'test@example.com' });

      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'user'
      };

      const res = await request(require('../../server'))
        .post('/api/v1/auth/register')
        .send(userData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });

  // Test user login
  describe('POST /api/v1/auth/login', () => {
    it('should login an existing user with correct credentials', async () => {
      // Create a test user
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: 'Test123!'
      });

      const res = await request(require('../../server'))
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
    });

    it('should not login with incorrect password', async () => {
      // Create a test user
      await createTestUser({
        email: 'test@example.com',
        password: 'Test123!'
      });

      const res = await request(require('../../server'))
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  // Test get current user
  describe('GET /api/v1/auth/me', () => {
    it('should return current user data', async () => {
      // Create and login a test user
      const testUser = await createTestUser({
        email: 'test@example.com',
        password: 'Test123!'
      });
      
      const token = await getAuthToken(testUser);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
      expect(res.body.data).not.toHaveProperty('password');
    });
  });
});
