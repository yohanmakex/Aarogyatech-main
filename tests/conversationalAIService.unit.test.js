const ConversationalAIService = require('../services/conversationalAIService');
const axios = require('axios');

// Mock all dependencies
jest.mock('axios');
jest.mock('../services/crisisDetectionService');
jest.mock('../services/mentalHealthContextService');
jest.mock('../services/sessionManagementService');
jest.mock('../services/privacyService');
jest.mock('../services/secureApiService');
jest.mock('../services/errorHandlingService');
jest.mock('../services/fallbackResponseService');
jest.mock('../services/languageService');
jest.mock('../services/performanceOptimizationService');
jest.mock('../services/cachingService');

describe('ConversationalAIService Unit Tests', () => {
  let conversationalAIService;
  let mockAxios;
  let mockCrisisDetection;
  let mockMentalHealthContext;
  let mockSessionManager;
  let mockPrivacyService;
  let mockLanguageService;
  let mockCachingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    
    conversationalAIService = new ConversationalAIService();
    mockAxios = axios;

    // Setup mock services
    mockCrisisDetection = conversationalAIService.crisisDetection;
    mockMentalHealthContext = conversationalAIService.mentalHealthContext;
    mockSessionManager = conversationalAIService.sessionManager;
    mockPrivacyService = conversationalAIService.privacyService;
    mockLanguageService = conversationalAIService.languageService;
    mockCachingService = conversationalAIService.cachingService;

    // Mock secure API service
    conversationalAIService.secureApiService = {
      encryptRequestPayload: jest.fn().mockReturnValue({}),
      makeSecureRequest: jest.fn().mockResolvedValue({
        success: false // Force fallback to regular method
      })
    };

    // Default mock implementations
    mockCrisisDetection.analyzeMessage = jest.fn().mockReturnValue({
      isCrisis: false,
      severity: 'none',
      keywords: [],
      response: null
    });

    mockSessionManager.getSession = jest.fn().mockReturnValue({
      context: { messages: [] },
      createdAt: new Date(),
      lastActivity: new Date()
    });

    mockSessionManager.createSession = jest.fn().mockReturnValue({
      sessionId: 'test-session-id'
    });

    mockSessionManager.validateSessionSecurity = jest.fn().mockReturnValue({
      valid: true
    });

    mockSessionManager.updateSessionContext = jest.fn();

    mockPrivacyService.anonymizeMessage = jest.fn().mockReturnValue({
      anonymizedMessage: 'test message',
      piiDetected: false,
      confidence: 1.0
    });

    mockLanguageService.detectLanguage = jest.fn().mockResolvedValue('en');
    mockLanguageService.processAIResponse = jest.fn().mockResolvedValue({
      response: 'AI response',
      translationApplied: false,
      originalResponse: 'AI response'
    });

    mockCachingService.getCachedResponse = jest.fn().mockReturnValue(null);
    mockCachingService.cacheResponse = jest.fn();

    mockMentalHealthContext.enhanceResponse = jest.fn().mockReturnValue({
      enhancedResponse: 'Enhanced AI response',
      type: 'supportive'
    });

    mockMentalHealthContext.validateMentalHealthResponse = jest.fn().mockReturnValue({
      isAppropriate: true,
      issues: []
    });
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
  });

  describe('Service Availability', () => {
    test('should return true when API key is configured', () => {
      expect(conversationalAIService.isServiceAvailable()).toBe(true);
    });

    test('should return false when API key is not configured', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new ConversationalAIService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('Message Processing', () => {
    const mockAIResponse = {
      data: [{
        generated_text: 'Human: test message\nAssistant: This is an AI response'
      }]
    };

    test('should process normal message successfully', async () => {
      mockAxios.post.mockResolvedValue(mockAIResponse);

      const result = await conversationalAIService.processMessage(
        'test message',
        'session-id',
        { ipAddress: '127.0.0.1' }
      );

      expect(result).toEqual({
        message: 'AI response',
        isCrisis: false,
        crisisData: null,
        mentalHealthEnhancement: {
          enhancedResponse: 'Enhanced AI response',
          type: 'supportive'
        },
        sessionId: 'session-id',
        languageInfo: {
          userLanguage: 'en',
          detectedLanguage: 'en',
          translationApplied: false,
          originalResponse: 'AI response'
        },
        privacyInfo: {
          piiDetected: false,
          anonymized: true,
          confidence: 1.0
        }
      });

      expect(mockCrisisDetection.analyzeMessage).toHaveBeenCalledWith('test message', 'session-id');
      expect(mockPrivacyService.anonymizeMessage).toHaveBeenCalledWith('test message');
      expect(mockMentalHealthContext.enhanceResponse).toHaveBeenCalled();
    });

    test('should handle crisis detection', async () => {
      mockCrisisDetection.analyzeMessage.mockReturnValue({
        isCrisis: true,
        severity: 'high',
        keywords: ['suicide'],
        response: 'Crisis response message',
        escalationLevel: 2,
        resources: [{ name: 'Crisis Hotline', phone: '988' }]
      });

      mockCrisisDetection.createEscalationWorkflow.mockReturnValue({
        sessionId: 'session-id',
        severity: 'high',
        steps: []
      });

      mockLanguageService.getMentalHealthResourcesForLanguage.mockReturnValue([]);

      const result = await conversationalAIService.processMessage(
        'I want to hurt myself',
        'session-id'
      );

      expect(result.isCrisis).toBe(true);
      expect(result.crisisData.severity).toBe('high');
      expect(result.crisisData.keywords).toContain('suicide');
      expect(mockCrisisDetection.createEscalationWorkflow).toHaveBeenCalled();
    });

    test('should return cached response when available', async () => {
      mockCachingService.getCachedResponse.mockReturnValue({
        response: 'Cached response',
        hitCount: 5
      });

      const result = await conversationalAIService.processMessage(
        'test message',
        'session-id'
      );

      expect(result.message).toBe('Cached response');
      expect(result.cached).toBe(true);
      expect(mockAxios.post).not.toHaveBeenCalled();
    });

    test('should handle PII detection and anonymization', async () => {
      mockPrivacyService.anonymizeMessage.mockReturnValue({
        anonymizedMessage: 'My name is [NAME]',
        piiDetected: true,
        confidence: 0.95
      });

      mockAxios.post.mockResolvedValue(mockAIResponse);

      const result = await conversationalAIService.processMessage(
        'My name is John Doe',
        'session-id'
      );

      expect(result.privacyInfo.piiDetected).toBe(true);
      expect(result.privacyInfo.anonymized).toBe(true);
      expect(mockPrivacyService.anonymizeMessage).toHaveBeenCalledWith('My name is John Doe');
    });

    test('should throw error when API key is not configured', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new ConversationalAIService();

      await expect(service.processMessage('test', 'session-id'))
        .rejects.toThrow('Conversational AI service not configured');
    });

    test('should throw error with invalid message', async () => {
      await expect(conversationalAIService.processMessage(null, 'session-id'))
        .rejects.toThrow('Invalid message provided');

      await expect(conversationalAIService.processMessage('', 'session-id'))
        .rejects.toThrow('Invalid message provided');
    });

    test('should handle session security validation failure', async () => {
      mockSessionManager.validateSessionSecurity.mockReturnValue({
        valid: false,
        reason: 'Invalid IP address'
      });

      await expect(conversationalAIService.processMessage('test', 'session-id'))
        .rejects.toThrow('Session security validation failed: Invalid IP address');
    });
  });

  describe('AI Response Generation', () => {
    test('should generate AI response with conversation context', async () => {
      const mockSession = {
        context: {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ]
        }
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);

      const mockResponse = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hi there!\nHuman: How are you?\nAssistant: I am doing well, thank you for asking!'
        }]
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await conversationalAIService.processMessage(
        'How are you?',
        'session-id'
      );

      expect(mockAxios.post).toHaveBeenCalledWith(
        conversationalAIService.modelUrl,
        expect.objectContaining({
          inputs: expect.stringContaining('Human: Hello\nAssistant: Hi there!')
        }),
        expect.any(Object)
      );

      expect(result.message).toBe('AI response');
    });

    test('should handle API rate limiting', async () => {
      const rateLimitError = {
        response: { status: 429, headers: { 'retry-after': '1000' } }
      };

      mockAxios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: [{ generated_text: 'Human: test\nAssistant: Success after retry' }]
        });

      const result = await conversationalAIService.processMessage('test', 'session-id');

      expect(result.message).toBe('AI response');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should handle model loading error', async () => {
      const modelLoadingError = {
        response: { status: 503 }
      };

      mockAxios.post
        .mockRejectedValueOnce(modelLoadingError)
        .mockResolvedValueOnce({
          data: [{ generated_text: 'Human: test\nAssistant: Success after retry' }]
        });

      const result = await conversationalAIService.processMessage('test', 'session-id');

      expect(result.message).toBe('AI response');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should use fallback response when AI generation fails', async () => {
      const networkError = new Error('Network error');
      mockAxios.post.mockRejectedValue(networkError);

      // Mock error handler to return fallback
      conversationalAIService.errorHandler = {
        handleError: jest.fn().mockResolvedValue({
          fallback: { message: 'Fallback response' },
          error: { type: 'network' }
        })
      };

      // Mock fallback service
      conversationalAIService.fallbackService = {
        generateFallbackResponse: jest.fn().mockReturnValue({
          message: 'Fallback response'
        })
      };

      // Mock language service to process fallback response
      mockLanguageService.processAIResponse.mockResolvedValue({
        response: 'Fallback response',
        translationApplied: false,
        originalResponse: 'Fallback response'
      });

      const result = await conversationalAIService.processMessage('test', 'session-id');

      expect(result.message).toBe('Fallback response');
      expect(result.mentalHealthEnhancement.type).toBe('fallback');
    });
  });

  describe('Mental Health Response Enhancement', () => {
    test('should enhance response appropriately', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: I feel sad\nAssistant: I understand you are feeling sad.' }]
      });

      mockMentalHealthContext.enhanceResponse.mockReturnValue({
        enhancedResponse: 'I understand you are feeling sad. It\'s okay to feel this way, and I\'m here to support you.',
        type: 'supportive',
        copingStrategies: ['breathing exercises']
      });

      const result = await conversationalAIService.processMessage('I feel sad', 'session-id');

      expect(result.mentalHealthEnhancement.type).toBe('supportive');
      expect(result.mentalHealthEnhancement.copingStrategies).toContain('breathing exercises');
    });

    test('should validate enhanced response appropriateness', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant: Original response' }]
      });

      mockMentalHealthContext.enhanceResponse.mockReturnValue({
        enhancedResponse: 'Inappropriate enhanced response',
        type: 'enhanced'
      });

      mockMentalHealthContext.validateMentalHealthResponse.mockReturnValue({
        isAppropriate: false,
        issues: ['inappropriate language']
      });

      const result = await conversationalAIService.processMessage('test', 'session-id');

      // Should fall back to original response when enhancement fails validation
      expect(result.message).toBe('AI response'); // Original response after language processing
    });
  });

  describe('Language Processing', () => {
    test('should handle non-English input', async () => {
      mockLanguageService.detectLanguage.mockResolvedValue('es');
      mockLanguageService.translateText = jest.fn().mockResolvedValue('translated message');

      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: translated message\nAssistant: English response' }]
      });

      mockLanguageService.processAIResponse.mockResolvedValue({
        response: 'Respuesta en español',
        translationApplied: true,
        originalResponse: 'English response'
      });

      const result = await conversationalAIService.processMessage(
        'mensaje en español',
        'session-id',
        {},
        'es'
      );

      expect(result.languageInfo.detectedLanguage).toBe('es');
      expect(result.languageInfo.translationApplied).toBe(true);
      expect(result.message).toBe('Respuesta en español');
    });

    test('should handle translation errors gracefully', async () => {
      mockLanguageService.detectLanguage.mockResolvedValue('fr');
      mockLanguageService.translateText = jest.fn().mockRejectedValue(new Error('Translation failed'));

      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: message français\nAssistant: Response' }]
      });

      // Should continue with original message when translation fails
      const result = await conversationalAIService.processMessage(
        'message français',
        'session-id'
      );

      expect(result.languageInfo.detectedLanguage).toBe('fr');
      // The service should use the original message when translation fails
      expect(mockAxios.post).toHaveBeenCalled();
      // Just verify that the service handled the translation failure gracefully
      expect(result.message).toBe('AI response');
    });
  });

  describe('Session Management', () => {
    test('should create new session when none exists', async () => {
      mockSessionManager.getSession.mockReturnValue(null);
      mockSessionManager.createSession.mockReturnValue({
        sessionId: 'new-session-id'
      });
      mockSessionManager.getSession.mockReturnValueOnce(null).mockReturnValue({
        context: { messages: [] }
      });

      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant: Response' }]
      });

      const result = await conversationalAIService.processMessage(
        'test',
        'old-session-id',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        encryptionEnabled: true,
        anonymized: true
      });

      expect(result.sessionId).toBe('new-session-id');
    });

    test('should update session context with messages', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant: Response' }]
      });

      await conversationalAIService.processMessage('test message', 'session-id');

      expect(mockSessionManager.updateSessionContext).toHaveBeenCalledWith(
        'session-id',
        expect.objectContaining({
          message: expect.objectContaining({
            role: 'user',
            content: 'test message'
          })
        })
      );

      expect(mockSessionManager.updateSessionContext).toHaveBeenCalledWith(
        'session-id',
        expect.objectContaining({
          message: expect.objectContaining({
            role: 'assistant',
            content: 'AI response'
          })
        })
      );
    });

    test('should clear session successfully', () => {
      mockSessionManager.clearSessionContext.mockReturnValue(true);
      mockCrisisDetection.clearSession = jest.fn();

      const result = conversationalAIService.clearSession('session-id');

      expect(result).toBe(true);
      expect(mockSessionManager.clearSessionContext).toHaveBeenCalledWith('session-id');
      expect(mockCrisisDetection.clearSession).toHaveBeenCalledWith('session-id');
    });

    test('should destroy session successfully', () => {
      mockSessionManager.destroySession.mockReturnValue(true);
      mockCrisisDetection.clearSession = jest.fn();

      const result = conversationalAIService.destroySession('session-id');

      expect(result).toBe(true);
      expect(mockSessionManager.destroySession).toHaveBeenCalledWith('session-id');
      expect(mockCrisisDetection.clearSession).toHaveBeenCalledWith('session-id');
    });
  });

  describe('Performance and Caching', () => {
    test('should cache successful responses', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant: Response' }]
      });

      await conversationalAIService.processMessage('test message', 'session-id');

      expect(mockCachingService.cacheResponse).toHaveBeenCalledWith(
        'test message',
        'AI response',
        expect.objectContaining({
          enhancementType: 'supportive'
        }),
        'en'
      );
    });

    test('should handle concurrent requests', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant: Response' }]
      });

      const requests = Array(3).fill().map((_, i) =>
        conversationalAIService.processMessage(`message ${i}`, `session-${i}`)
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.sessionId).toBe(`session-${i}`);
      });
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle unexpected API response format', async () => {
      mockAxios.post.mockResolvedValue({
        data: { unexpected: 'format' }
      });

      conversationalAIService.errorHandler = {
        handleError: jest.fn().mockResolvedValue({
          fallback: { message: 'Fallback for unexpected format' },
          error: { type: 'format' }
        })
      };

      // Mock fallback service for this test
      conversationalAIService.fallbackService = {
        generateFallbackResponse: jest.fn().mockReturnValue({
          message: 'Fallback for unexpected format'
        })
      };

      // Mock language service to process fallback response
      mockLanguageService.processAIResponse.mockResolvedValue({
        response: 'Fallback for unexpected format',
        translationApplied: false,
        originalResponse: 'Fallback for unexpected format'
      });

      const result = await conversationalAIService.processMessage('test', 'session-id');

      expect(result.message).toBe('Fallback for unexpected format');
    });

    test('should handle empty AI response', async () => {
      mockAxios.post.mockResolvedValue({
        data: [{ generated_text: 'Human: test\nAssistant:' }] // Empty assistant response
      });

      conversationalAIService.fallbackService = {
        generateFallbackResponse: jest.fn().mockReturnValue({
          message: 'I apologize, but I\'m having trouble generating a response right now.'
        })
      };

      const result = await conversationalAIService.processMessage('test', 'session-id');

      expect(conversationalAIService.fallbackService.generateFallbackResponse).toHaveBeenCalled();
    });
  });
});