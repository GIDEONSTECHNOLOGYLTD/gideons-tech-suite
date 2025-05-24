const nodemailer = require('nodemailer');
const EmailSettings = require('../models/EmailSettings');

/**
 * Get a nodemailer transporter with the current email settings
 * @returns {Promise<Object>} Configured nodemailer transporter
 * @throws {Error} If email settings are not configured or invalid
 */
const getTransporter = async () => {
  try {
    const settings = await EmailSettings.findOne().sort({ updatedAt: -1 }).lean();
    if (!settings) {
      throw new Error('Email settings not configured');
    }

    if (!settings.enabled) {
      throw new Error('Email service is not enabled');
    }

    // Validate required settings
    const requiredFields = ['host', 'port', 'username', 'password', 'fromEmail'];
    const missingFields = requiredFields.filter(field => !settings[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required email settings: ${missingFields.join(', ')}`);
    }

    // Create transporter with TLS options
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.username,
        pass: settings.password
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      },
      // Better timeout defaults
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      // Enable debug logging in development
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });

    // Verify connection configuration
    await transporter.verify();
    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw new Error(`Failed to initialize email service: ${error.message}`);
  }
};

/**
 * Send an email using the configured email settings
 * @param {Object} options - Email options
 * @param {string|Array<string>} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text version of the email
 * @param {string} [options.html] - HTML version of the email
 * @param {Object} [options.attachments] - Email attachments
 * @returns {Promise<Object>} Result of the email sending operation
 */
const sendEmail = async ({ to, subject, text, html, attachments }) => {
  if (!to) {
    throw new Error('Recipient email address is required');
  }

  if (!subject) {
    throw new Error('Email subject is required');
  }

  if (!text && !html) {
    throw new Error('Either text or html content is required');
  }

  try {
    const settings = await EmailSettings.findOne().sort({ updatedAt: -1 });
    if (!settings) {
      throw new Error('Email settings not found');
    }

    if (!settings.enabled) {
      throw new Error('Email service is not enabled');
    }

    const transporter = await getTransporter();
    
    const mailOptions = {
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      text: text,
      html: html || text,
      attachments: attachments || [],
      // Add headers for tracking
      headers: {
        'X-GTS-Email-Type': 'system-email',
        'X-GTS-Env': process.env.NODE_ENV || 'development'
      }
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    
    // Log successful email sending
    console.log(`Email sent to ${to} with message ID: ${info.messageId}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    };
  } catch (error) {
    console.error('Error sending email:', {
      to,
      subject,
      error: error.message,
      stack: error.stack
    });
    
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
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = sendEmail;
