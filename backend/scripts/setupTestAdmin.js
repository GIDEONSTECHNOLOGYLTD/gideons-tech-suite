const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Connect to the test database
const connectDB = async () => {
  try {
    // Override the MONGODB_URI to use the test database
    process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite-test';
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB test database');
    return true;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    return false;
  }
};

const setupTestAdmin = async () => {
  try {
    // Connect to the test database
    const isConnected = await connectDB();
    if (!isConnected) {
      console.error('Failed to connect to the database');
      process.exit(1);
    }

    // Get the User model
    const User = require('../models/User');
    
    // Check if admin user already exists
    let admin = await User.findOne({ email: 'admin@example.com' });
    
    if (admin) {
      console.log('Admin user already exists in test database');
      console.log('Updating admin password...');
      
      // Update existing admin password
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash('Admin123!', salt);
      admin.role = 'admin';
      admin.isActive = true;
      await admin.save();
      
      console.log('Admin user updated in test database');
    } else {
      console.log('Creating new admin user in test database...');
      
      // Create new admin user
      admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Admin123!',
        role: 'admin',
        isActive: true,
        preferences: {
          notifications: { email: true, push: true },
          theme: 'system',
          timezone: 'UTC',
          language: 'en'
        }
      });
      
      console.log('Admin user created in test database');
    }
    
    console.log('Admin credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up test admin:', error);
    process.exit(1);
  }
};

// Run the setup
setupTestAdmin();
