const mongoose = require('mongoose');
const TokenPackage = require('../models/TokenPackage');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-image-generator', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const defaultPackages = [
  {
    name: 'Starter',
    description: 'Perfect for getting started with AI image generation',
    tokens: 50,
    price: 9.99,
    currency: 'USD',
    isActive: true,
    isPopular: false,
    isLimited: false,
    bonusTokens: 0,
    discountPercentage: 0,
    features: [
      {
        name: 'Basic AI Generation',
        description: 'Access to standard AI image generation',
        icon: '🎨'
      },
      {
        name: 'Standard Resolution',
        description: 'Generate images in standard quality',
        icon: '📱'
      }
    ]
  },
  {
    name: 'Popular',
    description: 'Most popular choice for regular users',
    tokens: 150,
    price: 24.99,
    currency: 'USD',
    isActive: true,
    isPopular: true,
    isLimited: false,
    bonusTokens: 25,
    discountPercentage: 17,
    features: [
      {
        name: 'Enhanced AI Generation',
        description: 'Access to advanced AI models',
        icon: '🚀'
      },
      {
        name: 'High Resolution',
        description: 'Generate images in high quality',
        icon: '🖼️'
      },
      {
        name: 'Priority Support',
        description: 'Faster response times',
        icon: '⚡'
      }
    ]
  },
  {
    name: 'Pro',
    description: 'For power users and professionals',
    tokens: 500,
    price: 69.99,
    currency: 'USD',
    isActive: true,
    isPopular: false,
    isLimited: false,
    bonusTokens: 100,
    discountPercentage: 30,
    features: [
      {
        name: 'Premium AI Models',
        description: 'Access to the latest AI models',
        icon: '👑'
      },
      {
        name: 'Ultra High Resolution',
        description: 'Generate images in ultra high quality',
        icon: '🎯'
      },
      {
        name: 'Batch Generation',
        description: 'Generate multiple images at once',
        icon: '📦'
      },
      {
        name: 'Priority Support',
        description: '24/7 priority support',
        icon: '🎧'
      }
    ]
  },
  {
    name: 'Enterprise',
    description: 'For large teams and businesses',
    tokens: 1500,
    price: 199.99,
    currency: 'USD',
    isActive: true,
    isPopular: false,
    isLimited: false,
    bonusTokens: 300,
    discountPercentage: 33,
    features: [
      {
        name: 'Enterprise AI Models',
        description: 'Access to enterprise-grade AI models',
        icon: '🏢'
      },
      {
        name: 'Maximum Resolution',
        description: 'Generate images in maximum quality',
        icon: '🌟'
      },
      {
        name: 'Unlimited Batch Generation',
        description: 'Generate unlimited images in batches',
        icon: '♾️'
      },
      {
        name: 'Dedicated Support',
        description: 'Dedicated account manager',
        icon: '👨‍💼'
      },
      {
        name: 'API Access',
        description: 'Direct API access for integration',
        icon: '🔌'
      }
    ]
  },
  {
    name: 'Limited Time Offer',
    description: 'Special limited time package with huge savings',
    tokens: 200,
    price: 19.99,
    currency: 'USD',
    isActive: true,
    isPopular: false,
    isLimited: true,
    maxPurchases: 1,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    bonusTokens: 50,
    discountPercentage: 60,
    features: [
      {
        name: 'Premium AI Models',
        description: 'Access to premium AI models',
        icon: '💎'
      },
      {
        name: 'High Resolution',
        description: 'Generate images in high quality',
        icon: '🖼️'
      },
      {
        name: 'Limited Time Only',
        description: 'Special offer - limited availability',
        icon: '⏰'
      }
    ]
  }
];

async function createTokenPackages() {
  try {
    console.log('Creating default token packages...');
    
    // Clear existing packages
    await TokenPackage.deleteMany({});
    console.log('Cleared existing packages');
    
    // Create new packages
    const createdPackages = await TokenPackage.insertMany(defaultPackages);
    console.log(`Created ${createdPackages.length} token packages:`);
    
    createdPackages.forEach(pkg => {
      console.log(`- ${pkg.name}: ${pkg.tokens} tokens for $${pkg.price} (${pkg.bonusTokens > 0 ? `+${pkg.bonusTokens} bonus` : 'no bonus'})`);
    });
    
    console.log('\nToken packages created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating token packages:', error);
    process.exit(1);
  }
}

createTokenPackages(); 