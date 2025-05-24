const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const nodemailer = require('nodemailer');

// @desc    Get email settings
// @route   GET /api/v1/admin/settings/email
// @access  Private/Admin
exports.getEmailSettings = asyncHandler(async (req, res, next) => {
  // In a real app, you would get these from a database
  const emailSettings = {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    username: process.env.EMAIL_USERNAME || '',
    fromEmail: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Gideon\'s Tech Suite'
  };

  res.status(200).json({
    success: true,
    data: emailSettings
  });
});

// @desc    Update email settings
// @route   PUT /api/v1/admin/settings/email
// @access  Private/Admin
exports.updateEmailSettings = asyncHandler(async (req, res, next) => {
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

  // In a real app, you would save these to a database
  // For now, we'll just validate and return the settings
  const updatedSettings = {
    enabled: Boolean(enabled),
    host: host || '',
    port: parseInt(port) || 587,
    secure: Boolean(secure),
    username: username || '',
    fromEmail: fromEmail || '',
    fromName: fromName || 'Gideon\'s Tech Suite'
  };

  // In a real app, you would save these settings to a database
  // and update environment variables or a config file
  
  // For demonstration, we'll just return the updated settings
  res.status(200).json({
    success: true,
    data: updatedSettings,
    message: 'Email settings updated successfully. In a production environment, these would be saved to a database.'
  });
});

// @desc    Send test email
// @route   POST /api/v1/admin/settings/email/test
// @access  Private/Admin
exports.sendTestEmail = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new ErrorResponse('Email address is required', 400));
  }

  // In a real app, you would use the saved email settings
  const emailConfig = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  };

  // Create a test account if no email config is set up
  let testAccount;
  if (!emailConfig.host) {
    testAccount = await nodemailer.createTestAccount();
    emailConfig.host = 'smtp.ethereal.email';
    emailConfig.port = 587;
    emailConfig.secure = false;
    emailConfig.auth = {
      user: testAccount.user,
      pass: testAccount.pass
    };
  }

  try {
    const transporter = nodemailer.createTransport(emailConfig);

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Test'}" <${testAccount?.user || process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Test Email from Gideon\'s Tech Suite',
      text: 'This is a test email to verify your email settings are working correctly.',
      html: `
        <div>
          <h2>Test Email</h2>
          <p>This is a test email to verify your email settings are working correctly.</p>
          <p>If you received this email, your email configuration is working!</p>
          <hr />
          <p style="color: #666; font-size: 0.9em;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `
    });

    let response = {
      success: true,
      message: 'Test email sent successfully!',
      previewUrl: null
    };

    // If using ethereal email, include the preview URL
    (testAccount) {
      response.previewUrl = nodemailer.getTestMessageUrl(info);
      response.message += ' Check your ethereal email account for the test message.';
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error sending test email:', error);
    return next(new ErrorResponse('Failed to send test email', 500));
  }
});
