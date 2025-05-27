#!/usr/bin/env node

/**
 * Test script to verify database and environment configuration
 */

const colors = require('colors');
const { connectDB, testMongoConnection } = require('../config/db');
const env = require('../config/env');

// Enable colors
colors.enable();

console.log('\n🚀 Starting Connection Tests\n'.blue.bold);

// Initialize environment
env.load();

// Test environment variables
console.log('\n=== Testing Environment Variables ==='.blue);

const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];
let envValid = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✓'.green : '✗'.red;
  const displayValue = value 
    ? varName.includes('SECRET') 
      ? '********' 
      : value.substring(0, 30) + (value.length > 30 ? '...' : '')
    : 'Not set';
  
  console.log(`${status} ${varName.padEnd(15)}: ${displayValue}`);
  
  if (!value) {
    envValid = false;
  }
});

if (!envValid) {
  console.error('\n❌ Error: Missing required environment variables'.red);
  process.exit(1);
}

console.log('\n✅ Environment variables test passed'.green);

// Test database connection
async function runTests() {
  try {
    console.log('\n=== Testing Database Connection ==='.blue);
    
    // Test direct connection
    console.log('\n🔌 Testing direct MongoDB connection...'.blue);
    const connectionResult = await testMongoConnection(process.env.MONGODB_URI);
    
    if (connectionResult.success) {
      console.log('\n✅ Direct connection test passed'.green);
      console.log(`   Host: ${connectionResult.host}`);
      console.log(`   Database: ${connectionResult.database}`);
      console.log(`   Version: ${connectionResult.serverVersion}`);
      console.log(`   Connection time: ${connectionResult.connectionTime}ms`);
    } else {
      console.error('\n❌ Direct connection test failed:'.red);
      console.error(`   Error: ${connectionResult.error.message}`);
      
      if (connectionResult.suggestions) {
        console.error('\n💡 Suggestions:'.yellow);
        connectionResult.suggestions.forEach(suggestion => {
          if (Array.isArray(suggestion)) {
            suggestion.forEach(line => console.log(`   ${line}`.yellow));
          } else {
            console.log(`   ${suggestion}`.yellow);
          }
        });
      }
      
      process.exit(1);
    }
    
    // Test Mongoose connection
    console.log('\n🔌 Testing Mongoose connection...'.blue);
    try {
      await connectDB();
      console.log('\n✅ Mongoose connection test passed'.green);
      
      // Test a simple query
      try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log(`\n📊 Found ${collections.length} collections in the database`.green);
        
        if (collections.length > 0) {
          console.log('\nCollections:'.blue);
          collections.slice(0, 10).forEach((col, index) => {
            console.log(`  ${index + 1}. ${col.name}`);
          });
          
          if (collections.length > 10) {
            console.log(`  ... and ${collections.length - 10} more`);
          }
        }
      } catch (queryError) {
        console.warn('⚠️  Could not list collections:'.yellow, queryError.message);
      }
      
    } catch (mongooseError) {
      console.error('\n❌ Mongoose connection test failed:'.red);
      console.error(`   ${mongooseError.message}`.red);
      process.exit(1);
    }
    
    console.log('\n✅ All connection tests completed successfully!\n'.green.bold);
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Unhandled error during tests:'.red);
    console.error(error);
    process.exit(1);
  } finally {
    // Ensure we close the Mongoose connection when done
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

// Make sure we have mongoose available
const mongoose = require('mongoose');

// Run the tests
runTests();
