const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  console.log('🔍 Testing MongoDB connection...');
  console.log('Connection string:', uri.replace(/:([^:]+)@/, ':***@'));

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Successfully connected to MongoDB');
    console.log('Database name:', mongoose.connection.name);
    
    // Test if we can perform a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Provide specific error messages for common issues
    if (error.name === 'MongoServerSelectionError') {
      console.log('\n🔧 Troubleshooting:');
      if (error.message.includes('getaddrinfo ENOTFOUND')) {
        console.log('- The hostname in your connection string might be incorrect');
        console.log('- Check your internet connection');
      } else if (error.message.includes('bad auth')) {
        console.log('- Authentication failed');
        console.log('- Check your username and password in the connection string');
      } else if (error.message.includes('timed out')) {
        console.log('- Connection timed out');
        console.log('- Check if your IP is whitelisted in MongoDB Atlas');
        console.log('- Check your internet connection');
      }
    }
    
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

testConnection();
