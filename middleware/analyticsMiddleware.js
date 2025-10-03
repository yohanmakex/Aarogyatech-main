const AnalyticsService = require('../services/analyticsService');

class AnalyticsMiddleware {
  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  // Middleware to track API usage
  trackApiUsage = (req, res, next) => {
    const startTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to capture response data
    res.end = function(chunk, encoding) {
      const responseTime = Date.now() - startTime;
      
      // Only track certain endpoints
      if (this.shouldTrackEndpoint(req.path)) {
        this.recordApiInteraction(req, res, responseTime);
      }
      
      // Call original end function
      originalEnd.call(res, chunk, encoding);
    }.bind(this);
    
    next();
  };

  shouldTrackEndpoint(path) {
    const trackableEndpoints = [
      '/api/speech-to-text',
      '/api/conversational-ai',
      '/api/text-to-speech'
    ];
    
    return trackableEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  recordApiInteraction(req, res, responseTime) {
    try {
      // Extract user information
      const userId = this.extractUserId(req);
      const sessionId = this.extractSessionId(req);
      
      // Determine interaction type
      const interactionType = this.determineInteractionType(req.path);
      
      // Extract additional data from request/response
      const interactionData = {
        sessionId,
        type: interactionType,
        messageLength: this.extractMessageLength(req),
        responseTime,
        sentiment: this.extractSentiment(req, res),
        topics: this.extractTopics(req, res),
        crisisDetected: this.extractCrisisDetection(req, res),
        language: this.extractLanguage(req),
        success: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ipAddress: this.anonymizeIP(req.ip || req.connection.remoteAddress)
      };

      // Record the interaction asynchronously
      setImmediate(() => {
        this.analyticsService.recordUserInteraction(userId, interactionData);
      });
      
    } catch (error) {
      console.error('Failed to record analytics interaction:', error);
      // Don't throw error to avoid disrupting the main request
    }
  }

  extractUserId(req) {
    // Try to get user ID from various sources
    if (req.user && req.user.id) {
      return req.user.id;
    }
    
    if (req.headers['x-user-id']) {
      return req.headers['x-user-id'];
    }
    
    if (req.body && req.body.userId) {
      return req.body.userId;
    }
    
    // Generate anonymous user ID based on IP and User-Agent
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    return `anonymous_${Buffer.from(ip + userAgent).toString('base64').substring(0, 12)}`;
  }

  extractSessionId(req) {
    // Try to get session ID from various sources
    if (req.headers['x-session-id']) {
      return req.headers['x-session-id'];
    }
    
    if (req.body && req.body.sessionId) {
      return req.body.sessionId;
    }
    
    if (req.query && req.query.sessionId) {
      return req.query.sessionId;
    }
    
    // Generate session ID if not provided
    return this.analyticsService.generateSessionId();
  }

  determineInteractionType(path) {
    if (path.includes('speech-to-text')) {
      return 'voice-to-text';
    } else if (path.includes('text-to-speech')) {
      return 'text-to-voice';
    } else if (path.includes('conversational-ai')) {
      return 'text';
    }
    return 'unknown';
  }

  extractMessageLength(req) {
    if (req.body) {
      if (req.body.message) {
        return req.body.message.length;
      }
      if (req.body.text) {
        return req.body.text.length;
      }
      if (req.body.audio && req.body.audio.length) {
        return req.body.audio.length;
      }
    }
    return 0;
  }

  extractSentiment(req, res) {
    // Try to extract sentiment from response
    if (res.locals && res.locals.sentiment) {
      return res.locals.sentiment;
    }
    
    // Try to extract from request if it was analyzed
    if (req.body && req.body.sentiment) {
      return req.body.sentiment;
    }
    
    return null;
  }

  extractTopics(req, res) {
    // Try to extract topics from response
    if (res.locals && res.locals.topics) {
      return res.locals.topics;
    }
    
    // Try to extract from request
    if (req.body && req.body.topics) {
      return req.body.topics;
    }
    
    return [];
  }

  extractCrisisDetection(req, res) {
    // Check if crisis was detected
    if (res.locals && res.locals.crisisDetected) {
      return res.locals.crisisDetected;
    }
    
    if (req.body && req.body.crisisDetected) {
      return req.body.crisisDetected;
    }
    
    return false;
  }

  extractLanguage(req) {
    // Try to get language from various sources
    if (req.headers['x-language']) {
      return req.headers['x-language'];
    }
    
    if (req.body && req.body.language) {
      return req.body.language;
    }
    
    if (req.query && req.query.language) {
      return req.query.language;
    }
    
    // Default to English
    return 'en';
  }

  anonymizeIP(ip) {
    if (!ip) return 'unknown';
    
    // Simple IP anonymization - remove last octet for IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    
    // For IPv6 or other formats, just return a hash
    return `hashed_${Buffer.from(ip).toString('base64').substring(0, 8)}`;
  }

  // Middleware to add analytics metadata to responses
  addAnalyticsMetadata = (req, res, next) => {
    // Initialize locals for analytics data
    res.locals.analyticsData = {
      startTime: Date.now(),
      endpoint: req.path,
      method: req.method
    };
    
    next();
  };

  // Helper method to manually record interaction (for use in route handlers)
  recordInteraction(userId, interactionData) {
    try {
      return this.analyticsService.recordUserInteraction(userId, interactionData);
    } catch (error) {
      console.error('Failed to record manual interaction:', error);
      return null;
    }
  }

  // Get analytics service instance (for use in other parts of the application)
  getAnalyticsService() {
    return this.analyticsService;
  }
}

module.exports = AnalyticsMiddleware;