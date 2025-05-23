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

// Configure readline for better input handling
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question, hidden = false) => {
  return new Promise((resolve) => {
    if (hidden) {
      const { stdin } = process;
      const stdinHandler = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.pause();
        } else {
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', stdinHandler);
      rl.question(question, (answer) => {
        process.stdin.off('data', stdinHandler);
        console.log();
        resolve(answer);
      });
    } else {
      rl.question(question, (answer) => resolve(answer));
    }
  });
};

// Connect to DB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gideons-tech-suite';
    console.log(`🔗 Connecting to MongoDB: ${mongoUri.split('@').pop()}`);
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
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
    const name = await askQuestion('👤 Full Name: ');
    if (!name.trim()) {
      throw new Error('Name is required');
    }

    const email = await askQuestion('📧 Email: ');
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    let password, confirmPassword;
    do {
      password = await askQuestion('🔑 Password (min 8 characters): ', true);
      if (password.length < 8) {
        console.log('❌ Password must be at least 8 characters'.red);
        continue;
      }
      
      confirmPassword = await askQuestion('🔐 Confirm Password: ', true);
      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match'.red);
      }
    } while (password !== confirmPassword || password.length < 8);

    // Check if user already exists
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
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ' + `Error: ${error.message}`.red);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
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
    process.exit(1);
  }
};

// Run the application
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { createAdmin, validateEmail };
