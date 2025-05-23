const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../backend/models/User');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './backend/config/config.env' });

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const createAdmin = async () => {
  try {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (question) => new Promise(resolve => readline.question(question, resolve));

    console.log('=== Create Admin User ===');
    
    const name = await askQuestion('Name: ');
    const email = await askInput('Email: ');
    const password = await askPassword('Password (min 8 characters): ');

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error('Error: User with this email already exists');
      process.exit(1);
    }

    // Create user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log('Role: admin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

// Helper function to hide password input
const askPassword = (question) => {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const { stdout } = process;
  
  return new Promise((resolve) => {
    const inputHandler = (char) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.pause();
          break;
        default:
          stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', inputHandler);

    rl.question(question, (answer) => {
      process.stdin.off('data', inputHandler);
      rl.close();
      console.log();
      resolve(answer);
    });
  });
};

// Helper function for regular input
const askInput = (question) => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => readline.question(question, answer => {
    readline.close();
    resolve(answer);
  }));
};

// Run the function
createAdmin();
