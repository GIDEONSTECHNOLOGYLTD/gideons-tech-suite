const AuditLogService = require('../services/auditLogService');
const { validationResult } = require('express-validator');

const auditLogController = {
  /**
   * @desc    Get audit logs with filtering and pagination
   * @route   GET /api/audit-logs
   * @access  Private/Admin
   */
  getAuditLogs: async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        action,
        entity,
        userId,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const result = await AuditLogService.getLogs({
        action,
        entity,
        userId,
        startDate,
        endDate,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100) // Cap limit at 100
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error getting audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while retrieving audit logs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * @desc    Get a single audit log by ID
   * @route   GET /api/audit-logs/:id
   * @access  Private/Admin
   */
  getAuditLogById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const log = await AuditLog.findById(id)
        .populate('userId', 'name email')
        .lean();
      
      if (!log) {
        return res.status(404).json({
          success: false,
          message: 'Audit log not found'
        });
      }

      res.json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('Error getting audit log by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while retrieving audit log',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * @desc    Get audit logs for the current user
   * @route   GET /api/audit-logs/me
   * @access  Private
   */
  getMyAuditLogs: async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const { page = 1, limit = 20 } = req.query;

      const result = await AuditLogService.getLogs({
        userId,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 50) // Cap limit at 50 for user requests
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error getting user audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while retrieving your audit logs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * @desc    Get system statistics from audit logs
   * @route   GET /api/audit-logs/stats
   * @access  Private/Admin
   */
  getAuditStats: async (req, res) => {
    try {
      const [
        totalLogs,
        actions,
        entities,
        recentLogs
      ] = await Promise.all([
        AuditLog.countDocuments(),
        AuditLog.aggregate([
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        AuditLog.aggregate([
          { $group: { _id: '$entity', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        AuditLog.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('userId', 'name email')
          .lean()
      ]);

      // Calculate success rate
      const successLogs = await AuditLog.countDocuments({ status: 'SUCCESS' });
      const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0;

      res.json({
        success: true,
        data: {
          totalLogs,
          successRate,
          actions,
          entities,
          recentLogs
        }
      });
    } catch (error) {
      console.error('Error getting audit stats:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while retrieving audit statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = auditLogController;
