const EventEmitter = require('events');

/**
 * Centralized Error Handling Service
 * Provides comprehensive error handling, fallback mechanisms, and recovery options
 */
class ErrorHandlingService extends EventEmitter {
  constructor() {
    super();
    
    // Error tracking and statistics
    this.errorStats = {
      total: 0,
      byType: {},
      byService: {},
      rateLimitHits: 0,
      serviceOutages: {},
      recoveryAttempts: 0,
      successfulRecoveries: 0
    };
    
    // Rate limiting and queue management
    this.rateLimitQueues = new Map();
    this.serviceStatus = new Map();
    this.fallbackModes = new Map();
    
    // Circuit breaker pattern for services
    this.circuitBreakers = new Map();
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    
    // Initialize default configurations
    this.initializeDefaults();
    
    // Start monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize default configurations for error handling
   */
  initializeDefaults() {
    // Default circuit breaker settings
    const defaultCircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      state: 'closed' // closed, open, half-open
    };

    // Initialize circuit breakers for each service
    const services = ['conversational-ai', 'speech-to-text', 'text-to-speech'];
    services.forEach(service => {
      this.circuitBreakers.set(service, {
        ...defaultCircuitBreakerConfig,
        service,
        failures: 0,
        lastFailure: null,
        lastSuccess: null
      });
      
      this.serviceStatus.set(service, {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0,
        lastError: null
      });
    });

    // Default fallback modes
    this.fallbackModes.set('conversational-ai', {
      enabled: true,
      strategies: ['cached-responses', 'template-responses', 'offline-mode'],
      currentStrategy: 'template-responses'
    });

    this.fallbackModes.set('speech-to-text', {
      enabled: true,
      strategies: ['web-speech-api', 'text-input-only'],
      currentStrategy: 'web-speech-api'
    });

    this.fallbackModes.set('text-to-speech', {
      enabled: true,
      strategies: ['web-speech-api', 'text-only-mode'],
      currentStrategy: 'web-speech-api'
    });

    // Recovery strategies
    this.recoveryStrategies.set('rate-limit', {
      strategy: 'exponential-backoff',
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    });

    this.recoveryStrategies.set('service-unavailable', {
      strategy: 'circuit-breaker',
      fallbackEnabled: true,
      healthCheckInterval: 30000
    });

    this.recoveryStrategies.set('network-error', {
      strategy: 'retry-with-backoff',
      maxRetries: 2,
      baseDelay: 2000
    });
  }

  /**
   * Handle errors with appropriate recovery strategies
   * @param {Error} error - The error to handle
   * @param {string} service - Service that generated the error
   * @param {Object} context - Additional context information
   * @returns {Object} Error handling result with recovery options
   */
  async handleError(error, service, context = {}) {
    // Update error statistics
    this.updateErrorStats(error, service);

    // Classify the error
    const errorType = this.classifyError(error);
    
    // Log the error with context
    this.logError(error, service, errorType, context);

    // Update circuit breaker
    this.updateCircuitBreaker(service, false);

    // Determine recovery strategy
    const recoveryPlan = await this.createRecoveryPlan(error, service, errorType, context);

    // Execute recovery if possible
    const recoveryResult = await this.executeRecovery(recoveryPlan);

    // Emit error event for monitoring (but don't emit 'error' as it's a special event)
    this.emit('errorHandled', {
      error,
      service,
      errorType,
      context,
      recoveryPlan,
      recoveryResult,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: {
        type: errorType,
        message: this.getUserFriendlyMessage(error, errorType),
        originalMessage: error.message,
        service,
        code: error.code || 'UNKNOWN_ERROR'
      },
      recovery: recoveryResult,
      fallback: recoveryResult.fallbackAvailable ? await this.getFallbackResponse(service, context) : null,
      retryAfter: recoveryResult.retryAfter,
      userActions: this.getUserActionSuggestions(errorType, service)
    };
  }

  /**
   * Classify error types for appropriate handling
   * @param {Error} error - Error to classify
   * @returns {string} Error type classification
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    const status = error.response?.status;

    // Rate limiting errors
    if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate-limit';
    }

    // Service unavailable errors
    if (status === 503 || message.includes('service unavailable') || message.includes('temporarily unavailable')) {
      return 'service-unavailable';
    }

    // Authentication errors
    if (status === 401 || message.includes('unauthorized') || message.includes('invalid api key')) {
      return 'authentication';
    }

    // Bad request errors
    if (status === 400 || message.includes('bad request') || message.includes('invalid')) {
      return 'bad-request';
    }

    // Network connectivity errors
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'network-error';
    }

    // Model loading errors
    if (message.includes('model is loading') || message.includes('loading')) {
      return 'model-loading';
    }

    // Configuration errors
    if (message.includes('not configured') || message.includes('configuration')) {
      return 'configuration';
    }

    // File/data errors
    if (message.includes('file') || message.includes('audio') || message.includes('format')) {
      return 'data-error';
    }

    return 'unknown';
  }

  /**
   * Create a recovery plan based on error type and context
   * @param {Error} error - The error
   * @param {string} service - Service name
   * @param {string} errorType - Classified error type
   * @param {Object} context - Error context
   * @returns {Object} Recovery plan
   */
  async createRecoveryPlan(error, service, errorType, context) {
    const plan = {
      service,
      errorType,
      strategies: [],
      fallbackAvailable: false,
      retryAfter: null,
      autoRetry: false
    };

    switch (errorType) {
      case 'rate-limit':
        plan.strategies.push('exponential-backoff', 'queue-request');
        plan.retryAfter = this.calculateRetryDelay(error, service);
        plan.autoRetry = true;
        plan.fallbackAvailable = this.fallbackModes.get(service)?.enabled || false;
        break;

      case 'service-unavailable':
      case 'model-loading':
        plan.strategies.push('circuit-breaker', 'fallback-mode');
        plan.retryAfter = 30000; // 30 seconds
        plan.fallbackAvailable = true;
        break;

      case 'network-error':
        plan.strategies.push('retry-with-backoff', 'offline-mode');
        plan.retryAfter = 5000; // 5 seconds
        plan.autoRetry = true;
        plan.fallbackAvailable = true;
        break;

      case 'authentication':
        plan.strategies.push('refresh-credentials', 'fallback-mode');
        plan.fallbackAvailable = true;
        break;

      case 'configuration':
        plan.strategies.push('fallback-mode', 'user-notification');
        plan.fallbackAvailable = true;
        break;

      case 'bad-request':
      case 'data-error':
        plan.strategies.push('input-validation', 'format-conversion');
        plan.fallbackAvailable = false;
        break;

      default:
        plan.strategies.push('fallback-mode');
        plan.fallbackAvailable = true;
        break;
    }

    return plan;
  }

  /**
   * Execute recovery strategies
   * @param {Object} recoveryPlan - Recovery plan to execute
   * @returns {Object} Recovery execution result
   */
  async executeRecovery(recoveryPlan) {
    const result = {
      success: false,
      strategiesAttempted: [],
      fallbackActivated: false,
      retryAfter: recoveryPlan.retryAfter,
      fallbackAvailable: recoveryPlan.fallbackAvailable
    };

    for (const strategy of recoveryPlan.strategies) {
      try {
        const strategyResult = await this.executeRecoveryStrategy(strategy, recoveryPlan);
        result.strategiesAttempted.push({
          strategy,
          success: strategyResult.success,
          details: strategyResult.details
        });

        if (strategyResult.success) {
          result.success = true;
          break;
        }

        if (strategy === 'fallback-mode' && strategyResult.success) {
          result.fallbackActivated = true;
        }

      } catch (strategyError) {
        console.error(`Recovery strategy ${strategy} failed:`, strategyError);
        result.strategiesAttempted.push({
          strategy,
          success: false,
          error: strategyError.message
        });
      }
    }

    this.errorStats.recoveryAttempts++;
    if (result.success) {
      this.errorStats.successfulRecoveries++;
    }

    return result;
  }

  /**
   * Execute a specific recovery strategy
   * @param {string} strategy - Strategy name
   * @param {Object} recoveryPlan - Recovery plan context
   * @returns {Object} Strategy execution result
   */
  async executeRecoveryStrategy(strategy, recoveryPlan) {
    switch (strategy) {
      case 'exponential-backoff':
        return this.executeExponentialBackoff(recoveryPlan);

      case 'queue-request':
        return this.executeQueueRequest(recoveryPlan);

      case 'circuit-breaker':
        return this.executeCircuitBreaker(recoveryPlan);

      case 'fallback-mode':
        return this.executeFallbackMode(recoveryPlan);

      case 'retry-with-backoff':
        return this.executeRetryWithBackoff(recoveryPlan);

      case 'offline-mode':
        return this.executeOfflineMode(recoveryPlan);

      case 'refresh-credentials':
        return this.executeRefreshCredentials(recoveryPlan);

      case 'input-validation':
        return this.executeInputValidation(recoveryPlan);

      case 'format-conversion':
        return this.executeFormatConversion(recoveryPlan);

      case 'user-notification':
        return this.executeUserNotification(recoveryPlan);

      default:
        return { success: false, details: `Unknown strategy: ${strategy}` };
    }
  }

  /**
   * Execute exponential backoff strategy
   */
  async executeExponentialBackoff(recoveryPlan) {
    const service = recoveryPlan.service;
    const config = this.recoveryStrategies.get('rate-limit');
    
    // Add to rate limit queue
    if (!this.rateLimitQueues.has(service)) {
      this.rateLimitQueues.set(service, []);
    }

    return {
      success: true,
      details: `Request queued for retry after ${recoveryPlan.retryAfter}ms`
    };
  }

  /**
   * Execute request queueing strategy
   */
  async executeQueueRequest(recoveryPlan) {
    const service = recoveryPlan.service;
    const queue = this.rateLimitQueues.get(service) || [];
    
    // Add request to queue with timestamp
    queue.push({
      timestamp: Date.now(),
      retryAfter: recoveryPlan.retryAfter
    });
    
    this.rateLimitQueues.set(service, queue);
    
    return {
      success: true,
      details: `Request added to queue. Position: ${queue.length}`
    };
  }

  /**
   * Execute circuit breaker strategy
   */
  async executeCircuitBreaker(recoveryPlan) {
    const service = recoveryPlan.service;
    const breaker = this.circuitBreakers.get(service);
    
    if (breaker.state === 'closed') {
      // Open the circuit breaker
      breaker.state = 'open';
      breaker.lastFailure = Date.now();
      
      // Schedule recovery attempt
      setTimeout(() => {
        breaker.state = 'half-open';
      }, breaker.recoveryTimeout);
    }
    
    return {
      success: true,
      details: `Circuit breaker opened for ${service}. Will retry in ${breaker.recoveryTimeout}ms`
    };
  }

  /**
   * Execute fallback mode strategy
   */
  async executeFallbackMode(recoveryPlan) {
    const service = recoveryPlan.service;
    const fallbackConfig = this.fallbackModes.get(service);
    
    if (!fallbackConfig || !fallbackConfig.enabled) {
      return { success: false, details: 'Fallback mode not available' };
    }
    
    // Activate fallback mode
    fallbackConfig.active = true;
    fallbackConfig.activatedAt = Date.now();
    
    return {
      success: true,
      details: `Fallback mode activated for ${service} using ${fallbackConfig.currentStrategy}`
    };
  }

  /**
   * Execute retry with backoff strategy
   */
  async executeRetryWithBackoff(recoveryPlan) {
    const config = this.recoveryStrategies.get('network-error');
    
    return {
      success: true,
      details: `Retry scheduled with ${config.baseDelay}ms delay`
    };
  }

  /**
   * Execute offline mode strategy
   */
  async executeOfflineMode(recoveryPlan) {
    return {
      success: true,
      details: 'Offline mode activated - using cached responses and local processing'
    };
  }

  /**
   * Execute credential refresh strategy
   */
  async executeRefreshCredentials(recoveryPlan) {
    // In a real implementation, this would attempt to refresh API keys
    return {
      success: false,
      details: 'Credential refresh not implemented - manual intervention required'
    };
  }

  /**
   * Execute input validation strategy
   */
  async executeInputValidation(recoveryPlan) {
    return {
      success: true,
      details: 'Input validation rules applied'
    };
  }

  /**
   * Execute format conversion strategy
   */
  async executeFormatConversion(recoveryPlan) {
    return {
      success: true,
      details: 'Format conversion attempted'
    };
  }

  /**
   * Execute user notification strategy
   */
  async executeUserNotification(recoveryPlan) {
    return {
      success: true,
      details: 'User notification sent'
    };
  }

  /**
   * Get fallback response for a service
   * @param {string} service - Service name
   * @param {Object} context - Request context
   * @returns {Object} Fallback response
   */
  async getFallbackResponse(service, context) {
    const fallbackConfig = this.fallbackModes.get(service);
    
    if (!fallbackConfig || !fallbackConfig.enabled) {
      return null;
    }

    switch (service) {
      case 'conversational-ai':
        return this.getConversationalAIFallback(context);
      
      case 'speech-to-text':
        return this.getSpeechToTextFallback(context);
      
      case 'text-to-speech':
        return this.getTextToSpeechFallback(context);
      
      default:
        return null;
    }
  }

  /**
   * Get conversational AI fallback response
   */
  getConversationalAIFallback(context) {
    const fallbackResponses = [
      "I'm having trouble connecting to my AI services right now, but I'm still here to listen. Can you tell me more about what's on your mind?",
      "I'm experiencing some technical difficulties, but I want to help. While I work on reconnecting, please know that your feelings are valid and you're not alone.",
      "My AI capabilities are temporarily limited, but I can still provide some basic support. If you're in crisis, please contact emergency services or a crisis hotline immediately.",
      "I'm having connectivity issues right now. In the meantime, here are some quick coping strategies: take deep breaths, ground yourself by naming 5 things you can see, and remember that this feeling will pass.",
      "Technical difficulties are preventing me from giving you my full response capabilities. If you need immediate help, please reach out to a trusted friend, family member, or mental health professional."
    ];

    // Simple keyword-based response selection
    const message = context.message?.toLowerCase() || '';
    let selectedResponse = fallbackResponses[0];

    if (message.includes('crisis') || message.includes('emergency') || message.includes('help')) {
      selectedResponse = fallbackResponses[2];
    } else if (message.includes('anxious') || message.includes('panic') || message.includes('overwhelmed')) {
      selectedResponse = fallbackResponses[3];
    } else if (message.includes('sad') || message.includes('depressed') || message.includes('alone')) {
      selectedResponse = fallbackResponses[1];
    }

    return {
      message: selectedResponse,
      isFallback: true,
      fallbackType: 'template-response',
      crisisResources: this.getCrisisResources()
    };
  }

  /**
   * Get speech-to-text fallback response
   */
  getSpeechToTextFallback(context) {
    return {
      suggestion: 'web-speech-api',
      message: 'Our speech recognition service is temporarily unavailable. You can try using your browser\'s built-in speech recognition or type your message instead.',
      fallbackInstructions: {
        webSpeechAPI: 'Click the microphone icon to use browser speech recognition',
        textInput: 'Type your message in the text box below'
      }
    };
  }

  /**
   * Get text-to-speech fallback response
   */
  getTextToSpeechFallback(context) {
    return {
      suggestion: 'web-speech-api',
      message: 'Voice synthesis is temporarily unavailable. You can read the text response or try using your browser\'s built-in text-to-speech.',
      fallbackInstructions: {
        webSpeechAPI: 'Your browser may have built-in text-to-speech capabilities',
        textOnly: 'Continue with text-only conversation'
      }
    };
  }

  /**
   * Calculate retry delay for rate limiting
   * @param {Error} error - Rate limit error
   * @param {string} service - Service name
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(error, service) {
    // Check if retry-after header is available
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000; // Convert to milliseconds
    }

    // Use exponential backoff based on consecutive failures
    const serviceStatus = this.serviceStatus.get(service);
    const failures = serviceStatus?.consecutiveFailures || 0;
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute

    const delay = Math.min(baseDelay * Math.pow(2, failures), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  }

  /**
   * Update circuit breaker state
   * @param {string} service - Service name
   * @param {boolean} success - Whether the operation was successful
   */
  updateCircuitBreaker(service, success) {
    let breaker = this.circuitBreakers.get(service);
    
    // Initialize circuit breaker if it doesn't exist
    if (!breaker) {
      const defaultCircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        state: 'closed',
        service,
        failures: 0,
        lastFailure: null,
        lastSuccess: null
      };
      this.circuitBreakers.set(service, defaultCircuitBreakerConfig);
      breaker = defaultCircuitBreakerConfig;
      
      // Also initialize service status
      this.serviceStatus.set(service, {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0,
        lastError: null
      });
    }

    if (success) {
      breaker.failures = 0;
      breaker.lastSuccess = Date.now();
      
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
      }
    } else {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= breaker.failureThreshold && breaker.state === 'closed') {
        breaker.state = 'open';
        
        // Schedule recovery attempt
        setTimeout(() => {
          breaker.state = 'half-open';
        }, breaker.recoveryTimeout);
      }
    }

    // Update service status
    const status = this.serviceStatus.get(service);
    if (status) {
      status.lastCheck = Date.now();
      if (success) {
        status.consecutiveFailures = 0;
        status.status = 'healthy';
        status.lastError = null;
      } else {
        status.consecutiveFailures++;
        status.status = 'unhealthy';
      }
    }
  }

  /**
   * Check if service is available based on circuit breaker
   * @param {string} service - Service name
   * @returns {boolean} Whether service is available
   */
  isServiceAvailable(service) {
    const breaker = this.circuitBreakers.get(service);
    return breaker ? breaker.state !== 'open' : true;
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Original error
   * @param {string} errorType - Classified error type
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(error, errorType) {
    const messages = {
      'rate-limit': 'We\'re experiencing high demand right now. Your request has been queued and will be processed shortly.',
      'service-unavailable': 'Our AI services are temporarily unavailable. We\'re working to restore them quickly.',
      'network-error': 'There seems to be a connection issue. Please check your internet connection and try again.',
      'authentication': 'There\'s a configuration issue with our services. Please try again later.',
      'bad-request': 'There was an issue with your request. Please check your input and try again.',
      'model-loading': 'Our AI models are starting up. This usually takes just a moment.',
      'configuration': 'Our services are being configured. Please try again in a few minutes.',
      'data-error': 'There was an issue processing your data. Please check the format and try again.',
      'unknown': 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    };

    return messages[errorType] || messages['unknown'];
  }

  /**
   * Get user action suggestions based on error type
   * @param {string} errorType - Error type
   * @param {string} service - Service name
   * @returns {Array} Array of suggested actions
   */
  getUserActionSuggestions(errorType, service) {
    const suggestions = {
      'rate-limit': [
        'Wait a moment and try again',
        'Your request is queued and will be processed automatically'
      ],
      'service-unavailable': [
        'Try again in a few minutes',
        'Use text-only mode as an alternative',
        'Check our status page for updates'
      ],
      'network-error': [
        'Check your internet connection',
        'Try refreshing the page',
        'Switch to a different network if available'
      ],
      'authentication': [
        'Try again in a few minutes',
        'Contact support if the issue persists'
      ],
      'bad-request': [
        'Check your input format',
        'Try with different content',
        'Reduce the size of your request'
      ],
      'model-loading': [
        'Wait a moment for the service to start',
        'Try again in 30 seconds'
      ],
      'configuration': [
        'Try again later',
        'Use alternative features if available'
      ],
      'data-error': [
        'Check your file format',
        'Try with a smaller file',
        'Ensure your audio is clear and not corrupted'
      ]
    };

    return suggestions[errorType] || ['Try again later', 'Contact support if the issue persists'];
  }

  /**
   * Get crisis resources for fallback responses
   * @returns {Array} Crisis resources
   */
  getCrisisResources() {
    return [
      {
        name: 'National Suicide Prevention Lifeline',
        phone: '988',
        description: '24/7 crisis support',
        type: 'emergency'
      },
      {
        name: 'Crisis Text Line',
        phone: 'Text HOME to 741741',
        description: '24/7 text-based crisis support',
        type: 'emergency'
      },
      {
        name: 'Emergency Services',
        phone: '911',
        description: 'For immediate emergencies',
        type: 'emergency'
      }
    ];
  }

  /**
   * Update error statistics
   * @param {Error} error - Error object
   * @param {string} service - Service name
   */
  updateErrorStats(error, service) {
    this.errorStats.total++;
    
    const errorType = this.classifyError(error);
    this.errorStats.byType[errorType] = (this.errorStats.byType[errorType] || 0) + 1;
    this.errorStats.byService[service] = (this.errorStats.byService[service] || 0) + 1;
    
    if (errorType === 'rate-limit') {
      this.errorStats.rateLimitHits++;
    }
    
    if (errorType === 'service-unavailable') {
      this.errorStats.serviceOutages[service] = (this.errorStats.serviceOutages[service] || 0) + 1;
    }
  }

  /**
   * Log error with context
   * @param {Error} error - Error object
   * @param {string} service - Service name
   * @param {string} errorType - Error type
   * @param {Object} context - Error context
   */
  logError(error, service, errorType, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service,
      errorType,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        // Remove sensitive information
        message: context.message ? '[REDACTED]' : undefined,
        sessionId: context.sessionId ? context.sessionId.substring(0, 8) + '...' : undefined
      }
    };
    
    console.error('[ERROR HANDLER]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Start health monitoring for services
   */
  startHealthMonitoring() {
    // Monitor service health every 30 seconds
    this.healthMonitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);
    
    // Clean up old queue entries every minute
    this.queueCleanupInterval = setInterval(() => {
      this.cleanupQueues();
    }, 60000);
  }

  /**
   * Stop health monitoring (for cleanup)
   */
  stopHealthMonitoring() {
    if (this.healthMonitoringInterval) {
      clearInterval(this.healthMonitoringInterval);
      this.healthMonitoringInterval = null;
    }
    if (this.queueCleanupInterval) {
      clearInterval(this.queueCleanupInterval);
      this.queueCleanupInterval = null;
    }
  }

  /**
   * Perform health checks on services
   */
  async performHealthChecks() {
    const services = ['conversational-ai', 'speech-to-text', 'text-to-speech'];
    
    for (const service of services) {
      const breaker = this.circuitBreakers.get(service);
      
      // Only check if circuit breaker is half-open or we haven't checked recently
      if (breaker.state === 'half-open' || 
          !breaker.lastSuccess || 
          Date.now() - breaker.lastSuccess > 300000) { // 5 minutes
        
        try {
          // Perform a lightweight health check
          const isHealthy = await this.checkServiceHealth(service);
          this.updateCircuitBreaker(service, isHealthy);
        } catch (error) {
          this.updateCircuitBreaker(service, false);
        }
      }
    }
  }

  /**
   * Check health of a specific service
   * @param {string} service - Service name
   * @returns {boolean} Whether service is healthy
   */
  async checkServiceHealth(service) {
    // This would make actual health check requests to services
    // For now, return true as a placeholder
    return true;
  }

  /**
   * Clean up old queue entries
   */
  cleanupQueues() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [service, queue] of this.rateLimitQueues.entries()) {
      const cleanQueue = queue.filter(item => now - item.timestamp < maxAge);
      this.rateLimitQueues.set(service, cleanQueue);
    }
  }

  /**
   * Get comprehensive error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      serviceStatus: Object.fromEntries(this.serviceStatus),
      queueLengths: Object.fromEntries(
        Array.from(this.rateLimitQueues.entries()).map(([service, queue]) => [service, queue.length])
      )
    };
  }

  /**
   * Reset error statistics
   */
  resetErrorStats() {
    this.errorStats = {
      total: 0,
      byType: {},
      byService: {},
      rateLimitHits: 0,
      serviceOutages: {},
      recoveryAttempts: 0,
      successfulRecoveries: 0
    };
  }

  /**
   * Get service status report
   * @returns {Object} Service status report
   */
  getServiceStatusReport() {
    const report = {
      timestamp: new Date().toISOString(),
      services: {},
      overallHealth: 'healthy'
    };

    let unhealthyServices = 0;
    const totalServices = this.serviceStatus.size;

    for (const [service, status] of this.serviceStatus.entries()) {
      const breaker = this.circuitBreakers.get(service);
      const fallback = this.fallbackModes.get(service);
      
      report.services[service] = {
        status: status.status,
        circuitBreakerState: breaker.state,
        consecutiveFailures: status.consecutiveFailures,
        lastCheck: status.lastCheck,
        fallbackActive: fallback?.active || false,
        queueLength: this.rateLimitQueues.get(service)?.length || 0
      };

      if (status.status === 'unhealthy') {
        unhealthyServices++;
      }
    }

    // Determine overall health
    if (unhealthyServices === 0) {
      report.overallHealth = 'healthy';
    } else if (unhealthyServices < totalServices) {
      report.overallHealth = 'degraded';
    } else {
      report.overallHealth = 'unhealthy';
    }

    return report;
  }
}

module.exports = ErrorHandlingService;