const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TokenPackage',
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  tokens: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'card'
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

PaymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Payment', PaymentSchema); 