const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/auth');
const {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getDocumentsByTag
} = require('../controllers/tags');

// All routes below this middleware are protected
router.use(protect);

// /api/v1/tags
router
  .route('/')
  .get(getTags)
  .post(createTag);

// /api/v1/tags/:id
router
  .route('/:id')
  .get(getTag)
  .put(updateTag)
  .delete(deleteTag);

// /api/v1/tags/:id/documents
router.get('/:id/documents', getDocumentsByTag);

module.exports = router;
