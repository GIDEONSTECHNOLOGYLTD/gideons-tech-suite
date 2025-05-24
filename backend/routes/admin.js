const express = require('express');
const { 
  makeUserAdmin,
  getUsers,
  getUser,
  deleteUser
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const auditLogRoutes = require('./auditLogRoutes');

const router = express.Router();

// Log admin route access
router.use((req, res, next) => {
  console.log(`[Admin Route] ${req.method} ${req.originalUrl}`);
  next();
});

// All routes below are protected and require admin role
router.use(protect);
router.use((req, res, next) => {
  console.log('User attempting admin access:', {
    userId: req.user?._id,
    role: req.user?.role,
    email: req.user?.email
  });
  next();
});
router.use(authorize('admin'));

// Admin routes
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.post('/make-admin', makeUserAdmin);
router.delete('/users/:id', deleteUser);

// Audit Logs routes
router.use('/audit-logs', auditLogRoutes);

// Settings routes
router.use('/settings', require('./settings'));

module.exports = router;
