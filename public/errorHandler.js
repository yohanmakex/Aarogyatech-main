/**
 * Frontend Error Handler
 * Provides comprehensive error handling and user feedback for the MindCare application
 */
class FrontendErrorHandler {
  constructor() {
    // Error tracking
    this.errorLog = [];
    this.maxLogSize = 100;
    
    // Service status tracking
    this.serviceStatus = {
      'conversational-ai': 'unknown',
      'speech-to-text': 'unknown',
      'text-to-speech': 'unknown'
    };
    
    // Retry configurations
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    };
    
    // UI elements
    this.errorContainer = null;
    this.statusIndicator = null;
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize the error handler
   */
  initialize() {
    // Create error container if it doesn't exist
    this.createErrorContainer();
    
    // Create status indicator
    this.createStatusIndicator();
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
    
    // Start service monitoring
    this.startServiceMonitoring();
    
    console.log('Frontend Error Handler initialized');
  }

  /**
   * Create error container in the DOM
   */
  createErrorContainer() {
    let container = document.getElementById('globalErrorContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalErrorContainer';
      container.className = 'global-error-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    this.errorContainer = container;
  }

  /**
   * Create service status indicator
   */
  createStatusIndicator() {
    let indicator = document.getElementById('serviceStatusIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'serviceStatusIndicator';
      indicator.className = 'service-status-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 9999;
        display: none;
        cursor: pointer;
      `;
      indicator.onclick = () => this.showServiceStatus();
      document.body.appendChild(indicator);
    }
    this.statusIndicator = indicator;
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandled_promise_rejection', {
        promise: event.promise
      });
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'javascript_error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle fetch errors globally
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Update service status based on response
        this.updateServiceStatusFromResponse(args[0], response);
        
        return response;
      } catch (error) {
        // Handle fetch errors
        this.handleFetchError(error, args[0]);
        throw error;
      }
    };
  }

  /**
   * Handle errors with comprehensive recovery options
   * @param {Error|string} error - Error object or message
   * @param {string} type - Error type
   * @param {Object} context - Additional context
   */
  async handleError(error, type, context = {}) {
    // Normalize error
    const normalizedError = this.normalizeError(error);
    
    // Log error
    this.logError(normalizedError, type, context);
    
    // Classify error
    const classification = this.classifyError(normalizedError, type, context);
    
    // Show user notification
    this.showErrorNotification(classification);
    
    // Attempt recovery if possible
    if (classification.autoRecovery) {
      setTimeout(() => {
        this.attemptRecovery(classification, context);
      }, classification.recoveryDelay || 2000);
    }
    
    // Update service status
    if (classification.service) {
      this.updateServiceStatus(classification.service, 'error');
    }
  }

  /**
   * Handle fetch errors specifically
   * @param {Error} error - Fetch error
   * @param {string} url - Request URL
   */
  handleFetchError(error, url) {
    const service = this.extractServiceFromUrl(url);
    
    this.handleError(error, 'fetch_error', {
      url,
      service
    });
  }

  /**
   * Normalize error to consistent format
   * @param {Error|string} error - Error to normalize
   * @returns {Object} Normalized error
   */
  normalizeError(error) {
    if (typeof error === 'string') {
      return {
        message: error,
        name: 'Error',
        stack: null
      };
    }
    
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }
    
    return {
      message: 'Unknown error occurred',
      name: 'UnknownError',
      stack: null
    };
  }

  /**
   * Classify error for appropriate handling
   * @param {Object} error - Normalized error
   * @param {string} type - Error type
   * @param {Object} context - Error context
   * @returns {Object} Error classification
   */
  classifyError(error, type, context) {
    const message = error.message.toLowerCase();
    
    // Network/connectivity errors
    if (message.includes('network') || message.includes('fetch') || type === 'fetch_error') {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: 'Connection issue detected. Please check your internet connection.',
        service: context.service,
        autoRecovery: true,
        recoveryDelay: 3000,
        recoveryOptions: ['retry', 'check_connection', 'offline_mode']
      };
    }
    
    // Service unavailable
    if (message.includes('service unavailable') || message.includes('503')) {
      return {
        type: 'service_unavailable',
        severity: 'high',
        userMessage: 'AI services are temporarily unavailable. Fallback mode activated.',
        service: context.service,
        autoRecovery: true,
        recoveryDelay: 30000,
        recoveryOptions: ['retry_later', 'fallback_mode']
      };
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return {
        type: 'rate_limit',
        severity: 'low',
        userMessage: 'Please wait a moment before trying again.',
        service: context.service,
        autoRecovery: true,
        recoveryDelay: 10000,
        recoveryOptions: ['wait_and_retry']
      };
    }
    
    // Permission/authentication errors
    if (message.includes('permission') || message.includes('denied') || message.includes('401')) {
      return {
        type: 'permission',
        severity: 'high',
        userMessage: 'Permission denied. Please check your settings.',
        autoRecovery: false,
        recoveryOptions: ['grant_permission', 'refresh_page']
      };
    }
    
    // Browser compatibility
    if (message.includes('not supported') || type === 'compatibility_error') {
      return {
        type: 'compatibility',
        severity: 'high',
        userMessage: 'This feature is not supported in your browser.',
        autoRecovery: false,
        recoveryOptions: ['update_browser', 'use_alternative']
      };
    }
    
    // JavaScript errors
    if (type === 'javascript_error') {
      return {
        type: 'javascript',
        severity: 'medium',
        userMessage: 'An unexpected error occurred. Please refresh the page.',
        autoRecovery: false,
        recoveryOptions: ['refresh_page', 'report_issue']
      };
    }
    
    // Default classification
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: 'An unexpected error occurred. Please try again.',
      autoRecovery: true,
      recoveryDelay: 5000,
      recoveryOptions: ['retry', 'refresh_page']
    };
  }

  /**
   * Show error notification to user
   * @param {Object} classification - Error classification
   */
  showErrorNotification(classification) {
    const notification = document.createElement('div');
    notification.className = `error-notification ${classification.severity}-severity`;
    notification.style.cssText = `
      background: ${this.getSeverityColor(classification.severity)};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      animation: slideInRight 0.3s ease-out;
      max-width: 100%;
      word-wrap: break-word;
    `;
    
    // Create message content
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-message';
    messageDiv.textContent = classification.userMessage;
    notification.appendChild(messageDiv);
    
    // Add recovery options if available
    if (classification.recoveryOptions && classification.recoveryOptions.length > 0) {
      const optionsDiv = document.createElement('div');
      optionsDiv.className = 'error-recovery-options';
      optionsDiv.style.cssText = `
        margin-top: 8px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      `;
      
      classification.recoveryOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'recovery-option-btn';
        button.style.cssText = `
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        `;
        button.onmouseover = () => button.style.background = 'rgba(255, 255, 255, 0.3)';
        button.onmouseout = () => button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.onclick = () => {
          this.executeRecoveryOption(option, classification);
          this.removeNotification(notification);
        };
        
        button.textContent = this.getRecoveryOptionText(option);
        optionsDiv.appendChild(button);
      });
      
      notification.appendChild(optionsDiv);
    }
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => this.removeNotification(notification);
    notification.style.position = 'relative';
    notification.appendChild(closeButton);
    
    // Add to container
    this.errorContainer.appendChild(notification);
    
    // Auto-remove based on severity
    const autoRemoveDelay = classification.severity === 'low' ? 5000 : 
                           classification.severity === 'medium' ? 8000 : 12000;
    
    setTimeout(() => {
      this.removeNotification(notification);
    }, autoRemoveDelay);
  }

  /**
   * Remove notification from DOM
   * @param {HTMLElement} notification - Notification element
   */
  removeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  /**
   * Get color for severity level
   * @param {string} severity - Severity level
   * @returns {string} CSS color
   */
  getSeverityColor(severity) {
    const colors = {
      low: '#f59e0b',      // amber
      medium: '#ef4444',   // red
      high: '#dc2626'      // dark red
    };
    return colors[severity] || colors.medium;
  }

  /**
   * Get text for recovery option
   * @param {string} option - Recovery option
   * @returns {string} Button text
   */
  getRecoveryOptionText(option) {
    const texts = {
      retry: 'Try Again',
      check_connection: 'Check Connection',
      offline_mode: 'Offline Mode',
      retry_later: 'Retry Later',
      fallback_mode: 'Use Fallback',
      wait_and_retry: 'Wait & Retry',
      grant_permission: 'Grant Permission',
      refresh_page: 'Refresh Page',
      update_browser: 'Update Browser',
      use_alternative: 'Use Alternative',
      report_issue: 'Report Issue'
    };
    return texts[option] || 'Try Again';
  }

  /**
   * Execute recovery option
   * @param {string} option - Recovery option
   * @param {Object} classification - Error classification
   */
  async executeRecoveryOption(option, classification) {
    switch (option) {
      case 'retry':
        // Retry the last failed operation
        this.showInfo('Retrying...');
        break;
        
      case 'check_connection':
        this.showInfo('Please check your internet connection and try again.');
        break;
        
      case 'offline_mode':
        this.activateOfflineMode();
        break;
        
      case 'retry_later':
        this.showInfo('Will retry automatically in a few moments.');
        break;
        
      case 'fallback_mode':
        this.activateFallbackMode(classification.service);
        break;
        
      case 'wait_and_retry':
        this.showInfo('Waiting before retry...');
        setTimeout(() => {
          this.showInfo('Retrying now...');
        }, 10000);
        break;
        
      case 'grant_permission':
        this.showInfo('Please grant the required permissions in your browser settings.');
        break;
        
      case 'refresh_page':
        if (confirm('Refresh the page? Any unsaved changes will be lost.')) {
          window.location.reload();
        }
        break;
        
      case 'update_browser':
        this.showInfo('Please update your browser to the latest version for full functionality.');
        break;
        
      case 'use_alternative':
        this.showInfo('Switching to alternative input method.');
        if (window.VoiceModeManager) {
          VoiceModeManager.setMode('text');
        }
        break;
        
      case 'report_issue':
        this.showReportIssueDialog();
        break;
    }
  }

  /**
   * Activate offline mode
   */
  activateOfflineMode() {
    this.showInfo('Offline mode activated. Limited functionality available.');
    // Implement offline mode logic here
  }

  /**
   * Activate fallback mode for a service
   * @param {string} service - Service name
   */
  activateFallbackMode(service) {
    this.showInfo(`Fallback mode activated for ${service}. Basic functionality available.`);
    // Implement fallback mode logic here
  }

  /**
   * Show info message
   * @param {string} message - Info message
   */
  showInfo(message) {
    this.showNotification(message, 'info');
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show notification with type
   * @param {string} message - Message text
   * @param {string} type - Notification type
   */
  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      background: ${this.getNotificationColor(type)};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;
    
    this.errorContainer.appendChild(notification);
    
    setTimeout(() => {
      this.removeNotification(notification);
    }, 4000);
  }

  /**
   * Get color for notification type
   * @param {string} type - Notification type
   * @returns {string} CSS color
   */
  getNotificationColor(type) {
    const colors = {
      info: '#3b82f6',     // blue
      success: '#10b981',  // green
      warning: '#f59e0b',  // amber
      error: '#ef4444'     // red
    };
    return colors[type] || colors.info;
  }

  /**
   * Log error for debugging and analytics
   * @param {Object} error - Normalized error
   * @param {string} type - Error type
   * @param {Object} context - Error context
   */
  logError(error, type, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      type,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Add to error log
    this.errorLog.push(logEntry);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    // Console log for debugging
    console.error('[Frontend Error Handler]', logEntry);
  }

  /**
   * Extract service name from URL
   * @param {string} url - Request URL
   * @returns {string} Service name
   */
  extractServiceFromUrl(url) {
    if (url.includes('/speech-to-text')) return 'speech-to-text';
    if (url.includes('/text-to-speech')) return 'text-to-speech';
    if (url.includes('/conversational-ai')) return 'conversational-ai';
    return 'unknown';
  }

  /**
   * Update service status from response
   * @param {string} url - Request URL
   * @param {Response} response - Fetch response
   */
  updateServiceStatusFromResponse(url, response) {
    const service = this.extractServiceFromUrl(url);
    if (service === 'unknown') return;
    
    const status = response.ok ? 'healthy' : 'error';
    this.updateServiceStatus(service, status);
  }

  /**
   * Update service status
   * @param {string} service - Service name
   * @param {string} status - Service status
   */
  updateServiceStatus(service, status) {
    if (this.serviceStatus[service] !== status) {
      this.serviceStatus[service] = status;
      this.updateStatusIndicator();
    }
  }

  /**
   * Update status indicator
   */
  updateStatusIndicator() {
    const statuses = Object.values(this.serviceStatus);
    const hasErrors = statuses.includes('error');
    const hasUnknown = statuses.includes('unknown');
    
    if (hasErrors) {
      this.statusIndicator.style.background = '#ef4444';
      this.statusIndicator.textContent = 'Service Issues';
      this.statusIndicator.style.display = 'block';
    } else if (hasUnknown) {
      this.statusIndicator.style.background = '#f59e0b';
      this.statusIndicator.textContent = 'Checking Services';
      this.statusIndicator.style.display = 'block';
    } else {
      this.statusIndicator.style.display = 'none';
    }
  }

  /**
   * Show service status details
   */
  showServiceStatus() {
    const statusText = Object.entries(this.serviceStatus)
      .map(([service, status]) => `${service}: ${status}`)
      .join('\n');
    
    alert(`Service Status:\n\n${statusText}`);
  }

  /**
   * Start service monitoring
   */
  startServiceMonitoring() {
    // Check service status every 30 seconds
    setInterval(() => {
      this.checkServiceHealth();
    }, 30000);
    
    // Initial check
    this.checkServiceHealth();
  }

  /**
   * Check service health
   */
  async checkServiceHealth() {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      
      if (data.services) {
        Object.entries(data.services).forEach(([service, info]) => {
          const status = info.status === 'healthy' ? 'healthy' : 'error';
          this.updateServiceStatus(service, status);
        });
      }
    } catch (error) {
      // Health check failed - mark all services as unknown
      Object.keys(this.serviceStatus).forEach(service => {
        this.updateServiceStatus(service, 'unknown');
      });
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const typeCount = {};
    this.errorLog.forEach(entry => {
      typeCount[entry.type] = (typeCount[entry.type] || 0) + 1;
    });
    
    return {
      totalErrors: this.errorLog.length,
      errorsByType: typeCount,
      recentErrors: this.errorLog.slice(-10),
      serviceStatus: this.serviceStatus
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}

// Initialize global error handler
window.frontendErrorHandler = new FrontendErrorHandler();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);