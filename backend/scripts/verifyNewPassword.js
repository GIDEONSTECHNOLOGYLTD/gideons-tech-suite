const bcrypt = require('bcryptjs');

const plainPassword = 'Admin123!';
const hashedPassword = '$2b$10$xWQkVKAQHjFlCrA/iNRb..xSmqhRG9qPMDS2gCcQPZxqd13mRXsku'; // New hash from DB

bcrypt.compare(plainPassword, hashedPassword, (err, isMatch) => {
  if (err) {
    console.error('Error comparing passwords:', err);
    return;
  }
  console.log('Password matches:', isMatch);
});
