const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { 
  getSystemStats,
  sendAnnouncement,
  getSystemLogs 
} = require('../controllers/systemController');

const router = express.Router();

// All routes protected and admin only
router.use(protect);
router.use(authorize('admin'));

// System statistics
router.get('/stats', getSystemStats);

// System announcements
router.post('/announce', sendAnnouncement);

// System logs
router.get('/logs', getSystemLogs);

module.exports = router;
