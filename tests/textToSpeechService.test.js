const TextToSpeechService = require('../services/textToSpeechService');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('TextToSpeechService', () => {
  let service;
  
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    service = new TextToSpeechService();
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
      service = new TextToSpeechService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('validateText', () => {
    it('should validate correct text', () => {
      const result = service.validateText('Hello world');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty text', () => {
      const result = service.validateText('   '); // whitespace only
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text cannot be empty');
    });

    it('should reject non-string input', () => {
      const result = service.validateText(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text must be a non-empty string');
    });

    it('should reject text that is too long', () => {
      const longText = 'a'.repeat(1001);
      const result = service.validateText(longText);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text too long. Maximum length is 1000 characters');
    });
  });
});