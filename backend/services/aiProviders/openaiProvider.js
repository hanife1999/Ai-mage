const BaseAIProvider = require('./baseProvider');

/**
 * OpenAI DALL-E Provider
 * Integrates with OpenAI's DALL-E image generation API
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'openai';
    this.initialized = false;
    this.openai = null;
  }

  async initialize(config) {
    this.config = { ...this.config, ...config };
    
    // Check if OpenAI API key is provided
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      // Dynamically import OpenAI (only if needed)
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        organization: this.config.organization // Optional
      });
      
      this.initialized = true;
      console.log('OpenAI Provider initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI provider:', error);
      throw new Error('OpenAI provider initialization failed');
    }
  }

  async generateImage(prompt, options = {}) {
    if (!this.initialized || !this.openai) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      // Map our options to OpenAI parameters
      const openaiOptions = this.mapOptionsToOpenAI(options);
      
      // Generate image using OpenAI API
      const response = await this.openai.images.generate({
        model: openaiOptions.model,
        prompt: prompt,
        n: 1,
        size: openaiOptions.size,
        quality: openaiOptions.quality,
        style: openaiOptions.style,
        response_format: 'url'
      });

      const imageData = response.data[0];
      
      return {
        success: true,
        imageUrl: imageData.url,
        thumbnailUrl: imageData.url, // OpenAI doesn't provide separate thumbnails
        prompt,
        options,
        metadata: {
          provider: 'openai',
          model: openaiOptions.model,
          size: openaiOptions.size,
          quality: openaiOptions.quality,
          style: openaiOptions.style,
          generatedAt: new Date().toISOString(),
          openaiResponse: {
            revisedPrompt: imageData.revised_prompt,
            created: imageData.created
          }
        }
      };
    } catch (error) {
      console.error('OpenAI generation error:', error);
      
      // Handle specific OpenAI errors
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.code === 'content_policy_violation') {
        throw new Error('Content policy violation. Please modify your prompt.');
      } else if (error.code === 'billing_not_active') {
        throw new Error('OpenAI billing not active. Please check your account.');
      } else {
        throw new Error(`OpenAI generation failed: ${error.message}`);
      }
    }
  }

  mapOptionsToOpenAI(options = {}) {
    const mapping = {
      model: options.model || 'dall-e-3',
      size: this.mapSize(options.size),
      quality: options.quality || 'standard',
      style: options.style === 'artistic' ? 'vivid' : 'natural'
    };

    // Validate model
    if (!['dall-e-2', 'dall-e-3'].includes(mapping.model)) {
      mapping.model = 'dall-e-3';
    }

    return mapping;
  }

  mapSize(size) {
    const sizeMap = {
      '256x256': '256x256',
      '512x512': '512x512',
      '1024x1024': '1024x1024',
      '1792x1024': '1792x1024',
      '1024x1792': '1024x1792'
    };
    
    return sizeMap[size] || '1024x1024';
  }

  getAvailableModels() {
    return [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'Latest OpenAI image generation model',
        maxPromptLength: 4000,
        supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
        features: ['high_quality', 'natural_style', 'vivid_style']
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        description: 'Previous generation model',
        maxPromptLength: 1000,
        supportedSizes: ['256x256', '512x512', '1024x1024'],
        features: ['standard_quality']
      }
    ];
  }

  getPricing() {
    return {
      baseCost: 5,
      models: {
        'dall-e-3': {
          '1024x1024': 8,
          '1792x1024': 10,
          '1024x1792': 10
        },
        'dall-e-2': {
          '256x256': 3,
          '512x512': 5,
          '1024x1024': 7
        }
      },
      qualityMultipliers: {
        'standard': 1,
        'hd': 1.5
      },
      currency: 'tokens'
    };
  }

  calculateTokenCost(options = {}) {
    const pricing = this.getPricing();
    const model = options.model || 'dall-e-3';
    const size = options.size || '1024x1024';
    
    let cost = pricing.models[model]?.[size] || pricing.baseCost;
    
    // Apply quality multiplier
    if (options.quality && pricing.qualityMultipliers[options.quality]) {
      cost *= pricing.qualityMultipliers[options.quality];
    }
    
    return Math.round(cost);
  }

  async getStatus() {
    if (!this.initialized) {
      return {
        name: this.name,
        status: 'not_initialized',
        message: 'OpenAI provider not initialized'
      };
    }

    try {
      // Test API connection
      await this.openai.models.list();
      return {
        name: this.name,
        status: 'operational',
        message: 'OpenAI API is working',
        uptime: '99.9%',
        responseTime: '2-10 seconds'
      };
    } catch (error) {
      return {
        name: this.name,
        status: 'error',
        message: `OpenAI API error: ${error.message}`,
        uptime: 'unknown',
        responseTime: 'unknown'
      };
    }
  }

  validatePrompt(prompt) {
    const baseValidation = super.validatePrompt(prompt);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // OpenAI specific validations
    const maxLength = 4000; // DALL-E 3 limit
    
    if (prompt.length > maxLength) {
      return { 
        valid: false, 
        error: `Prompt must be less than ${maxLength} characters for OpenAI` 
      };
    }

    // Check for potentially problematic content
    const problematicTerms = [
      'nude', 'naked', 'explicit', 'porn', 'violence', 'gore',
      'blood', 'weapon', 'drug', 'illegal'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    for (const term of problematicTerms) {
      if (lowerPrompt.includes(term)) {
        return { 
          valid: false, 
          error: `Prompt contains potentially inappropriate content: ${term}` 
        };
      }
    }

    return { valid: true };
  }
}

module.exports = OpenAIProvider; 