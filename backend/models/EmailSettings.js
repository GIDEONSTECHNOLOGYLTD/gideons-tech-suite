const mongoose = require('mongoose');

const emailSettingsSchema = new mongoose.Schema({
  enabled: { 
    type: Boolean, 
    default: false,
    required: true
  },
  host: {
    type: String,
    trim: true,
    required: [true, 'SMTP host is required when email is enabled'],
    validate: {
      validator: function(v) {
        return !this.enabled || (v && v.length > 0);
      },
      message: 'SMTP host is required when email is enabled'
    }
  },
  port: { 
    type: Number, 
    default: 587,
    min: [1, 'Port must be a positive number'],
    max: [65535, 'Port number too large']
  },
  secure: { 
    type: Boolean, 
    default: false 
  },
  username: {
    type: String,
    trim: true,
    required: [
      function() { return this.enabled; },
      'Username is required when email is enabled'
    ]
  },
  password: {
    type: String,
    required: [
      function() { return this.enabled; },
      'Password is required when email is enabled'
    ],
    select: false
  },
  fromEmail: {
    type: String,
    trim: true,
    lowercase: true,
    required: [
      function() { return this.enabled; },
      'From email is required when email is enabled'
    ],
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  fromName: { 
    type: String, 
    trim: true,
    default: "Gideon's Tech Suite" 
  },
  lastTested: {
    type: Date,
    default: null
  },
  lastError: {
    type: String,
    default: null
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.lastError;
      return ret;
    }
  }
});

/**
 * Get the latest email settings
 * @returns {Promise<Object>} The email settings
 */
emailSettingsSchema.statics.getSettings = async function() {
  try {
    let settings = await this.findOne().sort({ updatedAt: -1 });
    if (!settings) {
      settings = await this.create({});
    }
    return settings;
  } catch (error) {
    console.error('Error getting email settings:', error);
    throw new Error('Failed to retrieve email settings');
  }
};

/**
 * Test the current email settings
 * @returns {Promise<{success: boolean, error?: string}>} Test result
 */
emailSettingsSchema.methods.testConnection = async function() {
  try {
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.username,
        pass: this.password
      },
      // Don't fail on invalid TLS certificates
      tls: {
        rejectUnauthorized: false
      }
    });
    
    await transporter.verify();
    this.lastTested = new Date();
    this.lastError = null;
    await this.save();
    return { success: true };
  } catch (error) {
    this.lastError = error.message;
    await this.save();
    return { 
      success: false, 
      error: error.message 
    };
  }
};

module.exports = mongoose.model('EmailSettings', emailSettingsSchema);
