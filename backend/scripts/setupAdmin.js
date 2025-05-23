require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/db');

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' 
  ? '../config/config.prod.env' 
  : '../config/config.env';

require('dotenv').config({ path: envFile });

// Connect to database
connectDB();

const createAdmin = async () => {
  try {
    // Check if there are any existing admin users
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin user already exists:'.yellow);
      console.log(`Email: ${existingAdmin.email}`.cyan);
      console.log(`Name: ${existingAdmin.name}`.cyan);
      process.exit(0);
    }

    // Create a new admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
      isEmailVerified: true
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    // Save the admin user
    await adminUser.save();

    console.log('Admin user created successfully!'.green.bold);
    console.log('Email: admin@example.com'.cyan);
    console.log('Password: admin123'.cyan);
    console.log('\nPlease change this password after first login!'.yellow);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`.red);
    process.exit(1);
  }
};

// Run the function
createAdmin();
