const express = require('express');
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getUserProjects
} = require('../controllers/projects');

const { protect, authorize, isOwner } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Project = require('../models/Project');

const router = express.Router({ mergeParams: true });

// All routes are protected
router.use(protect);

// Re-route into other resource routers
const taskRouter = require('./tasks');

// Re-route to task router
router.use('/:projectId/tasks', taskRouter);

// Routes for /api/v1/projects
router
  .route('/')
  .get(
    advancedResults(Project, [
      { path: 'team', select: 'name email role' },
      { path: 'createdBy', select: 'name email' }
    ]),
    getProjects
  )
  .post(authorize('admin', 'manager'), createProject);

// Routes for /api/v1/projects/user/:userId
router.get('/user/me', (req, res, next) => {
  // Set the user ID from the authenticated user
  req.params.userId = req.user.id;
  next();
}, getUserProjects);

router.get('/user/:userId', authorize('admin', 'manager'), getUserProjects);

// Routes for /api/v1/projects/:id
router
  .route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(authorize('admin', 'manager'), deleteProject);

// Middleware to check if user is part of the project team
router.use('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return next(
        new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
      );
    }
    
    // Check if user is part of the project team or is an admin
    if (!project.team.includes(req.user.id) && req.user.role !== 'admin') {
      return next(
        new ErrorResponse('Not authorized to access this project', 403)
      );
    }
    
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
