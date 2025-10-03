const SessionManagementService = require('../services/sessionManagementService');
const PrivacyService = require('../services/privacyService');
const SecureApiService = require('../services/secureApiService');

describe('Session Management and Privacy Features', () => {
  let sessionManager;
  let privacyService;
  let secureApiService;

  beforeEach(() => {
    sessionManager = new SessionManagementService();
    privacyService = new PrivacyService();
    secureApiService = new SecureApiService();
  });

  afterEach(() => {
    // Clean up any sessions created during tests
    if (sessionManager && sessionManager._cleanup) {
      sessionManager._cleanup();
    }
  });

  describe('SessionManagementService', () => {
    test('should create a secure session', () => {
      const sessionInfo = sessionManager.createSession({
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        encryptionEnabled: true,
        anonymized: true
      });

      expect(sessionInfo).toHaveProperty('sessionId');
      expect(sessionInfo).toHaveProperty('createdAt');
      expect(sessionInfo).toHaveProperty('expiresAt');
      expect(sessionInfo.sessionId).toMatch(/^sess_[a-z0-9]+_[a-f0-9]+$/);
    });

    test('should retrieve session data', () => {
      const sessionInfo = sessionManager.createSession();
      const session = sessionManager.getSession(sessionInfo.sessionId);

      expect(session).toBeTruthy();
      expect(session.id).toBe(sessionInfo.sessionId);
      expect(session.context).toHaveProperty('messages');
      expect(session.privacy).toHaveProperty('encryptionEnabled');
    });

    test('should update session context', () => {
      const sessionInfo = sessionManager.createSession();
      const success = sessionManager.updateSessionContext(sessionInfo.sessionId, {
        message: {
          role: 'user',
          content: 'Hello, how are you?'
        }
      });

      expect(success).toBe(true);
      
      const session = sessionManager.getSession(sessionInfo.sessionId);
      expect(session.context.messages).toHaveLength(1);
      expect(session.context.messages[0].content).toBe('Hello, how are you?');
    });

    test('should clear session context', () => {
      const sessionInfo = sessionManager.createSession();
      sessionManager.updateSessionContext(sessionInfo.sessionId, {
        message: { role: 'user', content: 'Test message' }
      });

      const success = sessionManager.clearSessionContext(sessionInfo.sessionId);
      expect(success).toBe(true);

      const session = sessionManager.getSession(sessionInfo.sessionId);
      expect(session.context.messages).toHaveLength(0);
    });

    test('should destroy session completely', () => {
      const sessionInfo = sessionManager.createSession();
      const success = sessionManager.destroySession(sessionInfo.sessionId);
      
      expect(success).toBe(true);
      
      const session = sessionManager.getSession(sessionInfo.sessionId);
      expect(session).toBeNull();
    });

    test('should validate session security', () => {
      const sessionInfo = sessionManager.createSession({
        ipAddress: '127.0.0.1'
      });

      const validation = sessionManager.validateSessionSecurity(sessionInfo.sessionId, {
        ipAddress: '127.0.0.1'
      });

      expect(validation.valid).toBe(true);
    });

    test('should return session statistics', () => {
      sessionManager.createSession();
      sessionManager.createSession();
      
      const stats = sessionManager.getSessionStats();
      
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PrivacyService', () => {
    test('should anonymize PII in messages', () => {
      const message = 'My email is john.doe@example.com and my phone is 555-123-4567';
      const result = privacyService.anonymizeMessage(message);

      expect(result.piiDetected).toBe(true);
      expect(result.anonymizedMessage).toContain('[EMAIL_REDACTED]');
      expect(result.anonymizedMessage).toContain('[PHONE_REDACTED]');
      expect(result.replacements).toHaveLength(2);
    });

    test('should encrypt and decrypt data', () => {
      const originalData = 'This is sensitive information';
      const encrypted = privacyService.encryptData(originalData, 'test-context');
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('timestamp');

      const decrypted = privacyService.decryptData(encrypted, 'test-context');
      expect(decrypted).toBe(originalData);
    });

    test('should sanitize data for logging', () => {
      const sensitiveData = {
        message: 'Hello world',
        password: 'secret123',
        apiKey: 'sk-1234567890',
        sessionId: 'sess_abc123'
      };

      const sanitized = privacyService.sanitizeForLogging(sensitiveData);
      
      expect(sanitized.message).toBe('Hello world');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.sessionId).toBe('[REDACTED]');
    });

    test('should generate privacy report', () => {
      const sessionData = {
        id: 'sess_test_123',
        privacy: {
          dataRetention: 'session-only',
          encryptionEnabled: true,
          anonymized: true
        },
        context: {
          messages: [
            { content: 'Hello', encrypted: true },
            { content: 'My email is test@example.com', encrypted: false }
          ]
        }
      };

      const report = privacyService.generatePrivacyReport(sessionData);
      
      expect(report).toHaveProperty('sessionId');
      expect(report).toHaveProperty('dataRetention');
      expect(report).toHaveProperty('encryptionStatus');
      expect(report).toHaveProperty('sensitiveDataHandling');
      expect(report.sensitiveDataHandling.messagesProcessed).toBe(2);
    });

    test('should validate privacy compliance', () => {
      const compliantData = {
        privacy: {
          dataRetention: 'session-only',
          encryptionEnabled: true,
          anonymized: true
        }
      };

      const validation = privacyService.validatePrivacyCompliance(compliantData);
      
      expect(validation.compliant).toBe(true);
      expect(validation.score).toBe(100);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('SecureApiService', () => {
    test('should create and verify request signatures', () => {
      const requestData = { message: 'Hello world' };
      const timestamp = new Date().toISOString();
      
      const signature = secureApiService.createRequestSignature(requestData, timestamp);
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');

      const isValid = secureApiService.verifyRequestSignature(requestData, signature, timestamp);
      expect(isValid).toBe(true);
    });

    test('should encrypt and decrypt request payloads', () => {
      const payload = { message: 'Test message', data: { key: 'value' } };
      const sessionId = 'test-session-123';

      const encrypted = secureApiService.encryptRequestPayload(payload, sessionId);
      expect(encrypted).toHaveProperty('data');
      
      // Check if encryption was successful or failed gracefully
      if (encrypted.encrypted) {
        expect(encrypted).toHaveProperty('salt');
        expect(encrypted).toHaveProperty('iv');
        expect(encrypted).toHaveProperty('tag');
      }

      const decrypted = secureApiService.decryptRequestPayload(encrypted, sessionId);
      expect(decrypted).toEqual(payload);
    });

    test('should sanitize API responses', () => {
      const response = {
        data: { message: 'Hello' },
        headers: {
          'authorization': 'Bearer secret-token',
          'content-type': 'application/json',
          'x-api-key': 'secret-key'
        },
        error: 'API key sk-1234567890abcdefghijklmnopqrstuvwxyz123456789012 is invalid'
      };

      const sanitized = secureApiService.sanitizeApiResponse(response);
      
      expect(sanitized.data).toEqual(response.data);
      expect(sanitized.headers).not.toHaveProperty('authorization');
      expect(sanitized.headers).not.toHaveProperty('x-api-key');
      expect(sanitized.headers).toHaveProperty('content-type');
      expect(sanitized.error).toContain('[TOKEN]');
    });

    test('should generate security report', () => {
      const requestStats = {
        totalRequests: 100,
        blockedRequests: 5,
        rateLimitViolations: 2,
        suspiciousPatterns: 1
      };

      const report = secureApiService.generateSecurityReport(requestStats);
      
      expect(report).toHaveProperty('requestSecurity');
      expect(report).toHaveProperty('apiSecurity');
      expect(report).toHaveProperty('recommendations');
      expect(report.requestSecurity.totalRequests).toBe(100);
      expect(report.requestSecurity.blockedRequests).toBe(5);
    });
  });

  describe('Integration Tests', () => {
    test('should work together for secure session with privacy', () => {
      // Create session
      const sessionInfo = sessionManager.createSession({
        encryptionEnabled: true,
        anonymized: true
      });

      // Add message with PII
      const messageWithPII = 'Hello, my email is user@example.com';
      const anonymized = privacyService.anonymizeMessage(messageWithPII);
      
      sessionManager.updateSessionContext(sessionInfo.sessionId, {
        message: {
          role: 'user',
          content: anonymized.anonymizedMessage,
          piiDetected: anonymized.piiDetected
        }
      });

      // Validate session compliance
      const session = sessionManager.getSession(sessionInfo.sessionId);
      const compliance = privacyService.validatePrivacyCompliance(session);
      
      expect(compliance.compliant).toBe(true);
      expect(session.context.messages[0].piiDetected).toBe(true);
      expect(session.context.messages[0].content).toContain('[EMAIL_REDACTED]');
    });
  });
});