const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['image', 'video', 'document', 'audio', 'other'],
    default: 'other'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: 500
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

// Pre-save middleware to set file type based on mime type
FileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set file type based on mime type
  if (this.mimeType.startsWith('image/')) {
    this.fileType = 'image';
  } else if (this.mimeType.startsWith('video/')) {
    this.fileType = 'video';
  } else if (this.mimeType.startsWith('audio/')) {
    this.fileType = 'audio';
  } else if (this.mimeType.startsWith('application/') || this.mimeType.startsWith('text/')) {
    this.fileType = 'document';
  } else {
    this.fileType = 'other';
  }
  
  next();
});

// Virtual for file size in MB
FileSchema.virtual('sizeMB').get(function() {
  return (this.fileSize / (1024 * 1024)).toFixed(2);
});

// Virtual for file size in KB
FileSchema.virtual('sizeKB').get(function() {
  return (this.fileSize / 1024).toFixed(2);
});

// Virtual for formatted file size
FileSchema.virtual('formattedSize').get(function() {
  if (this.fileSize < 1024) {
    return `${this.fileSize} B`;
  } else if (this.fileSize < 1024 * 1024) {
    return `${this.sizeKB} KB`;
  } else {
    return `${this.sizeMB} MB`;
  }
});

// Index for better query performance
FileSchema.index({ user: 1, createdAt: -1 });
FileSchema.index({ fileType: 1 });
FileSchema.index({ tags: 1 });

// Ensure virtual fields are serialized
FileSchema.set('toJSON', { virtuals: true });
FileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('File', FileSchema); 