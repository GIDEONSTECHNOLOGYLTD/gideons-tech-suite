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

  const { name, description, folder, project, tags, changes = 'Initial version' } = req.body;
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
    updatedBy: req.user.id,
    changes,
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

// @desc    Get document by ID
// @route   GET /api/v1/documents/:id
// @access  Private
exports.getDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('folder', 'name')
    .populate('project', 'name')
    .populate('versions.uploadedBy', 'name email');

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access
  if (
    document.createdBy._id.toString() !== req.user.id &&
    !document.access.some(a => a.user.toString() === req.user.id)
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this document`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Get document versions
// @route   GET /api/v1/documents/:id/versions
// @access  Private
exports.getDocumentVersions = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id)
    .select('versions')
    .populate('versions.uploadedBy', 'name email');

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access
  if (
    document.createdBy.toString() !== req.user.id &&
    !document.access.some(a => a.user.toString() === req.user.id)
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this document`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    count: document.versions.length,
    data: document.versions.sort((a, b) => b.versionNumber - a.versionNumber)
  });
});

// @desc    Restore document version
// @route   PUT /api/v1/documents/:id/versions/:versionNumber/restore
// @access  Private
exports.restoreDocumentVersion = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(
      new ErrorResponse(`Document not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has edit access
  if (
    document.createdBy.toString() !== req.user.id &&
    !document.access.some(a => 
      a.user.toString() === req.user.id && ['edit', 'manage'].includes(a.permission)
    )
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this document`,
        401
      )
    );
  }

  const versionNumber = parseInt(req.params.versionNumber);
  const version = document.versions.find(v => v.versionNumber === versionNumber);
  
  if (!version) {
    return next(
      new ErrorResponse(`Version ${versionNumber} not found for document ${req.params.id}`, 404)
    );
  }
  
  // Create a new version with the restored content
  const newVersion = {
    versionNumber: document.currentVersion + 1,
    fileUrl: version.fileUrl,
    fileType: version.fileType,
    fileSize: version.fileSize,
    uploadedBy: req.user.id,
    changes: `Restored from version ${versionNumber}`,
    isCurrent: true
  };
  
  // Mark all other versions as not current
  document.versions.forEach(v => {
    v.isCurrent = false;
  });
  
  document.versions.push(newVersion);
  document.currentVersion = newVersion.versionNumber;
  document.fileUrl = version.fileUrl;
  document.fileType = version.fileType;
  document.fileSize = version.fileSize;
  document.updatedBy = req.user.id;
  
  await document.save();
  
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

  // Make sure user is document owner or has edit access
  if (
    document.createdBy.toString() !== req.user.id &&
    !document.access.some(a => 
      a.user.toString() === req.user.id && ['edit', 'manage'].includes(a.permission)
    )
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this document`,
        401
      )
    );
  }

  // Handle file upload if present
  if (req.file) {
    // Keep old file path for versioning
    const oldFileUrl = document.fileUrl;
    
    // Update document with new file info
    document.fileUrl = `/uploads/documents/${req.file.filename}`;
    document.fileType = req.file.mimetype;
    document.fileSize = req.file.size;
    document.updatedBy = req.user.id;
    document.changes = req.body.changes || 'Updated file';
    
    // Save will trigger the versioning middleware
    document = await document.save();
    
    // Delete old file after successful versioning
    try {
      const oldFilePath = path.join(__dirname, '../..', oldFileUrl);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    } catch (err) {
      console.error('Error deleting old file:', err);
    }
    
    return res.status(200).json({
      success: true,
      data: document
    });
  }
  
  // For non-file updates
  req.body.updatedBy = req.user.id;
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

// @desc    Download a document
// @route   GET /api/v1/documents/:id/download
// @access  Private
exports.downloadDocument = asyncHandler(async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return next(new ErrorResponse('Document not found', 404));
    }

    const hasAccess = document.createdBy._id.toString() === req.user.id || 
                   document.access.some(a => a.user.toString() === req.user.id);
  
    if (!hasAccess) {
      return next(
        new ErrorResponse(`Not authorized to access this document`, 401)
      );
    }

    const filePath = path.join(__dirname, `../../public${document.fileUrl}`);
    
    if (!fs.existsSync(filePath)) {
      return next(new ErrorResponse('File not found', 404));
    }

    res.download(filePath, document.name);
  } catch (err) {
    next(err);
  }
});
