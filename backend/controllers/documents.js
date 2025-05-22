const Document = require('../models/Document');
const Folder = require('../models/Folder');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const path = require('path');
const fs = require('fs');

// @desc    Upload a document
// @route   POST /api/v1/documents
// @access  Private
exports.uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const { name, description, folder, project, tags } = req.body;
  const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

  // Check if folder exists if provided
  if (folder) {
    const folderExists = await Folder.findById(folder);
    if (!folderExists) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return next(new ErrorResponse(`No folder with the id of ${folder}`, 404));
    }
  }

  const document = await Document.create({
    name: name || req.file.originalname,
    description,
    fileUrl: `/uploads/documents/${req.file.filename}`,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    folder: folder || null,
    project: project || null,
    tags: tagsArray,
    createdBy: req.user.id,
    access: [{
      user: req.user.id,
      permission: 'manage'
    }]
  });

  res.status(201).json({
    success: true,
    data: document
  });
});

// @desc    Get all documents
// @route   GET /api/v1/documents
// @access  Private
exports.getDocuments = asyncHandler(async (req, res, next) => {
  // Check for project filter
  if (req.params.projectId) {
    // Check if user has access to this project
    // This would be implemented based on your project access control
    
    const documents = await Document.find({ 
      project: req.params.projectId,
      $or: [
        { createdBy: req.user.id },
        { 'access.user': req.user.id }
      ]
    })
    .populate('createdBy', 'name email')
    .populate('folder', 'name')
    .sort('-createdAt');

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  }

  // If no project specified, get all documents user has access to
  const documents = await Document.find({
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  })
  .populate('createdBy', 'name email')
  .populate('folder', 'name')
  .populate('project', 'name')
  .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
});

// @desc    Get single document
// @route   GET /api/v1/documents/:id
// @access  Private
exports.getDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('folder', 'name')
    .populate('project', 'name');

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this document
  const hasAccess = document.createdBy._id.toString() === req.user.id || 
                   document.access.some(a => a.user.toString() === req.user.id);
  
  if (!hasAccess) {
    return next(
      new ErrorResponse(`Not authorized to access this document`, 401)
    );
  }

  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Update document
// @route   PUT /api/v1/documents/:id
// @access  Private
exports.updateDocument = asyncHandler(async (req, res, next) => {
  let document = await Document.findById(req.params.id);

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is document owner or has manage access
  const userAccess = document.access.find(a => a.user.toString() === req.user.id);
  if (document.createdBy.toString() !== req.user.id && 
      (!userAccess || !['edit', 'manage'].includes(userAccess.permission))) {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update this document`, 401)
    );
  }

  // Check if folder exists if being updated
  if (req.body.folder) {
    const folderExists = await Folder.findById(req.body.folder);
    if (!folderExists) {
      return next(new ErrorResponse(`No folder with the id of ${req.body.folder}`, 404));
    }
  }

  // Update document
  document = await Document.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Delete document
// @route   DELETE /api/v1/documents/:id
// @access  Private
exports.deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is document owner or has manage access
  const userAccess = document.access.find(a => a.user.toString() === req.user.id);
  if (document.createdBy.toString() !== req.user.id && 
      (!userAccess || userAccess.permission !== 'manage')) {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to delete this document`, 401)
    );
  }

  // Delete the file from the filesystem
  const filePath = path.join(__dirname, `../../public${document.fileUrl}`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await document.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Download document
// @route   GET /api/v1/documents/:id/download
// @access  Private
exports.downloadDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this document
  const hasAccess = document.createdBy._id.toString() === req.user.id || 
                   document.access.some(a => a.user.toString() === req.user.id);
  
  if (!hasAccess) {
    return next(
      new ErrorResponse(`Not authorized to access this document`, 401)
    );
  }

  const filePath = path.join(__dirname, `../../public${document.fileUrl}`);
  
  if (!fs.existsSync(filePath)) {
    return next(
      new ErrorResponse('File not found', 404)
    );
  }

  res.download(filePath, document.name);
});
