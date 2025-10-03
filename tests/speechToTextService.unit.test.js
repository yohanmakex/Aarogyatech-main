const SpeechToTextService = require('../services/speechToTextService');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../services/errorHandlingService');
jest.mock('../services/languageService');

describe('SpeechToTextService Unit Tests', () => {
  let speechToTextService;
  let mockAxios;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variable
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    
    // Create service instance
    speechToTextService = new SpeechToTextService();
    mockAxios = axios;
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
  });

  describe('Service Availability', () => {
    test('should return true when API key is configured', () => {
      expect(speechToTextService.isServiceAvailable()).toBe(true);
    });

    test('should return false when API key is not configured', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new SpeechToTextService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('Audio Transcription', () => {
    const mockAudioBuffer = Buffer.from('mock audio data');
    const mockSuccessResponse = {
      data: {
        text: 'Hello, this is a test transcription.'
      }
    };

    beforeEach(() => {
      // Mock language service
      speechToTextService.languageService = {
        processSpeechToTextResult: jest.fn().mockResolvedValue({
          transcription: 'Hello, this is a test transcription.',
          originalTranscription: 'Hello, this is a test transcription.',
          detectedLanguage: 'en',
          expectedLanguage: 'auto',
          translationApplied: false,
          confidence: 0.95
        })
      };
    });

    test('should successfully transcribe audio with valid input', async () => {
      mockAxios.post.mockResolvedValue(mockSuccessResponse);

      const result = await speechToTextService.transcribeAudio(mockAudioBuffer);

      expect(result).toEqual({
        text: 'Hello, this is a test transcription.',
        originalText: 'Hello, this is a test transcription.',
        detectedLanguage: 'en',
        expectedLanguage: 'auto',
        translationApplied: false,
        confidence: 0.95
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        speechToTextService.modelUrl,
        mockAudioBuffer,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'audio/wav'
          })
        })
      );
    });

    test('should handle array response format', async () => {
      const arrayResponse = {
        data: [{ text: 'Array format response' }]
      };
      mockAxios.post.mockResolvedValue(arrayResponse);

      speechToTextService.languageService.processSpeechToTextResult.mockResolvedValue({
        transcription: 'Array format response',
        originalTranscription: 'Array format response',
        detectedLanguage: 'en',
        expectedLanguage: 'auto',
        translationApplied: false,
        confidence: 0.9
      });

      const result = await speechToTextService.transcribeAudio(mockAudioBuffer);

      expect(result.text).toBe('Array format response');
    });

    test('should throw error when API key is not configured', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new SpeechToTextService();

      await expect(service.transcribeAudio(mockAudioBuffer))
        .rejects.toThrow('Hugging Face API key not configured');
    });

    test('should throw error with invalid audio buffer', async () => {
      await expect(speechToTextService.transcribeAudio(null))
        .rejects.toThrow('Invalid audio buffer provided');

      await expect(speechToTextService.transcribeAudio(Buffer.alloc(0)))
        .rejects.toThrow('Invalid audio buffer provided');
    });

    test('should throw error with unsupported content type', async () => {
      await expect(speechToTextService.transcribeAudio(mockAudioBuffer, 'audio/unsupported'))
        .rejects.toThrow('Unsupported audio format: audio/unsupported');
    });

    test('should handle rate limiting with retry', async () => {
      const rateLimitError = {
        response: { status: 429, headers: { 'retry-after': '1000' } }
      };

      mockAxios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await speechToTextService.transcribeAudio(mockAudioBuffer);

      expect(result.text).toBe('Hello, this is a test transcription.');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should handle model loading with retry', async () => {
      const modelLoadingError = {
        response: { status: 503 }
      };

      mockAxios.post
        .mockRejectedValueOnce(modelLoadingError)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await speechToTextService.transcribeAudio(mockAudioBuffer);

      expect(result.text).toBe('Hello, this is a test transcription.');
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should throw error after max retries exceeded', async () => {
      const rateLimitError = {
        response: { 
          status: 429,
          headers: { 'retry-after': '1000' }
        }
      };

      mockAxios.post.mockRejectedValue(rateLimitError);

      await expect(speechToTextService.transcribeAudio(mockAudioBuffer))
        .rejects.toThrow('Rate limit exceeded. Please try again later.');

      expect(mockAxios.post).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    test('should handle 400 bad request without retry', async () => {
      const badRequestError = {
        response: { status: 400 }
      };

      mockAxios.post.mockRejectedValue(badRequestError);

      await expect(speechToTextService.transcribeAudio(mockAudioBuffer))
        .rejects.toThrow('Invalid audio format or corrupted audio file');

      expect(mockAxios.post).toHaveBeenCalledTimes(1); // No retry for 400
    });

    test('should handle 401 unauthorized without retry', async () => {
      const unauthorizedError = {
        response: { status: 401 }
      };

      mockAxios.post.mockRejectedValue(unauthorizedError);

      await expect(speechToTextService.transcribeAudio(mockAudioBuffer))
        .rejects.toThrow('Invalid Hugging Face API key');

      expect(mockAxios.post).toHaveBeenCalledTimes(1); // No retry for 401
    });

    test('should handle unexpected response format', async () => {
      const unexpectedResponse = {
        data: { unexpected: 'format' }
      };

      mockAxios.post.mockResolvedValue(unexpectedResponse);

      await expect(speechToTextService.transcribeAudio(mockAudioBuffer))
        .rejects.toThrow('Unexpected response format from Hugging Face API');
    });
  });

  describe('Audio File Validation', () => {
    test('should validate audio file successfully', () => {
      const validBuffer = Buffer.from('valid audio data');
      const result = speechToTextService.validateAudioFile(validBuffer, 'audio/wav');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect empty audio file', () => {
      const result = speechToTextService.validateAudioFile(Buffer.alloc(0), 'audio/wav');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Audio file is empty or invalid');
    });

    test('should detect file too large', () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB
      const result = speechToTextService.validateAudioFile(largeBuffer, 'audio/wav');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Audio file too large. Maximum size is 25MB');
    });

    test('should detect unsupported format', () => {
      const validBuffer = Buffer.from('valid audio data');
      const result = speechToTextService.validateAudioFile(validBuffer, 'audio/unsupported');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported audio format: audio/unsupported. Supported formats: audio/wav, audio/mpeg, audio/mp3, audio/webm, audio/ogg');
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxios.post.mockRejectedValue(timeoutError);

      await expect(speechToTextService.transcribeAudio(Buffer.from('test')))
        .rejects.toThrow('Speech-to-text service failed after 3 attempts');
    });

    test('should handle network connection error', async () => {
      const connectionError = new Error('Network Error');
      connectionError.code = 'ENOTFOUND';

      mockAxios.post.mockRejectedValue(connectionError);

      await expect(speechToTextService.transcribeAudio(Buffer.from('test')))
        .rejects.toThrow('Speech-to-text service failed after 3 attempts');
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple concurrent requests', async () => {
      const mockSuccessResponse = {
        data: {
          text: 'Hello, this is a test transcription.'
        }
      };
      
      mockAxios.post.mockResolvedValue(mockSuccessResponse);

      // Ensure language service is properly mocked for all requests
      speechToTextService.languageService.processSpeechToTextResult = jest.fn().mockResolvedValue({
        transcription: 'Hello, this is a test transcription.',
        originalTranscription: 'Hello, this is a test transcription.',
        detectedLanguage: 'en',
        expectedLanguage: 'auto',
        translationApplied: false,
        confidence: 0.95
      });

      const requests = Array(5).fill().map(() => 
        speechToTextService.transcribeAudio(Buffer.from('test audio'))
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.text).toBe('Hello, this is a test transcription.');
      });
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxios.post.mockRejectedValue(timeoutError);

      await expect(speechToTextService.transcribeAudio(Buffer.from('test')))
        .rejects.toThrow('Speech-to-text service failed after 3 attempts');
    });
  });

  describe('Language Processing Integration', () => {
    test('should process transcription with language service', async () => {
      const mockSuccessResponse = {
        data: {
          text: 'Hello, this is a test transcription.'
        }
      };
      
      mockAxios.post.mockResolvedValue(mockSuccessResponse);

      const mockLanguageResult = {
        transcription: 'Processed transcription',
        originalTranscription: 'Hello, this is a test transcription.',
        detectedLanguage: 'en',
        expectedLanguage: 'es',
        translationApplied: true,
        confidence: 0.88
      };

      speechToTextService.languageService.processSpeechToTextResult
        .mockResolvedValue(mockLanguageResult);

      const result = await speechToTextService.transcribeAudio(
        Buffer.from('test'), 'audio/wav', 'es'
      );

      expect(speechToTextService.languageService.processSpeechToTextResult)
        .toHaveBeenCalledWith('Hello, this is a test transcription.', 'es');

      expect(result).toEqual({
        text: 'Processed transcription',
        originalText: 'Hello, this is a test transcription.',
        detectedLanguage: 'en',
        expectedLanguage: 'es',
        translationApplied: true,
        confidence: 0.88
      });
    });
  });
});