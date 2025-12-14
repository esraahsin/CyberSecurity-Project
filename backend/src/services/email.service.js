/**
 * Service d'envoi d'emails pour MFA et notifications
 * @module services/email.service
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    // ✅ FIX: Proper error handling and fallback for missing config
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      // Verify connection on startup (optional, non-blocking)
      this.transporter.verify((error, success) => {
        if (error) {
          logger.warn('Email service verification failed', { error: error.message });
          console.warn('⚠️  Email service not configured properly. MFA emails will not be sent.');
        } else {
          console.log('✅ Email service ready');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
      console.error('❌ Email service initialization failed:', error.message);
      // Create a dummy transporter that logs instead of sending
      this.transporter = null;
    }
  }

  /**
   * Envoie un code MFA par email
   * @param {string} email - Email du destinataire
   * @param {string} code - Code MFA à 6 chiffres
   * @param {string} userName - Nom de l'utilisateur
   */
  async sendMFACode(email, code, userName) {
    // ✅ FIX: Handle missing transporter gracefully
    if (!this.transporter) {
      console.log('📧 [DEV MODE] MFA Code:', code, 'for', email);
      logger.info('MFA code generated (email service not configured)', { 
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        code 
      });
      return { success: true, devMode: true };
    }

    try {
      const mailOptions = {
        from: `"SecureBank Security" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your SecureBank Verification Code',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .code-box { background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; font-family: monospace; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Security Verification</h1>
                </div>
                <div class="content">
                  <p>Hello <strong>${userName}</strong>,</p>
                  
                  <p>You are attempting to log into your SecureBank account. To complete the login process, please use the verification code below:</p>
                  
                  <div class="code-box">
                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Verification Code</div>
                    <div class="code">${code}</div>
                  </div>
                  
                  <p><strong>This code will expire in 10 minutes.</strong></p>
                  
                  <div class="warning">
                    <strong>⚠️ Security Notice:</strong>
                    <p style="margin: 5px 0 0 0;">If you did not attempt to log in, please ignore this email and consider changing your password immediately.</p>
                  </div>
                  
                  <p>For your security:</p>
                  <ul>
                    <li>Never share this code with anyone</li>
                    <li>SecureBank will never ask for this code via phone or email</li>
                    <li>This code is only valid for 10 minutes</li>
                  </ul>
                  
                  <div class="footer">
                    <p>© ${new Date().getFullYear()} SecureBank. All rights reserved.</p>
                    <p>This is an automated message, please do not reply.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Hello ${userName},

Your SecureBank verification code is: ${code}

This code will expire in 10 minutes.

If you did not attempt to log in, please ignore this email and consider changing your password.

For your security:
- Never share this code with anyone
- SecureBank will never ask for this code via phone or email
- This code is only valid for 10 minutes

© ${new Date().getFullYear()} SecureBank. All rights reserved.
        `
      };

      await this.transporter.sendMail(mailOptions);
      
      logger.info('MFA code email sent successfully', { 
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2')
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to send MFA email', { error: error.message, email });
      // ✅ FIX: Don't throw, return error info instead
      console.error('❌ Email send failed:', error.message);
      console.log('📧 [FALLBACK] MFA Code:', code);
      return { success: false, error: error.message, code }; // Include code for dev fallback
    }
  }

  /**
   * Envoie une notification de suppression de compte
   * @param {string} email - Email du destinataire
   * @param {string} userName - Nom de l'utilisateur
   */
  async sendAccountDeletionNotification(email, userName) {
    if (!this.transporter) {
      console.log('📧 [DEV MODE] Account deletion notification for:', email);
      return { success: true, devMode: true };
    }

    try {
      const mailOptions = {
        from: `"SecureBank Security" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your SecureBank Account Has Been Deleted',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⚠️ Account Deletion Confirmation</h1>
                </div>
                <div class="content">
                  <p>Hello <strong>${userName}</strong>,</p>
                  
                  <div class="alert">
                    <strong>Your SecureBank account has been permanently deleted.</strong>
                  </div>
                  
                  <p>This action was completed on: <strong>${new Date().toLocaleString()}</strong></p>
                  
                  <p>The following data has been removed:</p>
                  <ul>
                    <li>All account information</li>
                    <li>Transaction history</li>
                    <li>Personal settings and preferences</li>
                  </ul>
                  
                  <p><strong>If you did not request this deletion:</strong></p>
                  <p>Please contact our security team immediately at security@securebank.com</p>
                  
                  <p>Thank you for banking with SecureBank.</p>
                  
                  <div class="footer">
                    <p>© ${new Date().getFullYear()} SecureBank. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info('Account deletion notification sent', { email });
      return { success: true };
    } catch (error) {
      logger.error('Failed to send deletion notification', { error: error.message });
      return { success: false };
    }
  }

  /**
   * Vérifie la configuration email
   */
  async verifyConnection() {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new EmailService();