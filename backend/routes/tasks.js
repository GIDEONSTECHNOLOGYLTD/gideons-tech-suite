const express = require('express');
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getUserTasks,
  getTasksByStatus
} = require('../controllers/tasks');

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Task = require('../models/Task');

const router = express.Router({ mergeParams: true });

// All routes are protected
router.use(protect);

// Re-route to project tasks if projectId is present
const taskRouter = express.Router({ mergeParams: true });

// Routes for /api/v1/tasks
router.use(
  '/',
  // If projectId is present, only show tasks for that project
  (req, res, next) => {
    if (req.params.projectId) {
      req.query.project = req.params.projectId;
    }
    next();
  },
  advancedResults(Task, [
    { path: 'project', select: 'name client' },
    { path: 'assignedTo', select: 'name email role' },
    { path: 'createdBy', select: 'name email' }
  ]),
  taskRouter
);

// Routes for /api/v1/tasks
// or /api/v1/projects/:projectId/tasks
taskRouter
  .route('/')
  .get(getTasks)
  .post(createTask);

// Routes for /api/v1/tasks/user/me - Get current user's tasks
// or /api/v1/projects/:projectId/tasks/user/me
taskRouter.get('/user/me', (req, res, next) => {
  // Set the user ID from the authenticated user
  req.params.userId = req.user.id;
  next();
}, getUserTasks);

// Routes for /api/v1/tasks/user/:userId - Admin/manager can get any user's tasks
// or /api/v1/projects/:projectId/tasks/user/:userId
taskRouter.get('/user/:userId', authorize('admin', 'manager'), getUserTasks);

// Routes for /api/v1/tasks/status/:status
// or /api/v1/projects/:projectId/tasks/status/:status
taskRouter.get('/status/:status', getTasksByStatus);

// Routes for /api/v1/tasks/:id
// or /api/v1/projects/:projectId/tasks/:id
taskRouter
  .route('/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

// Middleware to check if user is assigned to the task or is the creator
router.use('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    
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
        new ErrorResponse('Not authorized to access this task', 403)
      );
    }
    
    req.task = task;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
