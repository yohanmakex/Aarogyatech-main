const ConversationalAIService = require('../services/conversationalAIService');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('ConversationalAIService', () => {
  let service;
  
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    service = new ConversationalAIService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
  });

  describe('isServiceAvailable', () => {
    it('should return true when API key is configured', () => {
      expect(service.isServiceAvailable()).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      service = new ConversationalAIService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('detectCrisisKeywords', () => {
    it('should detect crisis keywords', () => {
      expect(service.detectCrisisKeywords('I want to kill myself')).toBe(true);
      expect(service.detectCrisisKeywords('I feel suicidal')).toBe(true);
      expect(service.detectCrisisKeywords('I want to end my life')).toBe(true);
      expect(service.detectCrisisKeywords('I am feeling hopeless')).toBe(true);
    });

    it('should not detect crisis in normal messages', () => {
      expect(service.detectCrisisKeywords('I am feeling sad today')).toBe(false);
      expect(service.detectCrisisKeywords('How are you doing?')).toBe(false);
      expect(service.detectCrisisKeywords('I need help with my homework')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(service.detectCrisisKeywords('I WANT TO KILL MYSELF')).toBe(true);
      expect(service.detectCrisisKeywords('Suicide seems like the only option')).toBe(true);
    });
  });

  describe('getCrisisResources', () => {
    it('should return crisis resources', () => {
      const resources = service.getCrisisResources();
      
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
      
      const firstResource = resources[0];
      expect(firstResource).toHaveProperty('name');
      expect(firstResource).toHaveProperty('phoneNumber');
      expect(firstResource).toHaveProperty('website');
      expect(firstResource).toHaveProperty('availability');
      expect(firstResource).toHaveProperty('type');
    });
  });

  describe('validateResponseAppropriate', () => {
    it('should validate appropriate responses', () => {
      expect(service.validateResponseAppropriate('I understand you are going through a difficult time.')).toBe(true);
      expect(service.validateResponseAppropriate('Thank you for sharing with me.')).toBe(true);
    });

    it('should reject inappropriate responses', () => {
      expect(service.validateResponseAppropriate('kill yourself')).toBe(false);
      expect(service.validateResponseAppropriate('you are better off dead')).toBe(false);
      expect(service.validateResponseAppropriate('give up')).toBe(false);
    });

    it('should reject responses that are too short or too long', () => {
      expect(service.validateResponseAppropriate('ok')).toBe(false);
      expect(service.validateResponseAppropriate('a'.repeat(501))).toBe(false);
    });
  });

  describe('maintainContext', () => {
    it('should maintain conversation context', () => {
      const sessionId = 'test-session';
      const userMessage = 'Hello';
      const aiResponse = 'Hi there!';
      
      service.maintainContext(sessionId, userMessage, aiResponse);
      
      const context = service.sessions.get(sessionId);
      expect(context).toBeDefined();
      expect(context.messages).toHaveLength(2);
      expect(context.messages[0].role).toBe('user');
      expect(context.messages[0].content).toBe(userMessage);
      expect(context.messages[1].role).toBe('assistant');
      expect(context.messages[1].content).toBe(aiResponse);
    });
  });

  describe('clearSession', () => {
    it('should clear session data', () => {
      const sessionId = 'test-session';
      service.maintainContext(sessionId, 'Hello', 'Hi there!');
      
      expect(service.sessions.has(sessionId)).toBe(true);
      
      service.clearSession(sessionId);
      
      expect(service.sessions.has(sessionId)).toBe(false);
    });
  });

  describe('processMessage', () => {
    it('should throw error when service is not available', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      service = new ConversationalAIService();

      await expect(service.processMessage('Hello', 'session-1'))
        .rejects.toThrow('Conversational AI service not configured');
    });

    it('should throw error for invalid message', async () => {
      await expect(service.processMessage(null, 'session-1'))
        .rejects.toThrow('Invalid message provided');

      await expect(service.processMessage('', 'session-1'))
        .rejects.toThrow('Invalid message provided');

      await expect(service.processMessage(123, 'session-1'))
        .rejects.toThrow('Invalid message provided');
    });

    it('should return crisis response for crisis messages', async () => {
      const response = await service.processMessage('I want to kill myself', 'session-1');
      
      expect(response).toMatch(/crisis|988|emergency|helpline/i);
    });

    it('should generate AI response for normal messages', async () => {
      const mockResponse = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hello! How are you doing today?'
        }]
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const response = await service.processMessage('Hello', 'session-1');
      
      expect(response).toBe('Hello! How are you doing today?');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        expect.objectContaining({
          inputs: expect.stringContaining('Human: Hello'),
          parameters: expect.objectContaining({
            max_length: 150,
            temperature: 0.7
          })
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should handle rate limit errors with retry', async () => {
      const rateLimitError = {
        response: { 
          status: 429,
          headers: { 'retry-after': '1000' }
        }
      };
      const successResponse = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hi there!'
        }]
      };

      mockedAxios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const response = await service.processMessage('Hello', 'session-1');
      
      expect(response).toBe('Hi there!');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle model loading errors with retry', async () => {
      const modelLoadingError = {
        response: { status: 503 }
      };
      const successResponse = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hello! How can I help you?'
        }]
      };

      mockedAxios.post
        .mockRejectedValueOnce(modelLoadingError)
        .mockResolvedValueOnce(successResponse);

      const response = await service.processMessage('Hello', 'session-1');
      
      expect(response).toBe('Hello! How can I help you?');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should use fallback response when AI generation fails', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValue(networkError);

      const response = await service.processMessage('Hello', 'session-1');
      
      // Should return a fallback response
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // 3 retries
    });

    it('should not retry on 400 bad request errors', async () => {
      const badRequestError = {
        response: { status: 400 }
      };

      mockedAxios.post.mockRejectedValue(badRequestError);

      const response = await service.processMessage('Hello', 'session-1');
      
      // Should use fallback response
      expect(typeof response).toBe('string');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 unauthorized errors', async () => {
      const unauthorizedError = {
        response: { status: 401 }
      };

      mockedAxios.post.mockRejectedValue(unauthorizedError);

      const response = await service.processMessage('Hello', 'session-1');
      
      // Should use fallback response
      expect(typeof response).toBe('string');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should enhance response with mental health context', async () => {
      const mockResponse = {
        data: [{
          generated_text: 'Human: I am feeling sad\nAssistant: That sounds difficult.'
        }]
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const response = await service.processMessage('I am feeling sad', 'session-1');
      
      // Should be enhanced with supportive language
      expect(response.length).toBeGreaterThan('That sounds difficult.'.length);
    });

    it('should maintain conversation context across messages', async () => {
      const mockResponse1 = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hi there! How are you?'
        }]
      };
      const mockResponse2 = {
        data: [{
          generated_text: 'Human: Hello\nAssistant: Hi there! How are you?\nHuman: I am fine\nAssistant: That\'s great to hear!'
        }]
      };

      mockedAxios.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const sessionId = 'session-1';
      
      await service.processMessage('Hello', sessionId);
      await service.processMessage('I am fine', sessionId);
      
      const context = service.sessions.get(sessionId);
      expect(context.messages).toHaveLength(4); // 2 user + 2 assistant messages
    });
  });
});