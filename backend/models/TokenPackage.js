const mongoose = require('mongoose');

const TokenPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  tokens: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isLimited: {
    type: Boolean,
    default: false
  },
  maxPurchases: {
    type: Number,
    default: null // null means unlimited
  },
  expiresAt: {
    type: Date,
    default: null // null means never expires
  },
  bonusTokens: {
    type: Number,
    default: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  features: [{
    name: String,
    description: String,
    icon: String
  }],
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

// Update the updatedAt field before saving
TokenPackageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for total tokens (including bonus)
TokenPackageSchema.virtual('totalTokens').get(function() {
  return this.tokens + this.bonusTokens;
});

// Virtual for final price after discount
TokenPackageSchema.virtual('finalPrice').get(function() {
  if (this.discountPercentage > 0) {
    return this.price * (1 - this.discountPercentage / 100);
  }
  return this.price;
});

// Virtual for savings amount
TokenPackageSchema.virtual('savingsAmount').get(function() {
  if (this.discountPercentage > 0) {
    return this.price * (this.discountPercentage / 100);
  }
  return 0;
});

// Method to check if package is available
TokenPackageSchema.methods.isAvailable = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

module.exports = mongoose.model('TokenPackage', TokenPackageSchema); 