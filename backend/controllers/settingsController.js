const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const EmailSettings = require('../models/EmailSettings');
const sendEmail = require('../utils/sendEmail');

/**
 * @desc    Get current email settings
 * @route   GET /api/v1/admin/settings/email
 * @access  Private/Admin
 */
exports.getEmailSettings = asyncHandler(async (req, res, next) => {
  try {
    const settings = await EmailSettings.findOne().sort({ updatedAt: -1 }).lean();
    
    if (!settings) {
      // Return default settings if none exist
      const defaultSettings = new EmailSettings();
      return res.status(200).json({ 
        success: true, 
        data: defaultSettings.toObject({ virtuals: true }) 
      });
    }
    
    // The password is already excluded by the schema's toJSON transform
    res.status(200).json({ 
      success: true, 
      data: settings 
    });
  } catch (error) {
    console.error('Error fetching email settings:', error);
    next(new ErrorResponse('Failed to retrieve email settings', 500));
  }
});

/**
 * @desc    Update email settings
 * @route   PUT /api/v1/admin/settings/email
 * @access  Private/Admin
 */
exports.updateEmailSettings = asyncHandler(async (req, res, next) => {
  try {
    const { 
      enabled, 
      host, 
      port, 
      secure, 
      username, 
      password, 
      fromEmail, 
      fromName 
    } = req.body;

    // Find the most recent settings or create new ones
    let settings = await EmailSettings.findOne().sort({ updatedAt: -1 });
    
    if (!settings) {
      settings = new EmailSettings();
    }
    
    // Update fields if they are provided in the request
    if (enabled !== undefined) settings.enabled = enabled;
    if (host) settings.host = host;
    if (port) settings.port = port;
    if (secure !== undefined) settings.secure = secure;
    if (username) settings.username = username;
    if (password) settings.password = password;
    if (fromEmail) settings.fromEmail = fromEmail;
    if (fromName) settings.fromName = fromName;
    
    // If enabling email, validate the settings
    if (settings.enabled) {
      const requiredFields = ['host', 'port', 'username', 'password', 'fromEmail'];
      const missingFields = requiredFields.filter(field => !settings[field]);
      
      if (missingFields.length > 0) {
        return next(new ErrorResponse(
          `Missing required fields when enabling email: ${missingFields.join(', ')}`,
          400
        ));
      }
      
      // Test the connection if this is a new configuration
      if (settings.isModified('host') || settings.isModified('port') || 
          settings.isModified('username') || settings.isModified('password')) {
        try {
          await settings.testConnection();
        } catch (error) {
          return next(new ErrorResponse(
            `Failed to verify email settings: ${error.message}`,
            400
          ));
        }
      }
    }
    
    await settings.save();
    
    // Convert to object to apply schema transformations
    const settingsObj = settings.toObject({ virtuals: true });
    
    res.status(200).json({
      success: true,
      data: settingsObj,
      message: 'Email settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating email settings:', error);
    next(new ErrorResponse('Failed to update email settings', 500));
  }
});

/**
 * @desc    Send a test email
 * @route   POST /api/v1/admin/settings/email/test
 * @access  Private/Admin
 */
exports.sendTestEmail = asyncHandler(async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new ErrorResponse('Email address is required', 400));
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new ErrorResponse('Please provide a valid email address', 400));
    }
    
    // Get current settings
    const settings = await EmailSettings.findOne().sort({ updatedAt: -1 });
    if (!settings || !settings.enabled) {
      return next(new ErrorResponse('Email service is not enabled or configured', 400));
    }
    
    // Send test email
    const result = await sendEmail({
      to: email,
      subject: 'Test Email from Gideon\'s Tech Suite',
      text: 'This is a test email to verify your email settings are working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email from Gideon's Tech Suite</h2>
          <p>This is a test email to verify that your email settings are working correctly.</p>
          <p>If you're receiving this email, it means the email settings have been configured properly.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `
    });
    
    // Update last tested timestamp
    settings.lastTested = new Date();
    settings.lastError = null;
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    
    // Update last error in settings
    try {
      const settings = await EmailSettings.findOne().sort({ updatedAt: -1 });
      if (settings) {
        settings.lastError = error.message;
        await settings.save();
      }
    } catch (updateError) {
      console.error('Failed to update email settings with error:', updateError);
    }
    
    next(new ErrorResponse(
      `Failed to send test email: ${error.message}`,
      500
    ));
  }
});

/**
 * @desc    Test email connection
 * @route   POST /api/v1/admin/settings/email/test-connection
 * @access  Private/Admin
 */
exports.testEmailConnection = asyncHandler(async (req, res, next) => {
  try {
    const settings = await EmailSettings.findOne().sort({ updatedAt: -1 });
    
    if (!settings) {
      return next(new ErrorResponse('Email settings not found', 404));
    }
    
    const result = await settings.testConnection();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email connection test successful',
        data: {
          lastTested: settings.lastTested
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Email connection test failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing email connection:', error);
    next(new ErrorResponse('Failed to test email connection', 500));
  }
});
