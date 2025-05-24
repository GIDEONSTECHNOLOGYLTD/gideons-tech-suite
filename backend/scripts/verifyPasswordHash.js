const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// The password we're testing
const testPassword = 'Admin123!';
// The hashed password from the database
const hashedPassword = '$2b$10$AtUfoEf6wiEyK./iJvTN2.bsbi21N.aj7gUNUCegYM42Ksltvl1Rm';

async function testPassword() {
  try {
    console.log('Testing password hashing and comparison...');
    console.log(`Test password: "${testPassword}"`);
    console.log(`Hashed password from DB: ${hashedPassword}`);
    
    // Compare the test password with the hashed password
    const isMatch = await bcrypt.compare(testPassword, hashedPassword);
    console.log(`Password comparison result: ${isMatch}`);
    
    // Generate a new hash of the test password to see what it looks like
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(testPassword, salt);
    console.log(`New hash of test password: ${newHash}`);
    
    // Compare the test password with the newly generated hash
    const isNewMatch = await bcrypt.compare(testPassword, newHash);
    console.log(`New hash comparison result: ${isNewMatch}`);
    
    console.log('Test completed.');
  } catch (error) {
    console.error('Error testing password:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testPassword();
