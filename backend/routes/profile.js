const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const s3Service = require('../services/s3Service');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Configure multer for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatar'), false);
    }
  }
});

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/', auth, async (req, res) => {
  try {
    const {
      name,
      bio,
      website,
      location,
      phone,
      dateOfBirth,
      gender,
      socialLinks,
      preferences
    } = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic profile information
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;
    if (location !== undefined) user.location = location;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) user.gender = gender;

    // Update social links
    if (socialLinks) {
      if (socialLinks.twitter !== undefined) user.socialLinks.twitter = socialLinks.twitter;
      if (socialLinks.instagram !== undefined) user.socialLinks.instagram = socialLinks.instagram;
      if (socialLinks.linkedin !== undefined) user.socialLinks.linkedin = socialLinks.linkedin;
      if (socialLinks.github !== undefined) user.socialLinks.github = socialLinks.github;
    }

    // Update preferences
    if (preferences) {
      if (preferences.language !== undefined) user.preferences.language = preferences.language;
      if (preferences.theme !== undefined) user.preferences.theme = preferences.theme;
      if (preferences.emailNotifications !== undefined) {
        user.preferences.emailNotifications = {
          ...user.preferences.emailNotifications,
          ...preferences.emailNotifications
        };
      }
      if (preferences.aiPreferences !== undefined) {
        if (preferences.aiPreferences.defaultStyle !== undefined) {
          user.preferences.aiPreferences.defaultStyle = preferences.aiPreferences.defaultStyle;
        }
        if (preferences.aiPreferences.defaultSize !== undefined) {
          user.preferences.aiPreferences.defaultSize = preferences.aiPreferences.defaultSize;
        }
        if (preferences.aiPreferences.favoritePrompts !== undefined) {
          user.preferences.aiPreferences.favoritePrompts = preferences.aiPreferences.favoritePrompts;
        }
      }
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No avatar file uploaded' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old avatar from S3 if exists
    if (user.avatar.url && s3Service.isS3Configured()) {
      try {
        await s3Service.deleteFromS3(user.avatar.url);
      } catch (error) {
        console.error('Failed to delete old avatar:', error);
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = req.file.originalname.split('.').pop();
    const fileName = `avatars/${user._id}_${timestamp}_${randomString}.${extension}`;

    // Upload to S3
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read',
      Metadata: {
        uploadedBy: user._id.toString(),
        uploadedAt: new Date().toISOString(),
        originalName: req.file.originalname
      }
    };

    const result = await s3Service.s3.upload(params).promise();

    // Update user avatar
    user.avatar = {
      url: result.Location,
      publicId: fileName
    };

    await user.save();

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: {
        url: user.avatar.url,
        publicId: user.avatar.publicId
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
  });
});

// Delete avatar
router.delete('/avatar', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.avatar.url) {
      return res.status(400).json({ message: 'No avatar to delete' });
    }

    // Delete from S3
    if (s3Service.isS3Configured()) {
      try {
        await s3Service.deleteFromS3(user.avatar.url);
      } catch (error) {
        console.error('Failed to delete avatar from S3:', error);
      }
    }

    // Remove avatar from user
    user.avatar = { url: null, publicId: null };
    await user.save();

    res.json({ message: 'Avatar deleted successfully' });
  } catch (err) {
    console.error('Delete avatar error:', err);
    res.status(500).json({ message: 'Failed to delete avatar' });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('stats');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ stats: user.stats });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update last activity
router.post('/activity', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.updateLastActivity();
    res.json({ message: 'Activity updated' });
  } catch (err) {
    console.error('Update activity error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get public profile (for other users to view)
router.get('/:userId/public', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name username bio avatar location socialLinks stats.memberSince stats.totalImagesGenerated')
      .where('isActive', true);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 