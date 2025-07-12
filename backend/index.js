const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connection successful'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Import services
const aiProviderManager = require('./services/aiProviderManager');
const notifications = require('./routes/notifications');

// Initialize AI Provider Manager
const initializeAIProvider = async () => {
  try {
    const aiConfig = {
      provider: process.env.AI_PROVIDER || 'mock',
      timeout: parseInt(process.env.AI_TIMEOUT) || 30000,
      retries: parseInt(process.env.AI_RETRIES) || 3,
      
      // OpenAI Configuration
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiOrganization: process.env.OPENAI_ORGANIZATION,
      openaiModel: process.env.OPENAI_MODEL || 'dall-e-3',
      
      // Stability AI Configuration
      stabilityApiKey: process.env.STABILITY_API_KEY,
      stabilityModel: process.env.STABILITY_MODEL || 'stable-diffusion-xl-1024-v1-0',
      
      // Custom Provider Configuration
      customProviderPath: process.env.CUSTOM_PROVIDER_PATH,
      customProviderConfig: process.env.CUSTOM_PROVIDER_CONFIG ? 
        JSON.parse(process.env.CUSTOM_PROVIDER_CONFIG) : {}
    };

    await aiProviderManager.initialize(aiConfig);
    console.log('✅ AI Provider Manager initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AI Provider Manager:', error);
    // Continue without AI provider (fallback to mock)
  }
};

// Initialize AI Provider before starting server
initializeAIProvider().then(() => {
  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/profile', require('./routes/profile'));
  app.use('/api/tokens', require('./routes/tokens'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/images', require('./routes/images'));
  app.use('/api/upload', require('./routes/upload'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/notifications', notifications);
});

app.get('/', (req, res) => {
  res.send('CulosAI Backend API is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 