const express = require('express');
const auth = require('../middleware/auth');
const Payment = require('../models/Payment');
const Token = require('../models/Token');
const User = require('../models/User');
const TokenPackage = require('../models/TokenPackage');

const router = express.Router();

// Initialize Stripe only if secret key is available
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('STRIPE_SECRET_KEY not found. Payment features will be disabled.');
}

// Get available token packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await TokenPackage.find({ isActive: true }).sort({ price: 1 });
    res.json({ packages });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create payment intent for token purchase
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Payment service is not configured' });
    }

    const { packageId } = req.body;

    // Find the package in database
    const package = await TokenPackage.findById(packageId);
    if (!package || !package.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive package selected' });
    }

    // Check if package has expired
    if (package.expiresAt && new Date() > package.expiresAt) {
      return res.status(400).json({ message: 'Package has expired' });
    }

    // Check if package has purchase limit
    if (package.maxPurchases) {
      const userPurchases = await Payment.countDocuments({
        user: req.user._id,
        packageId: package._id,
        status: 'succeeded'
      });
      
      if (userPurchases >= package.maxPurchases) {
        return res.status(400).json({ message: 'Purchase limit reached for this package' });
      }
    }

    const totalTokens = package.tokens + package.bonusTokens;
    const finalPrice = package.discountPercentage > 0 
      ? package.price * (1 - package.discountPercentage / 100)
      : package.price;

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalPrice * 100), // Convert to cents
      currency: package.currency.toLowerCase(),
      metadata: {
        userId: req.user._id.toString(),
        packageId: package._id.toString(),
        tokens: totalTokens.toString(),
        baseTokens: package.tokens.toString(),
        bonusTokens: package.bonusTokens.toString(),
        discountPercentage: package.discountPercentage.toString()
      }
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      packageId: package._id,
      stripePaymentIntentId: paymentIntent.id,
      amount: Math.round(finalPrice * 100),
      tokens: totalTokens,
      status: 'pending',
      metadata: {
        baseTokens: package.tokens,
        bonusTokens: package.bonusTokens,
        discountPercentage: package.discountPercentage,
        originalPrice: package.price
      }
    });

    await payment.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id
    });
  } catch (err) {
    console.error('Payment intent error:', err);
    res.status(500).json({ message: 'Failed to create payment intent' });
  }
});

// Confirm payment and add tokens
router.post('/confirm', auth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Payment service is not configured' });
    }

    const { paymentIntentId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Find payment record
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: paymentIntentId,
      user: req.user._id 
    }).populate('packageId');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status === 'succeeded') {
      return res.status(400).json({ message: 'Payment already processed' });
    }

    // Update payment status
    payment.status = 'succeeded';
    await payment.save();

    // Add tokens to user
    const user = await User.findById(req.user._id);
    user.tokens += payment.tokens;
    await user.save();

    // Create token transaction record
    const tokenTransaction = new Token({
      user: req.user._id,
      type: 'purchase',
      amount: payment.tokens,
      description: `Purchased ${payment.tokens} tokens from ${payment.packageId?.name || 'package'}`,
      category: 'purchase',
      paymentId: payment._id,
      packageId: payment.packageId?._id,
      metadata: {
        paymentIntentId,
        amount: payment.amount,
        baseTokens: payment.metadata?.baseTokens,
        bonusTokens: payment.metadata?.bonusTokens,
        discountPercentage: payment.metadata?.discountPercentage
      }
    });

    await tokenTransaction.save();

    res.json({
      message: 'Payment confirmed successfully',
      tokens: payment.tokens,
      newBalance: user.tokens,
      package: payment.packageId
    });
  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ user: req.user._id })
      .populate('packageId', 'name description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({ user: req.user._id });

    res.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 