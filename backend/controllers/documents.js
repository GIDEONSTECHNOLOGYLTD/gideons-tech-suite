const { Document, Tag } = require('../models/Document');
const Folder = require('../models/Folder');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const path = require('path');
const fs = require('fs');

/**
 * Process and validate tags
 * @param {Array} tags - Array of tag names
 * @param {String} userId - ID of the user creating/updating the document
 * @returns {Promise<Array>} Array of tag IDs
 */
const processTags = async (tags = [], userId) => {
  if (!Array.isArray(tags)) {
    throw new ErrorResponse('Tags must be an array', 400);
  }

  const processedTags = [];
  
  for (const tagName of tags) {
    if (typeof tagName !== 'string' || tagName.trim() === '') {
      throw new ErrorResponse('Tag name must be a non-empty string', 400);
    }

    const normalizedTagName = tagName.trim().toLowerCase();
    
    // Find or create tag
    let tag = await Tag.findOneAndUpdate(
      { name: normalizedTagName, createdBy: userId },
      { 
        $setOnInsert: { 
          name: normalizedTagName,
          createdBy: userId,
          color: `#${Math.floor(Math.random()*16777215).toString(16).padEnd(6, '0')}`
        }
      },
      { 
        new: true, 
        upsert: true, 
        setDefaultsOnInsert: true 
      }
    );
    
    if (tag) {
      processedTags.push(tag._id);
    }
  }
  
  return processedTags;
};

/**
 * @desc    Upload a document
 * @route   POST /api/v1/documents
 * @access  Private
 */
exports.uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const { name, description, folder, project, tags: tagNames = [], changes = 'Initial version' } = req.body;
  const file = req.file;
  
  // Validate file type
  const allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'];
  
  if (!allowedFileTypes.includes(file.mimetype)) {
    fs.unlinkSync(file.path);
    return next(new ErrorResponse(
      `File type not supported. Supported types: ${allowedFileTypes.join(', ')}`,
      400
    ));
  }

  // Validate file size (max 10MB)
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxFileSize) {
    fs.unlinkSync(file.path);
    return next(new ErrorResponse(
      `File size cannot be more than ${(maxFileSize / (1024 * 1024)).toFixed(2)}MB`,
      400
    ));
  }

  try {
    // Process tags if provided
    const tagIds = await processTags(tagNames, req.user.id);

    // Check if folder exists if provided
    if (folder) {
      const folderExists = await Folder.findOne({
        _id: folder,
        $or: [
          { createdBy: req.user.id },
          { 'collaborators.user': req.user.id }
        ]
      });
      
      if (!folderExists) {
        fs.unlinkSync(file.path);
        return next(new ErrorResponse(`No access to folder with id ${folder}`, 403));
      }
    }

    // Create document
    const document = new Document({
      name: name || file.originalname,
      description,
      fileUrl: `/uploads/documents/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
      folder: folder || null,
      project: project || null,
      tags: tagIds,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      changes,
      access: [{
        user: req.user.id,
        permission: 'manage',
        grantedAt: new Date()
      }],
      versions: [{
        version: 1,
        fileUrl: `/uploads/documents/${file.filename}`,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: req.user.id,
        changes: 'Initial version',
        uploadedAt: new Date()
      }]
    });

    await document.save();
    
    // Populate related fields for the response
    await document
      .populate('tags', 'name color')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .execPopulate();

    res.status(201).json({
      success: true,
      data: document
    });

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

/**
 * @desc    Update document details
 * @route   PUT /api/v1/documents/:id
 * @access  Private
 */
exports.updateDocument = asyncHandler(async (req, res, next) => {
  const { name, description, tags: tagNames, changes } = req.body;
  const file = req.file;
  
  let document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id,
    'access.permission': { $in: ['edit', 'manage'] }
  });

  if (!document) {
    if (file) fs.unlinkSync(file.path);
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }

  try {
    // Process tags if provided
    let tagIds = [...document.tags];
    if (tagNames) {
      tagIds = await processTags(tagNames, req.user.id);
    }

    // Handle file upload if new file is provided
    let fileUpdate = {};
    if (file) {
      // Delete old file if it exists
      if (document.fileUrl && fs.existsSync(path.join(__dirname, '..', document.fileUrl))) {
        fs.unlinkSync(path.join(__dirname, '..', document.fileUrl));
      }
      
      fileUpdate = {
        fileUrl: `/uploads/documents/${file.filename}`,
        fileType: file.mimetype,
        fileSize: file.size
      };

      // Add new version
      document.versions.push({
        version: document.versions.length + 1,
        fileUrl: `/uploads/documents/${file.filename}`,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: req.user.id,
        changes: changes || 'Document updated',
        uploadedAt: new Date()
      });
    }

    // Update document
    document.name = name || document.name;
    document.description = description !== undefined ? description : document.description;
    document.tags = tagIds;
    document.updatedBy = req.user.id;
    document.updatedAt = new Date();
    
    if (Object.keys(fileUpdate).length > 0) {
      Object.assign(document, fileUpdate);
    }

    await document.save();
    
    // Populate related fields for the response
    await document
      .populate('tags', 'name color')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .execPopulate();

    res.status(200).json({
      success: true,
      data: document
    });

  } catch (error) {
    if (file) fs.unlinkSync(file.path);
    next(error);
  }
});

/**
 * @desc    Get all documents
 * @route   GET /api/v1/documents
 * @access  Private
 */
exports.getDocuments = asyncHandler(async (req, res, next) => {
  // Filter by tags if provided
  const { tags, folder, project, search } = req.query;
  const query = {};
  
  // Only return documents the user has access to
  query['access.user'] = req.user.id;
  
  if (tags) {
    query.tags = { $in: tags.split(',') };
  }
  
  if (folder) {
    query.folder = folder;
  }
  
  if (project) {
    query.project = project;
  }
  
  if (search) {
    query.$text = { $search: search };
  }
  
  const documents = await Document.find(query)
    .populate('tags', 'name color')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort('-updatedAt');
  
  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
});

/**
 * @desc    Get single document
 * @route   GET /api/v1/documents/:id
 * @access  Private
 */
exports.getDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id
  })
    .populate('tags', 'name color')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  res.status(200).json({
    success: true,
    data: document
  });
});

/**
 * @desc    Delete document
 * @route   DELETE /api/v1/documents/:id
 * @access  Private
 */
exports.deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id,
    'access.permission': 'manage'
  });
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  try {
    // Delete the file from storage
    if (document.fileUrl && fs.existsSync(path.join(__dirname, '..', document.fileUrl))) {
      fs.unlinkSync(path.join(__dirname, '..', document.fileUrl));
    }
    
    // Delete all versions
    for (const version of document.versions) {
      if (version.fileUrl && fs.existsSync(path.join(__dirname, '..', version.fileUrl))) {
        fs.unlinkSync(path.join(__dirname, '..', version.fileUrl));
      }
    }
    
    await document.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Share document with another user
 * @route   POST /api/v1/documents/:id/share
 * @access  Private
 */
exports.shareDocument = asyncHandler(async (req, res, next) => {
  const { userId, permission } = req.body;
  
  if (!['view', 'edit', 'manage'].includes(permission)) {
    return next(new ErrorResponse('Invalid permission level. Must be one of: view, edit, manage', 400));
  }
  
  // Check if user exists and is not the document owner
  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  
  if (userId === req.user.id) {
    return next(new ErrorResponse('Cannot share with yourself', 400));
  }
  
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id,
    'access.permission': 'manage'
  });
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  // Check if user already has access
  const existingAccess = document.access.find(acc => acc.user.toString() === userId);
  
  if (existingAccess) {
    // Update existing access
    existingAccess.permission = permission;
    existingAccess.grantedAt = new Date();
  } else {
    // Add new access
    document.access.push({
      user: userId,
      permission,
      grantedAt: new Date(),
      grantedBy: req.user.id
    });
  }
  
  document.updatedBy = req.user.id;
  document.updatedAt = new Date();
  
  await document.save();
  
  // Populate related fields for the response
  await document
    .populate('access.user', 'name email')
    .populate('access.grantedBy', 'name email')
    .execPopulate();
  
  res.status(200).json({
    success: true,
    data: document
  });
});

/**
 * @desc    Remove user access to document
 * @route   DELETE /api/v1/documents/:id/share/:userId
 * @access  Private
 */
exports.removeDocumentAccess = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  
  // Cannot remove your own access
  if (userId === req.user.id) {
    return next(new ErrorResponse('Cannot remove your own access', 400));
  }
  
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id,
    'access.permission': 'manage'
  });
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  // Cannot remove the last manager
  const managerCount = document.access.filter(
    acc => acc.permission === 'manage' && acc.user.toString() !== userId
  ).length;
  
  if (managerCount === 0) {
    return next(new ErrorResponse('Cannot remove the last manager. Please assign another manager first.', 400));
  }
  
  // Remove the access
  document.access = document.access.filter(acc => acc.user.toString() !== userId);
  document.updatedBy = req.user.id;
  document.updatedAt = new Date();
  
  await document.save();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Get document versions
 * @route   GET /api/v1/documents/:id/versions
 * @access  Private
 */
exports.getDocumentVersions = asyncHandler(async (req, res, next) => {
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id
  }, 'versions');
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  // Populate user information for each version
  const versions = await Promise.all(
    document.versions.map(async (version) => {
      const populatedVersion = version.toObject();
      const user = await User.findById(version.uploadedBy).select('name email');
      return { ...populatedVersion, uploadedBy: user };
    })
  );
  
  res.status(200).json({
    success: true,
    count: versions.length,
    data: versions.sort((a, b) => b.version - a.version)
  });
});

/**
 * @desc    Restore document version
 * @route   POST /api/v1/documents/:id/versions/restore
 * @access  Private
 */
exports.restoreDocumentVersion = asyncHandler(async (req, res, next) => {
  const { version } = req.body;
  
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id,
    'access.permission': { $in: ['edit', 'manage'] }
  });
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  const versionToRestore = document.versions.find(v => v.version === parseInt(version));
  
  if (!versionToRestore) {
    return next(new ErrorResponse(`Version ${version} not found`, 404));
  }
  
  try {
    // Create a new version with the restored content
    document.versions.push({
      version: document.versions.length + 1,
      fileUrl: versionToRestore.fileUrl,
      fileType: versionToRestore.fileType,
      fileSize: versionToRestore.fileSize,
      uploadedBy: req.user.id,
      changes: `Restored version ${version}`,
      uploadedAt: new Date()
    });
    
    // Update document with the restored version
    document.fileUrl = versionToRestore.fileUrl;
    document.fileType = versionToRestore.fileType;
    document.fileSize = versionToRestore.fileSize;
    document.updatedBy = req.user.id;
    document.updatedAt = new Date();
    
    await document.save();
    
    res.status(200).json({
      success: true,
      data: document
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Download document
 * @route   GET /api/v1/documents/:id/download
 * @access  Private
 */
exports.downloadDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findOne({
    _id: req.params.id,
    'access.user': req.user.id
  });
  
  if (!document) {
    return next(new ErrorResponse('Document not found or insufficient permissions', 404));
  }
  
  const filePath = path.join(__dirname, '..', document.fileUrl);
  
  if (!fs.existsSync(filePath)) {
    return next(new ErrorResponse('File not found', 404));
  }
  
  // Set headers for file download
  res.download(filePath, document.name, (err) => {
    if (err) {
      return next(new ErrorResponse('Error downloading file', 500));
    }
  });
});
