const Document = require('../models/Document');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

/**
 * @desc    Search documents with advanced filters
 * @route   GET /api/v1/search/documents
 * @access  Private
 */
exports.searchDocuments = asyncHandler(async (req, res, next) => {
  const { 
    q: query, 
    tags, 
    folder, 
    project, 
    fileType, 
    sortBy = '-updatedAt',
    limit = 10,
    page = 1
  } = req.query;

  try {
    // Convert comma-separated tags to array if provided
    const tagArray = tags ? tags.split(',') : [];

    const searchResults = await Document.search({
      query,
      userId: req.user.id,
      tags: tagArray,
      folder,
      project,
      fileType,
      sortBy,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10)
    });

    res.status(200).json({
      success: true,
      ...searchResults
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get search suggestions
 * @route   GET /api/v1/search/suggestions
 * @access  Private
 */
exports.getSearchSuggestions = asyncHandler(async (req, res, next) => {
  const { q: query } = req.query;

  if (!query) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  try {
    // Search for matching documents
    const documents = await Document.find(
      {
        $and: [
          { 'access.user': req.user.id },
          {
            $or: [
              { name: new RegExp(query, 'i') },
              { description: new RegExp(query, 'i') },
              { 'tags.name': new RegExp(query, 'i') }
            ]
          }
        ]
      },
      'name description tags fileType',
      { limit: 5 }
    ).populate('tags', 'name color');

    // Extract unique tags from results
    const tagSet = new Set();
    documents.forEach(doc => {
      doc.tags.forEach(tag => {
        tagSet.add(JSON.stringify({
          _id: tag._id,
          name: tag.name,
          color: tag.color
        }));
      });
    });

    const tags = Array.from(tagSet).map(tag => JSON.parse(tag));

    res.status(200).json({
      success: true,
      data: {
        documents: documents.map(doc => ({
          _id: doc._id,
          name: doc.name,
          fileType: doc.fileType,
          description: doc.description
        })),
        tags
      }
    });
  } catch (error) {
    next(error);
  }
});
