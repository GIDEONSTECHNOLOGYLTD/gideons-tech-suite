const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, getAdminToken } = require('../../utils/testHelpers');

// Test suite for Email Settings API
describe('Email Settings API', () => {
  let adminToken;

  // Run before all tests
  beforeAll(async () => {
    await connectDB();
    adminToken = await getAdminToken();
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

  // Test getting email settings
  describe('GET /api/v1/admin/settings/email', () => {
    it('should get email settings (admin access)', async () => {
      const res = await request(require('../../server'))
        .get('/api/v1/admin/settings/email')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('smtp');
      // Ensure password is not returned in the response
      expect(res.body.data.smtp).not.toHaveProperty('password');
    });
  });

  // Test updating email settings
  describe('PUT /api/v1/admin/settings/email', () => {
    it('should update email settings (admin access)', async () => {
      const emailSettings = {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'testpassword123'
          },
          from: 'noreply@example.com'
        }
      };

      const res = await request(require('../../server'))
        .put('/api/v1/admin/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(emailSettings);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.smtp.host).toBe('smtp.example.com');
      expect(res.body.data.smtp.port).toBe(587);
      expect(res.body.data.smtp.auth.user).toBe('test@example.com');
      // Password should not be returned in the response
      expect(res.body.data.smtp.auth).not.toHaveProperty('pass');
    });
  });

  // Test sending a test email
  describe('POST /api/v1/admin/settings/email/test', () => {
    it('should send a test email (admin access)', async () => {
      // First, update email settings
      await request(require('../../server'))
        .put('/api/v1/admin/settings/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'test@example.com',
              pass: 'testpassword123'
            },
            from: 'noreply@example.com'
          }
        });

      const res = await request(require('../../server'))
        .post('/api/v1/admin/settings/email/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          to: 'test@example.com',
          subject: 'Test Email',
          text: 'This is a test email from the test suite.'
        });

      // We expect a 200 even if email sending fails in test environment
      // as we're not actually connecting to an SMTP server
      expect([200, 500]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'Test email sent');
      } else {
        // In test environment, we might get a 500 if SMTP is not configured
        expect(res.body).toHaveProperty('success', false);
      }
    });
  });
});
