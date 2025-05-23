#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');
const dotenv = require('dotenv');
require('colors');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/config/config.env') });

// Import User model
const User = require(path.join(__dirname, '../backend/models/User'));

// Simple synchronous prompt
const prompt = (question) => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
};

// Simple synchronous password prompt
const promptPassword = (question) => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // For older Node.js versions
  const fs = require('fs');
  const stdin = process.openStdin();
  
  process.stdin.resume();
  process.stdout.write(question);
  
  let password = '';
  
  // Disable echoing
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  
  return new Promise((resolve) => {
    const onData = (data) => {
      const char = data.toString();
      
      // Handle Enter key
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        console.log();
        resolve(password);
        return;
      }
      
      // Handle backspace
      if (char === '\b' || char === '\x7f') {
        if (password.length > 0) {
          process.stdout.write('\b \b');
          password = password.slice(0, -1);
        }
        return;
      }
      
      // Add character to password
      password += char;
      process.stdout.write('*');
    };
    
    process.stdin.on('data', onData);
  });
};

// Connect to DB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gideons-tech-suite';
    console.log(`🔗 Connecting to MongoDB: ${mongoUri.split('@').pop()}`);
    
    // Simple connection without deprecated options
    await mongoose.connect(mongoUri);
    
    console.log('✅ MongoDB Connected'.green);
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:'.red, err.message);
    return false;
  }
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const createAdmin = async () => {
  try {
    console.clear();
    console.log('🚀 '.blue + 'Gideon\'s Technology - Admin User Setup'.bold);
    console.log('='.repeat(60).gray + '\n');

    // Get admin details
    const name = await prompt('👤 Full Name: ');
    if (!name.trim()) {
      throw new Error('Name is required');
    }

    const email = await prompt('📧 Email: ');
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    let password, confirmPassword;
    do {
      console.log('\n🔑 Enter a password (min 8 characters):');
      password = await promptPassword('> ');
      
      if (password.length < 8) {
        console.log('❌ Password must be at least 8 characters'.red);
        continue;
      }
      
      console.log('\n🔐 Confirm password:');
      confirmPassword = await promptPassword('> ');
      
      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match'.red);
      }
    } while (password !== confirmPassword || password.length < 8);

    console.log('\n🔍 Checking if user exists...');
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log('\n⚠️ '.yellow + 'Admin user already exists with this email'.bold);
        console.log(`Name: ${existingUser.name}`);
        console.log(`Role: ${existingUser.role}`);
        console.log(`Created: ${existingUser.createdAt}`);
        process.exit(0);
      } else {
        throw new Error('A regular user with this email already exists');
      }
    }

    // Create user
    console.log('\n🔨 Creating admin user...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    console.log('\n✅ ' + 'Admin user created successfully!'.green.bold);
    console.log('='.repeat(60).gray);
    console.log(`👤 Name: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Role: ${user.role}`);
    console.log(`🆔 User ID: ${user._id}`);
    console.log('='.repeat(60).gray);
    console.log('\n🔒 ' + 'Please keep these credentials secure!'.red.bold);
    
    // Clean up and exit
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ' + `Error: ${error.message}`.red);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Main function
const main = async () => {
  try {
    console.log('\n🔌 Connecting to database...'.blue);
    const connected = await connectDB();
    
    if (!connected) {
      console.error('❌ Failed to connect to database. Please check your connection and try again.'.red);
      process.exit(1);
    }

    await createAdmin();
  } catch (error) {
    console.error('\n❌ ' + `Fatal error: ${error.message}`.red);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the application
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { createAdmin, validateEmail };
