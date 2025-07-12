const express = require('express');
const auth = require('../middleware/auth');
const { adminAuth, superAdminAuth } = require('../middleware/admin');
const User = require('../models/User');
const Image = require('../models/Image');
const Payment = require('../models/Payment');
const Token = require('../models/Token');
const File = require('../models/File');
const TokenPackage = require('../models/TokenPackage');

const router = express.Router();

// Get admin dashboard statistics
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalImages = await Image.countDocuments();
    const totalPayments = await Payment.countDocuments();
    const totalFiles = await File.countDocuments();

    // Get recent registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email role createdAt');

    // Get recent payments
    const recentPayments = await Payment.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get system statistics
    const totalTokensUsed = await Token.aggregate([
      { $match: { type: 'spend' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get user growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      statistics: {
        totalUsers,
        totalImages,
        totalPayments,
        totalFiles,
        totalTokensUsed: Math.abs(totalTokensUsed[0]?.total || 0),
        totalRevenue: totalRevenue[0]?.total || 0,
        newUsersThisMonth
      },
      recentUsers,
      recentPayments
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Failed to get dashboard data' });
  }
});

// Get all users with pagination and filters
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Get single user details
router.get('/users/:userId', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's images
    const images = await Image.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's payments
    const payments = await Payment.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's token transactions
    const tokenTransactions = await Token.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      images,
      payments,
      tokenTransactions
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Failed to get user details' });
  }
});

// Update user role (admin only)
router.patch('/users/:userId/role', auth, adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from changing their own role
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Toggle user active status
router.patch('/users/:userId/status', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from deactivating themselves
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

// Token Package Management
// Get all token packages
router.get('/token-packages', [auth, adminAuth], async (req, res) => {
  try {
    const packages = await TokenPackage.find().sort({ price: 1 });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new token package
router.post('/token-packages', [auth, adminAuth], async (req, res) => {
  try {
    const {
      name,
      description,
      tokens,
      price,
      currency = 'USD',
      isActive = true,
      isPopular = false,
      isLimited = false,
      maxPurchases = null,
      expiresAt = null,
      bonusTokens = 0,
      discountPercentage = 0,
      features = []
    } = req.body;

    if (!name || !description || !tokens || !price) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const package = new TokenPackage({
      name,
      description,
      tokens,
      price,
      currency,
      isActive,
      isPopular,
      isLimited,
      maxPurchases,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      bonusTokens,
      discountPercentage,
      features
    });

    await package.save();
    res.json(package);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'Package name already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update token package
router.put('/token-packages/:id', [auth, adminAuth], async (req, res) => {
  try {
    const {
      name,
      description,
      tokens,
      price,
      currency,
      isActive,
      isPopular,
      isLimited,
      maxPurchases,
      expiresAt,
      bonusTokens,
      discountPercentage,
      features
    } = req.body;

    const package = await TokenPackage.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    if (name) package.name = name;
    if (description) package.description = description;
    if (tokens) package.tokens = tokens;
    if (price) package.price = price;
    if (currency) package.currency = currency;
    if (typeof isActive === 'boolean') package.isActive = isActive;
    if (typeof isPopular === 'boolean') package.isPopular = isPopular;
    if (typeof isLimited === 'boolean') package.isLimited = isLimited;
    if (maxPurchases !== undefined) package.maxPurchases = maxPurchases;
    if (expiresAt !== undefined) package.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (bonusTokens !== undefined) package.bonusTokens = bonusTokens;
    if (discountPercentage !== undefined) package.discountPercentage = discountPercentage;
    if (features) package.features = features;

    await package.save();
    res.json(package);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'Package name already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Delete token package
router.delete('/token-packages/:id', [auth, adminAuth], async (req, res) => {
  try {
    const package = await TokenPackage.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ message: 'Package not found' });
    }

    await package.remove();
    res.json({ message: 'Package deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Add tokens to user
router.post('/users/:userId/tokens', [auth, adminAuth], async (req, res) => {
  try {
    const { amount, description, type = 'admin_adjustment', category = 'admin_bonus' } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ message: 'Amount and description are required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create token transaction
    const tokenTransaction = new Token({
      user: req.params.userId,
      type,
      amount,
      description,
      category,
      metadata: { adminId: req.user._id }
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

// Get system logs (super admin only)
router.get('/logs', auth, superAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Get recent activities from different collections
    const recentPayments = await Payment.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentImages = await Image.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentTokenTransactions = await Token.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      recentPayments,
      recentImages,
      recentTokenTransactions
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: 'Failed to get system logs' });
  }
});

// Delete user (super admin only)
router.delete('/users/:userId', auth, superAdminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent super admin from deleting themselves
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user's data (cascade delete)
    await Image.deleteMany({ user: req.params.userId });
    await Payment.deleteMany({ user: req.params.userId });
    await Token.deleteMany({ user: req.params.userId });
    await File.deleteMany({ user: req.params.userId });

    // Delete user
    await User.findByIdAndDelete(req.params.userId);

    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router; 