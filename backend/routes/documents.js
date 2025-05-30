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
  downloadDocument,
  getDocumentVersions,
  restoreDocumentVersion,
  shareDocument,
  removeDocumentAccess
} = require('../controllers/documents');

// Import tag routes
const tagRouter = require('./tags');

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

// /api/v1/documents/:id/versions
router
  .route('/:id/versions')
  .get(getDocumentVersions);

// /api/v1/documents/:id/versions/:versionNumber/restore
router
  .route('/:id/versions/:versionNumber/restore')
  .put(restoreDocumentVersion);

// /api/v1/documents/:id/share
router
  .route('/:id/share')
  .post(shareDocument);

// /api/v1/documents/:id/share/:userId
router
  .route('/:id/share/:userId')
  .delete(removeDocumentAccess);

// Re-route into tag router
router.use('/:documentId/tags', tagRouter);

// /api/v1/documents/:id/download
router.get('/:id/download', downloadDocument);

// /api/v1/projects/:projectId/documents
router.use('/projects/:projectId', require('./projectDocuments'));

module.exports = router;
