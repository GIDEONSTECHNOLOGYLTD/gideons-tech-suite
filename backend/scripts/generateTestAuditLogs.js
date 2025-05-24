const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');
const AuditLog = require('../models/AuditLog');

// Load environment variables
dotenv.config({ path: '../config/config.env' });

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/gideons-tech-suite', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Clear existing audit logs
    await AuditLog.deleteMany({});
    console.log('Cleared existing audit logs');
    
    // Generate test audit logs
    const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'AUTHORIZATION'];
    const entities = ['USER', 'DOCUMENT', 'PROJECT', 'AUTH', 'SYSTEM'];
    const statuses = ['SUCCESS', 'FAILURE'];
    const userRoles = ['admin', 'user'];
    
    const testLogs = [];
    const now = new Date();
    
    // Generate logs for the past 30 days
    for (let i = 0; i < 1000; i++) {
      const logDate = new Date(now);
      logDate.setDate(now.getDate() - Math.floor(Math.random() * 30));
      logDate.setHours(Math.floor(Math.random() * 24));
      logDate.setMinutes(Math.floor(Math.random() * 60));
      
      const action = faker.helpers.arrayElement(actions);
      const entity = faker.helpers.arrayElement(entities);
      const status = faker.helpers.arrayElement(statuses);
      const userRole = faker.helpers.arrayElement(userRoles);
      
      testLogs.push({
        action,
        entity,
        entityId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        userRole,
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        status,
        metadata: {
          message: `${action} ${entity.toLowerCase()}: ${faker.lorem.sentence()}`,
          url: faker.internet.url(),
          method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
          statusCode: status === 'SUCCESS' ? 200 : faker.helpers.arrayElement([400, 401, 403, 404, 500])
        },
        createdAt: logDate,
        updatedAt: logDate
      });
    }
    
    // Insert test logs in batches
    const batchSize = 100;
    for (let i = 0; i < testLogs.length; i += batchSize) {
      const batch = testLogs.slice(i, i + batchSize);
      await AuditLog.insertMany(batch);
      console.log(`Inserted ${i + batch.length}/${testLogs.length} logs`);
    }
    
    console.log('Successfully generated test audit logs');
    process.exit(0);
  } catch (error) {
    console.error('Error generating test audit logs:', error);
    process.exit(1);
  }
});
