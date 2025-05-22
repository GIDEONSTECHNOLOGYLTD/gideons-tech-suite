const mongoose = require('mongoose');

const VersionSchema = new mongoose.Schema({
  versionNumber: {
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
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  changes: {
    type: String,
    trim: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  color: {
    type: String,
    default: '#808080'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const DocumentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a document name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  currentVersion: {
    type: Number,
    default: 1
  },
  versions: [VersionSchema],
  folder: {
    type: mongoose.Schema.ObjectId,
    ref: 'Folder',
    default: null
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  project: {
    type: mongoose.Schema.ObjectId,
    ref: 'Project',
    default: null
  },
  access: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'manage'],
      default: 'view'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add text index for search
DocumentSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text' 
});

// Add index for faster version lookups
DocumentSchema.index({ 'versions.versionNumber': 1 });
DocumentSchema.index({ 'versions.isCurrent': 1 });

// Middleware to handle versioning
DocumentSchema.pre('save', async function(next) {
  if (this.isNew) {
    // For new documents, create the first version
    this.versions.push({
      versionNumber: 1,
      fileUrl: this.fileUrl,
      fileType: this.fileType,
      fileSize: this.fileSize,
      uploadedBy: this.createdBy,
      changes: 'Initial version',
      isCurrent: true
    });
  } else if (this.isModified('fileUrl') || this.isModified('fileType') || this.isModified('fileSize')) {
    // When file is updated, create a new version
    const newVersion = {
      versionNumber: this.currentVersion + 1,
      fileUrl: this.fileUrl,
      fileType: this.fileType,
      fileSize: this.fileSize,
      uploadedBy: this.updatedBy || this.createdBy,
      isCurrent: true
    };
    
    // Mark all other versions as not current
    this.versions.forEach(version => {
      version.isCurrent = false;
    });
    
    this.versions.push(newVersion);
    this.currentVersion = newVersion.versionNumber;
  }
  next();
});

// Cascade delete documents when a folder is deleted
DocumentSchema.pre('remove', async function(next) {
  await this.model('Comment').deleteMany({ document: this._id });
  next();
});

// Create Tag model
const Tag = mongoose.model('Tag', TagSchema);

// Create Document model
const Document = mongoose.model('Document', DocumentSchema);

module.exports = { Document, Tag };
