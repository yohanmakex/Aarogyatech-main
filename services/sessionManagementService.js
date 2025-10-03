const crypto = require('crypto');

/**
 * Session Management Service
 * Handles secure session creation, management, and cleanup without permanent storage
 */
class SessionManagementService {
  constructor() {
    // In-memory session storage (no persistent storage for privacy)
    this.sessions = new Map();
    this.sessionTimeouts = new Map();
    
    // Configuration
    this.config = {
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000, // 30 minutes default
      maxSessions: parseInt(process.env.MAX_SESSIONS) || 1000, // Maximum concurrent sessions
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL_MS) || 5 * 60 * 1000, // 5 minutes cleanup
      sessionIdLength: 32, // Length of session ID
      maxContextSize: 50, // Maximum conversation messages to keep
      encryptionKey: process.env.SESSION_ENCRYPTION_KEY || this._generateEncryptionKey()
    };
    
    // Start automatic cleanup
    this._startCleanupTimer();
    
    // Graceful shutdown handler
    this._setupShutdownHandlers();
  }

  /**
   * Create a new secure session
   * @param {Object} options - Session creation options
   * @returns {Object} Session information
   */
  createSession(options = {}) {
    // Generate secure session ID
    const sessionId = this._generateSecureSessionId();
    
    // Create session data
    const sessionData = {
      id: sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      context: {
        messages: [],
        metadata: {}
      },
      privacy: {
        dataRetention: options.dataRetention || 'session-only',
        encryptionEnabled: options.encryptionEnabled !== false,
        anonymized: options.anonymized !== false
      },
      security: {
        ipHash: options.ipAddress ? this._hashIP(options.ipAddress) : null,
        userAgent: options.userAgent ? this._sanitizeUserAgent(options.userAgent) : null,
        requestCount: 0,
        lastRequestTime: new Date()
      }
    };

    // Store session
    this.sessions.set(sessionId, sessionData);
    
    // Set timeout for automatic cleanup
    this._setSessionTimeout(sessionId);
    
    // Check session limits
    this._enforceSessionLimits();
    
    return {
      sessionId,
      createdAt: sessionData.createdAt,
      expiresAt: new Date(Date.now() + this.config.sessionTimeout),
      privacy: sessionData.privacy
    };
  }

  /**
   * Get session data
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data or null if not found
   */
  getSession(sessionId) {
    if (!this._isValidSessionId(sessionId)) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (this._isSessionExpired(session)) {
      this.destroySession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    session.security.lastRequestTime = new Date();
    session.security.requestCount++;

    // Reset timeout
    this._setSessionTimeout(sessionId);

    return session;
  }

  /**
   * Update session context
   * @param {string} sessionId - Session identifier
   * @param {Object} contextUpdate - Context data to add
   * @returns {boolean} Success status
   */
  updateSessionContext(sessionId, contextUpdate) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Add message to context
    if (contextUpdate.message) {
      session.context.messages.push({
        ...contextUpdate.message,
        timestamp: new Date(),
        encrypted: session.privacy.encryptionEnabled
      });

      // Trim context to prevent memory bloat
      this._trimSessionContext(session);
    }

    // Update metadata
    if (contextUpdate.metadata) {
      session.context.metadata = {
        ...session.context.metadata,
        ...contextUpdate.metadata
      };
    }

    return true;
  }

  /**
   * Clear session context while keeping session active
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Success status
   */
  clearSessionContext(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Clear conversation history
    session.context.messages = [];
    session.context.metadata = {};
    
    // Update activity timestamp
    session.lastActivity = new Date();

    return true;
  }

  /**
   * Destroy session and clean up all data
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Success status
   */
  destroySession(sessionId) {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return false;
    }

    // Clear timeout
    this._clearSessionTimeout(sessionId);

    // Securely wipe session data
    const session = this.sessions.get(sessionId);
    if (session) {
      this._secureWipeSessionData(session);
    }

    // Remove from storage
    this.sessions.delete(sessionId);

    return true;
  }

  /**
   * Get session statistics (anonymized)
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const now = new Date();
    let activeSessions = 0;
    let totalRequests = 0;
    const sessionAges = [];

    for (const [sessionId, session] of this.sessions) {
      if (!this._isSessionExpired(session)) {
        activeSessions++;
        totalRequests += session.security.requestCount;
        sessionAges.push(now - session.createdAt);
      }
    }

    return {
      activeSessions,
      totalRequests,
      averageSessionAge: sessionAges.length > 0 ? 
        Math.round(sessionAges.reduce((a, b) => a + b, 0) / sessionAges.length / 1000) : 0,
      memoryUsage: this._getMemoryUsage(),
      timestamp: now
    };
  }

  /**
   * Validate session security
   * @param {string} sessionId - Session identifier
   * @param {Object} requestInfo - Request information for validation
   * @returns {Object} Validation result
   */
  validateSessionSecurity(sessionId, requestInfo = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    // Check rate limiting
    const rateLimitResult = this._checkRateLimit(session);
    if (!rateLimitResult.allowed) {
      return { valid: false, reason: 'rate_limit_exceeded', retryAfter: rateLimitResult.retryAfter };
    }

    // Check IP consistency (if enabled)
    if (requestInfo.ipAddress && session.security.ipHash) {
      const currentIPHash = this._hashIP(requestInfo.ipAddress);
      if (currentIPHash !== session.security.ipHash) {
        console.warn(`IP address mismatch for session ${sessionId.substring(0, 8)}...`);
        // Log but don't block (IP can change legitimately)
      }
    }

    return { valid: true };
  }

  /**
   * Generate secure session ID
   * @returns {string} Secure session ID
   * @private
   */
  _generateSecureSessionId() {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(this.config.sessionIdLength).toString('hex');
    return `sess_${timestamp}_${randomBytes}`;
  }

  /**
   * Validate session ID format
   * @param {string} sessionId - Session ID to validate
   * @returns {boolean} True if valid format
   * @private
   */
  _isValidSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    
    // Check format: sess_timestamp_randomhex
    const pattern = /^sess_[a-z0-9]+_[a-f0-9]+$/;
    return pattern.test(sessionId) && sessionId.length > 20;
  }

  /**
   * Check if session has expired
   * @param {Object} session - Session object
   * @returns {boolean} True if expired
   * @private
   */
  _isSessionExpired(session) {
    const now = new Date();
    const expiryTime = new Date(session.lastActivity.getTime() + this.config.sessionTimeout);
    return now > expiryTime;
  }

  /**
   * Set session timeout for automatic cleanup
   * @param {string} sessionId - Session identifier
   * @private
   */
  _setSessionTimeout(sessionId) {
    // Clear existing timeout
    this._clearSessionTimeout(sessionId);

    // Set new timeout
    const timeoutId = setTimeout(() => {
      this.destroySession(sessionId);
    }, this.config.sessionTimeout);

    this.sessionTimeouts.set(sessionId, timeoutId);
  }

  /**
   * Clear session timeout
   * @param {string} sessionId - Session identifier
   * @private
   */
  _clearSessionTimeout(sessionId) {
    const timeoutId = this.sessionTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  /**
   * Trim session context to prevent memory bloat
   * @param {Object} session - Session object
   * @private
   */
  _trimSessionContext(session) {
    if (session.context.messages.length > this.config.maxContextSize) {
      // Keep only the most recent messages
      const messagesToKeep = this.config.maxContextSize;
      session.context.messages = session.context.messages.slice(-messagesToKeep);
    }
  }

  /**
   * Enforce session limits to prevent resource exhaustion
   * @private
   */
  _enforceSessionLimits() {
    if (this.sessions.size > this.config.maxSessions) {
      // Remove oldest sessions
      const sessionsToRemove = this.sessions.size - this.config.maxSessions;
      const sortedSessions = Array.from(this.sessions.entries())
        .sort(([, a], [, b]) => a.lastActivity - b.lastActivity);

      for (let i = 0; i < sessionsToRemove; i++) {
        const [sessionId] = sortedSessions[i];
        this.destroySession(sessionId);
      }
    }
  }

  /**
   * Hash IP address for privacy
   * @param {string} ipAddress - IP address to hash
   * @returns {string} Hashed IP
   * @private
   */
  _hashIP(ipAddress) {
    return crypto.createHash('sha256')
      .update(ipAddress + this.config.encryptionKey)
      .digest('hex')
      .substring(0, 16); // Truncate for storage efficiency
  }

  /**
   * Sanitize user agent string
   * @param {string} userAgent - User agent string
   * @returns {string} Sanitized user agent
   * @private
   */
  _sanitizeUserAgent(userAgent) {
    // Remove potentially identifying information while keeping basic browser info
    return userAgent
      .replace(/\d+\.\d+\.\d+/g, 'X.X.X') // Remove version numbers
      .substring(0, 100); // Limit length
  }

  /**
   * Check rate limiting for session
   * @param {Object} session - Session object
   * @returns {Object} Rate limit result
   * @private
   */
  _checkRateLimit(session) {
    const now = new Date();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 60; // Max requests per minute

    // Simple rate limiting based on request count and time
    const timeSinceLastRequest = now - session.security.lastRequestTime;
    
    if (timeSinceLastRequest < 1000 && session.security.requestCount > maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((windowMs - timeSinceLastRequest) / 1000)
      };
    }

    return { allowed: true };
  }

  /**
   * Securely wipe session data from memory
   * @param {Object} session - Session object to wipe
   * @private
   */
  _secureWipeSessionData(session) {
    // Overwrite sensitive data with random values
    if (session.context && session.context.messages) {
      session.context.messages.forEach(message => {
        if (message.content) {
          // Overwrite content with random data
          message.content = crypto.randomBytes(message.content.length).toString('hex');
        }
      });
    }

    // Clear references
    session.context = null;
    session.security = null;
    session.privacy = null;
  }

  /**
   * Start automatic cleanup timer
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this._performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Perform cleanup of expired sessions
   * @private
   */
  _performCleanup() {
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (this._isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.destroySession(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Generate encryption key if not provided
   * @returns {string} Encryption key
   * @private
   */
  _generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage info
   * @private
   */
  _getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };
  }

  /**
   * Setup graceful shutdown handlers
   * @private
   */
  _setupShutdownHandlers() {
    // Only set up handlers if not already set up
    if (this._handlersSetup) {
      return;
    }
    
    this._handlersSetup = true;
    
    const cleanup = () => {
      console.log('SessionManagementService: Performing cleanup on shutdown...');
      
      // Clear all timeouts
      for (const timeoutId of this.sessionTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      
      // Clear cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      
      // Securely wipe all session data
      for (const [sessionId, session] of this.sessions) {
        this._secureWipeSessionData(session);
      }
      
      // Clear session storage
      this.sessions.clear();
      this.sessionTimeouts.clear();
      
      console.log('SessionManagementService: Cleanup completed');
    };

    // Only add listeners in non-test environment
    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);
      process.on('exit', cleanup);
    }
    
    // Store cleanup function for manual cleanup in tests
    this._cleanup = cleanup;
  }
}

module.exports = SessionManagementService;