const Folder = require('../models/Folder');
const Document = require('../models/Document');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Create a folder
// @route   POST /api/v1/folders
// @access  Private
exports.createFolder = asyncHandler(async (req, res, next) => {
  const { name, parent, project } = req.body;

  // Check if parent folder exists if provided
  if (parent) {
    const parentFolder = await Folder.findById(parent);
    if (!parentFolder) {
      return next(new ErrorResponse(`Parent folder not found with id of ${parent}`, 404));
    }
  }

  // Check if folder with same name already exists in the same parent and project
  const existingFolder = await Folder.findOne({
    name,
    parent: parent || null,
    project: project || null
  });

  if (existingFolder) {
    return next(
      new ErrorResponse(`A folder with the name '${name}' already exists in this location`, 400)
    );
  }

  const folder = await Folder.create({
    name,
    parent: parent || null,
    project: project || null,
    createdBy: req.user.id,
    access: [{
      user: req.user.id,
      permission: 'manage'
    }]
  });

  res.status(201).json({
    success: true,
    data: folder
  });
});

// @desc    Get all folders
// @route   GET /api/v1/folders
// @access  Private
exports.getFolders = asyncHandler(async (req, res, next) => {
  // Check for project filter
  if (req.params.projectId) {
    const folders = await Folder.find({ 
      project: req.params.projectId,
      $or: [
        { createdBy: req.user.id },
        { 'access.user': req.user.id }
      ]
    })
    .populate('createdBy', 'name email')
    .populate('parent', 'name')
    .sort('name');

    return res.status(200).json({
      success: true,
      count: folders.length,
      data: folders
    });
  }

  // If no project specified, get all folders user has access to
  const folders = await Folder.find({
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  })
  .populate('createdBy', 'name email')
  .populate('parent', 'name')
  .populate('project', 'name')
  .sort('name');

  res.status(200).json({
    success: true,
    count: folders.length,
    data: folders
  });
});

// @desc    Get folder tree
// @route   GET /api/v1/folders/tree
// @access  Private
exports.getFolderTree = asyncHandler(async (req, res, next) => {
  const { projectId } = req.query;
  
  const query = {
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  };

  if (projectId) {
    query.project = projectId;
  } else {
    query.project = { $exists: false };
  }

  const folders = await Folder.find(query)
    .select('name parent project')
    .lean();

  // Build tree structure
  const buildTree = (parentId = null) => {
    return folders
      .filter(folder => 
        (folder.parent ? folder.parent.toString() : null) === (parentId ? parentId.toString() : null)
      )
      .map(folder => ({
        ...folder,
        children: buildTree(folder._id)
      }));
  };

  const tree = buildTree();

  res.status(200).json({
    success: true,
    data: tree
  });
});

// @desc    Get single folder
// @route   GET /api/v1/folders/:id
// @access  Private
exports.getFolder = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('parent', 'name')
    .populate('project', 'name');

  if (!folder) {
    return next(
      new ErrorResponse(`Folder not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this folder
  const hasAccess = folder.createdBy._id.toString() === req.user.id || 
                   folder.access.some(a => a.user.toString() === req.user.id);
  
  if (!hasAccess) {
    return next(
      new ErrorResponse(`Not authorized to access this folder`, 401)
    );
  }

  // Get subfolders
  const subfolders = await Folder.find({ parent: folder._id })
    .select('name')
    .sort('name');

  // Get documents in this folder
  const documents = await Document.find({ 
    folder: folder._id,
    $or: [
      { createdBy: req.user.id },
      { 'access.user': req.user.id }
    ]
  })
  .select('name fileType fileSize createdAt')
  .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: {
      ...folder.toObject(),
      subfolders,
      documents
    }
  });
});

// @desc    Update folder
// @route   PUT /api/v1/folders/:id
// @access  Private
exports.updateFolder = asyncHandler(async (req, res, next) => {
  let folder = await Folder.findById(req.params.id);

  if (!folder) {
    return next(
      new ErrorResponse(`Folder not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is folder owner or has manage access
  const userAccess = folder.access.find(a => a.user.toString() === req.user.id);
  if (folder.createdBy.toString() !== req.user.id && 
      (!userAccess || userAccess.permission !== 'manage')) {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update this folder`, 401)
    );
  }

  // Prevent moving folder to its own subfolder
  if (req.body.parent) {
    if (req.body.parent === req.params.id) {
      return next(
        new ErrorResponse('Cannot move folder into itself', 400)
      );
    }

    // Check for circular references
    let currentParent = req.body.parent;
    while (currentParent) {
      if (currentParent === req.params.id) {
        return next(
          new ErrorResponse('Cannot create circular folder reference', 400)
        );
      }
      const parentFolder = await Folder.findById(currentParent);
      currentParent = parentFolder ? parentFolder.parent : null;
    }
  }

  // Update folder
  folder = await Folder.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: folder
  });
});

// @desc    Delete folder
// @route   DELETE /api/v1/folders/:id
// @access  Private
exports.deleteFolder = asyncHandler(async (req, res, next) => {
  const folder = await Folder.findById(req.params.id);

  if (!folder) {
    return next(
      new ErrorResponse(`Folder not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is folder owner or has manage access
  const userAccess = folder.access.find(a => a.user.toString() === req.user.id);
  if (folder.createdBy.toString() !== req.user.id && 
      (!userAccess || userAccess.permission !== 'manage')) {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to delete this folder`, 401)
    );
  }

  // Check if folder is empty
  const subfolderCount = await Folder.countDocuments({ parent: folder._id });
  const documentCount = await Document.countDocuments({ folder: folder._id });

  if (subfolderCount > 0 || documentCount > 0) {
    return next(
      new ErrorResponse('Cannot delete folder that is not empty', 400)
    );
  }

  await folder.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Update folder access
// @route   PUT /api/v1/folders/:id/access
// @access  Private
exports.updateFolderAccess = asyncHandler(async (req, res, next) => {
  const { userId, permission } = req.body;

  const folder = await Folder.findById(req.params.id);

  if (!folder) {
    return next(
      new ErrorResponse(`Folder not found with id of ${req.params.id}`, 404)
    );
  }

  // Only folder owner can update access
  if (folder.createdBy.toString() !== req.user.id) {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update access for this folder`, 401)
    );
  }

  // Can't remove your own access
  if (userId === req.user.id) {
    return next(
      new ErrorResponse('Cannot remove your own access to the folder', 400)
    );
  }

  // Find existing access for this user
  const accessIndex = folder.access.findIndex(a => a.user.toString() === userId);

  if (permission) {
    // Update or add access
    const accessEntry = {
      user: userId,
      permission
    };

    if (accessIndex >= 0) {
      folder.access[accessIndex] = accessEntry;
    } else {
      folder.access.push(accessEntry);
    }
  } else if (accessIndex >= 0) {
    // Remove access if permission is not provided
    folder.access.splice(accessIndex, 1);
  }

  await folder.save();

  res.status(200).json({
    success: true,
    data: folder
  });
});
