const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initializeTransporter();
    this.loadTemplates();
  }

  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      // Fallback to mock transporter for development
      this.transporter = {
        sendMail: async (options) => {
          console.log('📧 Mock email sent:', {
            to: options.to,
            subject: options.subject,
            text: options.text?.substring(0, 100) + '...'
          });
          return { messageId: 'mock-' + Date.now() };
        }
      };
    }
  }

  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/email');
      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.html')) {
          const templateName = path.basename(file, '.html');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          this.templates[templateName] = templateContent;
        }
      }
      console.log(`📧 Loaded ${Object.keys(this.templates).length} email templates`);
    } catch (error) {
      console.log('📧 No email templates found, using default templates');
      this.loadDefaultTemplates();
    }
  }

  loadDefaultTemplates() {
    this.templates = {
      welcome: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hoş Geldiniz!</h2>
          <p>Merhaba {{username}},</p>
          <p>Hesabınız başarıyla oluşturuldu. Artık AI görsel üretim platformumuzu kullanmaya başlayabilirsiniz.</p>
          <p>Başlamak için <a href="{{loginUrl}}">giriş yapın</a>.</p>
          <p>Teşekkürler,<br>AI Platform Ekibi</p>
        </div>
      `,
      passwordReset: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Şifre Sıfırlama</h2>
          <p>Merhaba {{username}},</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
          <p><a href="{{resetUrl}}">Şifremi Sıfırla</a></p>
          <p>Bu link 1 saat geçerlidir.</p>
          <p>Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
          <p>Teşekkürler,<br>AI Platform Ekibi</p>
        </div>
      `,
      paymentSuccess: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ödeme Başarılı!</h2>
          <p>Merhaba {{username}},</p>
          <p>{{packageName}} paketini başarıyla satın aldınız.</p>
          <p><strong>Detaylar:</strong></p>
          <ul>
            <li>Paket: {{packageName}}</li>
            <li>Token: {{tokens}}</li>
            <li>Tutar: {{amount}} {{currency}}</li>
            <li>Tarih: {{date}}</li>
          </ul>
          <p>Tokenlarınız hesabınıza eklendi.</p>
          <p>Teşekkürler,<br>AI Platform Ekibi</p>
        </div>
      `,
      lowTokens: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Token Uyarısı</h2>
          <p>Merhaba {{username}},</p>
          <p>Token bakiyeniz düşük: <strong>{{remainingTokens}} token</strong></p>
          <p>Kesintisiz hizmet için <a href="{{buyTokensUrl}}">yeni token paketi satın alın</a>.</p>
          <p>Teşekkürler,<br>AI Platform Ekibi</p>
        </div>
      `,
      securityAlert: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Güvenlik Uyarısı</h2>
          <p>Merhaba {{username}},</p>
          <p>Hesabınızda şüpheli aktivite tespit edildi:</p>
          <p><strong>{{activity}}</strong></p>
          <p>Tarih: {{date}}</p>
          <p>IP: {{ipAddress}}</p>
          <p>Eğer bu siz değilseniz, lütfen <a href="{{securityUrl}}">güvenlik ayarlarınızı kontrol edin</a>.</p>
          <p>Teşekkürler,<br>AI Platform Ekibi</p>
        </div>
      `
    };
  }

  async renderTemplate(templateName, data) {
    let template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Replace placeholders with data
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(placeholder, value);
    }

    return template;
  }

  async sendEmail(options) {
    try {
      const {
        to,
        subject,
        template,
        templateData = {},
        html,
        text,
        attachments = [],
        priority = 'normal'
      } = options;

      let emailHtml = html;
      let emailText = text;

      // Use template if provided
      if (template) {
        emailHtml = await this.renderTemplate(template, templateData);
        emailText = this.htmlToText(emailHtml);
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html: emailHtml,
        text: emailText,
        attachments,
        priority: this.getPriority(priority)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent successfully to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  getPriority(priority) {
    const priorities = {
      low: '5',
      normal: '3',
      high: '1',
      urgent: '1'
    };
    return priorities[priority] || '3';
  }

  // Convenience methods for common emails
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Hoş Geldiniz - AI Platform',
      template: 'welcome',
      templateData: {
        username: user.username,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    return this.sendEmail({
      to: user.email,
      subject: 'Şifre Sıfırlama - AI Platform',
      template: 'passwordReset',
      templateData: {
        username: user.username,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });
  }

  async sendPaymentSuccessEmail(user, payment, packageData) {
    return this.sendEmail({
      to: user.email,
      subject: 'Ödeme Başarılı - AI Platform',
      template: 'paymentSuccess',
      templateData: {
        username: user.username,
        packageName: packageData.name,
        tokens: packageData.tokens,
        amount: payment.amount,
        currency: payment.currency,
        date: new Date().toLocaleDateString('tr-TR')
      }
    });
  }

  async sendLowTokensEmail(user, remainingTokens) {
    return this.sendEmail({
      to: user.email,
      subject: 'Token Uyarısı - AI Platform',
      template: 'lowTokens',
      templateData: {
        username: user.username,
        remainingTokens,
        buyTokensUrl: `${process.env.FRONTEND_URL}/buy-tokens`
      }
    });
  }

  async sendSecurityAlertEmail(user, activity, ipAddress) {
    return this.sendEmail({
      to: user.email,
      subject: 'Güvenlik Uyarısı - AI Platform',
      template: 'securityAlert',
      templateData: {
        username: user.username,
        activity,
        date: new Date().toLocaleDateString('tr-TR'),
        ipAddress,
        securityUrl: `${process.env.FRONTEND_URL}/profile/security`
      }
    });
  }
}

module.exports = new EmailService(); 