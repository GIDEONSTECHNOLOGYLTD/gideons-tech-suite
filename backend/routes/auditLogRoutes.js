const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auditLogController = require('../controllers/auditLogController');
const {
  getAuditLogsValidation,
  getAuditLogByIdValidation,
  getMyAuditLogsValidation
} = require('../validators/auditLogValidator');

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/audit-logs/me
// @desc    Get current user's audit logs
// @access  Private
router.get('/me', getMyAuditLogsValidation, auditLogController.getMyAuditLogs);

// Admin routes - require admin role
router.use(authorize('admin'));

// @route   GET /api/audit-logs
// @desc    Get all audit logs with filtering and pagination
// @access  Private/Admin
router.get('/', getAuditLogsValidation, auditLogController.getAuditLogs);

// @route   GET /api/audit-logs/stats
// @desc    Get audit log statistics
// @access  Private/Admin
router.get('/stats', auditLogController.getAuditStats);

// @route   GET /api/audit-logs/:id
// @desc    Get a single audit log by ID
// @access  Private/Admin
router.get('/:id', getAuditLogByIdValidation, auditLogController.getAuditLogById);

module.exports = router;
