#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');
const dotenv = require('dotenv');
require('colors');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/config/config.env') });

// MongoDB connection settings
const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'gideons-tech-suite';
const SALT_ROUNDS = 10;

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

// Test direct MongoDB connection using native driver
const testMongoConnection = async () => {
  const { MongoClient } = require('mongodb');
  const uri = 'mongodb://127.0.0.1:27017';
  
  console.log('Testing direct MongoDB connection...'.blue);
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  
  try {
    await client.connect();
    console.log('✅ Successfully connected to MongoDB'.green);
    const adminDb = client.db('admin');
    const result = await adminDb.command({ ping: 1 });
    console.log('Ping result:'.gray, result);
    return true;
  } catch (err) {
    console.error('❌ Direct MongoDB connection failed:'.red, err.message);
    return false;
  } finally {
    await client.close();
  }
};

// Connect to MongoDB using native driver
const connectDB = async () => {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  
  try {
    console.log('🔗 Connecting to MongoDB...'.blue);
    await client.connect();
    console.log('✅ Connected to MongoDB'.green);
    
    // Test the connection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Database ping successful'.green);
    
    return client;
  } catch (err) {
    console.error('\n❌ MongoDB connection failed:'.red);
    console.error('Error details:'.red, err.message);
    console.error('\nTroubleshooting tips:'.yellow);
    console.error('1. Make sure MongoDB is running:'.yellow);
    console.error('   $ brew services start mongodb-community'.gray);
    console.error('2. Check MongoDB service status:'.yellow);
    console.error('   $ brew services list | grep mongo'.gray);
    console.error('3. Try restarting MongoDB:'.yellow);
    console.error('   $ brew services restart mongodb-community'.gray);
    console.error('4. Check MongoDB logs:'.yellow);
    console.error('   $ tail -n 50 /opt/homebrew/var/log/mongodb/mongo.log'.gray);
    throw err;
  }
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const createAdmin = async () => {
  let client;
  
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

    console.log('\n🔍 Connecting to database...');
    client = await connectDB();
    const db = client.db(DB_NAME);
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log('\n⚠️ '.yellow + 'Admin user already exists with this email'.bold);
        console.log(`Name: ${existingUser.name}`);
        console.log(`Role: ${existingUser.role}`);
        await client.close();
        process.exit(0);
      } else {
        throw new Error('A regular user with this email already exists');
      }
    }

    // Create admin user
    console.log('\n🔨 Creating admin user...');
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.collection('users').insertOne({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (result.acknowledged && result.insertedId) {
      console.log('\n✅ ' + 'Admin user created successfully!'.green.bold);
      console.log('='.repeat(60).gray);
      console.log(`👤 Name: ${name}`);
      console.log(`📧 Email: ${email.toLowerCase()}`);
      console.log(`🔑 Role: admin`);
      console.log(`🆔 User ID: ${result.insertedId}`);
      console.log('='.repeat(60).gray);
      console.log('\n🔒 ' + 'Please keep these credentials secure!'.red.bold);
    } else {
      throw new Error('Failed to create admin user');
    }
    
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:'.red, err.message);
    if (client) {
      await client.close().catch(console.error);
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
