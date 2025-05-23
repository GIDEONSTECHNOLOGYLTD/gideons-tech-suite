const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getFolders,
  getFolderTree,
  createFolder
} = require('../controllers/folders');

// Public routes (none)

// Protected routes
router.use(protect);

// /api/v1/projects/:projectId/folders
router
  .route('/')
  .get(getFolders)
  .post(createFolder);

// /api/v1/projects/:projectId/folders/tree
router.get('/tree', getFolderTree);

module.exports = router;
