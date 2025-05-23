const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getFolders,
  getFolderTree,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  updateFolderAccess
} = require('../controllers/folders');

// Public routes (none for folders)

// Protected routes
router.use(protect);

// /api/v1/folders
router
  .route('/')
  .get(getFolders)
  .post(createFolder);

// /api/v1/folders/tree
router.get('/tree', getFolderTree);

// /api/v1/folders/:id
router
  .route('/:id')
  .get(getFolder)
  .put(updateFolder)
  .delete(deleteFolder);

// /api/v1/folders/:id/access
router.put('/:id/access', updateFolderAccess);

// /api/v1/projects/:projectId/folders
router.use('/projects/:projectId', require('./projectFolders'));

module.exports = router;
