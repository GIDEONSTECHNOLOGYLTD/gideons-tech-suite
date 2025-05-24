const AuditLog = require('../models/AuditLog');

class AuditLogService {
  static async log({
    action,
    entity,
    entityId,
    userId,
    userRole,
    ipAddress,
    userAgent,
    metadata = {},
    status = 'SUCCESS',
    error = null
  }) {
    try {
      const logEntry = new AuditLog({
        action,
        entity,
        entityId,
        userId,
        userRole,
        ipAddress,
        userAgent,
        metadata,
        status,
        error: error ? error.message || String(error) : null
      });

      await logEntry.save();
      return logEntry;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw to prevent breaking the main operation
      return null;
    }
  }

  static async getLogs({
    action,
    entity,
    userId,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = {}) {
    const query = {};
    
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userId) query.userId = userId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }
}

module.exports = AuditLogService;
