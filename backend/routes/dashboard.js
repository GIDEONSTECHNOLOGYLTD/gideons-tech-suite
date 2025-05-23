const express = require('express');
const { protect } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboard');

const router = express.Router();

// All routes in this file are protected
router.use(protect);

// Dashboard routes
router.get('/stats', getDashboardStats);

module.exports = router;
