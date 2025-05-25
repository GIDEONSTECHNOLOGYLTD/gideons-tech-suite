const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, createTestUser, createTestAdmin, getAuthToken, getAdminToken } = require('../../utils/testHelpers');

// Test suite for Admin API
describe('Admin API', () => {
  let adminToken;
  let regularUserToken;
  let adminUser;
  let regularUser;

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
    
    // Create test users
    adminUser = await createTestAdmin();
    regularUser = await createTestUser();
    
    // Get auth tokens
    adminToken = await getAuthToken(adminUser);
    regularUserToken = await getAuthToken(regularUser);
  });

  // Test admin user management
  describe('GET /api/v1/admin/users', () => {
    it('should get all users (admin access)', async () => {
      const res = await request(require('../../server'))
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveLength(2); // Admin + regular user
    });

    it('should not allow regular users to access all users', async () => {
      const res = await request(require('../../server'))
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  // Test user management
  describe('PUT /api/v1/admin/users/:id', () => {
    it('should update user details (admin access)', async () => {
      const updatedData = {
        name: 'Updated User',
        role: 'editor'
      };

      const res = await request(require('../../server'))
        .put(`/api/v1/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', 'Updated User');
      expect(res.body.data).toHaveProperty('role', 'editor');
    });
  });

  // Test user deactivation
  describe('PUT /api/v1/admin/users/:id/deactivate', () => {
    it('should deactivate a user (admin access)', async () => {
      const res = await request(require('../../server'))
        .put(`/api/v1/admin/users/${regularUser._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('isActive', false);
    });
  });

  // Test admin access to protected routes
  describe('Admin Access Control', () => {
    it('should allow admin to access protected admin route', async () => {
      const res = await request(require('../../server'))
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should not allow regular user to access admin route', async () => {
      const res = await request(require('../../server'))
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
