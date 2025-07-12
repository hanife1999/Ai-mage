const express = require('express');
const auth = require('../middleware/auth');
const { adminAuth } = require('../middleware/admin');
const Image = require('../models/Image');
const Token = require('../models/Token');
const User = require('../models/User');
const s3Service = require('../services/s3Service');
const aiProviderManager = require('../services/aiProviderManager');

const router = express.Router();

// AI Image Generation with Provider Manager
const generateAIImage = async (prompt, options, userId) => {
  try {
    // Generate image using AI provider
    const result = await aiProviderManager.generateImage(prompt, options);
    
    let imageUrl = result.imageUrl;
    let thumbnailUrl = result.thumbnailUrl;
    
    // Upload to S3 if configured and image is not already a URL
    if (s3Service.isS3Configured() && !imageUrl.startsWith('http')) {
      const fileName = `ai_generated_${Date.now()}.png`;
      imageUrl = await s3Service.uploadAIImage(Buffer.from(imageUrl), fileName, userId);
      thumbnailUrl = imageUrl; // In real app, generate thumbnail
    }
    
    return {
      imageUrl,
      thumbnailUrl,
      status: 'completed',
      metadata: result.metadata
    };
  } catch (error) {
    console.error('AI Image generation error:', error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
};

// Generate AI Image
router.post('/generate', auth, async (req, res) => {
  try {
    const { prompt, style = 'realistic', size = '512x512', model, quality } = req.body;

    // Validate prompt using AI provider
    const validation = aiProviderManager.getCurrentProvider().validatePrompt(prompt);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    // Calculate tokens using AI provider
    const options = { style, size, model, quality };
    const tokensRequired = aiProviderManager.calculateTokenCost(options);

    // Check user token balance
    const user = await User.findById(req.user._id);
    if (user.tokens < tokensRequired) {
      return res.status(400).json({ 
        message: `Insufficient tokens. Required: ${tokensRequired}, Available: ${user.tokens}` 
      });
    }

    // Create image record
    const image = new Image({
      user: req.user._id,
      prompt: prompt.trim(),
      status: 'generating',
      tokensUsed: tokensRequired,
      metadata: { 
        style, 
        size, 
        model, 
        quality,
        provider: aiProviderManager.getCurrentProvider().name
      }
    });

    await image.save();

    // Deduct tokens immediately
    user.tokens -= tokensRequired;
    await user.save();

    // Create token transaction
    const tokenTransaction = new Token({
      user: req.user._id,
      type: 'spend',
      amount: -tokensRequired,
      description: `AI Image Generation: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
      metadata: { 
        imageId: image._id, 
        style, 
        size, 
        model,
        provider: aiProviderManager.getCurrentProvider().name
      }
    });

    await tokenTransaction.save();

    // Start AI image generation process (async)
    generateAIImage(prompt, options, req.user._id).then(async (result) => {
      image.imageUrl = result.imageUrl;
      image.thumbnailUrl = result.thumbnailUrl;
      image.status = result.status;
      image.metadata = { ...image.metadata, ...result.metadata };
      await image.save();
    }).catch(async (error) => {
      console.error('Image generation error:', error);
      image.status = 'failed';
      image.metadata = { ...image.metadata, error: error.message };
      await image.save();
    });

    res.json({
      message: 'Image generation started',
      imageId: image._id,
      tokensUsed: tokensRequired,
      newBalance: user.tokens,
      provider: aiProviderManager.getCurrentProvider().name
    });

  } catch (err) {
    console.error('Image generation error:', err);
    res.status(500).json({ message: 'Failed to start image generation' });
  }
});

// AI Provider Management Routes (Admin Only)
// Get available AI providers
router.get('/providers', auth, adminAuth, async (req, res) => {
  try {
    const providers = aiProviderManager.getAvailableProviders();
    const providerInfo = providers.map(name => aiProviderManager.getProviderInfo(name));
    
    res.json({
      providers: providerInfo,
      currentProvider: aiProviderManager.getCurrentProvider().name
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get providers' });
  }
});

// Get current provider status
router.get('/providers/status', auth, adminAuth, async (req, res) => {
  try {
    const status = await aiProviderManager.getProviderStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get provider status' });
  }
});

// Switch AI provider
router.post('/providers/switch', auth, adminAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({ message: 'Provider name is required' });
    }

    await aiProviderManager.switchProvider(provider);
    
    res.json({
      message: `Switched to ${provider} provider`,
      currentProvider: provider
    });
  } catch (err) {
    res.status(500).json({ message: `Failed to switch provider: ${err.message}` });
  }
});

// Test AI provider
router.post('/providers/test', auth, adminAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({ message: 'Provider name is required' });
    }

    const result = await aiProviderManager.testProvider(provider);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to test provider' });
  }
});

// Get available models
router.get('/models', auth, async (req, res) => {
  try {
    const models = aiProviderManager.getAvailableModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get models' });
  }
});

// Get pricing information
router.get('/pricing', auth, async (req, res) => {
  try {
    const pricing = aiProviderManager.getPricing();
    res.json({ pricing });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get pricing' });
  }
});

// Get user's images
router.get('/my-images', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const images = await Image.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Image.countDocuments({ user: req.user._id });

    res.json({
      images,
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

// Get single image
router.get('/:imageId', auth, async (req, res) => {
  try {
    const image = await Image.findOne({ 
      _id: req.params.imageId, 
      user: req.user._id 
    });

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json({ image });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete AI generated image from S3 and database
router.delete('/:imageId', auth, async (req, res) => {
  try {
    const image = await Image.findOne({ 
      _id: req.params.imageId, 
      user: req.user._id 
    });

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete image from S3 if configured and image exists
    if (s3Service.isS3Configured() && image.imageUrl) {
      try {
        await s3Service.deleteFromS3(image.imageUrl);
        if (image.thumbnailUrl && image.thumbnailUrl !== image.imageUrl) {
          await s3Service.deleteFromS3(image.thumbnailUrl);
        }
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
        // Continue with database deletion even if S3 delete fails
      }
    }

    // Delete image record from database
    await Image.findByIdAndDelete(req.params.imageId);

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get image generation status
router.get('/:imageId/status', auth, async (req, res) => {
  try {
    const image = await Image.findOne({ 
      _id: req.params.imageId, 
      user: req.user._id 
    });

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json({ 
      status: image.status,
      imageUrl: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 