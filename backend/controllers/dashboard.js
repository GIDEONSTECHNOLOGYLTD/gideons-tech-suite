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
        { assignedTo: userId },
        { createdBy: userId }
      ]
    });

    const completedTasks = await Task.countDocuments({
      $and: [
        { status: 'completed' },
        {
          $or: [
            { assignedTo: userId },
            { createdBy: userId }
          ]
        }
      ]
    });
    
    // Get document statistics
    const totalDocuments = await Document.countDocuments({
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });
    
    // Get project statistics
    const totalProjects = await Project.countDocuments({
      $or: [
        { owner: userId },
        { 'team.user': userId }
      ]
    });
    
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
    return next(new ErrorResponse('Error fetching dashboard statistics', 500));
  }
});
