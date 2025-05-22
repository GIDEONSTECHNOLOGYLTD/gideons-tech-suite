const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getDocuments,
  uploadDocument
} = require('../controllers/documents');

// Public routes (none)

// Protected routes
router.use(protect);

// /api/v1/projects/:projectId/documents
router
  .route('/')
  .get(getDocuments)
  .post(upload.single('file'), uploadDocument);

module.exports = router;
