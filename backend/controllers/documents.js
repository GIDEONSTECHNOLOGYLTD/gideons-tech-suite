const { Document, Tag } = require('../models/Document');
const Folder = require('../models/Folder');
const User = require('../models/User');
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

  const { name, description, folder, project, tagIds, changes = 'Initial version' } = req.body;
  
  // Validate tags if provided
  let tags = [];
  if (tagIds) {
    const tagIdsArray = Array.isArray(tagIds) ? tagIds : tagIds.split(',');
    
    // Verify all tags exist and belong to the user
    const existingTags = await Tag.find({
      _id: { $in: tagIdsArray },
      createdBy: req.user.id
    });
    
    if (existingTags.length !== tagIdsArray.length) {
      fs.unlinkSync(req.file.path); // Clean up uploaded file
      return next(new ErrorResponse('One or more tags not found', 404));
    }
    
    tags = tagIdsArray;
  }

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
    tags,
    createdBy: req.user.id,
    updatedBy: req.user.id,
    changes,
    access: [{
      user: req.user.id,
      permission: 'manage'
    }]
  });
  
  // Populate tags for the response
  await document.populate('tags', 'name color');

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
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  };
  
  // Filter by tag if provided
  if (tag) {
    query.tags = tag;
  }
  
  // Get documents that the user has access to
  const documents = await Document.find(query)
    .populate('createdBy', 'name email')
    .populate('folder', 'name')
    .populate('tags', 'name color')
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
    .populate('tags', 'name color')
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

  // Handle tags update if provided
  if (req.body.tagIds) {
    const tagIdsArray = Array.isArray(req.body.tagIds) 
      ? req.body.tagIds 
      : req.body.tagIds.split(',');
    
    // Verify all tags exist and belong to the user
    const existingTags = await Tag.find({
      _id: { $in: tagIdsArray },
      createdBy: req.user.id
    });
    
    if (existingTags.length !== tagIdsArray.length) {
      return next(new ErrorResponse('One or more tags not found', 404));
    }
    
    req.body.tags = tagIdsArray;
    delete req.body.tagIds;
  }

  // Process file if uploaded
  if (req.file) {
    // Create a new version
    const newVersion = {
      versionNumber: document.versions.length + 1,
      fileUrl: `/uploads/documents/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
      changes: req.body.changes || 'Document updated',
      isCurrent: true
    };
    
    // Mark all other versions as not current
    document.versions.forEach(version => {
      version.isCurrent = false;
    });
    
    document.versions.push(newVersion);
    document.currentVersion = newVersion.versionNumber;
    
    // Update document with new file info
    req.body.fileUrl = newVersion.fileUrl;
    req.body.fileType = newVersion.fileType;
    req.body.fileSize = newVersion.fileSize;
  }

  // For non-file updates
  req.body.updatedBy = req.user.id;
  document = await Document.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    { new: true, runValidators: true }
  ).populate('tags', 'name color');

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

// @desc    Share a document with a user
// @route   POST /api/v1/documents/:id/share
// @access  Private
exports.shareDocument = asyncHandler(async (req, res, next) => {
  const { userId, permission } = req.body;

  // Validate permission
  if (!['view', 'edit', 'manage'].includes(permission)) {
    return next(new ErrorResponse('Invalid permission level', 400));
  }

  // Check if document exists and user has manage access
  let document = await Document.findById(req.params.id);
  if (!document) {
    return next(new ErrorResponse(`Document not found with id of ${req.params.id}`, 404));
  }

  // Check if user has manage access
  const hasManageAccess = document.access.some(
    a => a.user.toString() === req.user.id && a.permission === 'manage'
  );
  
  if (document.createdBy.toString() !== req.user.id && !hasManageAccess) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to share this document`,
        401
      )
    );
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
  }

  // Check if user already has access
  const existingAccess = document.access.find(
    a => a.user.toString() === userId
  );

  if (existingAccess) {
    // Update existing permission
    existingAccess.permission = permission;
  } else {
    // Add new access
    document.access.push({
      user: userId,
      permission
    });
  }

  await document.save();

  // Populate user details in the response
  await document.populate({
    path: 'access.user',
    select: 'name email'
  });

  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Remove user access to a document
// @route   DELETE /api/v1/documents/:id/share/:userId
// @access  Private
exports.removeDocumentAccess = asyncHandler(async (req, res, next) => {
  const { id, userId } = req.params;

  // Check if document exists and user has manage access
  let document = await Document.findById(id);
  if (!document) {
    return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
  }

  // Check if user has manage access
  const hasManageAccess = document.access.some(
    a => a.user.toString() === req.user.id && a.permission === 'manage'
  );
  
  if (document.createdBy.toString() !== req.user.id && !hasManageAccess) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to modify access for this document`,
        401
      )
    );
  }

  // Check if trying to remove owner's access
  if (document.createdBy.toString() === userId) {
    return next(
      new ErrorResponse('Cannot remove access for the document owner', 400)
    );
  }

  // Remove the access
  document.access = document.access.filter(
    a => a.user.toString() !== userId
  );

  await document.save();

  // Populate user details in the response
  await document.populate({
    path: 'access.user',
    select: 'name email'
  });

  res.status(200).json({
    success: true,
    data: document
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
