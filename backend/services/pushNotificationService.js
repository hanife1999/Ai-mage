const admin = require('firebase-admin');
const User = require('../models/User');

class PushNotificationService {
  constructor() {
    this.initialized = false;
    this.initializeFirebase();
  }

  async initializeFirebase() {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.initialized = true;
        console.log('✅ Firebase already initialized');
        return;
      }

      // Initialize Firebase Admin SDK
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Use service account key from environment variable
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else if (process.env.FIREBASE_PROJECT_ID) {
        // Use default credentials (for Google Cloud)
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } else {
        console.log('⚠️ Firebase credentials not found, using mock service');
        this.initialized = false;
        return;
      }

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async sendNotification(options) {
    try {
      const {
        userId,
        title,
        body,
        data = {},
        imageUrl,
        clickAction,
        priority = 'normal',
        ttl = 86400, // 24 hours
        badge = 1
      } = options;

      if (!this.initialized) {
        console.log('📱 Mock push notification:', { userId, title, body });
        return { success: true, messageId: 'mock-' + Date.now() };
      }

      // Get user's push tokens
      const user = await User.findById(userId);
      if (!user || !user.pushTokens || user.pushTokens.length === 0) {
        throw new Error('No push tokens found for user');
      }

      const message = {
        notification: {
          title,
          body,
          imageUrl
        },
        data: {
          ...data,
          clickAction: clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          ttl: ttl * 1000, // Convert to milliseconds
          notification: {
            clickAction,
            icon: 'ic_notification',
            color: '#4CAF50',
            sound: 'default',
            channelId: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              badge,
              sound: 'default',
              category: 'GENERAL'
            }
          },
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5',
            'apns-expiration': Math.floor(Date.now() / 1000) + ttl
          }
        },
        webpush: {
          headers: {
            TTL: ttl.toString(),
            Urgency: priority === 'high' ? 'high' : 'normal'
          },
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            actions: [
              {
                action: 'view',
                title: 'Görüntüle'
              },
              {
                action: 'dismiss',
                title: 'Kapat'
              }
            ]
          }
        }
      };

      const results = [];
      const failedTokens = [];

      // Send to all user's devices
      for (const token of user.pushTokens) {
        try {
          const result = await admin.messaging().send({
            ...message,
            token
          });
          results.push({ token, success: true, messageId: result });
        } catch (error) {
          console.error(`❌ Failed to send to token ${token}:`, error.message);
          failedTokens.push(token);
          results.push({ token, success: false, error: error.message });
        }
      }

      // Remove invalid tokens
      if (failedTokens.length > 0) {
        await this.removeInvalidTokens(userId, failedTokens);
      }

      return {
        success: results.some(r => r.success),
        results,
        failedTokens: failedTokens.length
      };
    } catch (error) {
      console.error('❌ Push notification failed:', error);
      throw error;
    }
  }

  async sendToTopic(topic, options) {
    try {
      const {
        title,
        body,
        data = {},
        imageUrl,
        clickAction,
        priority = 'normal'
      } = options;

      if (!this.initialized) {
        console.log('📱 Mock topic notification:', { topic, title, body });
        return { success: true, messageId: 'mock-' + Date.now() };
      }

      const message = {
        notification: {
          title,
          body,
          imageUrl
        },
        data: {
          ...data,
          clickAction: clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            clickAction,
            icon: 'ic_notification',
            color: '#4CAF50'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              category: 'GENERAL'
            }
          }
        }
      };

      const result = await admin.messaging().send({
        ...message,
        topic
      });

      console.log(`📱 Topic notification sent to ${topic}: ${result}`);
      return { success: true, messageId: result };
    } catch (error) {
      console.error('❌ Topic notification failed:', error);
      throw error;
    }
  }

  async subscribeToTopic(tokens, topic) {
    try {
      if (!this.initialized) {
        console.log('📱 Mock topic subscription:', { tokens: tokens.length, topic });
        return { success: true };
      }

      const result = await admin.messaging().subscribeToTopic(tokens, topic);
      console.log(`📱 Subscribed ${result.successCount}/${tokens.length} tokens to topic: ${topic}`);
      return result;
    } catch (error) {
      console.error('❌ Topic subscription failed:', error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens, topic) {
    try {
      if (!this.initialized) {
        console.log('📱 Mock topic unsubscription:', { tokens: tokens.length, topic });
        return { success: true };
      }

      const result = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      console.log(`📱 Unsubscribed ${result.successCount}/${tokens.length} tokens from topic: ${topic}`);
      return result;
    } catch (error) {
      console.error('❌ Topic unsubscription failed:', error);
      throw error;
    }
  }

  async removeInvalidTokens(userId, invalidTokens) {
    try {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushTokens: { $in: invalidTokens } }
      });
      console.log(`🗑️ Removed ${invalidTokens.length} invalid push tokens for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to remove invalid tokens:', error);
    }
  }

  async addPushToken(userId, token) {
    try {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { pushTokens: token }
      });
      console.log(`📱 Added push token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add push token:', error);
      return false;
    }
  }

  async removePushToken(userId, token) {
    try {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushTokens: token }
      });
      console.log(`🗑️ Removed push token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to remove push token:', error);
      return false;
    }
  }

  // Convenience methods for common notifications
  async sendWelcomeNotification(userId) {
    return this.sendNotification({
      userId,
      title: 'Hoş Geldiniz! 🎉',
      body: 'AI Platform\'a başarıyla kayıt oldunuz. Hemen görsel üretmeye başlayın!',
      data: {
        type: 'welcome',
        action: 'navigate',
        route: '/dashboard'
      },
      priority: 'high'
    });
  }

  async sendPaymentSuccessNotification(userId, packageData, tokens) {
    return this.sendNotification({
      userId,
      title: 'Ödeme Başarılı! 💳',
      body: `${packageData.name} paketini satın aldınız. ${tokens} token hesabınıza eklendi.`,
      data: {
        type: 'payment_success',
        action: 'navigate',
        route: '/dashboard'
      }
    });
  }

  async sendLowTokensNotification(userId, remainingTokens) {
    return this.sendNotification({
      userId,
      title: 'Token Uyarısı ⚠️',
      body: `Token bakiyeniz düşük: ${remainingTokens} token. Yeni paket satın alın.`,
      data: {
        type: 'low_tokens',
        action: 'navigate',
        route: '/buy-tokens'
      },
      priority: 'high'
    });
  }

  async sendImageGeneratedNotification(userId, imageCount) {
    return this.sendNotification({
      userId,
      title: 'Görsel Hazır! 🎨',
      body: `${imageCount} görsel başarıyla oluşturuldu. Hemen görüntüleyin!`,
      data: {
        type: 'image_generated',
        action: 'navigate',
        route: '/images'
      }
    });
  }

  async sendSecurityAlertNotification(userId, activity) {
    return this.sendNotification({
      userId,
      title: 'Güvenlik Uyarısı 🔒',
      body: `Hesabınızda şüpheli aktivite: ${activity}`,
      data: {
        type: 'security_alert',
        action: 'navigate',
        route: '/profile/security'
      },
      priority: 'high'
    });
  }
}

module.exports = new PushNotificationService(); 