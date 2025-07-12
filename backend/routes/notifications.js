const express = require('express');
const auth = require('../middleware/auth');
const { adminAuth } = require('../middleware/admin');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const pushNotificationService = require('../services/pushNotificationService');

const router = express.Router();

// Get user notifications with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      unreadOnly = false
    } = req.query;

    const result = await notificationService.getUserNotifications(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      status,
      unreadOnly: unreadOnly === 'true'
    });

    res.json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to get notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', auth, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.notificationId, req.user._id);
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
});

// Register push token
router.post('/push-token', auth, async (req, res) => {
  try {
    const { token, deviceInfo = {} } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    const success = await pushNotificationService.addPushToken(req.user._id, token);
    
    if (success) {
      res.json({ message: 'Push token registered successfully' });
    } else {
      res.status(500).json({ message: 'Failed to register push token' });
    }
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ message: 'Failed to register push token' });
  }
});

// Remove push token
router.delete('/push-token/:token', auth, async (req, res) => {
  try {
    const success = await pushNotificationService.removePushToken(req.user._id, req.params.token);
    
    if (success) {
      res.json({ message: 'Push token removed successfully' });
    } else {
      res.status(500).json({ message: 'Failed to remove push token' });
    }
  } catch (error) {
    console.error('Remove push token error:', error);
    res.status(500).json({ message: 'Failed to remove push token' });
  }
});

// Update notification preferences
router.patch('/preferences', auth, async (req, res) => {
  try {
    const { email, push, inApp } = req.body;

    const updateData = {};
    if (email !== undefined) updateData['notificationPreferences.email'] = email;
    if (push !== undefined) updateData['notificationPreferences.push'] = push;
    if (inApp !== undefined) updateData['notificationPreferences.inApp'] = inApp;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true }
    ).select('notificationPreferences');

    res.json({ 
      message: 'Notification preferences updated',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

// Get notification preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    res.json({ preferences: user.notificationPreferences || {} });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Failed to get notification preferences' });
  }
});

// Admin: Send notification to user
router.post('/admin/send', [auth, adminAuth], async (req, res) => {
  try {
    const {
      userId,
      title,
      message,
      category = 'admin',
      priority = 'normal',
      sendEmail = false,
      sendPush = false,
      data = {}
    } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'User ID, title and message are required' });
    }

    const notification = await notificationService.sendNotification({
      userId,
      title,
      message,
      category,
      priority,
      sendEmail,
      sendPush,
      data
    });

    res.json({ 
      message: 'Notification sent successfully',
      notification
    });
  } catch (error) {
    console.error('Admin send notification error:', error);
    res.status(500).json({ message: 'Failed to send notification' });
  }
});

// Admin: Send bulk notifications
router.post('/admin/bulk-send', [auth, adminAuth], async (req, res) => {
  try {
    const {
      userIds,
      title,
      message,
      category = 'admin',
      priority = 'normal',
      sendEmail = false,
      sendPush = false,
      data = {}
    } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const result = await notificationService.sendBulkNotifications(userIds, {
      title,
      message,
      category,
      priority,
      sendEmail,
      sendPush,
      data
    });

    res.json({ 
      message: 'Bulk notifications sent successfully',
      result
    });
  } catch (error) {
    console.error('Admin bulk send error:', error);
    res.status(500).json({ message: 'Failed to send bulk notifications' });
  }
});

// Admin: Get all notifications (with filters)
router.get('/admin/all', [auth, adminAuth], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      category,
      status,
      type,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (userId) query.user = userId;
    if (category) query.category = category;
    if (status) query.status = status;
    if (type) query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const notifications = await Notification.find(query)
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get all notifications error:', error);
    res.status(500).json({ message: 'Failed to get notifications' });
  }
});

// Admin: Get notification statistics
router.get('/admin/stats', [auth, adminAuth], async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Total notifications
    const totalNotifications = await Notification.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Notifications by status
    const byStatus = await Notification.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Notifications by category
    const byCategory = await Notification.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Notifications by type
    const byType = await Notification.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Daily notifications
    const dailyNotifications = await Notification.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalNotifications,
      byStatus,
      byCategory,
      byType,
      dailyNotifications
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to get notification statistics' });
  }
});

// Admin: Clean up old notifications
router.delete('/admin/cleanup', [auth, adminAuth], async (req, res) => {
  try {
    const { daysOld = 90 } = req.query;
    const deletedCount = await notificationService.cleanupOldNotifications(parseInt(daysOld));
    
    res.json({ 
      message: 'Old notifications cleaned up successfully',
      deletedCount
    });
  } catch (error) {
    console.error('Admin cleanup error:', error);
    res.status(500).json({ message: 'Failed to cleanup old notifications' });
  }
});

module.exports = router; 