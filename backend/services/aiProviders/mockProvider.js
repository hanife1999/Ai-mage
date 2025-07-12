const BaseAIProvider = require('./baseProvider');

/**
 * Mock AI Provider for Development and Testing
 * Simulates AI image generation without requiring real API keys
 */
class MockAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
    this.initialized = false;
  }

  async initialize(config) {
    this.config = { ...this.config, ...config };
    this.initialized = true;
    console.log('Mock AI Provider initialized');
    return true;
  }

  async generateImage(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Mock provider not initialized');
    }

    // Simulate processing time
    const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Generate mock image data
    const imageId = Math.random().toString(36).substring(7);
    const size = options.size || '512x512';
    
    // Use different placeholder services based on size
    let imageUrl, thumbnailUrl;
    
    if (size === '1024x1024') {
      imageUrl = `https://picsum.photos/1024/1024?random=${imageId}`;
      thumbnailUrl = `https://picsum.photos/256/256?random=${imageId}`;
    } else {
      imageUrl = `https://picsum.photos/512/512?random=${imageId}`;
      thumbnailUrl = `https://picsum.photos/256/256?random=${imageId}`;
    }

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Mock AI generation failed (simulated error)');
    }

    return {
      success: true,
      imageUrl,
      thumbnailUrl,
      prompt,
      options,
      metadata: {
        provider: 'mock',
        processingTime: Math.round(processingTime),
        imageId,
        generatedAt: new Date().toISOString()
      }
    };
  }

  getAvailableModels() {
    return [
      {
        id: 'mock-realistic',
        name: 'Mock Realistic',
        description: 'Realistic image generation (mock)',
        maxPromptLength: 1000,
        supportedSizes: ['512x512', '1024x1024']
      },
      {
        id: 'mock-artistic',
        name: 'Mock Artistic',
        description: 'Artistic style generation (mock)',
        maxPromptLength: 1000,
        supportedSizes: ['512x512', '1024x1024']
      }
    ];
  }

  getPricing() {
    return {
      baseCost: 5,
      sizeMultipliers: {
        '512x512': 1,
        '1024x1024': 1.6
      },
      styleMultipliers: {
        'realistic': 1,
        'artistic': 1.4,
        'cartoon': 1.2,
        'anime': 1.3
      },
      currency: 'tokens'
    };
  }

  calculateTokenCost(options = {}) {
    const pricing = this.getPricing();
    let cost = pricing.baseCost;
    
    // Apply size multiplier
    if (options.size && pricing.sizeMultipliers[options.size]) {
      cost *= pricing.sizeMultipliers[options.size];
    }
    
    // Apply style multiplier
    if (options.style && pricing.styleMultipliers[options.style]) {
      cost *= pricing.styleMultipliers[options.style];
    }
    
    return Math.round(cost);
  }

  async getStatus() {
    return {
      name: this.name,
      status: 'operational',
      message: 'Mock provider is working (simulated)',
      uptime: '100%',
      responseTime: '1-3 seconds (simulated)'
    };
  }

  // Mock specific methods
  async simulateError(errorType = 'random') {
    const errors = {
      'timeout': new Error('Request timeout (simulated)'),
      'rate_limit': new Error('Rate limit exceeded (simulated)'),
      'invalid_prompt': new Error('Invalid prompt content (simulated)'),
      'service_unavailable': new Error('Service temporarily unavailable (simulated)'),
      'random': new Error(`Random error: ${Math.random().toString(36).substring(7)}`)
    };
    
    throw errors[errorType] || errors.random;
  }
}

module.exports = MockAIProvider; 