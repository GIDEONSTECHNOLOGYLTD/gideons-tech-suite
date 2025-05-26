const mongoose = require('mongoose');
const colors = require('colors');

const connectDB = async () => {
  // Don't attempt to connect if no MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.warn('MongoDB: No connection string provided. Running in limited mode.'.yellow);
    return null;
  }

  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds before timing out
      connectTimeoutMS: 10000, // 10 seconds to connect
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maximum number of connections in the connection pool
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

// Helper function to test MongoDB connection
const testMongoConnection = async (uri) => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    
    await client.connect();
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    await client.close();
    
    return {
      success: true,
      databases: dbs.databases.map(db => db.name)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      name: error.name,
      code: error.code
    };
  }
};

module.exports = {
  connectDB,
  testMongoConnection
};
