const express = require('express');
const { protect } = require('../middleware/auth');
const {
  searchDocuments,
  getSearchSuggestions
} = require('../controllers/search');

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

/**
 * @route   GET /api/v1/search/documents
 * @desc    Search documents with advanced filters
 * @access  Private
 * @query   {string} q - Search query string
 * @query   {string} tags - Comma-separated tag IDs
 * @query   {string} folder - Filter by folder ID
 * @query   {string} project - Filter by project ID
 * @query   {string} fileType - Filter by file type
 * @query   {string} sortBy - Sort field (default: -updatedAt)
 * @query   {number} limit - Number of results per page (default: 10)
 * @query   {number} page - Page number (default: 1)
 */
router.get('/documents', searchDocuments);

/**
 * @route   GET /api/v1/search/suggestions
 * @desc    Get search suggestions based on query
 * @access  Private
 * @query   {string} q - Search query string (required)
 */
router.get('/suggestions', getSearchSuggestions);

module.exports = router;
