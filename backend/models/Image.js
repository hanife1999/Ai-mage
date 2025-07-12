const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: false // Initially null until generation completes
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  s3Key: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  tokensUsed: {
    type: Number,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ImageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Image', ImageSchema); 