const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a folder name'],
    trim: true
  },
  parent: {
    type: mongoose.Schema.ObjectId,
    ref: 'Folder',
    default: null
  },
  project: {
    type: mongoose.Schema.ObjectId,
    ref: 'Project',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
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

// Prevent duplicate folder names in the same parent
FolderSchema.index({ name: 1, parent: 1, project: 1 }, { unique: true });

// Cascade delete subfolders and documents when a folder is deleted
FolderSchema.pre('remove', async function(next) {
  // Delete all subfolders
  await this.model('Folder').deleteMany({ parent: this._id });
  // Delete all documents in this folder
  await this.model('Document').deleteMany({ folder: this._id });
  next();
});

module.exports = mongoose.model('Folder', FolderSchema);
