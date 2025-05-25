const mongoose = require('mongoose');
const colors = require('colors');

const connectDB = async () => {
  try {
    // Ensure we're using the test database in test environment
    const mongoUri = process.env.NODE_ENV === 'test' 
      ? 'mongodb://localhost:27017/gideons-tech-suite-test'
      : process.env.MONGODB_URI;
      
    if (!mongoUri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    console.log(`Connecting to MongoDB...`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    
    const options = {
      serverSelectionTimeoutMS: 10000, // Increased from 5s to 10s
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    };
    
    console.log('MongoDB Connection Options:', JSON.stringify(options, null, 2));
    
    const conn = await mongoose.connect(mongoUri, options);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
    console.log(`Database Name: ${conn.connection.name}`.cyan);
    
    // Log successful connection
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });
    
    // Log connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });
    
    // Log when the connection is disconnected
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    // Close the Mongoose connection when Node process ends
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('MongoDB Connection Error:'.red.bold);
    console.error(`- Error: ${error.message}`.red);
    if (error.name === 'MongoServerSelectionError') {
      console.error('- This usually means the MongoDB server is not accessible');
      console.error('- Please check if your IP is whitelisted in MongoDB Atlas');
      console.error('- Check your internet connection and MongoDB credentials');
    }
    console.error('Exiting application...'.red.bold);
    process.exit(1);
  }
};

module.exports = connectDB;
