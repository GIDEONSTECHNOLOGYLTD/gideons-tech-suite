const Project = require('../models/Project');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all projects
// @route   GET /api/v1/projects
// @access  Private
exports.getProjects = asyncHandler(async (req, res, next) => {
  let query;
  
  // Copy req.query
  const reqQuery = { ...req.query };
  
  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];
  
  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);
  
  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
  
  // Finding resource
  query = Project.find(JSON.parse(queryStr)).populate({
    path: 'team',
    select: 'name email role'
  });
  
  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
  
  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }
  
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Project.countDocuments(JSON.parse(queryStr));
  
  query = query.skip(startIndex).limit(limit);
  
  // Executing query
  const projects = await query;
  
  // Pagination result
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.status(200).json({
    success: true,
    count: projects.length,
    pagination,
    data: projects
  });
});

// @desc    Get single project
// @route   GET /api/v1/projects/:id
// @access  Private
exports.getProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id)
    .populate({
      path: 'team',
      select: 'name email role'
    })
    .populate({
      path: 'tasks',
      select: 'title status priority dueDate assignedTo'
    });
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is project team member or admin
  if (project.team.some(member => member._id.toString() === req.user.id) || req.user.role === 'admin') {
    res.status(200).json({
      success: true,
      data: project
    });
  } else {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this project`,
        401
      )
    );
  }
});

// @desc    Create new project
// @route   POST /api/v1/projects
// @access  Private
exports.createProject = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;
  
  // If team is not provided, add the creator to the team
  if (!req.body.team) {
    req.body.team = [req.user.id];
  } else if (!req.body.team.includes(req.user.id)) {
    // Make sure the creator is always in the team
    req.body.team.push(req.user.id);
  }
  
  const project = await Project.create(req.body);
  
  res.status(201).json({
    success: true,
    data: project
  });
});

// @desc    Update project
// @route   PUT /api/v1/projects/:id
// @access  Private
exports.updateProject = asyncHandler(async (req, res, next) => {
  let project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is project team member or admin
  if (!project.team.includes(req.user.id) && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this project`,
        401
      )
    );
  }
  
  // If team is being updated, make sure the current user is included
  if (req.body.team && !req.body.team.includes(req.user.id) && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        'You cannot remove yourself from the project team',
        400
      )
    );
  }
  
  project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: project
  });
});

// @desc    Delete project
// @route   DELETE /api/v1/projects/:id
// @access  Private
exports.deleteProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Make sure user is project creator or admin
  if (project.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this project`,
        401
      )
    );
  }
  
  await project.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get projects by user
// @route   GET /api/v1/projects/user/:userId
// @access  Private
exports.getUserProjects = asyncHandler(async (req, res, next) => {
  // Check if user exists (you can add this check if needed)
  
  const projects = await Project.find({ team: req.params.userId })
    .populate({
      path: 'team',
      select: 'name email role'
    });
  
  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects
  });
});
