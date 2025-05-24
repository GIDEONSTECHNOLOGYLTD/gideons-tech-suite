const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Task = require('../models/Task');
const Document = require('../models/Document');
const Project = require('../models/Project');
const mongoose = require('mongoose');

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
    console.log('Fetching task statistics for user:', userId);
    
    // Get task statistics
    const totalTasks = await Task.countDocuments({
      $or: [
        { assignedTo: { $in: [mongoose.Types.ObjectId(userId)] } },
        { createdBy: mongoose.Types.ObjectId(userId) }
      ]
    });

    const completedTasks = await Task.countDocuments({
      $and: [
        { status: 'Done' },
        {
          $or: [
            { assignedTo: { $in: [mongoose.Types.ObjectId(userId)] } },
            { createdBy: mongoose.Types.ObjectId(userId) }
          ]
        }
      ]
    });
    
    // Get document statistics
    let totalDocuments = 0;
    try {
      totalDocuments = await Document.countDocuments({
        'access': {
          $elemMatch: {
            user: mongoose.Types.ObjectId(userId),
            permission: { $in: ['view', 'edit', 'manage'] }
          }
        }
      });
    } catch (docError) {
      console.warn('Error counting documents, defaulting to 0:', docError);
      totalDocuments = 0;
    }
    
    // Get project statistics
    let totalProjects = 0;
    try {
      totalProjects = await Project.countDocuments({
        $or: [
          { createdBy: mongoose.Types.ObjectId(userId) },
          { team: { $in: [mongoose.Types.ObjectId(userId)] } }
        ]
      });
    } catch (projectError) {
      console.warn('Error counting projects, defaulting to 0:', projectError);
      totalProjects = 0;
    }
    
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
