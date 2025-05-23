const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Task = require('../models/Task');
const Document = require('../models/Document');
const Project = require('../models/Project');

// @desc    Get dashboard statistics
// @route   GET /api/v1/dashboard/stats
// @access  Private
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
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
    createdBy: userId
  });

  // Get project statistics
  const totalProjects = await Project.countDocuments({
    $or: [
      { members: userId },
      { createdBy: userId }
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
});
