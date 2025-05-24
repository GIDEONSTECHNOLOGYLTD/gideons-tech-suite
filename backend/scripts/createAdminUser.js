const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const User = require('../models/User');

// Set default MongoDB URI if not in environment
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite';
}

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    
    if (existingAdmin) {
      // Update existing admin
      const salt = await bcrypt.genSalt(10);
      existingAdmin.password = await bcrypt.hash('Admin123!', salt);
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log('Existing admin user updated!');
    } else {
      // Create new admin
      const user = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Admin123!',
        role: 'admin',
        isActive: true
      });
      console.log('New admin user created!');
    }

    console.log('Admin credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating/updating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
