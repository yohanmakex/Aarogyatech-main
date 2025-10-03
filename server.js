const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const ErrorHandlingMiddleware = require('./middleware/errorHandlingMiddleware');
const AnalyticsMiddleware = require('./middleware/analyticsMiddleware');
const RealTimeMonitoringService = require('./services/realTimeMonitoringService');
const PerformanceOptimizationService = require('./services/performanceOptimizationService');
const CachingService = require('./services/cachingService');
const ApiBatchingService = require('./services/apiBatchingService');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

// Initialize performance optimization services
const performanceOptimizer = new PerformanceOptimizationService();
const cachingService = new CachingService();
const batchingService = new ApiBatchingService();

// Initialize error handling middleware
const errorHandlingMiddleware = new ErrorHandlingMiddleware();
const middleware = errorHandlingMiddleware.getMiddleware();

// Initialize analytics middleware
const analyticsMiddleware = new AnalyticsMiddleware();


// Make performance services available to routes
app.locals.performanceServices = {
  performanceOptimizer,
  cachingService,
  batchingService
};

// Make analytics service available to routes
app.locals.analyticsService = analyticsMiddleware.getAnalyticsService();

// Security middleware - Relaxed for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.groq.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Analytics middleware (before routes)
app.use(analyticsMiddleware.addAnalyticsMetadata);
app.use(analyticsMiddleware.trackApiUsage);

// Serve static files
app.use(express.static('public'));

// API Routes with error handling middleware
const speechToTextRoutes = require('./routes/speechToText');
const conversationalAIRoutes = require('./routes/conversationalAI');
const textToSpeechRoutes = require('./routes/textToSpeech');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const monitoringRoutes = require('./routes/monitoring');
const screeningRoutes = require('./routes/screening');
const voiceConversationRoutes = require('./routes/voiceConversation');
const bookingRoutes = require('./routes/booking');
const { router: performanceRoutes, initializeServices } = require('./routes/performanceRoutes');

// Initialize performance routes with services
initializeServices({
  performanceOptimizer,
  cachingService,
  batchingService
});

// Apply service-specific middleware
app.use('/api/speech-to-text', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('speech-to-text'),
  speechToTextRoutes
);
app.use('/api/conversational-ai', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('conversational-ai'),
  conversationalAIRoutes
);
app.use('/api/text-to-speech', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('text-to-speech'),
  textToSpeechRoutes
);

// Authentication routes
app.use('/api/auth', authRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Performance optimization routes
app.use('/api/performance', performanceRoutes);

// Mental health screening routes
app.use('/api/screening', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('screening'),
  screeningRoutes
);

// Voice conversation routes
app.use('/api/voice-conversation', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('voice-conversation'),
  voiceConversationRoutes
);

// Booking routes
app.use('/api/booking', 
  middleware.handleRateLimit,
  middleware.handleServiceUnavailable('booking'),
  bookingRoutes
);

// Enhanced health check endpoint with error handling details
app.get('/health', middleware.healthCheck);

// Error statistics endpoint
app.get('/api/error-stats', middleware.errorStats);

// Queue status endpoint
app.get('/api/queue-status', middleware.queueStatus);

// API status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'operational',
    services: {
      server: 'running',
      groq: process.env.GROQ_API_KEY ? 'configured' : 'not_configured',
      huggingface: 'deprecated',
      screening: 'operational',
      voiceConversation: 'operational',
      booking: 'operational'
    },
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'MindCare AI Mental Health Assistant Backend',
    version: require('./package.json').version,
    endpoints: {
      health: '/health',
      status: '/api/status',
      screening: '/api/screening',
      voiceConversation: '/api/voice-conversation',
      booking: '/api/booking'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist.`
  });
});

// Enhanced global error handler
app.use(middleware.handleApiError);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Cleanup services
  performanceOptimizer.destroy();
  cachingService.destroy();
  batchingService.destroy();
  
  if (realTimeMonitoring) {
    realTimeMonitoring.destroy();
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Cleanup services
  performanceOptimizer.destroy();
  cachingService.destroy();
  batchingService.destroy();
  
  if (realTimeMonitoring) {
    realTimeMonitoring.destroy();
  }
  
  process.exit(0);
});

// Start server only if not in test mode
let server;
let realTimeMonitoring;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`MindCare AI Backend server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    
    // Initialize real-time monitoring after server starts
    realTimeMonitoring = new RealTimeMonitoringService(server, analyticsMiddleware.getAnalyticsService());
    
    // Make monitoring service available to routes
    app.locals.realTimeMonitoring = realTimeMonitoring;
    
    console.log('Real-time monitoring service initialized');
  });
}

module.exports = { app, server };
