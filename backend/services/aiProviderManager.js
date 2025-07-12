/**
 * AI Provider Manager
 * Manages different AI providers and handles provider switching
 */
class AIProviderManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.config = {};
  }

  /**
   * Register a new AI provider
   * @param {string} name - Provider name
   * @param {BaseAIProvider} providerClass - Provider class
   */
  registerProvider(name, providerClass) {
    this.providers.set(name, providerClass);
    console.log(`AI Provider registered: ${name}`);
  }

  /**
   * Initialize the provider manager with configuration
   * @param {Object} config - Configuration object
   */
  async initialize(config) {
    this.config = config;
    
    // Load available providers
    await this.loadProviders();
    
    // Set current provider
    const providerName = config.provider || 'mock';
    await this.setProvider(providerName);
    
    console.log(`AI Provider Manager initialized with provider: ${providerName}`);
  }

  /**
   * Load all available providers
   */
  async loadProviders() {
    try {
      // Load Mock Provider
      const MockProvider = require('./aiProviders/mockProvider');
      this.registerProvider('mock', MockProvider);
      
      // Load OpenAI Provider (if available)
      try {
        const OpenAIProvider = require('./aiProviders/openaiProvider');
        this.registerProvider('openai', OpenAIProvider);
      } catch (error) {
        console.log('OpenAI provider not available (missing dependencies)');
      }
      
      // Load Stability AI Provider (placeholder)
      // const StabilityProvider = require('./aiProviders/stabilityProvider');
      // this.registerProvider('stability', StabilityProvider);
      
      // Load Custom Provider (if configured)
      if (this.config.customProviderPath) {
        try {
          const CustomProvider = require(this.config.customProviderPath);
          this.registerProvider('custom', CustomProvider);
        } catch (error) {
          console.error('Failed to load custom provider:', error);
        }
      }
      
    } catch (error) {
      console.error('Error loading AI providers:', error);
      throw new Error('Failed to load AI providers');
    }
  }

  /**
   * Set the current AI provider
   * @param {string} providerName - Name of the provider to use
   */
  async setProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    const ProviderClass = this.providers.get(providerName);
    this.currentProvider = new ProviderClass();
    
    // Initialize the provider with configuration
    const providerConfig = this.getProviderConfig(providerName);
    await this.currentProvider.initialize(providerConfig);
    
    console.log(`Current AI provider set to: ${providerName}`);
  }

  /**
   * Get configuration for a specific provider
   * @param {string} providerName - Provider name
   * @returns {Object} - Provider configuration
   */
  getProviderConfig(providerName) {
    const baseConfig = {
      timeout: this.config.timeout || 30000,
      retries: this.config.retries || 3
    };

    switch (providerName) {
      case 'openai':
        return {
          ...baseConfig,
          apiKey: this.config.openaiApiKey,
          organization: this.config.openaiOrganization,
          model: this.config.openaiModel || 'dall-e-3'
        };
      
      case 'stability':
        return {
          ...baseConfig,
          apiKey: this.config.stabilityApiKey,
          model: this.config.stabilityModel || 'stable-diffusion-xl-1024-v1-0'
        };
      
      case 'custom':
        return {
          ...baseConfig,
          ...this.config.customProviderConfig
        };
      
      case 'mock':
      default:
        return baseConfig;
    }
  }

  /**
   * Get the current provider
   * @returns {BaseAIProvider} - Current provider instance
   */
  getCurrentProvider() {
    if (!this.currentProvider) {
      throw new Error('No AI provider is currently set');
    }
    return this.currentProvider;
  }

  /**
   * Generate image using current provider
   * @param {string} prompt - Image description
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated image data
   */
  async generateImage(prompt, options = {}) {
    const provider = this.getCurrentProvider();
    
    // Validate prompt
    const validation = provider.validatePrompt(prompt);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Generate image
    return await provider.generateImage(prompt, options);
  }

  /**
   * Get available models from current provider
   * @returns {Array} - Available models
   */
  getAvailableModels() {
    const provider = this.getCurrentProvider();
    return provider.getAvailableModels();
  }

  /**
   * Get pricing information from current provider
   * @returns {Object} - Pricing details
   */
  getPricing() {
    const provider = this.getCurrentProvider();
    return provider.getPricing();
  }

  /**
   * Calculate token cost for generation
   * @param {Object} options - Generation options
   * @returns {number} - Token cost
   */
  calculateTokenCost(options = {}) {
    const provider = this.getCurrentProvider();
    return provider.calculateTokenCost(options);
  }

  /**
   * Get status of current provider
   * @returns {Promise<Object>} - Provider status
   */
  async getProviderStatus() {
    const provider = this.getCurrentProvider();
    return await provider.getStatus();
  }

  /**
   * Get list of all available providers
   * @returns {Array} - List of provider names
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Switch to a different provider
   * @param {string} providerName - New provider name
   */
  async switchProvider(providerName) {
    await this.setProvider(providerName);
  }

  /**
   * Get provider information
   * @param {string} providerName - Provider name
   * @returns {Object} - Provider information
   */
  getProviderInfo(providerName) {
    if (!this.providers.has(providerName)) {
      return null;
    }

    const ProviderClass = this.providers.get(providerName);
    const provider = new ProviderClass();
    
    return {
      name: provider.name,
      models: provider.getAvailableModels(),
      pricing: provider.getPricing(),
      isCurrent: this.currentProvider && this.currentProvider.name === providerName
    };
  }

  /**
   * Test provider connection
   * @param {string} providerName - Provider to test
   * @returns {Promise<Object>} - Test result
   */
  async testProvider(providerName) {
    try {
      const originalProvider = this.currentProvider;
      await this.setProvider(providerName);
      const status = await this.getProviderStatus();
      
      // Restore original provider
      if (originalProvider) {
        this.currentProvider = originalProvider;
      }
      
      return {
        success: true,
        provider: providerName,
        status
      };
    } catch (error) {
      return {
        success: false,
        provider: providerName,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const aiProviderManager = new AIProviderManager();

module.exports = aiProviderManager; 