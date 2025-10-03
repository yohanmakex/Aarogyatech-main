const ErrorHandlingService = require('../services/errorHandlingService');
const QueueManagementService = require('../services/queueManagementService');

/**
 * Error Handling Middleware
 * Provides comprehensive error handling for all API routes
 */
class ErrorHandlingMiddleware {
  constructor() {
    this.errorHandler = new ErrorHandlingService();
    this.queueManager = new QueueManagementService();
    
    // Bind methods
    this.handleApiError = this.handleApiError.bind(this);
    this.handleRateLimit = this.handleRateLimit.bind(this);
    this.handleServiceUnavailable = this.handleServiceUnavailable.bind(this);
    this.wrapAsyncRoute = this.wrapAsyncRoute.bind(this);
  }

  /**
   * Main error handling middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async handleApiError(err, req, res, next) {
    // Skip if response already sent
    if (res.headersSent) {
      return next(err);
    }

    // Extract service name from route
    const service = this.extractServiceFromRoute(req.path);
    
    // Create context for error handling
    const context = {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      body: this.sanitizeRequestBody(req.body),
      query: req.query,
      timestamp: new Date().toISOString()
    };

    try {
      // Use enhanced error handling service
      const errorResult = await this.errorHandler.handleError(err, service, context);
      
      // Determine appropriate HTTP status code
      const statusCode = this.getStatusCodeFromError(err, errorResult.error.type);
      
      // Prepare response
      const response = {
        success: false,
        error: {
          type: errorResult.error.type,
          message: errorResult.error.message,
          code: errorResult.error.code
        },
        timestamp: new Date().toISOString()
      };

      // Add recovery information if available
      if (errorResult.recovery) {
        response.recovery = {
          retryAfter: errorResult.recovery.retryAfter,
          fallbackAvailable: errorResult.recovery.fallbackAvailable,
          userActions: errorResult.userActions
        };
      }

      // Add fallback response if available
      if (errorResult.fallback) {
        response.fallback = errorResult.fallback;
      }

      // Add queue information for rate limiting
      if (errorResult.error.type === 'rate-limit') {
        const queueStatus = this.queueManager.getQueueStatus(service);
        if (queueStatus) {
          response.queue = {
            position: queueStatus.queueLength + 1,
            estimatedWait: this.estimateWaitTime(queueStatus)
          };
        }
      }

      // Set appropriate headers
      this.setErrorHeaders(res, errorResult, statusCode);

      // Send response
      res.status(statusCode).json(response);

    } catch (handlingError) {
      // Fallback error handling if our error handler fails
      console.error('Error handler failed:', handlingError);
      
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'An unexpected error occurred while processing your request.',
          code: 'ERROR_HANDLER_FAILED'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Rate limiting middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async handleRateLimit(req, res, next) {
    const service = this.extractServiceFromRoute(req.path);
    
    // Check if service is available
    if (!this.errorHandler.isServiceAvailable(service)) {
      const error = new Error('Service temporarily unavailable due to circuit breaker');
      error.code = 'CIRCUIT_BREAKER_OPEN';
      return this.handleApiError(error, req, res, next);
    }

    // Check rate limiting
    const queueStatus = this.queueManager.getQueueStatus(service);
    if (queueStatus && queueStatus.rateLimitUsed >= queueStatus.rateLimitMax) {
      const error = new Error('Rate limit exceeded');
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.response = { status: 429 };
      return this.handleApiError(error, req, res, next);
    }

    next();
  }

  /**
   * Service availability middleware
   * @param {string} service - Service name to check
   * @returns {Function} Middleware function
   */
  handleServiceUnavailable(service) {
    return async (req, res, next) => {
      // Check circuit breaker status
      if (!this.errorHandler.isServiceAvailable(service)) {
        const error = new Error(`${service} service is temporarily unavailable`);
        error.code = 'SERVICE_UNAVAILABLE';
        error.response = { status: 503 };
        return this.handleApiError(error, req, res, next);
      }

      next();
    };
  }

  /**
   * Wrap async route handlers with error handling
   * @param {Function} fn - Async route handler
   * @returns {Function} Wrapped route handler
   */
  wrapAsyncRoute(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Extract service name from route path
   * @param {string} path - Request path
   * @returns {string} Service name
   */
  extractServiceFromRoute(path) {
    if (path.includes('/speech-to-text')) return 'speech-to-text';
    if (path.includes('/text-to-speech')) return 'text-to-speech';
    if (path.includes('/conversational-ai')) return 'conversational-ai';
    return 'unknown';
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   * @param {Object} body - Request body
   * @returns {Object} Sanitized body
   */
  sanitizeRequestBody(body) {
    if (!body) return {};
    
    const sanitized = { ...body };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Truncate long text fields
    if (sanitized.text && sanitized.text.length > 100) {
      sanitized.text = sanitized.text.substring(0, 100) + '...';
    }
    
    if (sanitized.message && sanitized.message.length > 100) {
      sanitized.message = sanitized.message.substring(0, 100) + '...';
    }

    return sanitized;
  }

  /**
   * Get appropriate HTTP status code from error
   * @param {Error} error - Original error
   * @param {string} errorType - Classified error type
   * @returns {number} HTTP status code
   */
  getStatusCodeFromError(error, errorType) {
    // Check if error has explicit status code
    if (error.response?.status) {
      return error.response.status;
    }

    // Map error types to status codes
    const statusMap = {
      'rate-limit': 429,
      'service-unavailable': 503,
      'model-loading': 503,
      'authentication': 401,
      'bad-request': 400,
      'data-error': 400,
      'network-error': 502,
      'configuration': 503,
      'unknown': 500
    };

    return statusMap[errorType] || 500;
  }

  /**
   * Set appropriate response headers for errors
   * @param {Object} res - Express response object
   * @param {Object} errorResult - Error handling result
   * @param {number} statusCode - HTTP status code
   */
  setErrorHeaders(res, errorResult, statusCode) {
    // Set retry-after header for rate limiting and service unavailable
    if (errorResult.recovery?.retryAfter) {
      res.set('Retry-After', Math.ceil(errorResult.recovery.retryAfter / 1000));
    }

    // Set cache control to prevent caching of error responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Set content type
    res.set('Content-Type', 'application/json');

    // Add custom headers for error tracking
    res.set('X-Error-Type', errorResult.error.type);
    res.set('X-Error-Code', errorResult.error.code);
    
    if (errorResult.recovery?.fallbackAvailable) {
      res.set('X-Fallback-Available', 'true');
    }
  }

  /**
   * Estimate wait time based on queue status
   * @param {Object} queueStatus - Queue status object
   * @returns {number} Estimated wait time in seconds
   */
  estimateWaitTime(queueStatus) {
    if (!queueStatus) return 0;
    
    // Simple estimation: queue length * average processing time
    const avgProcessingTime = 3; // 3 seconds average
    const queueLength = queueStatus.queueLength;
    const concurrentProcessing = queueStatus.processing;
    
    if (concurrentProcessing === 0) {
      return queueLength * avgProcessingTime;
    }
    
    return Math.ceil((queueLength / concurrentProcessing) * avgProcessingTime);
  }

  /**
   * Create health check endpoint handler
   * @returns {Function} Health check handler
   */
  createHealthCheckHandler() {
    return async (req, res) => {
      try {
        const serviceStatus = this.errorHandler.getServiceStatusReport();
        const queueStatus = this.queueManager.getAllQueueStatuses();
        const errorStats = this.errorHandler.getErrorStats();

        const healthReport = {
          status: serviceStatus.overallHealth,
          timestamp: new Date().toISOString(),
          services: serviceStatus.services,
          queues: queueStatus.services,
          errors: {
            total: errorStats.total,
            byType: errorStats.byType,
            recoveryRate: errorStats.successfulRecoveries / Math.max(errorStats.recoveryAttempts, 1)
          },
          uptime: process.uptime()
        };

        const statusCode = serviceStatus.overallHealth === 'healthy' ? 200 : 
                          serviceStatus.overallHealth === 'degraded' ? 200 : 503;

        res.status(statusCode).json(healthReport);

      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Create error statistics endpoint handler
   * @returns {Function} Error statistics handler
   */
  createErrorStatsHandler() {
    return async (req, res) => {
      try {
        const errorStats = this.errorHandler.getErrorStats();
        const queueStats = this.queueManager.getDetailedStats();

        res.json({
          success: true,
          data: {
            errors: errorStats,
            queues: queueStats,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            type: 'internal_error',
            message: 'Failed to retrieve error statistics'
          }
        });
      }
    };
  }

  /**
   * Create queue status endpoint handler
   * @returns {Function} Queue status handler
   */
  createQueueStatusHandler() {
    return async (req, res) => {
      try {
        const queueStatus = this.queueManager.getAllQueueStatuses();
        
        res.json({
          success: true,
          data: queueStatus
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            type: 'internal_error',
            message: 'Failed to retrieve queue status'
          }
        });
      }
    };
  }

  /**
   * Get middleware instance for Express app
   * @returns {Object} Middleware methods
   */
  getMiddleware() {
    return {
      handleApiError: this.handleApiError,
      handleRateLimit: this.handleRateLimit,
      handleServiceUnavailable: this.handleServiceUnavailable,
      wrapAsyncRoute: this.wrapAsyncRoute,
      healthCheck: this.createHealthCheckHandler(),
      errorStats: this.createErrorStatsHandler(),
      queueStatus: this.createQueueStatusHandler()
    };
  }
}

module.exports = ErrorHandlingMiddleware;