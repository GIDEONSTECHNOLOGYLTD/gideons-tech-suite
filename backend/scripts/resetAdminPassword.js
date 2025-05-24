const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const User = require('../models/User');

const newPassword = 'Admin123!'; // New password for the admin user

// Set default MongoDB URI if not in environment
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite';
}

const resetAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB...');

    // Find the admin user
    const admin = await User.findOne({ email: 'admin@example.com' });

    if (!admin) {
      console.error('Admin user not found');
      process.exit(1);
    }

    // Update the password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    console.log('Admin password has been reset successfully!');
    console.log(`New password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting admin password:', error);
    process.exit(1);
  }
};

resetAdminPassword();
