/**
 * Base AI Provider Class
 * All AI providers must extend this class and implement required methods
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Initialize the provider with configuration
   * @param {Object} config - Provider specific configuration
   */
  async initialize(config) {
    throw new Error('initialize method must be implemented by provider');
  }

  /**
   * Generate image from prompt
   * @param {string} prompt - Image description
   * @param {Object} options - Generation options (size, style, etc.)
   * @returns {Promise<Object>} - Generated image data
   */
  async generateImage(prompt, options = {}) {
    throw new Error('generateImage method must be implemented by provider');
  }

  /**
   * Get available models for this provider
   * @returns {Array} - List of available models
   */
  getAvailableModels() {
    throw new Error('getAvailableModels method must be implemented by provider');
  }

  /**
   * Get pricing information for this provider
   * @returns {Object} - Pricing details
   */
  getPricing() {
    throw new Error('getPricing method must be implemented by provider');
  }

  /**
   * Validate prompt for this provider
   * @param {string} prompt - Prompt to validate
   * @returns {Object} - Validation result
   */
  validatePrompt(prompt) {
    const minLength = 3;
    const maxLength = 1000;
    
    if (!prompt || typeof prompt !== 'string') {
      return { valid: false, error: 'Prompt must be a string' };
    }
    
    if (prompt.trim().length < minLength) {
      return { valid: false, error: `Prompt must be at least ${minLength} characters long` };
    }
    
    if (prompt.length > maxLength) {
      return { valid: false, error: `Prompt must be less than ${maxLength} characters` };
    }
    
    return { valid: true };
  }

  /**
   * Calculate token cost for generation
   * @param {Object} options - Generation options
   * @returns {number} - Token cost
   */
  calculateTokenCost(options = {}) {
    // Base implementation - can be overridden by providers
    let cost = 5; // Base cost
    
    if (options.size === '1024x1024') cost += 3;
    if (options.style === 'artistic') cost += 2;
    if (options.quality === 'hd') cost += 2;
    
    return cost;
  }

  /**
   * Get provider status
   * @returns {Object} - Provider status information
   */
  async getStatus() {
    return {
      name: this.name,
      status: 'unknown',
      message: 'Status check not implemented'
    };
  }
}

module.exports = BaseAIProvider; 