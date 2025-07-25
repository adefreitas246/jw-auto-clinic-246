const nodemailer = require('nodemailer');

/**
 * Send email using any SMTP
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {Object} [options.smtp] - Optional SMTP override
 */
const sendEmail = async ({ to, subject, html, smtp }) => {
  const transporter = nodemailer.createTransport({
    host: smtp?.host || process.env.SMTP_HOST,
    port: smtp?.port || parseInt(process.env.SMTP_PORT || '587'),
    secure: smtp?.secure ?? false,
    auth: {
      user: smtp?.user || process.env.SMTP_USER,
      pass: smtp?.pass || process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: smtp?.from || process.env.SMTP_FROM || '"JW Auto Clinic" <no-reply@jwautoclinic.com>',
      to,
      subject,
      html,
    });

    console.log(`📧 Email sent via ${transporter.options.host}:`, info.messageId);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email via ${transporter.options.host}:`, error);
    throw new Error('Email sending failed: ' + error.message);
  }
};

module.exports = sendEmail;
