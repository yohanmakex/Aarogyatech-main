require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Hugging Face API configuration
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseUrl: 'https://api-inference.huggingface.co/models',
    timeout: 30000, // 30 seconds
    retryAttempts: 3
  },
  
  // CORS configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:5500'
    ]
  },
  
  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // Security configuration
  security: {
    maxRequestSize: '10mb',
    enableHelmet: true,
    enableCors: true
  }
};

// Validation function
const validateConfig = () => {
  const errors = [];
  
  if (!config.huggingface.apiKey) {
    console.warn('Warning: HUGGINGFACE_API_KEY not set. AI features will not work.');
  }
  
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid PORT: must be between 1 and 65535');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
};

module.exports = {
  config,
  validateConfig
};