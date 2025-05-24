const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Set default MongoDB URI if not in environment
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite';
}

const testPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB...');

    // Get the User model
    const User = require('../models/User');
    
    // Find the admin user
    const admin = await User.findOne({ email: 'admin@example.com' }).select('+password');
    
    if (!admin) {
      console.error('Admin user not found');
      process.exit(1);
    }

    console.log('Admin user found:', {
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      passwordHash: admin.password
    });

    // Test password comparison
    const passwordToTest = 'Admin123!';
    console.log('\nTesting password comparison...');
    console.log('Password to test:', passwordToTest);
    
    // Method 1: Using the model's matchPassword method
    const isMatch = await admin.matchPassword(passwordToTest);
    console.log('\nMethod 1: Using matchPassword method');
    console.log('Password matches:', isMatch);
    
    // Method 2: Direct bcrypt comparison
    const directCompare = await bcrypt.compare(passwordToTest, admin.password);
    console.log('\nMethod 2: Direct bcrypt.compare');
    console.log('Password matches:', directCompare);
    
    // Method 3: Create a new hash and compare
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(passwordToTest, salt);
    console.log('\nMethod 3: New hash comparison');
    console.log('New hash:', newHash);
    console.log('Original hash:', admin.password);
    console.log('Hashes match:', newHash === admin.password);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testPassword();
