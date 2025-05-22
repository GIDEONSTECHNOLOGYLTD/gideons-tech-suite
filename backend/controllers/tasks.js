const Task = require('../models/Task');
const Project = require('../models/Project');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all tasks
// @route   GET /api/v1/tasks
// @route   GET /api/v1/projects/:projectId/tasks
// @access  Private
exports.getTasks = asyncHandler(async (req, res, next) => {
  if (req.params.projectId) {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate({
        path: 'assignedTo',
        select: 'name email'
      });
    
    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single task
// @route   GET /api/v1/tasks/:id
// @access  Private
exports.getTask = asyncHandler(async (req, res, next) => {
  const task = await Task.findById(req.params.id)
    .populate({
      path: 'project',
      select: 'name client'
    })
    .populate({
      path: 'assignedTo',
      select: 'name email role'
    })
    .populate({
      path: 'createdBy',
      select: 'name email'
    });
  
  if (!task) {
    return next(
      new ErrorResponse(`Task not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is assigned to the task or is an admin
  if (!task.assignedTo.some(user => user._id.toString() === req.user.id) && 
      req.user.role !== 'admin' && 
      task.createdBy._id.toString() !== req.user.id) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this task`,
        401
      )
    );
  }
  
  res.status(200).json({
    success: true,
    data: task
  });
});

// @desc    Create new task
// @route   POST /api/v1/projects/:projectId/tasks
// @access  Private
exports.createTask = asyncHandler(async (req, res, next) => {
  // Add project to req.body
  req.body.project = req.params.projectId;
  
  // Add user to req.body
  req.body.createdBy = req.user.id;
  
  // If assignedTo is not provided, assign to the creator
  if (!req.body.assignedTo || req.body.assignedTo.length === 0) {
    req.body.assignedTo = [req.user.id];
  }
  
  // Check if project exists and user is part of the project team
  const project = await Project.findById(req.params.projectId);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.projectId}`, 404)
    );
  }
  
  // Make sure user is part of the project team or is an admin
  if (!project.team.includes(req.user.id) && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to add tasks to this project`,
        401
      )
    );
  }
  
  // Check if all assigned users are part of the project team
  const invalidAssignments = req.body.assignedTo.filter(
    userId => !project.team.includes(userId)
  );
  
  if (invalidAssignments.length > 0) {
    return next(
      new ErrorResponse(
        `Cannot assign task to users who are not part of the project team`,
        400
      )
    );
  }
  
  const task = await Task.create(req.body);
  
  res.status(201).json({
    success: true,
    data: task
  });
});

// @desc    Update task
// @route   PUT /api/v1/tasks/:id
// @access  Private
exports.updateTask = asyncHandler(async (req, res, next) => {
  let task = await Task.findById(req.params.id);
  
  if (!task) {
    return next(
      new ErrorResponse(`Task not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Check if user is assigned to the task, is the creator, or is an admin
  const isAssigned = task.assignedTo.some(
    user => user._id.toString() === req.user.id
  );
  const isCreator = task.createdBy.toString() === req.user.id;
  
  if (!isAssigned && !isCreator && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this task`,
        401
      )
    );
  }
  
  // If status is being updated to 'Done', set completedAt
  if (req.body.status === 'Done' && task.status !== 'Done') {
    req.body.completedAt = Date.now();
  } else if (req.body.status !== 'Done' && task.status === 'Done') {
    // If status is being changed from 'Done', clear completedAt
    req.body.completedAt = null;
  }
  
  task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: task
  });
});

// @desc    Delete task
// @route   DELETE /api/v1/tasks/:id
// @access  Private
exports.deleteTask = asyncHandler(async (req, res, next) => {
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    return next(
      new ErrorResponse(`Task not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is task creator or admin
  if (task.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this task`,
        401
      )
    );
  }
  
  await task.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get tasks assigned to a user
// @route   GET /api/v1/tasks/user/:userId
// @access  Private
exports.getUserTasks = asyncHandler(async (req, res, next) => {
  const tasks = await Task.find({ assignedTo: req.params.userId })
    .populate({
      path: 'project',
      select: 'name client status'
    });
  
  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks
  });
});

// @desc    Get tasks by status
// @route   GET /api/v1/tasks/status/:status
// @access  Private
exports.getTasksByStatus = asyncHandler(async (req, res, next) => {
  const tasks = await Task.find({ status: req.params.status })
    .populate({
      path: 'project',
      select: 'name client'
    })
    .populate({
      path: 'assignedTo',
      select: 'name email'
    });
  
  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks
  });
});
