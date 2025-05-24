const mongoose = require('mongoose');
const colors = require('colors');

const connectDB = async () => {
  try {
    // Ensure we're using the test database in test environment
    const mongoUri = process.env.NODE_ENV === 'test' 
      ? 'mongodb://localhost:27017/gideons-tech-suite-test'
      : process.env.MONGODB_URI;
      
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maximum number of connections in the connection pool
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
  } catch (error) {
    console.error(`Error: ${error.message}`.red);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
