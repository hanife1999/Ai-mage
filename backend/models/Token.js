const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'spend', 'refund', 'bonus', 'expired', 'admin_adjustment'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['ai_generation', 'image_upload', 'admin_bonus', 'purchase', 'refund', 'expiration', 'other'],
    default: 'other'
  },
  paymentId: {
    type: String,
    default: null
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TokenPackage',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  // AI generation specific metadata
  aiProvider: {
    type: String,
    default: null
  },
  generationType: {
    type: String,
    enum: ['text_to_image', 'image_to_image', 'text_generation', 'other'],
    default: null
  },
  imageCount: {
    type: Number,
    default: null
  },
  imageSize: {
    type: String,
    default: null
  },
  prompt: {
    type: String,
    default: null
  },
  // Usage analytics
  sessionId: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
TokenSchema.index({ user: 1, createdAt: -1 });
TokenSchema.index({ user: 1, type: 1 });
TokenSchema.index({ user: 1, category: 1 });
TokenSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Token', TokenSchema); 