const User = require('../models/User');
const Document = require('../models/Document');
const Project = require('../models/Project');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
// Temporarily using console.log instead of logger
const sendEmail = require('../utils/sendEmail');

// Simple logger replacement
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data),
  error: (message, data) => console.error(`[ERROR] ${message}`, data),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data),
  debug: (message, data) => console.debug(`[DEBUG] ${message}`, data)
};

// @desc    Get system statistics
// @route   GET /api/v1/admin/system/stats
// @access  Private/Admin
exports.getSystemStats = asyncHandler(async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalDocuments,
      totalProjects,
      storageUsed,
      recentSignups,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Document.countDocuments(),
      Project.countDocuments(),
      calculateStorageUsage(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role createdAt lastActive'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers },
        documents: totalDocuments,
        projects: totalProjects,
        storage: { 
          used: storageUsed, 
          total: 10737418240, // 10GB in bytes
          usedPercentage: Math.round((storageUsed / 10737418240) * 100)
        },
        recentSignups,
        systemHealth: {
          status: 'operational',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV || 'development'
        }
      }
    });
  } catch (error) {
    logger.error('Error getting system stats', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user?._id
    });
    next(new ErrorResponse('Error retrieving system statistics', 500));
  }
});

// @desc    Send system announcement
// @route   POST /api/v1/admin/system/announce
// @access  Private/Admin
exports.sendAnnouncement = asyncHandler(async (req, res, next) => {
  const { subject, message, target = 'all' } = req.body;
  
  // Validate input
  if (!subject || !message) {
    return next(new ErrorResponse('Subject and message are required', 400));
  }

  try {
    // Get target users
    let users = [];
    if (target === 'all') {
      users = await User.find().select('email name');
    } else if (target === 'active') {
      users = await User.find({ 
        lastActive: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      }).select('email name');
    } else if (target === 'admins') {
      users = await User.find({ role: 'admin' }).select('email name');
    }

    // Prepare email content
    const emailPromises = users.map(user => 
      sendEmail({
        email: user.email,
        subject: `[Announcement] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${subject}</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
              © ${new Date().getFullYear()} Gideon's Tech Suite. All rights reserved.
            </p>
          </div>
        `
      })
    );

    // Send emails in parallel
    await Promise.all(emailPromises);

    // Log the announcement
    logger.info('System announcement sent', {
      subject,
      target,
      recipients: users.length,
      sentBy: req.user._id,
      timestamp: new Date()
    });

    res.status(200).json({ 
      success: true, 
      message: `Announcement sent to ${users.length} users`,
      data: {
        recipients: users.length,
        target
      }
    });
  } catch (error) {
    logger.error('Error sending announcement', {
      error: error.message,
      stack: error.stack,
      sentBy: req.user?._id
    });
    next(new ErrorResponse('Error sending announcement', 500));
  }
});

// @desc    Get system logs
// @route   GET /api/v1/admin/system/logs
// @access  Private/Admin
exports.getSystemLogs = asyncHandler(async (req, res, next) => {
  try {
    // This is a simplified example - in a real app, you'd query your logging system
    // For now, we'll return sample data
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'System check completed',
        user: 'system'
      },
      {
        timestamp: new Date(Date.now() - 60000),
        level: 'warning',
        message: 'High memory usage detected',
        user: 'system'
      },
      {
        timestamp: new Date(Date.now() - 120000),
        level: 'error',
        message: 'Failed to connect to database',
        user: 'system'
      }
    ];

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    logger.error('Error retrieving system logs', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user?._id
    });
    next(new ErrorResponse('Error retrieving system logs', 500));
  }
});

// Helper function to calculate storage usage
async function calculateStorageUsage() {
  try {
    // This is a simplified example - in a real app, you'd calculate actual storage usage
    // For now, we'll return a random value for demonstration
    return Math.floor(Math.random() * 1000000000);
  } catch (error) {
    logger.error('Error calculating storage usage', {
      error: error.message,
      stack: error.stack
    });
    return 0;
  }
}
