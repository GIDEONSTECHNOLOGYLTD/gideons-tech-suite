const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/test
 * @desc    Test API endpoint
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
