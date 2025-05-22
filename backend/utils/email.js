const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');
const path = require('path');

class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name ? user.name.split(' ')[0] : 'User';
    this.url = url;
    this.from = `Gideon's Tech Suite <${process.env.EMAIL_FROM || 'noreply@gideonstechsuite.com'}>`;
  }

  // Create a transporter
  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Use SendGrid for production
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
    }

    // Use Mailtrap for development
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(
      path.join(__dirname, `../views/emails/${template}.pug`),
      {
        firstName: this.firstName,
        url: this.url,
        subject
      }
    );

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html)
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  // Send welcome email
  async sendWelcome() {
    await this.send('welcome', 'Welcome to Gideon\'s Tech Suite!');
  }

  // Send password reset token
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for 10 minutes)'
    );
  }

  // Send email verification
  async sendVerification() {
    await this.send(
      'verifyEmail',
      'Verify your email address (valid for 24 hours)'
    );
  }

  // Send notification
  async sendNotification(subject, message) {
    await this.send('notification', subject, { message });
  }
}

module.exports = Email;
