const crypto = require('crypto');

/**
 * Privacy Service
 * Handles data privacy, anonymization, and protection controls
 */
class PrivacyService {
  constructor() {
    this.config = {
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,
      dataRetentionPeriod: parseInt(process.env.DATA_RETENTION_HOURS) || 24, // hours
      anonymizationEnabled: process.env.ANONYMIZATION_ENABLED !== 'false',
      encryptionKey: process.env.PRIVACY_ENCRYPTION_KEY || this._generateMasterKey()
    };

    // PII patterns for detection and anonymization
    this.piiPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Simple name pattern
      address: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi,
      zipCode: /\b\d{5}(?:-\d{4})?\b/g,
      ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
    };

    // Sensitive keywords that should be handled carefully
    this.sensitiveKeywords = [
      'password', 'secret', 'token', 'key', 'private',
      'confidential', 'personal', 'medical', 'health',
      'diagnosis', 'medication', 'therapy', 'counseling'
    ];
  }

  /**
   * Anonymize user message by removing or masking PII
   * @param {string} message - Original message
   * @param {Object} options - Anonymization options
   * @returns {Object} Anonymized message and metadata
   */
  anonymizeMessage(message, options = {}) {
    if (!message || typeof message !== 'string') {
      return { anonymizedMessage: message, piiDetected: false, replacements: [] };
    }

    let anonymizedMessage = message;
    const replacements = [];
    let piiDetected = false;

    // Apply PII pattern replacements
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      const matches = message.match(pattern);
      if (matches) {
        piiDetected = true;
        matches.forEach(match => {
          const replacement = this._generateReplacement(type, match);
          anonymizedMessage = anonymizedMessage.replace(match, replacement);
          replacements.push({
            type,
            original: match.substring(0, 3) + '***', // Partial for logging
            replacement,
            position: message.indexOf(match)
          });
        });
      }
    }

    // Check for sensitive keywords
    const sensitiveFound = this._detectSensitiveKeywords(message);
    if (sensitiveFound.length > 0) {
      piiDetected = true;
      replacements.push({
        type: 'sensitive_keywords',
        keywords: sensitiveFound,
        action: 'flagged_for_review'
      });
    }

    return {
      anonymizedMessage,
      piiDetected,
      replacements,
      sensitiveKeywords: sensitiveFound,
      confidence: this._calculateAnonymizationConfidence(replacements)
    };
  }

  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @param {string} context - Context for key derivation
   * @returns {Object} Encrypted data with metadata
   */
  encryptData(data, context = 'default') {
    if (!data) {
      return null;
    }

    try {
      // Generate salt and IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);

      // Derive key from master key and context
      const key = this._deriveKey(this.config.encryptionKey, salt, context);

      // Create cipher
      const cipher = crypto.createCipher('aes-256-cbc', key.toString('hex'));

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: null, // Not available with CBC mode
        algorithm: 'aes-256-cbc',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Encryption failed:', error.message);
      // Return unencrypted data with flag if encryption fails
      return {
        encrypted: data,
        salt: null,
        iv: null,
        tag: null,
        algorithm: 'none',
        timestamp: new Date().toISOString(),
        encryptionFailed: true
      };
    }
  }

  /**
   * Decrypt encrypted data
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} context - Context for key derivation
   * @returns {string} Decrypted data
   */
  decryptData(encryptedData, context = 'default') {
    if (!encryptedData || !encryptedData.encrypted) {
      return null;
    }

    // If encryption failed originally, return the data as-is
    if (encryptedData.encryptionFailed) {
      return encryptedData.encrypted;
    }

    // If no salt/iv, assume it wasn't actually encrypted
    if (!encryptedData.salt || !encryptedData.iv) {
      return encryptedData.encrypted;
    }

    try {
      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');

      // Derive key
      const key = this._deriveKey(this.config.encryptionKey, salt, context);

      // Create decipher
      const decipher = crypto.createDecipher('aes-256-cbc', key.toString('hex'));

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      // Return original data if decryption fails
      return encryptedData.encrypted;
    }
  }

  /**
   * Sanitize data for logging
   * @param {Object} data - Data to sanitize
   * @param {Array} sensitiveFields - Fields to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeForLogging(data, sensitiveFields = []) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const defaultSensitiveFields = [
      'password', 'token', 'key', 'secret', 'apiKey',
      'sessionId', 'userId', 'email', 'phone', 'address'
    ];

    const fieldsToSanitize = [...defaultSensitiveFields, ...sensitiveFields];
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone

    this._sanitizeObject(sanitized, fieldsToSanitize);
    return sanitized;
  }

  /**
   * Generate privacy report for a session
   * @param {Object} sessionData - Session data to analyze
   * @returns {Object} Privacy report
   */
  generatePrivacyReport(sessionData) {
    const report = {
      sessionId: sessionData.id ? sessionData.id.substring(0, 8) + '...' : 'unknown',
      timestamp: new Date().toISOString(),
      dataRetention: sessionData.privacy?.dataRetention || 'session-only',
      encryptionStatus: sessionData.privacy?.encryptionEnabled ? 'enabled' : 'disabled',
      anonymizationStatus: sessionData.privacy?.anonymized ? 'enabled' : 'disabled',
      piiDetected: false,
      sensitiveDataHandling: {
        messagesProcessed: 0,
        piiInstances: 0,
        encryptedFields: 0,
        anonymizedFields: 0
      },
      complianceStatus: 'compliant',
      recommendations: []
    };

    // Analyze messages for PII
    if (sessionData.context && sessionData.context.messages) {
      report.sensitiveDataHandling.messagesProcessed = sessionData.context.messages.length;

      sessionData.context.messages.forEach(message => {
        if (message.content) {
          const analysis = this.anonymizeMessage(message.content);
          if (analysis.piiDetected) {
            report.piiDetected = true;
            report.sensitiveDataHandling.piiInstances += analysis.replacements.length;
          }
        }

        if (message.encrypted) {
          report.sensitiveDataHandling.encryptedFields++;
        }
      });
    }

    // Generate recommendations
    if (report.piiDetected && !sessionData.privacy?.anonymized) {
      report.recommendations.push('Enable anonymization to better protect user privacy');
    }

    if (!sessionData.privacy?.encryptionEnabled) {
      report.recommendations.push('Enable encryption for sensitive data protection');
    }

    if (sessionData.privacy?.dataRetention !== 'session-only') {
      report.recommendations.push('Consider session-only data retention for maximum privacy');
    }

    return report;
  }

  /**
   * Validate privacy compliance
   * @param {Object} data - Data to validate
   * @param {Object} requirements - Compliance requirements
   * @returns {Object} Compliance validation result
   */
  validatePrivacyCompliance(data, requirements = {}) {
    const validation = {
      compliant: true,
      issues: [],
      score: 100,
      requirements: {
        dataMinimization: requirements.dataMinimization !== false,
        encryption: requirements.encryption !== false,
        anonymization: requirements.anonymization !== false,
        retention: requirements.retention !== false
      }
    };

    // Check data minimization
    if (validation.requirements.dataMinimization) {
      const unnecessaryData = this._detectUnnecessaryData(data);
      if (unnecessaryData.length > 0) {
        validation.issues.push({
          type: 'data_minimization',
          message: 'Unnecessary data detected',
          details: unnecessaryData
        });
        validation.score -= 20;
      }
    }

    // Check encryption
    if (validation.requirements.encryption) {
      if (!data.privacy?.encryptionEnabled) {
        validation.issues.push({
          type: 'encryption',
          message: 'Encryption not enabled for sensitive data'
        });
        validation.score -= 25;
      }
    }

    // Check anonymization
    if (validation.requirements.anonymization) {
      if (!data.privacy?.anonymized) {
        validation.issues.push({
          type: 'anonymization',
          message: 'Data anonymization not enabled'
        });
        validation.score -= 20;
      }
    }

    // Check retention policy
    if (validation.requirements.retention) {
      if (data.privacy?.dataRetention !== 'session-only') {
        validation.issues.push({
          type: 'retention',
          message: 'Data retention period may be too long'
        });
        validation.score -= 15;
      }
    }

    validation.compliant = validation.issues.length === 0;
    return validation;
  }

  /**
   * Securely delete data
   * @param {Object} data - Data to delete
   * @returns {boolean} Success status
   */
  secureDelete(data) {
    if (!data) {
      return true;
    }

    try {
      // Overwrite sensitive fields with random data
      this._overwriteWithRandomData(data);
      return true;
    } catch (error) {
      console.error('Secure delete failed:', error);
      return false;
    }
  }

  /**
   * Generate replacement for PII
   * @param {string} type - PII type
   * @param {string} original - Original value
   * @returns {string} Replacement value
   * @private
   */
  _generateReplacement(type, original) {
    const replacements = {
      email: '[EMAIL_REDACTED]',
      phone: '[PHONE_REDACTED]',
      ssn: '[SSN_REDACTED]',
      creditCard: '[CARD_REDACTED]',
      name: '[NAME_REDACTED]',
      address: '[ADDRESS_REDACTED]',
      zipCode: '[ZIP_REDACTED]',
      ipAddress: '[IP_REDACTED]'
    };

    return replacements[type] || '[PII_REDACTED]';
  }

  /**
   * Detect sensitive keywords in text
   * @param {string} text - Text to analyze
   * @returns {Array} Found sensitive keywords
   * @private
   */
  _detectSensitiveKeywords(text) {
    const lowerText = text.toLowerCase();
    return this.sensitiveKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Calculate anonymization confidence score
   * @param {Array} replacements - Replacements made
   * @returns {number} Confidence score (0-100)
   * @private
   */
  _calculateAnonymizationConfidence(replacements) {
    if (replacements.length === 0) {
      return 100; // No PII detected
    }

    // Base confidence starts high and decreases with more PII found
    let confidence = 90;
    
    replacements.forEach(replacement => {
      switch (replacement.type) {
        case 'email':
        case 'phone':
        case 'ssn':
          confidence -= 15; // High-risk PII
          break;
        case 'name':
        case 'address':
          confidence -= 10; // Medium-risk PII
          break;
        default:
          confidence -= 5; // Low-risk PII
      }
    });

    return Math.max(confidence, 0);
  }

  /**
   * Derive encryption key from master key
   * @param {string} masterKey - Master encryption key
   * @param {Buffer} salt - Salt for key derivation
   * @param {string} context - Context string
   * @returns {Buffer} Derived key
   * @private
   */
  _deriveKey(masterKey, salt, context) {
    const keyMaterial = masterKey + context;
    return crypto.pbkdf2Sync(
      keyMaterial,
      salt,
      this.config.keyDerivationIterations,
      32, // 256 bits
      'sha256'
    );
  }

  /**
   * Generate master encryption key
   * @returns {string} Master key
   * @private
   */
  _generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sanitize object recursively
   * @param {Object} obj - Object to sanitize
   * @param {Array} sensitiveFields - Fields to sanitize
   * @private
   */
  _sanitizeObject(obj, sensitiveFields) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          this._sanitizeObject(obj[key], sensitiveFields);
        }
      }
    }
  }

  /**
   * Detect unnecessary data that could be minimized
   * @param {Object} data - Data to analyze
   * @returns {Array} List of unnecessary data fields
   * @private
   */
  _detectUnnecessaryData(data) {
    const unnecessary = [];
    
    // Check for overly detailed user agent strings
    if (data.security?.userAgent && data.security.userAgent.length > 100) {
      unnecessary.push('userAgent_too_detailed');
    }

    // Check for excessive message history
    if (data.context?.messages && data.context.messages.length > 50) {
      unnecessary.push('excessive_message_history');
    }

    return unnecessary;
  }

  /**
   * Overwrite data with random values for secure deletion
   * @param {Object} data - Data to overwrite
   * @private
   */
  _overwriteWithRandomData(data) {
    if (typeof data === 'string') {
      return crypto.randomBytes(data.length).toString('hex');
    }

    if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          if (typeof data[key] === 'string') {
            data[key] = crypto.randomBytes(Math.max(data[key].length, 16)).toString('hex');
          } else if (typeof data[key] === 'object') {
            this._overwriteWithRandomData(data[key]);
          }
        }
      }
    }
  }
}

module.exports = PrivacyService;