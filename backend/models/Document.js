const mongoose = require('mongoose');

// Version Schema for document versioning
const VersionSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changes: {
    type: String,
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Tag Schema for document tagging
const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a tag name'],
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters'],
    lowercase: true
  },
  color: {
    type: String,
    default: '#3f51b5',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please add a valid hex color']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Export Tag model
const Tag = mongoose.model('Tag', TagSchema);

// Document Schema
const DocumentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [200, 'Name can not be more than 200 characters']
  },
  description: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  access: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'manage'],
      default: 'view'
    },
    grantedAt: {
      type: Date,
      default: Date.now
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  versions: [VersionSchema],
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add text index for search
DocumentSchema.index(
  { 
    name: 'text', 
    description: 'text',
    'metadata.content': 'text' 
  },
  { 
    name: 'document_search_index',
    weights: { 
      name: 10, 
      description: 3,
      'metadata.content': 2
    },
    default_language: 'english',
    language_override: 'search_language'
  }
);

/**
 * Search documents with advanced filters
 * @param {Object} options - Search options
 * @param {String} options.query - Search query string
 * @param {String} options.userId - Current user ID
 * @param {Array} options.tags - Filter by tag IDs
 * @param {String} options.folder - Filter by folder ID
 * @param {String} options.project - Filter by project ID
 * @param {String} options.fileType - Filter by file type
 * @param {String} options.sortBy - Sort field
 * @param {Number} options.limit - Number of results to return
 * @param {Number} options.page - Page number
 * @returns {Promise<Object>} Search results with pagination
 */
DocumentSchema.statics.search = async function({
  query,
  userId,
  tags,
  folder,
  project,
  fileType,
  sortBy = '-updatedAt',
  limit = 10,
  page = 1
}) {
  const skip = (page - 1) * limit;
  
  // Build the base query
  const conditions = [
    { 'access.user': userId }
  ];

  // Add text search if query exists
  if (query) {
    conditions.push({
      $text: { $search: query }
    });
  }

  // Add tag filter if provided
  if (tags && tags.length > 0) {
    conditions.push({
      tags: { $all: tags }
    });
  }
  // Add folder filter if provided
  if (folder) {
    conditions.push({ folder });
  }
  // Add project filter if provided
  if (project) {
    conditions.push({ project });
  }
  // Add file type filter if provided
  if (fileType) {
    conditions.push({
      fileType: new RegExp(fileType, 'i')
    });
  }

  // Combine all conditions with $and
  const queryConditions = conditions.length > 0 ? { $and: conditions } : {};

  // Execute the query with pagination
  const [documents, total] = await Promise.all([
    this.find(queryConditions)
      .populate('tags', 'name color')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(limit),
    this.countDocuments(queryConditions)
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    documents,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      hasNextPage,
      hasPreviousPage,
      limit
    }
  };
};

// Create a compound index for tag-based queries
DocumentSchema.index({ 'access.user': 1, tags: 1 });
DocumentSchema.index({ 'access.user': 1, folder: 1 });
DocumentSchema.index({ 'access.user': 1, project: 1 });
DocumentSchema.index({ 'access.user': 1, fileType: 1 });

// Cascade delete versions when a document is deleted
DocumentSchema.pre('remove', async function(next) {
  // Here you would typically delete the actual files from storage
  // For example, using a file storage service or the filesystem
  console.log(`Document ${this._id} is being removed`);
  next();
});

// Create the model from the schema
const Document = mongoose.model('Document', DocumentSchema);

module.exports = { Document, Tag };
