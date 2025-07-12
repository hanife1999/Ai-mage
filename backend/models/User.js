const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tokens: { type: Number, default: 0 },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'super_admin'], 
    default: 'user' 
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  
  // Profile Information
  avatar: {
    url: { type: String, default: null },
    publicId: { type: String, default: null }
  },
  bio: { 
    type: String, 
    maxlength: 500,
    default: '' 
  },
  website: { 
    type: String, 
    default: '' 
  },
  location: { 
    type: String, 
    default: '' 
  },
  phone: { 
    type: String, 
    default: '' 
  },
  dateOfBirth: { 
    type: Date, 
    default: null 
  },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  
  // Social Media Links
  socialLinks: {
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' }
  },
  
  // User Preferences
  preferences: {
    language: { 
      type: String, 
      enum: ['en', 'tr', 'es', 'fr', 'de'],
      default: 'en' 
    },
    theme: { 
      type: String, 
      enum: ['light', 'dark', 'auto'],
      default: 'dark' 
    },
    emailNotifications: {
      newFeatures: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      security: { type: Boolean, default: true }
    },
    aiPreferences: {
      defaultStyle: { 
        type: String, 
        enum: ['realistic', 'artistic', 'cartoon', 'anime'],
        default: 'realistic' 
      },
      defaultSize: { 
        type: String, 
        enum: ['512x512', '1024x1024', '1024x768'],
        default: '512x512' 
      },
      favoritePrompts: [{ type: String }]
    }
  },
  
  // Statistics
  stats: {
    totalImagesGenerated: { type: Number, default: 0 },
    totalTokensSpent: { type: Number, default: 0 },
    totalFilesUploaded: { type: Number, default: 0 },
    memberSince: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
  },
  
  pushTokens: [{
    type: String,
    required: true
  }],
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    inApp: {
      type: Boolean,
      default: true
    },
    marketing: {
      type: Boolean,
      default: false
    }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
UserSchema.pre('save', async function (next) {
  this.updatedAt = new Date();
  
  // Hash password only if it's modified
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for display name (username or name)
UserSchema.virtual('displayName').get(function() {
  return this.name || this.username;
});

// Virtual for age calculation
UserSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Method to update last activity
UserSchema.methods.updateLastActivity = function() {
  this.stats.lastActivity = new Date();
  return this.save();
};

// Method to increment image generation count
UserSchema.methods.incrementImageCount = function() {
  this.stats.totalImagesGenerated += 1;
  return this.save();
};

// Method to increment token spending
UserSchema.methods.incrementTokenSpending = function(amount) {
  this.stats.totalTokensSpent += amount;
  return this.save();
};

// Method to increment file upload count
UserSchema.methods.incrementFileCount = function() {
  this.stats.totalFilesUploaded += 1;
  return this.save();
};

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema); 