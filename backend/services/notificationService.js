const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('./emailService');
const pushNotificationService = require('./pushNotificationService');

class NotificationService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  // Create and send notification
  async sendNotification(options) {
    try {
      const {
        userId,
        type = 'in_app',
        category = 'system',
        title,
        message,
        data = {},
        priority = 'normal',
        scheduledFor = null,
        sendEmail = false,
        sendPush = false,
        emailTemplate = null,
        emailData = {}
      } = options;

      // Create notification record
      const notification = new Notification({
        user: userId,
        type,
        category,
        title,
        message,
        data,
        priority,
        scheduledFor,
        metadata: {
          emailTemplate,
          batchId: data.batchId
        }
      });

      await notification.save();

      // Send immediately if not scheduled
      if (!scheduledFor || scheduledFor <= new Date()) {
        await this.deliverNotification(notification, {
          sendEmail,
          sendPush,
          emailTemplate,
          emailData
        });
      }

      return notification;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      throw error;
    }
  }

  // Deliver notification through different channels
  async deliverNotification(notification, options = {}) {
    const { sendEmail, sendPush, emailTemplate, emailData } = options;
    const promises = [];

    try {
      // Get user data
      const user = await User.findById(notification.user);
      if (!user) {
        throw new Error('User not found');
      }

      // Send email notification
      if (sendEmail && user.emailPreferences?.email) {
        promises.push(
          this.sendEmailNotification(user, notification, emailTemplate, emailData)
        );
      }

      // Send push notification
      if (sendPush && user.pushTokens?.length > 0) {
        promises.push(
          this.sendPushNotification(user, notification)
        );
      }

      // Wait for all deliveries to complete
      const results = await Promise.allSettled(promises);
      
      // Update notification status
      const hasSuccess = results.some(result => result.status === 'fulfilled');
      if (hasSuccess) {
        notification.status = 'sent';
        notification.sentAt = new Date();
      } else {
        notification.status = 'failed';
        await notification.incrementAttempts();
      }

      await notification.save();
      return results;
    } catch (error) {
      console.error('❌ Failed to deliver notification:', error);
      notification.status = 'failed';
      await notification.incrementAttempts();
      await notification.save();
      throw error;
    }
  }

  // Send email notification
  async sendEmailNotification(user, notification, template, templateData) {
    try {
      const emailOptions = {
        to: user.email,
        subject: notification.title,
        template: template || this.getEmailTemplate(notification.category),
        templateData: {
          username: user.username,
          ...templateData,
          ...notification.data
        },
        priority: notification.priority
      };

      const result = await emailService.sendEmail(emailOptions);
      console.log(`📧 Email notification sent to ${user.email}: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error('❌ Email notification failed:', error);
      throw error;
    }
  }

  // Send push notification
  async sendPushNotification(user, notification) {
    try {
      const pushOptions = {
        userId: user._id,
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification._id.toString(),
          category: notification.category,
          ...notification.data
        },
        priority: notification.priority
      };

      const result = await pushNotificationService.sendNotification(pushOptions);
      console.log(`📱 Push notification sent to user ${user._id}: ${result.success}`);
      return result;
    } catch (error) {
      console.error('❌ Push notification failed:', error);
      throw error;
    }
  }

  // Get email template based on category
  getEmailTemplate(category) {
    const templates = {
      payment: 'paymentSuccess',
      token: 'lowTokens',
      security: 'securityAlert',
      system: 'welcome'
    };
    return templates[category] || 'welcome';
  }

  // Send welcome notification
  async sendWelcomeNotification(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    // In-app notification
    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'system',
      title: 'Hoş Geldiniz! 🎉',
      message: 'AI Platform\'a başarıyla kayıt oldunuz. Hemen görsel üretmeye başlayın!',
      data: {
        action: 'navigate',
        route: '/dashboard'
      },
      priority: 'high',
      sendEmail: true,
      sendPush: true,
      emailTemplate: 'welcome'
    });
  }

  // Send payment success notification
  async sendPaymentSuccessNotification(userId, payment, packageData) {
    const user = await User.findById(userId);
    if (!user) return;

    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'payment',
      title: 'Ödeme Başarılı! 💳',
      message: `${packageData.name} paketini satın aldınız. ${packageData.tokens} token hesabınıza eklendi.`,
      data: {
        paymentId: payment._id.toString(),
        packageId: packageData._id.toString(),
        amount: payment.amount,
        tokens: packageData.tokens,
        action: 'navigate',
        route: '/dashboard'
      },
      priority: 'high',
      sendEmail: true,
      sendPush: true,
      emailTemplate: 'paymentSuccess',
      emailData: {
        packageName: packageData.name,
        tokens: packageData.tokens,
        amount: payment.amount,
        currency: payment.currency
      }
    });
  }

  // Send low tokens notification
  async sendLowTokensNotification(userId, remainingTokens) {
    const user = await User.findById(userId);
    if (!user) return;

    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'token',
      title: 'Token Uyarısı ⚠️',
      message: `Token bakiyeniz düşük: ${remainingTokens} token. Yeni paket satın alın.`,
      data: {
        remainingTokens,
        action: 'navigate',
        route: '/buy-tokens'
      },
      priority: 'high',
      sendEmail: true,
      sendPush: true,
      emailTemplate: 'lowTokens',
      emailData: { remainingTokens }
    });
  }

  // Send image generated notification
  async sendImageGeneratedNotification(userId, imageCount, imageIds) {
    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'image_generation',
      title: 'Görsel Hazır! 🎨',
      message: `${imageCount} görsel başarıyla oluşturuldu. Hemen görüntüleyin!`,
      data: {
        imageCount,
        imageIds,
        action: 'navigate',
        route: '/images'
      },
      priority: 'normal',
      sendPush: true
    });
  }

  // Send security alert notification
  async sendSecurityAlertNotification(userId, activity, ipAddress) {
    const user = await User.findById(userId);
    if (!user) return;

    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'security',
      title: 'Güvenlik Uyarısı 🔒',
      message: `Hesabınızda şüpheli aktivite tespit edildi: ${activity}`,
      data: {
        activity,
        ipAddress,
        action: 'navigate',
        route: '/profile/security'
      },
      priority: 'high',
      sendEmail: true,
      sendPush: true,
      emailTemplate: 'securityAlert',
      emailData: { activity, ipAddress }
    });
  }

  // Send admin notification
  async sendAdminNotification(userId, title, message, data = {}) {
    await this.sendNotification({
      userId,
      type: 'in_app',
      category: 'admin',
      title,
      message,
      data,
      priority: 'normal',
      sendEmail: true
    });
  }

  // Send bulk notifications
  async sendBulkNotifications(userIds, options) {
    const batchId = `batch_${Date.now()}`;
    const notifications = [];

    for (const userId of userIds) {
      try {
        const notification = await this.sendNotification({
          ...options,
          userId,
          data: {
            ...options.data,
            batchId
          }
        });
        notifications.push(notification);
      } catch (error) {
        console.error(`❌ Failed to send notification to user ${userId}:`, error);
      }
    }

    return {
      batchId,
      total: userIds.length,
      sent: notifications.length,
      failed: userIds.length - notifications.length
    };
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    try {
      const scheduledNotifications = await Notification.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() }
      }).populate('user');

      for (const notification of scheduledNotifications) {
        await this.deliverNotification(notification, {
          sendEmail: true,
          sendPush: true
        });
      }

      console.log(`⏰ Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      console.error('❌ Failed to process scheduled notifications:', error);
    }
  }

  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      unreadOnly = false
    } = options;

    const skip = (page - 1) * limit;
    const query = { user: userId };

    if (category) query.category = category;
    if (status) query.status = status;
    if (unreadOnly) {
      query.status = { $in: ['pending', 'sent', 'delivered'] };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await notification.markAsRead();
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    return await Notification.updateMany(
      {
        user: userId,
        status: { $in: ['pending', 'sent', 'delivered'] }
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );
  }

  // Get unread count
  async getUnreadCount(userId) {
    return await Notification.getUnreadCount(userId);
  }

  // Delete old notifications
  async cleanupOldNotifications(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['read', 'failed'] }
    });

    console.log(`🗑️ Cleaned up ${result.deletedCount} old notifications`);
    return result.deletedCount;
  }
}

module.exports = new NotificationService(); 