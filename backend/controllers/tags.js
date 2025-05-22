const { Tag } = require('../models/Document');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all tags
// @route   GET /api/v1/tags
// @access  Private
exports.getTags = asyncHandler(async (req, res, next) => {
  const tags = await Tag.find({ createdBy: req.user.id });
  res.status(200).json({ success: true, count: tags.length, data: tags });
});

// @desc    Get single tag
// @route   GET /api/v1/tags/:id
// @access  Private
exports.getTag = asyncHandler(async (req, res, next) => {
  const tag = await Tag.findOne({
    _id: req.params.id,
    createdBy: req.user.id
  });

  if (!tag) {
    return next(
      new ErrorResponse(`Tag not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({ success: true, data: tag });
});

// @desc    Create new tag
// @route   POST /api/v1/tags
// @access  Private
exports.createTag = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  // Check if tag with same name already exists for this user
  const existingTag = await Tag.findOne({
    name: req.body.name.toLowerCase(),
    createdBy: req.user.id
  });

  if (existingTag) {
    return next(new ErrorResponse('Tag with this name already exists', 400));
  }

  const tag = await Tag.create(req.body);
  res.status(201).json({ success: true, data: tag });
});

// @desc    Update tag
// @route   PUT /api/v1/tags/:id
// @access  Private
exports.updateTag = asyncHandler(async (req, res, next) => {
  let tag = await Tag.findById(req.params.id);

  if (!tag) {
    return next(
      new ErrorResponse(`Tag not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is tag owner
  if (tag.createdBy.toString() !== req.user.id) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this tag`,
        401
      )
    );
  }

  // If name is being updated, check for duplicates
  if (req.body.name) {
    const existingTag = await Tag.findOne({
      name: req.body.name.toLowerCase(),
      createdBy: req.user.id,
      _id: { $ne: req.params.id }
    });

    if (existingTag) {
      return next(new ErrorResponse('Tag with this name already exists', 400));
    }
  }

  tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: tag });
});

// @desc    Delete tag
// @route   DELETE /api/v1/tags/:id
// @access  Private
exports.deleteTag = asyncHandler(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);

  if (!tag) {
    return next(
      new ErrorResponse(`Tag not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is tag owner
  if (tag.createdBy.toString() !== req.user.id) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this tag`,
        401
      )
    );
  }

  // Remove tag from all documents
  await mongoose.model('Document').updateMany(
    { tags: req.params.id },
    { $pull: { tags: req.params.id } }
  );

  await tag.remove();

  res.status(200).json({ success: true, data: {} });
});

// @desc    Get documents by tag
// @route   GET /api/v1/tags/:id/documents
// @access  Private
exports.getDocumentsByTag = asyncHandler(async (req, res, next) => {
  const documents = await mongoose.model('Document').find({
    tags: req.params.id,
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  }).populate('createdBy', 'name email').populate('tags', 'name color');

  res.status(200).json({ success: true, count: documents.length, data: documents });
});
