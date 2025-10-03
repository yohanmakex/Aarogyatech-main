const crypto = require('crypto');
const axios = require('axios');

/**
 * Secure API Communication Service
 * Handles secure communication protocols and API security
 */
class SecureApiService {
  constructor() {
    this.config = {
      requestTimeout: parseInt(process.env.API_TIMEOUT_MS) || 30000,
      maxRetries: parseInt(process.env.API_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.API_RETRY_DELAY_MS) || 1000,
      rateLimitWindow: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000,
      rateLimitMax: parseInt(process.env.API_RATE_LIMIT_MAX) || 100,
      encryptionEnabled: process.env.API_ENCRYPTION_ENABLED !== 'false',
      signatureSecret: process.env.API_SIGNATURE_SECRET || this._generateSignatureSecret(),
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || []
    };

    // Request tracking for rate limiting and monitoring
    this.requestTracker = new Map();
    
    // API key validation patterns
    this.apiKeyPatterns = {
      huggingface: /^hf_[a-zA-Z0-9]{37}$/,
      openai: /^sk-[a-zA-Z0-9]{48}$/,
      generic: /^[a-zA-Z0-9_-]{20,}$/
    };

    // Security headers configuration
    this.securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
    };

    // Initialize axios instance with security defaults
    this.secureAxios = this._createSecureAxiosInstance();
  }

  /**
   * Validate API request security
   * @param {Object} req - Express request object
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateRequestSecurity(req, options = {}) {
    const validation = {
      valid: true,
      issues: [],
      securityScore: 100,
      recommendations: []
    };

    // Validate origin
    const originValidation = this._validateOrigin(req);
    if (!originValidation.valid) {
      validation.valid = false;
      validation.issues.push(originValidation.issue);
      validation.securityScore -= 30;
    }

    // Check rate limiting
    const rateLimitValidation = this._checkRateLimit(req);
    if (!rateLimitValidation.allowed) {
      validation.valid = false;
      validation.issues.push({
        type: 'rate_limit_exceeded',
        message: 'Request rate limit exceeded',
        retryAfter: rateLimitValidation.retryAfter
      });
      validation.securityScore -= 25;
    }

    // Validate request headers
    const headerValidation = this._validateSecurityHeaders(req);
    if (headerValidation.issues.length > 0) {
      validation.issues.push(...headerValidation.issues);
      validation.securityScore -= headerValidation.issues.length * 5;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this._detectSuspiciousPatterns(req);
    if (suspiciousPatterns.length > 0) {
      validation.issues.push({
        type: 'suspicious_patterns',
        message: 'Suspicious request patterns detected',
        patterns: suspiciousPatterns
      });
      validation.securityScore -= suspiciousPatterns.length * 10;
    }

    // Validate request size
    const sizeValidation = this._validateRequestSize(req);
    if (!sizeValidation.valid) {
      validation.issues.push(sizeValidation.issue);
      validation.securityScore -= 15;
    }

    // Generate recommendations
    validation.recommendations = this._generateSecurityRecommendations(validation.issues);

    return validation;
  }

  /**
   * Create secure request signature
   * @param {Object} requestData - Request data to sign
   * @param {string} timestamp - Request timestamp
   * @returns {string} Request signature
   */
  createRequestSignature(requestData, timestamp) {
    const payload = JSON.stringify(requestData) + timestamp;
    return crypto
      .createHmac('sha256', this.config.signatureSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify request signature
   * @param {Object} requestData - Request data
   * @param {string} signature - Provided signature
   * @param {string} timestamp - Request timestamp
   * @returns {boolean} True if signature is valid
   */
  verifyRequestSignature(requestData, signature, timestamp) {
    const expectedSignature = this.createRequestSignature(requestData, timestamp);
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt API request payload
   * @param {Object} payload - Request payload
   * @param {string} sessionId - Session identifier for key derivation
   * @returns {Object} Encrypted payload
   */
  encryptRequestPayload(payload, sessionId) {
    if (!this.config.encryptionEnabled) {
      return payload;
    }

    try {
      const payloadString = JSON.stringify(payload);
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Derive key from session ID and signature secret
      const key = crypto.pbkdf2Sync(
        this.config.signatureSecret + sessionId,
        salt,
        100000,
        32,
        'sha256'
      );

      const cipher = crypto.createCipher('aes-256-cbc', key.toString('hex'));
      let encrypted = cipher.update(payloadString, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted: true,
        data: encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: null, // Not available with CBC mode
        algorithm: 'aes-256-cbc'
      };
    } catch (error) {
      console.error('Request encryption failed:', error.message);
      // Return unencrypted payload with flag if encryption fails
      return {
        encrypted: false,
        data: payload,
        encryptionFailed: true
      };
    }
  }

  /**
   * Decrypt API request payload
   * @param {Object} encryptedPayload - Encrypted payload
   * @param {string} sessionId - Session identifier for key derivation
   * @returns {Object} Decrypted payload
   */
  decryptRequestPayload(encryptedPayload, sessionId) {
    if (!encryptedPayload.encrypted) {
      return encryptedPayload.data || encryptedPayload;
    }

    // If encryption failed originally, return the data as-is
    if (encryptedPayload.encryptionFailed) {
      return encryptedPayload.data;
    }

    try {
      const salt = Buffer.from(encryptedPayload.salt, 'hex');

      // Derive key
      const key = crypto.pbkdf2Sync(
        this.config.signatureSecret + sessionId,
        salt,
        100000,
        32,
        'sha256'
      );

      const decipher = crypto.createDecipher('aes-256-cbc', key.toString('hex'));

      let decrypted = decipher.update(encryptedPayload.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Request decryption failed:', error.message);
      // Return original data if decryption fails
      return encryptedPayload.data;
    }
  }

  /**
   * Make secure API request to external service
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async makeSecureRequest(options) {
    const {
      url,
      method = 'POST',
      data,
      headers = {},
      timeout = this.config.requestTimeout,
      retries = this.config.maxRetries,
      validateResponse = true
    } = options;

    // Add security headers
    const secureHeaders = {
      ...this.securityHeaders,
      ...headers,
      'User-Agent': 'MindCare-AI-Backend/1.0.0',
      'X-Request-ID': crypto.randomUUID(),
      'X-Timestamp': new Date().toISOString()
    };

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.secureAxios({
          url,
          method,
          data,
          headers: secureHeaders,
          timeout,
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });

        // Validate response if requested
        if (validateResponse) {
          const validation = this._validateApiResponse(response);
          if (!validation.valid) {
            throw new Error(`Invalid API response: ${validation.issues.join(', ')}`);
          }
        }

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
          requestId: secureHeaders['X-Request-ID']
        };

      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          break;
        }

        // Exponential backoff for retries
        if (attempt < retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this._sleep(delay);
        }
      }
    }

    throw new Error(`API request failed after ${retries} attempts: ${lastError.message}`);
  }

  /**
   * Sanitize API response for security
   * @param {Object} response - API response
   * @returns {Object} Sanitized response
   */
  sanitizeApiResponse(response) {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = JSON.parse(JSON.stringify(response));

    // Remove potentially sensitive headers
    if (sanitized.headers) {
      const sensitiveHeaders = [
        'authorization', 'cookie', 'set-cookie', 'x-api-key',
        'x-auth-token', 'x-session-id'
      ];
      
      sensitiveHeaders.forEach(header => {
        delete sanitized.headers[header];
        delete sanitized.headers[header.toLowerCase()];
      });
    }

    // Sanitize error messages
    if (sanitized.error && typeof sanitized.error === 'string') {
      sanitized.error = this._sanitizeErrorMessage(sanitized.error);
    }

    return sanitized;
  }

  /**
   * Generate API security report
   * @param {Object} requestStats - Request statistics
   * @returns {Object} Security report
   */
  generateSecurityReport(requestStats = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      requestSecurity: {
        totalRequests: requestStats.totalRequests || 0,
        blockedRequests: requestStats.blockedRequests || 0,
        rateLimitViolations: requestStats.rateLimitViolations || 0,
        suspiciousPatterns: requestStats.suspiciousPatterns || 0
      },
      apiSecurity: {
        encryptionEnabled: this.config.encryptionEnabled,
        signatureValidation: !!this.config.signatureSecret,
        timeoutConfiguration: this.config.requestTimeout,
        retryConfiguration: this.config.maxRetries
      },
      recommendations: []
    };

    // Generate recommendations based on stats
    if (requestStats.blockedRequests > 0) {
      report.recommendations.push('Review blocked requests for potential security threats');
    }

    if (requestStats.rateLimitViolations > requestStats.totalRequests * 0.1) {
      report.recommendations.push('Consider adjusting rate limits or implementing additional protection');
    }

    if (!this.config.encryptionEnabled) {
      report.recommendations.push('Enable API request encryption for enhanced security');
    }

    return report;
  }

  /**
   * Validate origin header
   * @param {Object} req - Express request object
   * @returns {Object} Validation result
   * @private
   */
  _validateOrigin(req) {
    const origin = req.get('Origin') || req.get('Referer');
    
    if (!origin) {
      // Allow requests without origin (e.g., mobile apps, curl)
      return { valid: true };
    }

    const isAllowed = this.config.allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === '*') return true;
      return origin.startsWith(allowedOrigin);
    });

    return {
      valid: isAllowed,
      issue: isAllowed ? null : {
        type: 'invalid_origin',
        message: `Origin ${origin} not allowed`,
        origin
      }
    };
  }

  /**
   * Check rate limiting for request
   * @param {Object} req - Express request object
   * @returns {Object} Rate limit result
   * @private
   */
  _checkRateLimit(req) {
    const clientId = this._getClientIdentifier(req);
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow;

    // Get or create request history for client
    let clientRequests = this.requestTracker.get(clientId) || [];
    
    // Remove old requests outside the window
    clientRequests = clientRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (clientRequests.length >= this.config.rateLimitMax) {
      return {
        allowed: false,
        retryAfter: Math.ceil((clientRequests[0] + this.config.rateLimitWindow - now) / 1000)
      };
    }

    // Add current request
    clientRequests.push(now);
    this.requestTracker.set(clientId, clientRequests);

    return { allowed: true };
  }

  /**
   * Validate security headers
   * @param {Object} req - Express request object
   * @returns {Object} Validation result
   * @private
   */
  _validateSecurityHeaders(req) {
    const issues = [];

    // Check for required security headers in response (this would be set by middleware)
    const requiredHeaders = ['x-content-type-options', 'x-frame-options'];
    
    // Check Content-Type header
    const contentType = req.get('Content-Type');
    if (req.method === 'POST' && (!contentType || !contentType.includes('application/json'))) {
      issues.push({
        type: 'invalid_content_type',
        message: 'Invalid or missing Content-Type header'
      });
    }

    return { issues };
  }

  /**
   * Detect suspicious request patterns
   * @param {Object} req - Express request object
   * @returns {Array} List of suspicious patterns found
   * @private
   */
  _detectSuspiciousPatterns(req) {
    const patterns = [];

    // Check for SQL injection patterns
    const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b|[';])/i;
    if (req.body && typeof req.body === 'object') {
      const bodyString = JSON.stringify(req.body);
      if (sqlPatterns.test(bodyString)) {
        patterns.push('sql_injection_attempt');
      }
    }

    // Check for XSS patterns
    const xssPatterns = /<script|javascript:|on\w+\s*=/i;
    if (req.body && typeof req.body === 'object') {
      const bodyString = JSON.stringify(req.body);
      if (xssPatterns.test(bodyString)) {
        patterns.push('xss_attempt');
      }
    }

    // Check for excessive request size
    if (req.get('Content-Length') && parseInt(req.get('Content-Length')) > 10 * 1024 * 1024) {
      patterns.push('oversized_request');
    }

    // Check for suspicious user agents
    const userAgent = req.get('User-Agent');
    if (userAgent && (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.length < 10)) {
      patterns.push('suspicious_user_agent');
    }

    return patterns;
  }

  /**
   * Validate request size
   * @param {Object} req - Express request object
   * @returns {Object} Validation result
   * @private
   */
  _validateRequestSize(req) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get('Content-Length') || '0');

    if (contentLength > maxSize) {
      return {
        valid: false,
        issue: {
          type: 'request_too_large',
          message: `Request size ${contentLength} exceeds maximum ${maxSize}`,
          size: contentLength,
          maxSize
        }
      };
    }

    return { valid: true };
  }

  /**
   * Generate security recommendations
   * @param {Array} issues - Security issues found
   * @returns {Array} List of recommendations
   * @private
   */
  _generateSecurityRecommendations(issues) {
    const recommendations = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'invalid_origin':
          recommendations.push('Configure proper CORS settings for your domain');
          break;
        case 'rate_limit_exceeded':
          recommendations.push('Implement client-side request throttling');
          break;
        case 'suspicious_patterns':
          recommendations.push('Review and sanitize input data');
          break;
        case 'request_too_large':
          recommendations.push('Reduce request payload size');
          break;
        default:
          recommendations.push('Review security configuration');
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get client identifier for rate limiting
   * @param {Object} req - Express request object
   * @returns {string} Client identifier
   * @private
   */
  _getClientIdentifier(req) {
    // Use IP address as primary identifier
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Hash IP for privacy
    return crypto.createHash('sha256')
      .update(ip + this.config.signatureSecret)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Create secure axios instance
   * @returns {Object} Configured axios instance
   * @private
   */
  _createSecureAxiosInstance() {
    return axios.create({
      timeout: this.config.requestTimeout,
      maxRedirects: 0, // Disable redirects for security
      validateStatus: (status) => status < 500,
      headers: {
        'User-Agent': 'MindCare-AI-Backend/1.0.0'
      }
    });
  }

  /**
   * Validate API response
   * @param {Object} response - API response
   * @returns {Object} Validation result
   * @private
   */
  _validateApiResponse(response) {
    const issues = [];

    // Check response status
    if (response.status >= 400) {
      issues.push(`HTTP error status: ${response.status}`);
    }

    // Check response size
    const responseSize = JSON.stringify(response.data).length;
    if (responseSize > 5 * 1024 * 1024) { // 5MB
      issues.push('Response size too large');
    }

    // Check for required fields (if applicable)
    if (response.data && typeof response.data === 'object') {
      // Add specific validation logic based on your API requirements
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Sanitize error message
   * @param {string} errorMessage - Original error message
   * @returns {string} Sanitized error message
   * @private
   */
  _sanitizeErrorMessage(errorMessage) {
    // Remove potentially sensitive information from error messages
    return errorMessage
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]')
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [TOKEN]')
      .replace(/\bsk-[A-Za-z0-9]{48}\b/g, '[TOKEN]')
      .replace(/\bhf_[a-zA-Z0-9]{37}\b/g, '[TOKEN]')
      .replace(/api[_-]?key[:\s=]+[A-Za-z0-9._-]+/gi, 'api_key=[KEY]');
  }

  /**
   * Generate signature secret
   * @returns {string} Signature secret
   * @private
   */
  _generateSignatureSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SecureApiService;