const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['email', 'push', 'in_app', 'sms'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'system',
      'payment',
      'token',
      'image_generation',
      'security',
      'marketing',
      'admin'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending'
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  metadata: {
    emailTemplate: String,
    pushToken: String,
    deviceInfo: mongoose.Schema.Types.Mixed,
    campaignId: String,
    batchId: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ category: 1, createdAt: -1 });
notificationSchema.index({ 'metadata.batchId': 1 });

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark as sent
notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Method to increment delivery attempts
notificationSchema.methods.incrementAttempts = function() {
  this.deliveryAttempts += 1;
  if (this.deliveryAttempts >= 3) {
    this.status = 'failed';
  }
  return this.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user: userId,
    status: { $in: ['pending', 'sent', 'delivered'] }
  });
};

// Static method to get notifications by category
notificationSchema.statics.getByCategory = function(userId, category, limit = 20) {
  return this.find({
    user: userId,
    category: category
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Notification', notificationSchema); 