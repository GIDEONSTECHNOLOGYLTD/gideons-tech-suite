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
  console.log('Database connection state:', mongoose.connection.readyState);
  console.log('Authenticated user:', req.user ? {
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  } : 'No user');
  
  if (!req.user || !req.user.id) {
    console.error('No user ID found in request');
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
  
  const userId = req.user.id;
  
  try {
    console.log('Fetching dashboard stats for user:', userId);
    
    // Convert userId to ObjectId once
    const userIdObj = toObjectId(userId);
    if (!userIdObj) {
      throw new Error('Invalid user ID format');
    }
    
    // Run queries in parallel for better performance
    const [
      totalTasks,
      completedTasks,
      totalDocuments,
      totalProjects
    ] = await Promise.all([
      // Total tasks
      Task.countDocuments({
        $or: [
          { assignedTo: { $in: [userIdObj] } },
          { createdBy: userIdObj }
        ]
      }).catch(err => {
        console.error('Error counting total tasks:', err);
        return 0;
      }),
      
      // Completed tasks
      Task.countDocuments({
        status: 'Done',
        $or: [
          { assignedTo: { $in: [userIdObj] } },
          { createdBy: userIdObj }
        ]
      }).catch(err => {
        console.error('Error counting completed tasks:', err);
        return 0;
      }),
      
      // Documents with access
      Document.countDocuments({
        $or: [
          { 'access.user': userIdObj, 'access.permission': { $in: ['view', 'edit', 'manage'] } },
          { createdBy: userIdObj }
        ]
      }).catch(err => {
        console.error('Error counting documents:', err);
        return 0;
      }),
      
      // Projects
      Project.countDocuments({
        $or: [
          { createdBy: userIdObj },
          { team: { $in: [userIdObj] } }
        ]
      }).catch(err => {
        console.error('Error counting projects:', err);
        return 0;
      })
    ]);
    
    // Calculate completion percentage (avoid division by zero)
    const completionPercentage = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          inProgress: totalTasks - completedTasks,
          completionPercentage
        },
        documents: {
          total: totalDocuments
        },
        projects: {
          total: totalProjects
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    // Include the error message in the response for debugging
    return next(new ErrorResponse(`Error fetching dashboard statistics: ${error.message}`, 500));
  }
});
