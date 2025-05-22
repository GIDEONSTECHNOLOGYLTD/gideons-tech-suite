const mongoose = require('mongoose');

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
  folder: {
    type: mongoose.Schema.ObjectId,
    ref: 'Folder',
    default: null
  },
  tags: [{
    type: String,
    trim: true
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

// Cascade delete documents when a folder is deleted
DocumentSchema.pre('remove', async function(next) {
  await this.model('Comment').deleteMany({ document: this._id });
  next();
});

module.exports = mongoose.model('Document', DocumentSchema);
