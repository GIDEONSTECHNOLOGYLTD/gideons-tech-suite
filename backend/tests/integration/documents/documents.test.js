const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, createTestUser, getAuthToken } = require('../../utils/testHelpers');

// Test suite for Documents API
describe('Documents API', () => {
  let adminToken;
  let user1Token;
  let user2Token;
  let user1;
  let user2;
  let testDocument;

  // Run before all tests
  beforeAll(async () => {
    await connectDB();
    
    // Create test users
    user1 = await createTestUser({
      email: 'user1@example.com',
      name: 'User One'
    });
    
    user2 = await createTestUser({
      email: 'user2@example.com',
      name: 'User Two'
    });
    
    // Get auth tokens
    adminToken = await getAuthToken(await createTestUser({
      email: 'admin@example.com',
      role: 'admin'
    }));
    
    user1Token = await getAuthToken(user1);
    user2Token = await getAuthToken(user2);
  });

  // Run after all tests
  afterAll(async () => {
    await clearDB();
    await mongoose.connection.close();
  });

  // Run before each test
  beforeEach(async () => {
    // Clear all documents before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (key === 'users') continue; // Keep users for testing
      await collections[key].deleteMany({});
    }
  });

  // Test document creation
  describe('POST /api/v1/documents', () => {
    it('should create a new document', async () => {
      const documentData = {
        title: 'Test Document',
        content: 'This is a test document content.',
        isPublic: false
      };

      const res = await request(require('../../server'))
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(documentData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('title', 'Test Document');
      expect(res.body.data).toHaveProperty('owner', user1._id.toString());
      
      // Save the document for later tests
      testDocument = res.body.data;
    });
  });

  // Test document sharing
  describe('POST /api/v1/documents/:id/share', () => {
    beforeEach(async () => {
      // Create a test document
      const res = await request(require('../../server'))
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Shared Document',
          content: 'This document will be shared.',
          isPublic: false
        });
      
      testDocument = res.body.data;
    });

    it('should share a document with another user', async () => {
      const shareData = {
        userId: user2._id,
        permission: 'edit' // Can be 'view', 'edit', or 'manage'
      };

      const res = await request(require('../../server'))
        .post(`/api/v1/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(shareData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.sharedWith).toContainEqual(
        expect.objectContaining({
          user: user2._id.toString(),
          permission: 'edit'
        })
      );
    });

    it('should allow shared user to access the document', async () => {
      // First share the document
      await request(require('../../server'))
        .post(`/api/v1/documents/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user2._id,
          permission: 'view'
        });

      // Try to access the document with user2's token
      const res = await request(require('../../server'))
        .get(`/api/v1/documents/${testDocument._id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('_id', testDocument._id);
    });
  });

  // Test document versioning
  describe('Document Versioning', () => {
    let documentId;
    let versionId;

    beforeEach(async () => {
      // Create a test document
      const createRes = await request(require('../../server'))
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Versioned Document',
          content: 'Initial version',
          isPublic: false
        });
      
      documentId = createRes.body.data._id;
    });

    it('should create a new version when document is updated', async () => {
      // Update the document
      const updateRes = await request(require('../../server'))
        .put(`/api/v1/documents/${documentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Updated content',
          versionComment: 'First update'
        });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body.data).toHaveProperty('version', 2);
      
      // Get document versions
      const versionsRes = await request(require('../../server'))
        .get(`/api/v1/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(versionsRes.statusCode).toEqual(200);
      expect(versionsRes.body).toHaveProperty('success', true);
      expect(versionsRes.body.data).toHaveLength(2); // Original + update
      
      // Save version ID for restore test
      versionId = versionsRes.body.data[0]._id;
    });

    it('should restore a previous version', async () => {
      // First create a version to restore
      await request(require('../../server'))
        .put(`/api/v1/documents/${documentId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Content to be reverted',
          versionComment: 'Will be reverted'
        });

      // Get versions to find the original version
      const versionsRes = await request(require('../../server'))
        .get(`/api/v1/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      const originalVersion = versionsRes.body.data.find(v => v.version === 1);

      // Restore the original version
      const restoreRes = await request(require('../../server'))
        .post(`/api/v1/documents/${documentId}/restore`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          versionId: originalVersion._id
        });

      expect(restoreRes.statusCode).toEqual(200);
      expect(restoreRes.body.data.content).toBe('Initial version');
      
      // Verify a new version was created
      expect(restoreRes.body.data.version).toBe(3);
    });
  });
});
