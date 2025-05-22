const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument
} = require('../controllers/documents');

// Public routes (none for documents)

// Protected routes
router.use(protect);

// /api/v1/documents
router
  .route('/')
  .get(getDocuments)
  .post(upload.single('file'), uploadDocument);

// /api/v1/documents/:id
router
  .route('/:id')
  .get(getDocument)
  .put(updateDocument)
  .delete(deleteDocument);

// /api/v1/documents/:id/download
get('/:id/download', downloadDocument);

// /api/v1/projects/:projectId/documents
router.use('/projects/:projectId', require('./projectDocuments'));

module.exports = router;
