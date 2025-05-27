const mongoose = require('mongoose');
const colors = require('colors');
const env = require('./env');

// Cache the connection to avoid multiple connections
let cachedDb = null;
let isConnecting = false;
let connectionRetries = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

// Set Mongoose options
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', true);
mongoose.set('bufferTimeoutMS', 30000); // 30 seconds

// Event listeners for connection
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connection Established'.green);
  connectionRetries = 0; // Reset retry counter on successful connection
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:'.red, err.message);
  if (connectionRetries < MAX_RETRIES) {
    connectionRetries++;
    console.log(`Retrying connection (${connectionRetries}/${MAX_RETRIES}) in ${RETRY_DELAY_MS/1000} seconds...`.yellow);
    setTimeout(connectDB, RETRY_DELAY_MS);
  } else {
    console.error('❌ Max connection retries reached. Please check your MongoDB connection.'.red);
    process.exit(1);
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('ℹ️  MongoDB Disconnected'.yellow);
});

// Close the Mongoose connection when the Node process ends
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination'.yellow);
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:'.red, err);
    process.exit(1);
  }
});

const connectDB = async () => {
  // Return cached connection if available and healthy
  if (cachedDb && mongoose.connection.readyState === 1) {
    try {
      // Ping the database to verify the connection is still alive
      await mongoose.connection.db.admin().ping();
      console.log('✅ Using existing database connection'.green);
      return mongoose.connection;
    } catch (err) {
      console.warn('⚠️  Cached connection is stale, reconnecting...'.yellow);
      cachedDb = null;
    }
  }

  // Prevent multiple connection attempts
  if (isConnecting) {
    console.log('⚠️  Database connection in progress, waiting...'.yellow);
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (mongoose.connection.readyState === 1) {
          resolve(mongoose.connection);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  isConnecting = true;
  
  try {
    // Get MongoDB URI from environment
    const mongoUri = env.getRequired('MONGODB_URI');
    
    // Parse and validate the MongoDB URI
    let url;
    try {
      url = new URL(mongoUri);
      if (!url.protocol.startsWith('mongodb')) {
        throw new Error('Invalid MongoDB connection string protocol');
      }
    } catch (err) {
      throw new Error(`Invalid MongoDB URI: ${err.message}`);
    }
    
    // If no database name is specified in the URI, add our default one
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/gideons_tech_suite';
      console.warn('⚠️  No database name specified in MONGODB_URI, using default'.yellow);
    }
    
    // Configure connection options
    url.searchParams.set('retryWrites', 'true');
    url.searchParams.set('w', 'majority');
    
    // Rebuild the URI
    const finalMongoUri = url.toString();
    const maskedUri = finalMongoUri.replace(/(mongodb\+srv:\/\/[^:]+:)[^@]+@/, '$1********@');
    
    console.log(`🔌 Connecting to MongoDB: ${maskedUri}`.blue);
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4,
      maxPoolSize: 10,
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      heartbeatFrequencyMS: 10000, // Send a heartbeat every 10 seconds
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };
    
    // Close any existing connections
    if (mongoose.connection.readyState === 1) {
      console.log('ℹ️  Closing existing database connection...'.yellow);
      await mongoose.connection.close();
    }
    
    // Create new connection
    const conn = await mongoose.connect(finalMongoUri, options);
    
    // Cache the connection
    cachedDb = conn.connection;
    isConnecting = false;
    
    console.log('✅ Successfully connected to MongoDB'.green);
    return conn.connection;
    
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
    console.log(`Database Name: ${conn.connection.name}`.cyan);
    
    // Set up event listeners for the connection
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB'.green);
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:'.red, err);
      
      // Attempt to reconnect
      setTimeout(() => {
        console.log('Attempting to reconnect to MongoDB...'.yellow);
        mongoose.connect(mongoUri, options).catch(console.error);
      }, 5000);
      console.error('MongoDB connection error:'.red, err.message);
    });
    
    // Log when the connection is disconnected
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected'.yellow);
    });
    
    // Close the Mongoose connection when Node process ends
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
    
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`.red);
    
    // More detailed error handling
    if (error.name === 'MongoServerSelectionError') {
      console.error('Could not connect to any servers in your MongoDB Atlas cluster.'.red);
      console.error('Please check your network connection and ensure your IP is whitelisted in your Atlas cluster.'.yellow);
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error('Mongoose could not connect to MongoDB. Please check your connection string.'.red);
    } else if (error.name === 'MongoNetworkError') {
      console.error('Network error while connecting to MongoDB. Please check your network connection.'.red);
    } else if (error.name === 'MongoError') {
      console.error('MongoDB error:'.red, error.message);
    }
    console.error('Exiting application...'.red.bold);
    process.exit(1);
  }
};

/**
 * Tests the MongoDB connection and returns detailed connection information
 * @param {string} uri - MongoDB connection string
 * @returns {Promise<Object>} Connection test result with detailed information
 */
const testMongoConnection = async (uri) => {
  const startTime = Date.now();
  let client;
  
  try {
    // Parse the connection string to extract information
    const url = new URL(uri);
    const dbName = url.pathname ? url.pathname.replace(/^\/+/, '') : 'admin';
    
    console.log(`\n🔍 Testing MongoDB connection to: ${url.hostname}...`.blue);
    
    const { MongoClient } = require('mongodb');
    
    // Configure connection options
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
      maxPoolSize: 1,
      retryWrites: true,
      w: 'majority',
      appName: 'gideons-tech-suite-connection-test',
      ssl: url.searchParams.get('ssl') === 'true' || uri.includes('ssl=true'),
      authSource: url.searchParams.get('authSource') || 'admin',
      authMechanism: url.searchParams.get('authMechanism')
    };
    
    // Create a new client
    client = new MongoClient(uri, options);
    
    // Test basic connection
    await client.connect();
    
    // Get server info
    const serverInfo = await client.db().admin().serverInfo();
    
    // Get database list (with error handling in case of insufficient permissions)
    let databaseList = [];
    try {
      const dbs = await client.db().admin().listDatabases();
      databaseList = dbs.databases.map(db => db.name);
    } catch (listError) {
      console.warn('⚠️  Could not list databases (insufficient permissions)'.yellow);
    }
    
    // Test write operation if we have write permissions
    let writeTest = { success: false, error: 'Not tested' };
    try {
      const testCollection = client.db(dbName).collection('connection_test');
      const testDoc = { 
        timestamp: new Date(), 
        test: 'connection_test',
        app: 'gideons-tech-suite'
      };
      
      const insertResult = await testCollection.insertOne(testDoc);
      await testCollection.deleteOne({ _id: insertResult.insertedId });
      
      writeTest = { success: true };
    } catch (writeError) {
      writeTest = { 
        success: false, 
        error: writeError.message,
        code: writeError.code
      };
    }
    
    const connectionTime = Date.now() - startTime;
    
    console.log('✅ MongoDB Connection Test Successful'.green);
    console.log(`⏱️  Connection time: ${connectionTime}ms`);
    console.log(`🏷️  Server version: ${serverInfo.version}`);
    console.log(`🔌 Write test: ${writeTest.success ? '✅ Succeeded' : '❌ Failed'}`);
    
    return {
      success: true,
      connectionTime,
      serverVersion: serverInfo.version,
      writeTest: writeTest.success,
      databases: databaseList,
      host: url.hostname,
      port: url.port || '27017',
      database: dbName || 'admin',
      authSource: options.authSource,
      ssl: options.ssl || false,
      serverInfo: {
        host: serverInfo.host,
        version: serverInfo.version,
        process: serverInfo.process,
        os: serverInfo.os
      }
    };
    
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    console.error('❌ MongoDB Connection Test Failed'.red);
    console.error(`⏱️  Failed after: ${connectionTime}ms`);
    console.error(`❌ Error: ${error.message}`.red);
    
    return {
      success: false,
      connectionTime,
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      connectionDetails: {
        host: uri.includes('@') ? uri.split('@')[1].split('/')[0] : uri.split('//')[1].split('/')[0],
        database: (new URL(uri)).pathname.replace(/^\/+/, '') || 'admin'
      },
      suggestions: getMongoErrorSuggestions(error)
    };
    
  } finally {
    try {
      if (client) {
        await client.close();
      }
    } catch (closeError) {
      console.warn('⚠️  Error closing test connection:'.yellow, closeError.message);
    }
  }
};

/**
 * Provides helpful suggestions based on common MongoDB connection errors
 */
function getMongoErrorSuggestions(error) {
  const suggestions = [];
  
  if (error.code === 'ENOTFOUND') {
    suggestions.push('The hostname could not be resolved. Check your network connection and DNS settings.');
  } else if (error.code === 'ECONNREFUSED') {
    suggestions.push(
      'The connection was refused. This usually means:',
      '- The MongoDB server is not running',
      '- The connection details (host/port) are incorrect',
      '- A firewall is blocking the connection'
    );
  } else if (error.code === 'ETIMEDOUT') {
    suggestions.push(
      'Connection timed out. Please check:',
      '- Is the MongoDB server running and accessible?',
      '- Is there a firewall blocking the connection?',
      '- Are you using the correct port? (default is 27017)'
    );
  } else if (error.code === 18) {
    suggestions.push(
      'Authentication failed. Please check:',
      '- Are the username and password correct?',
      '- Is the authentication database correct?',
      '- Does the user have the correct permissions?'
    );
  } else if (error.code === 13) {
    suggestions.push(
      'Insufficient permissions. The provided credentials do not have access to the specified database.'
    );
  } else if (error.message.includes('self signed certificate')) {
    suggestions.push(
      'SSL certificate validation failed. You may need to:',
      '- Set `ssl=true` in your connection string',
      '- Add `tlsAllowInvalidCertificates=true` for development (not recommended for production)',
      '- Configure the correct CA certificate using `tlsCAFile` option'
    );
  }
  
  return suggestions.length > 0 ? suggestions : ['No specific suggestions available for this error.'];
}

module.exports = {
  connectDB,
  testMongoConnection
};
