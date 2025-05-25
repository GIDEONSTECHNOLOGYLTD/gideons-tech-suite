const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');

/**
 * Connect to the test database
 */
const connectDB = async () => {
  try {
    const mongoUri = 'mongodb://localhost:27017/gideons-tech-suite-test';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Test database connected');
  } catch (error) {
    console.error('Test database connection error:', error);
    process.exit(1);
  }
};

/**
 * Clear all test data from the database
 */
const clearDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Create a test user
 * @param {Object} userData - User data (optional)
 * @returns {Promise<Object>} Created user
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Test123!',
    role: 'user',
    isActive: true,
    ...userData
  };

  const user = new User(defaultUser);
  await user.save();
  return user;
};

/**
 * Create a test admin user
 * @returns {Promise<Object>} Created admin user
 */
const createTestAdmin = async () => {
  return createTestUser({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin123!',
    role: 'admin',
    isActive: true
  });
};

/**
 * Get auth token for a user
 * @param {Object} user - User object
 * @returns {Promise<String>} JWT token
 */
const getAuthToken = async (user) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: user.email,
      password: 'Test123!' // Default test password
    });
  
  return res.body.token;
};

/**
 * Get auth token for admin
 * @returns {Promise<String>} JWT token for admin
 */
const getAdminToken = async () => {
  const admin = await createTestAdmin();
  return getAuthToken(admin);
};

module.exports = {
  connectDB,
  clearDB,
  createTestUser,
  createTestAdmin,
  getAuthToken,
  getAdminToken,
  app
};
