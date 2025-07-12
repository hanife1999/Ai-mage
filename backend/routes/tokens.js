const express = require('express');
const auth = require('../middleware/auth');
const { adminAuth } = require('../middleware/admin');
const User = require('../models/User');
const Token = require('../models/Token');
const TokenPackage = require('../models/TokenPackage');

const router = express.Router();

// Get user token balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('tokens');
    res.json({ tokens: user.tokens });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get token transaction history with advanced filtering
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter options
    const { type, category, startDate, endDate, search } = req.query;
    
    let query = { user: req.user._id };
    
    if (type) query.type = type;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { prompt: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Token.find(query)
      .populate('packageId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Token.countDocuments(query);

    res.json({
      transactions,
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

// Get token usage analytics
router.get('/analytics', auth, async (req, res) => {
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
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Total tokens spent
    const totalSpent = await Token.aggregate([
      { $match: { user: req.user._id, type: 'spend', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Tokens by category
    const tokensByCategory = await Token.aggregate([
      { $match: { user: req.user._id, createdAt: { $gte: startDate } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Tokens by AI provider
    const tokensByProvider = await Token.aggregate([
      { $match: { user: req.user._id, aiProvider: { $exists: true, $ne: null }, createdAt: { $gte: startDate } } },
      { $group: { _id: '$aiProvider', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Daily usage for chart
    const dailyUsage = await Token.aggregate([
      { $match: { user: req.user._id, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalSpent: Math.abs(totalSpent[0]?.total || 0),
      tokensByCategory,
      tokensByProvider,
      dailyUsage
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available token packages
router.get('/packages', auth, async (req, res) => {
  try {
    const packages = await TokenPackage.find({ isActive: true })
      .sort({ price: 1 });
    
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Spend tokens (for AI generation) - Enhanced version
router.post('/spend', auth, async (req, res) => {
  try {
    const { 
      amount, 
      description, 
      category = 'ai_generation',
      aiProvider = null,
      generationType = null,
      imageCount = null,
      imageSize = null,
      prompt = null,
      metadata = {} 
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const user = await User.findById(req.user._id);
    
    if (user.tokens < amount) {
      return res.status(400).json({ message: 'Insufficient tokens' });
    }

    // Create token transaction with enhanced metadata
    const tokenTransaction = new Token({
      user: req.user._id,
      type: 'spend',
      amount: -amount, // Negative for spending
      description,
      category,
      aiProvider,
      generationType,
      imageCount,
      imageSize,
      prompt,
      sessionId: req.headers['x-session-id'] || null,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      metadata
    });

    // Update user token balance
    user.tokens -= amount;

    await Promise.all([tokenTransaction.save(), user.save()]);

    res.json({
      message: 'Tokens spent successfully',
      newBalance: user.tokens,
      transaction: tokenTransaction
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add tokens (for purchases, bonuses, etc.) - Enhanced version
router.post('/add', auth, async (req, res) => {
  try {
    const { 
      amount, 
      description, 
      type = 'bonus', 
      category = 'admin_bonus',
      packageId = null,
      metadata = {} 
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const user = await User.findById(req.user._id);

    // Create token transaction
    const tokenTransaction = new Token({
      user: req.user._id,
      type,
      amount,
      description,
      category,
      packageId,
      sessionId: req.headers['x-session-id'] || null,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      metadata
    });

    // Update user token balance
    user.tokens += amount;

    await Promise.all([tokenTransaction.save(), user.save()]);

    res.json({
      message: 'Tokens added successfully',
      newBalance: user.tokens,
      transaction: tokenTransaction
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all token transactions (with pagination and filtering)
router.get('/admin/transactions', [auth, adminAuth], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { userId, type, category, startDate, endDate, search } = req.query;
    
    let query = {};
    
    if (userId) query.user = userId;
    if (type) query.type = type;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { prompt: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Token.find(query)
      .populate('user', 'username email')
      .populate('packageId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Token.countDocuments(query);

    res.json({
      transactions,
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

// Admin: Get system-wide token analytics
router.get('/admin/analytics', [auth, adminAuth], async (req, res) => {
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
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Total tokens in system
    const totalTokens = await Token.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Tokens by type
    const tokensByType = await Token.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Top users by token usage
    const topUsers = await Token.aggregate([
      { $match: { type: 'spend', createdAt: { $gte: startDate } } },
      { $group: { _id: '$user', totalSpent: { $sum: '$amount' } } },
      { $sort: { totalSpent: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $project: { username: '$userInfo.username', email: '$userInfo.email', totalSpent: 1 } }
    ]);

    // Daily system usage
    const dailySystemUsage = await Token.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalTokens: totalTokens[0]?.total || 0,
      tokensByType,
      topUsers,
      dailySystemUsage
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 