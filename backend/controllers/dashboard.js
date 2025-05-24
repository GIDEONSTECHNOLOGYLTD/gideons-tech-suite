const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Task = require('../models/Task');
const Document = require('../models/Document');
const Project = require('../models/Project');
const mongoose = require('mongoose');

// Helper function to safely convert string to ObjectId
const toObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId(id);
  } catch (error) {
    console.error('Invalid ObjectId:', id, error);
    return null;
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/v1/dashboard/stats
// @access  Private
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  console.log('=== Dashboard Stats Request ===');
  
  if (!req.user || !req.user.id) {
    console.error('No user ID found in request');
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
  
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  try {
    console.log(`Fetching dashboard stats for ${isAdmin ? 'admin' : 'user'}:`, userId);
    
    // Convert userId to ObjectId once
    const userIdObj = toObjectId(userId);
    if (!userIdObj) {
      throw new Error('Invalid user ID format');
    }
    
    // Base query conditions for user-specific data
    const userQuery = {
      $or: [
        { assignedTo: { $in: [userIdObj] } },
        { createdBy: userIdObj }
      ]
    };

    // Get date range for recent activity (last 30 days)
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
    
    // Run all queries in parallel for better performance
    const [
      // Task statistics
      taskStats,
      
      // Document statistics
      documentStats,
      
      // Project statistics
      projectStats,
      
      // Team members (for admin)
      teamMembers,
      
      // Recent activity
      recentActivity,
      
      // System stats (admin only)
      systemStats
    ] = await Promise.all([
      // Task statistics
      (async () => {
        const tasks = await Task.aggregate([
          { $match: isAdmin ? {} : userQuery },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              dueDates: { $push: '$dueDate' }
            }
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: 1,
              overdue: {
                $size: {
                  $filter: {
                    input: '$dueDates',
                    as: 'date',
                    cond: { $and: [
                      { $ne: ['$$date', null] },
                      { $lt: ['$$date', new Date()] }
                    ]}
                  }
                }
              }
            }
          }
        ]).catch(err => {
          console.error('Error aggregating task stats:', err);
          return [];
        });

        const stats = {
          total: 0,
          byStatus: {},
          overdue: 0
        };

        tasks.forEach(stat => {
          stats.total += stat.count;
          stats.byStatus[stat.status] = stat.count;
          if (stat.overdue) {
            stats.overdue += stat.overdue;
          }
        });

        return stats;
      })(),
      
      // Document statistics
      (async () => {
        const docs = await Document.aggregate([
          { 
            $match: isAdmin ? {} : {
              $or: [
                { 'access.user': userIdObj, 'access.permission': { $in: ['view', 'edit', 'manage'] } },
                { createdBy: userIdObj }
              ]
            }
          },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              totalSize: { $sum: '$size' }
            }
          },
          {
            $project: {
              _id: 0,
              type: { $ifNull: ['$_id', 'other'] },
              count: 1,
              totalSize: 1
            }
          }
        ]).catch(err => {
          console.error('Error aggregating document stats:', err);
          return [];
        });

        const stats = {
          total: 0,
          totalSize: 0,
          byType: {}
        };

        docs.forEach(doc => {
          stats.total += doc.count;
          stats.totalSize += doc.totalSize || 0;
          stats.byType[doc.type] = doc.count;
        });

        return stats;
      })(),
      
      // Project statistics
      (async () => {
        const projects = await Project.aggregate([
          { 
            $match: isAdmin ? {} : {
              $or: [
                { createdBy: userIdObj },
                { team: { $in: [userIdObj] } }
              ]
            }
          },
          {
            $lookup: {
              from: 'tasks',
              localField: '_id',
              foreignField: 'project',
              as: 'tasks'
            }
          },
          {
            $project: {
              name: 1,
              status: 1,
              startDate: 1,
              endDate: 1,
              totalTasks: { $size: '$tasks' },
              completedTasks: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: { $eq: ['$$task.status', 'Done'] }
                  }
                }
              }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalTasks: { $sum: '$totalTasks' },
              completedTasks: { $sum: '$completedTasks' },
              overdue: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $ne: ['$endDate', null] },
                      { $lt: ['$endDate', new Date()] },
                      { $ne: ['$status', 'Completed'] }
                    ]},
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: 1,
              totalTasks: 1,
              completedTasks: 1,
              overdue: 1,
              completionRate: {
                $cond: [
                  { $eq: ['$totalTasks', 0] },
                  0,
                  { $divide: ['$completedTasks', '$totalTasks'] }
                ]
              }
            }
          }
        ]).catch(err => {
          console.error('Error aggregating project stats:', err);
          return [];
        });

        const stats = {
          total: 0,
          totalTasks: 0,
          completedTasks: 0,
          overdue: 0,
          byStatus: {}
        };

        projects.forEach(proj => {
          stats.total += proj.count;
          stats.totalTasks += proj.totalTasks || 0;
          stats.completedTasks += proj.completedTasks || 0;
          stats.overdue += proj.overdue || 0;
          stats.byStatus[proj.status] = {
            count: proj.count,
            completionRate: proj.completionRate
          };
        });

        return stats;
      })(),
      
      // Team members (for admin)
      isAdmin ? User.find({}, 'name email role lastLogin')
        .sort({ lastLogin: -1 })
        .limit(10)
        .lean()
        .catch(err => {
          console.error('Error fetching team members:', err);
          return [];
        }) : [],
      
      // Recent activity
      (async () => {
        const activities = [];
        
        // Get recent tasks
        const recentTasks = await Task.find({
          ...(isAdmin ? {} : userQuery),
          updatedAt: { $gte: thirtyDaysAgo }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name')
        .lean()
        .catch(err => {
          console.error('Error fetching recent tasks:', err);
          return [];
        });
        
        activities.push(...recentTasks.map(task => ({
          type: 'task',
          id: task._id,
          title: task.title,
          action: task.status === 'Done' ? 'completed' : 'updated',
          user: task.updatedBy || task.createdBy,
          date: task.updatedAt,
          project: task.project
        })));
        
        // Get recent documents (for admin or user's documents)
        const recentDocs = await Document.find({
          ...(isAdmin ? {} : {
            $or: [
              { 'access.user': userIdObj, 'access.permission': { $in: ['view', 'edit', 'manage'] } },
              { createdBy: userIdObj }
            ]
          }),
          updatedAt: { $gte: thirtyDaysAgo }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('createdBy', 'name')
        .lean()
        .catch(err => {
          console.error('Error fetching recent documents:', err);
          return [];
        });
        
        activities.push(...recentDocs.map(doc => ({
          type: 'document',
          id: doc._id,
          title: doc.name,
          action: 'updated',
          user: doc.updatedBy || doc.createdBy,
          date: doc.updatedAt,
          fileType: doc.type
        })));
        
        // Sort all activities by date and return top 15
        return activities
          .sort((a, b) => b.date - a.date)
          .slice(0, 15);
      })(),
      
      // System stats (admin only)
      isAdmin ? (async () => {
        try {
          const [totalUsers, activeUsers, storageUsage] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
            Document.aggregate([
              { $group: { _id: null, total: { $sum: '$size' } } }
            ])
          ]);
          
          return {
            totalUsers,
            activeUsers,
            storageUsage: storageUsage[0]?.total || 0,
            lastUpdated: new Date()
          };
        } catch (err) {
          console.error('Error fetching system stats:', err);
          return {};
        }
      })() : {}
    ]);
    
    // Prepare response data
    const responseData = {
      tasks: {
        total: taskStats.total,
        byStatus: taskStats.byStatus,
        overdue: taskStats.overdue,
        completionRate: taskStats.total > 0 
          ? Math.round(((taskStats.byStatus.Done || 0) / taskStats.total) * 100)
          : 0
      },
      documents: {
        total: documentStats.total,
        totalSize: documentStats.totalSize,
        byType: documentStats.byType
      },
      projects: {
        total: projectStats.total,
        totalTasks: projectStats.totalTasks,
        completedTasks: projectStats.completedTasks,
        overdue: projectStats.overdue,
        byStatus: projectStats.byStatus
      },
      recentActivity,
      ...(isAdmin && {
        team: {
          total: teamMembers.length,
          members: teamMembers
        },
        system: systemStats
      })
    };

    // Cache the response for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
    
    res.status(200).json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return next(new ErrorResponse(
      `Error fetching dashboard statistics: ${error.message}`, 
      500,
      { stack: process.env.NODE_ENV === 'development' ? error.stack : undefined }
    ));
  }
});
