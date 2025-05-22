const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    lowercase: true,
    trim: true
  },
  avatar: {
    type: String,
    default: 'uploads/default-avatar.png'
  },
  role: {
    type: String,
    enum: ['user', 'manager', 'admin'],
    default: 'user'
  },
  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department cannot be more than 50 characters']
  },
  position: {
    type: String,
    trim: true,
    maxlength: [100, 'Position cannot be more than 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot be longer than 20 characters']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  
  // Update the updatedAt timestamp
  this.updatedAt = Date.now();
});

// Update the updatedAt timestamp when other fields are modified
UserSchema.pre('save', function(next) {
  if (this.isModified() && !this.isModified('password')) {
    this.updatedAt = Date.now();
  }
  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login timestamp
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = Date.now();
  await this.save({ validateBeforeSave: false });
};

// Virtual for getting user's full name
UserSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for getting user's initials
UserSchema.virtual('initials').get(function() {
  return this.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
});

// Virtual for getting user's projects
UserSchema.virtual('projects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'team',
  justOne: false
});

// Virtual for getting user's assigned tasks
UserSchema.virtual('assignedTasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'assignedTo',
  justOne: false
});

// Virtual for getting user's created tasks
UserSchema.virtual('createdTasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'createdBy',
  justOne: false
});

// Cascade delete user's tasks and remove user from projects when user is deleted
UserSchema.pre('remove', async function(next) {
  await this.model('Task').deleteMany({ createdBy: this._id });
  await this.model('Project').updateMany(
    { team: this._id },
    { $pull: { team: this._id } }
  );
  next();
});

// Static method to check if email is taken
UserSchema.statics.isEmailTaken = async function(email, excludeUserId) {
  const user = await this.findOne({ 
    email, 
    _id: { $ne: excludeUserId } 
  });
  return !!user;
};

// Add text index for search
UserSchema.index({ name: 'text', email: 'text' });

module.exports = mongoose.model('User', UserSchema);
