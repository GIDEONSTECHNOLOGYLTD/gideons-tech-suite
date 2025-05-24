const bcrypt = require('bcryptjs');

const plainPassword = 'Admin123!';
const hashedPassword = '$2b$10$VNl4MOnQWiqVyRRrHPljD.7ZMrt1l5WsRW0RSatdUVtMycVzMAGZe';

bcrypt.compare(plainPassword, hashedPassword, (err, isMatch) => {
  if (err) {
    console.error('Error comparing passwords:', err);
    return;
  }
  console.log('Password matches:', isMatch);
});
