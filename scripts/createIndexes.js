const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Document } = require('../backend/models/Document');

// Load environment variables
dotenv.config({ path: './backend/config/config.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Use MONGODB_URI from environment or fallback to config
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gideons-tech-suite';
    // Ensure we're using the correct database name
    const dbName = mongoUri.includes('?') 
      ? mongoUri.split('/').pop().split('?')[0] 
      : mongoUri.split('/').pop();
    console.log(`Using database: ${dbName}`);
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Create indexes
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Check if the documents collection exists, create it if it doesn't
    const collections = await db.listCollections({ name: 'documents' }).toArray();
    if (collections.length === 0) {
      console.log('Creating documents collection...');
      await db.createCollection('documents');
      console.log('Documents collection created');
    }
    
    // Get the collection
    const collection = db.collection('documents');
    
    try {
      // List all indexes
      console.log('Current indexes:');
      const indexes = await collection.indexes();
      indexes.forEach(idx => {
        console.log(`- ${idx.name}:`, JSON.stringify(idx.key));
      });
      
      // Check if text index exists
      const indexExists = indexes.some(idx => idx.name === 'document_search_index');
      
      if (indexExists) {
        console.log('Text index already exists, dropping it...');
        await collection.dropIndex('document_search_index');
      }
      
      console.log('Creating text index...');
      await collection.createIndex(
        { 
          name: 'text', 
          description: 'text',
          'metadata.content': 'text' 
        },
        { 
          name: 'document_search_index',
          weights: { 
            name: 10, 
            description: 3,
            'metadata.content': 2
          },
          default_language: 'english'
        }
      );
      
      console.log('Text index created successfully');
      
      // List indexes again to verify
      console.log('\nUpdated indexes:');
      const updatedIndexes = await collection.indexes();
      updatedIndexes.forEach(idx => {
        console.log(`- ${idx.name}:`, JSON.stringify(idx.key));
      });
    } catch (err) {
      console.error('Error during index operations:', err);
      throw err;
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating indexes:', err);
    process.exit(1);
  }
};

// Run the script
(async () => {
  await connectDB();
  await createIndexes();
  mongoose.connection.close();
})();
