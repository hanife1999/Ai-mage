const User = require('../models/User');

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
  try {
    // Check if user exists and has admin role
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Add admin user to request
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Super admin authorization middleware (for critical operations)
const superAdminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user has super admin role
    if (user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    req.superAdminUser = user;
    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { adminAuth, superAdminAuth }; 