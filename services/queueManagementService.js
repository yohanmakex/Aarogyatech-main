const EventEmitter = require('events');

/**
 * Queue Management Service
 * Handles request queuing, rate limiting, and load balancing for AI services
 */
class QueueManagementService extends EventEmitter {
  constructor() {
    super();
    
    // Service queues
    this.queues = new Map();
    
    // Rate limiting configurations
    this.rateLimits = new Map();
    
    // Processing state
    this.processing = new Map();
    
    // Queue statistics
    this.stats = {
      totalRequests: 0,
      processedRequests: 0,
      failedRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0
    };
    
    // Initialize default configurations
    this.initializeDefaults();
    
    // Start queue processing
    this.startQueueProcessing();
  }

  /**
   * Initialize default queue configurations
   */
  initializeDefaults() {
    const services = ['conversational-ai', 'speech-to-text', 'text-to-speech'];
    
    services.forEach(service => {
      // Initialize queue
      this.queues.set(service, []);
      
      // Initialize rate limiting
      this.rateLimits.set(service, {
        maxRequestsPerMinute: 60,
        maxConcurrentRequests: 5,
        currentRequests: 0,
        requestHistory: [],
        lastReset: Date.now()
      });
      
      // Initialize processing state
      this.processing.set(service, {
        active: false,
        currentRequests: 0,
        lastProcessed: null,
        errors: 0,
        consecutiveErrors: 0
      });
    });
  }

  /**
   * Add request to queue
   * @param {string} service - Service name
   * @param {Object} request - Request object
   * @param {Object} options - Queue options
   * @returns {Promise} Request promise
   */
  async enqueueRequest(service, request, options = {}) {
    const queueItem = {
      id: this.generateRequestId(),
      service,
      request,
      options: {
        priority: options.priority || 'normal', // 'high', 'normal', 'low'
        timeout: options.timeout || 30000,
        retries: options.retries || 3,
        retryDelay: options.retryDelay || 1000,
        ...options
      },
      status: 'queued',
      queuedAt: Date.now(),
      attempts: 0,
      lastAttempt: null,
      errors: []
    };

    // Create promise for the request
    return new Promise((resolve, reject) => {
      queueItem.resolve = resolve;
      queueItem.reject = reject;
      
      // Add to appropriate queue position based on priority
      this.addToQueue(service, queueItem);
      
      // Update statistics
      this.stats.totalRequests++;
      this.stats.queuedRequests++;
      
      // Emit queue event
      this.emit('requestQueued', {
        service,
        requestId: queueItem.id,
        queueLength: this.queues.get(service).length,
        priority: queueItem.options.priority
      });
      
      // Set timeout for the request
      setTimeout(() => {
        if (queueItem.status === 'queued' || queueItem.status === 'processing') {
          this.handleRequestTimeout(queueItem);
        }
      }, queueItem.options.timeout);
    });
  }

  /**
   * Add item to queue with priority handling
   * @param {string} service - Service name
   * @param {Object} queueItem - Queue item
   */
  addToQueue(service, queueItem) {
    let queue = this.queues.get(service);
    
    // Initialize queue if it doesn't exist
    if (!queue) {
      queue = [];
      this.queues.set(service, queue);
    }
    
    if (queueItem.options.priority === 'high') {
      // High priority items go to the front
      queue.unshift(queueItem);
    } else if (queueItem.options.priority === 'low') {
      // Low priority items go to the back
      queue.push(queueItem);
    } else {
      // Normal priority items go after high priority but before low priority
      const highPriorityCount = queue.filter(item => item.options.priority === 'high').length;
      queue.splice(highPriorityCount, 0, queueItem);
    }
  }

  /**
   * Start queue processing for all services
   */
  startQueueProcessing() {
    const services = Array.from(this.queues.keys());
    
    services.forEach(service => {
      this.processQueue(service);
    });
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupQueues();
      this.updateRateLimits();
    }, 60000); // Every minute
  }

  /**
   * Stop queue processing (for cleanup)
   */
  stopQueueProcessing() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Pause all queues
    for (const service of this.queues.keys()) {
      this.pauseQueue(service);
    }
  }

  /**
   * Process queue for a specific service
   * @param {string} service - Service name
   */
  async processQueue(service) {
    const processingState = this.processing.get(service);
    const rateLimit = this.rateLimits.get(service);
    const queue = this.queues.get(service);
    
    // Check if we can process more requests
    if (processingState.currentRequests >= rateLimit.maxConcurrentRequests) {
      // Schedule next check
      setTimeout(() => this.processQueue(service), 1000);
      return;
    }
    
    // Check rate limiting
    if (!this.canProcessRequest(service)) {
      // Schedule next check when rate limit resets
      const resetTime = this.getNextRateLimitReset(service);
      setTimeout(() => this.processQueue(service), resetTime);
      return;
    }
    
    // Get next item from queue
    const queueItem = queue.shift();
    if (!queueItem) {
      // No items in queue, check again later
      setTimeout(() => this.processQueue(service), 1000);
      return;
    }
    
    // Process the request
    await this.processRequest(service, queueItem);
    
    // Continue processing
    setImmediate(() => this.processQueue(service));
  }

  /**
   * Process a single request
   * @param {string} service - Service name
   * @param {Object} queueItem - Queue item to process
   */
  async processRequest(service, queueItem) {
    const processingState = this.processing.get(service);
    const rateLimit = this.rateLimits.get(service);
    
    try {
      // Update state
      queueItem.status = 'processing';
      queueItem.attempts++;
      queueItem.lastAttempt = Date.now();
      queueItem.processingStarted = Date.now();
      
      processingState.currentRequests++;
      rateLimit.currentRequests++;
      
      // Add to request history for rate limiting
      rateLimit.requestHistory.push(Date.now());
      
      // Update statistics
      this.stats.queuedRequests--;
      const waitTime = queueItem.processingStarted - queueItem.queuedAt;
      this.updateAverageWaitTime(waitTime);
      
      // Emit processing event
      this.emit('requestProcessing', {
        service,
        requestId: queueItem.id,
        attempt: queueItem.attempts,
        waitTime
      });
      
      // Execute the actual request
      const result = await this.executeRequest(service, queueItem);
      
      // Request successful
      queueItem.status = 'completed';
      const processingTime = Date.now() - queueItem.processingStarted;
      
      // Update statistics
      this.stats.processedRequests++;
      this.updateAverageProcessingTime(processingTime);
      processingState.consecutiveErrors = 0;
      
      // Emit success event
      this.emit('requestCompleted', {
        service,
        requestId: queueItem.id,
        processingTime,
        attempts: queueItem.attempts
      });
      
      // Resolve the promise
      queueItem.resolve(result);
      
    } catch (error) {
      await this.handleRequestError(service, queueItem, error);
    } finally {
      // Update processing state
      processingState.currentRequests--;
      processingState.lastProcessed = Date.now();
    }
  }

  /**
   * Execute the actual request (to be implemented by specific services)
   * @param {string} service - Service name
   * @param {Object} queueItem - Queue item
   * @returns {Promise} Request result
   */
  async executeRequest(service, queueItem) {
    // This is a placeholder - actual implementation would call the specific service
    // For now, simulate processing time and potential failures
    
    const processingTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error(`Simulated ${service} service error`);
    }
    
    return {
      success: true,
      data: `Processed request for ${service}`,
      processingTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle request errors with retry logic
   * @param {string} service - Service name
   * @param {Object} queueItem - Queue item
   * @param {Error} error - Error that occurred
   */
  async handleRequestError(service, queueItem, error) {
    const processingState = this.processing.get(service);
    
    // Add error to item
    queueItem.errors.push({
      error: error.message,
      timestamp: Date.now(),
      attempt: queueItem.attempts
    });
    
    // Update processing state
    processingState.errors++;
    processingState.consecutiveErrors++;
    
    // Emit error event
    this.emit('requestError', {
      service,
      requestId: queueItem.id,
      error: error.message,
      attempt: queueItem.attempts,
      willRetry: queueItem.attempts < queueItem.options.retries
    });
    
    // Check if we should retry
    if (queueItem.attempts < queueItem.options.retries) {
      // Calculate retry delay with exponential backoff
      const retryDelay = this.calculateRetryDelay(queueItem);
      
      // Schedule retry
      setTimeout(() => {
        queueItem.status = 'queued';
        this.addToQueue(service, queueItem);
      }, retryDelay);
      
    } else {
      // Max retries reached, fail the request
      queueItem.status = 'failed';
      this.stats.failedRequests++;
      
      this.emit('requestFailed', {
        service,
        requestId: queueItem.id,
        attempts: queueItem.attempts,
        errors: queueItem.errors
      });
      
      // Reject the promise
      queueItem.reject(new Error(`Request failed after ${queueItem.attempts} attempts: ${error.message}`));
    }
  }

  /**
   * Handle request timeout
   * @param {Object} queueItem - Queue item that timed out
   */
  handleRequestTimeout(queueItem) {
    if (queueItem.status === 'completed' || queueItem.status === 'failed') {
      return; // Already handled
    }
    
    queueItem.status = 'timeout';
    this.stats.failedRequests++;
    
    this.emit('requestTimeout', {
      service: queueItem.service,
      requestId: queueItem.id,
      timeout: queueItem.options.timeout
    });
    
    // Remove from queue if still queued
    const queue = this.queues.get(queueItem.service);
    const index = queue.findIndex(item => item.id === queueItem.id);
    if (index !== -1) {
      queue.splice(index, 1);
      this.stats.queuedRequests--;
    }
    
    // Reject the promise
    queueItem.reject(new Error(`Request timeout after ${queueItem.options.timeout}ms`));
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {Object} queueItem - Queue item
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(queueItem) {
    const baseDelay = queueItem.options.retryDelay;
    const attempt = queueItem.attempts;
    const maxDelay = 30000; // 30 seconds max
    
    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    
    return delay + jitter;
  }

  /**
   * Check if we can process a request based on rate limiting
   * @param {string} service - Service name
   * @returns {boolean} Whether request can be processed
   */
  canProcessRequest(service) {
    const rateLimit = this.rateLimits.get(service);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old requests from history
    rateLimit.requestHistory = rateLimit.requestHistory.filter(time => time > oneMinuteAgo);
    
    // Check if we're under the rate limit
    return rateLimit.requestHistory.length < rateLimit.maxRequestsPerMinute;
  }

  /**
   * Get time until next rate limit reset
   * @param {string} service - Service name
   * @returns {number} Time in milliseconds
   */
  getNextRateLimitReset(service) {
    const rateLimit = this.rateLimits.get(service);
    const oldestRequest = Math.min(...rateLimit.requestHistory);
    const resetTime = oldestRequest + 60000 - Date.now();
    
    return Math.max(resetTime, 1000); // At least 1 second
  }

  /**
   * Update rate limits (called periodically)
   */
  updateRateLimits() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    for (const [service, rateLimit] of this.rateLimits.entries()) {
      // Clean old requests
      rateLimit.requestHistory = rateLimit.requestHistory.filter(time => time > oneMinuteAgo);
      
      // Reset current requests counter if needed
      if (now - rateLimit.lastReset > 60000) {
        rateLimit.currentRequests = 0;
        rateLimit.lastReset = now;
      }
    }
  }

  /**
   * Clean up old queue items and update statistics
   */
  cleanupQueues() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [service, queue] of this.queues.entries()) {
      const originalLength = queue.length;
      
      // Remove old items
      const cleanQueue = queue.filter(item => {
        if (now - item.queuedAt > maxAge) {
          // Timeout old items
          this.handleRequestTimeout(item);
          return false;
        }
        return true;
      });
      
      this.queues.set(service, cleanQueue);
      
      // Update statistics
      const removed = originalLength - cleanQueue.length;
      if (removed > 0) {
        this.stats.queuedRequests -= removed;
      }
    }
  }

  /**
   * Update average wait time
   * @param {number} waitTime - Wait time for this request
   */
  updateAverageWaitTime(waitTime) {
    const currentAverage = this.stats.averageWaitTime;
    const processedRequests = this.stats.processedRequests;
    
    this.stats.averageWaitTime = 
      ((currentAverage * (processedRequests - 1)) + waitTime) / processedRequests;
  }

  /**
   * Update average processing time
   * @param {number} processingTime - Processing time for this request
   */
  updateAverageProcessingTime(processingTime) {
    const currentAverage = this.stats.averageProcessingTime;
    const processedRequests = this.stats.processedRequests;
    
    this.stats.averageProcessingTime = 
      ((currentAverage * (processedRequests - 1)) + processingTime) / processedRequests;
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status for a service
   * @param {string} service - Service name
   * @returns {Object} Queue status
   */
  getQueueStatus(service) {
    let queue = this.queues.get(service);
    let processing = this.processing.get(service);
    let rateLimit = this.rateLimits.get(service);
    
    // Initialize if they don't exist
    if (!queue) {
      queue = [];
      this.queues.set(service, queue);
    }
    
    if (!processing) {
      processing = {
        active: false,
        currentRequests: 0,
        lastProcessed: null,
        errors: 0,
        consecutiveErrors: 0
      };
      this.processing.set(service, processing);
    }
    
    if (!rateLimit) {
      rateLimit = {
        maxRequestsPerMinute: 60,
        maxConcurrentRequests: 5,
        currentRequests: 0,
        requestHistory: [],
        lastReset: Date.now()
      };
      this.rateLimits.set(service, rateLimit);
    }
    
    return {
      service,
      queueLength: queue.length,
      processing: processing.currentRequests,
      maxConcurrent: rateLimit.maxConcurrentRequests,
      rateLimitUsed: rateLimit.requestHistory.length,
      rateLimitMax: rateLimit.maxRequestsPerMinute,
      consecutiveErrors: processing.consecutiveErrors,
      lastProcessed: processing.lastProcessed
    };
  }

  /**
   * Get status for all services
   * @returns {Object} All queue statuses
   */
  getAllQueueStatuses() {
    const statuses = {};
    
    for (const service of this.queues.keys()) {
      statuses[service] = this.getQueueStatus(service);
    }
    
    return {
      services: statuses,
      globalStats: this.stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update rate limit configuration for a service
   * @param {string} service - Service name
   * @param {Object} config - New rate limit configuration
   */
  updateRateLimit(service, config) {
    const rateLimit = this.rateLimits.get(service);
    
    if (rateLimit) {
      Object.assign(rateLimit, config);
      
      this.emit('rateLimitUpdated', {
        service,
        config: rateLimit
      });
    }
  }

  /**
   * Pause queue processing for a service
   * @param {string} service - Service name
   */
  pauseQueue(service) {
    const processing = this.processing.get(service);
    if (processing) {
      processing.active = false;
      
      this.emit('queuePaused', { service });
    }
  }

  /**
   * Resume queue processing for a service
   * @param {string} service - Service name
   */
  resumeQueue(service) {
    const processing = this.processing.get(service);
    if (processing) {
      processing.active = true;
      
      // Restart processing
      setImmediate(() => this.processQueue(service));
      
      this.emit('queueResumed', { service });
    }
  }

  /**
   * Clear queue for a service
   * @param {string} service - Service name
   * @returns {number} Number of items cleared
   */
  clearQueue(service) {
    const queue = this.queues.get(service);
    if (!queue) {
      return 0;
    }
    
    const clearedCount = queue.length;
    
    // Reject all pending requests
    queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    // Clear the queue
    queue.length = 0;
    this.stats.queuedRequests -= clearedCount;
    
    this.emit('queueCleared', {
      service,
      clearedCount
    });
    
    return clearedCount;
  }

  /**
   * Get detailed statistics
   * @returns {Object} Detailed statistics
   */
  getDetailedStats() {
    return {
      global: this.stats,
      queues: this.getAllQueueStatuses(),
      rateLimits: Object.fromEntries(this.rateLimits),
      processing: Object.fromEntries(this.processing),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      processedRequests: 0,
      failedRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0
    };
    
    // Reset processing stats
    for (const processing of this.processing.values()) {
      processing.errors = 0;
      processing.consecutiveErrors = 0;
    }
    
    this.emit('statsReset');
  }
}

module.exports = QueueManagementService;