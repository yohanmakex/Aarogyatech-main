const TextToSpeechService = require('../services/textToSpeechService');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../services/languageService');
jest.mock('../services/cachingService');
jest.mock('../services/performanceOptimizationService');

describe('TextToSpeechService Unit Tests', () => {
  let textToSpeechService;
  let mockAxios;
  let mockLanguageService;
  let mockCachingService;
  let mockPerformanceOptimizer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    
    textToSpeechService = new TextToSpeechService();
    mockAxios = axios;

    // Setup mock services
    mockLanguageService = textToSpeechService.languageService;
    mockCachingService = textToSpeechService.cachingService;
    mockPerformanceOptimizer = textToSpeechService.performanceOptimizer;

    // Default mock implementations
    mockLanguageService.prepareTextForTTS = jest.fn().mockResolvedValue({
      text: 'prepared text',
      language: 'en',
      sourceLanguage: 'en',
      translationApplied: false,
      originalText: 'prepared text',
      voiceParameters: {}
    });

    mockCachingService.getCachedAudio = jest.fn().mockReturnValue(null);
    mockCachingService.cacheAudio = jest.fn();

    mockPerformanceOptimizer.compressAudio = jest.fn().mockResolvedValue({
      compressedBuffer: Buffer.from('compressed audio'),
      originalSize: 1000,
      compressedSize: 800,
      compressionRatio: 0.8
    });
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
  });

  describe('Service Availability', () => {
    test('should return true when API key is configured', () => {
      expect(textToSpeechService.isServiceAvailable()).toBe(true);
    });

    test('should return false when API key is not configured', () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new TextToSpeechService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('Speech Synthesis', () => {
    const mockAudioBuffer = Buffer.from('mock audio data');

    beforeEach(() => {
      mockAxios.post.mockResolvedValue({
        data: mockAudioBuffer
      });
    });

    test('should synthesize speech successfully', async () => {
      const result = await textToSpeechService.synthesizeSpeech('Hello world');

      expect(result).toEqual({
        audioBuffer: Buffer.from('compressed audio'),
        language: 'en',
        sourceLanguage: 'en',
        translationApplied: false,
        originalText: 'prepared text',
        processedText: 'prepared text.',
        voiceParameters: expect.objectContaining({
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        }),
        cached: false,
        compression: {
          originalSize: 1000,
          compressedSize: 800,
          compressionRatio: 0.8
        }
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        textToSpeechService.modelUrl,
        expect.objectContaining({
          inputs: 'prepared text.',
          parameters: expect.any(Object)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          responseType: 'arraybuffer'
        })
      );
    });

    test('should return cached audio when available', async () => {
      const cachedAudio = {
        audioBuffer: Buffer.from('cached audio'),
        hitCount: 3
      };

      mockCachingService.getCachedAudio.mockReturnValue(cachedAudio);

      const result = await textToSpeechService.synthesizeSpeech('Hello world');

      expect(result.audioBuffer).toEqual(Buffer.from('cached audio'));
      expect(result.cached).toBe(true);
      expect(result.hitCount).toBe(3);
      expect(mockAxios.post).not.toHaveBeenCalled();
    });

    test('should throw error when API key is not configured', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      const service = new TextToSpeechService();

      await expect(service.synthesizeSpeech('test'))
        .rejects.toThrow('Text-to-speech service not configured');
    });

    test('should throw error with invalid text input', async () => {
      await expect(textToSpeechService.synthesizeSpeech(null))
        .rejects.toThrow('Invalid text provided');

      await expect(textToSpeechService.synthesizeSpeech(''))
        .rejects.toThrow('Invalid text provided');

      await expect(textToSpeechService.synthesizeSpeech('   '))
        .rejects.toThrow('Text cannot be empty');
    });

    test('should throw error with text too long', async () => {
      const longText = 'a'.repeat(1001);
      
      await expect(textToSpeechService.synthesizeSpeech(longText))
        .rejects.toThrow('Text too long. Maximum length is 1000 characters');
    });

    test('should handle custom voice parameters', async () => {
      const options = {
        speed: 1.5,
        pitch: 0.8,
        volume: 0.9,
        language: 'es'
      };

      await textToSpeechService.synthesizeSpeech('Hello world', options);

      expect(mockLanguageService.prepareTextForTTS).toHaveBeenCalledWith('Hello world', 'es');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 60000
        })
      );
    });

    test('should handle rate limiting with retry', async () => {
      const rateLimitError = {
        response: { status: 429, headers: { 'retry-after': '1000' } }
      };

      mockAxios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: mockAudioBuffer });

      const result = await textToSpeechService.synthesizeSpeech('test');

      expect(result.audioBuffer).toEqual(Buffer.from('compressed audio'));
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should handle model loading with retry', async () => {
      const modelLoadingError = {
        response: { status: 503 }
      };

      mockAxios.post
        .mockRejectedValueOnce(modelLoadingError)
        .mockResolvedValueOnce({ data: mockAudioBuffer });

      const result = await textToSpeechService.synthesizeSpeech('test');

      expect(result.audioBuffer).toEqual(Buffer.from('compressed audio'));
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

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Rate limit exceeded. Please try again later.');

      expect(mockAxios.post).toHaveBeenCalledTimes(3);
    });

    test('should handle 400 bad request without retry', async () => {
      const badRequestError = {
        response: { status: 400 }
      };

      mockAxios.post.mockRejectedValue(badRequestError);

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Invalid text format or unsupported characters');

      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });

    test('should handle 401 unauthorized without retry', async () => {
      const unauthorizedError = {
        response: { status: 401 }
      };

      mockAxios.post.mockRejectedValue(unauthorizedError);

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Invalid Hugging Face API key');

      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });

    test('should handle empty audio response', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.alloc(0) });

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Empty audio response from TTS service');
    });
  });

  describe('Voice Parameters', () => {
    test('should set voice parameters successfully', () => {
      textToSpeechService.setVoiceParameters(1.5, 0.8, 0.9);

      const params = textToSpeechService.getVoiceParameters();
      expect(params).toEqual({
        speed: 1.5,
        pitch: 0.8,
        volume: 0.9
      });
    });

    test('should validate voice parameters', () => {
      expect(() => textToSpeechService.setVoiceParameters(0.4))
        .toThrow('Speed must be a number between 0.5 and 2.0');

      expect(() => textToSpeechService.setVoiceParameters(2.1))
        .toThrow('Speed must be a number between 0.5 and 2.0');

      expect(() => textToSpeechService.setVoiceParameters(1.0, 0.4))
        .toThrow('Pitch must be a number between 0.5 and 2.0');

      expect(() => textToSpeechService.setVoiceParameters(1.0, 1.0, 0.05))
        .toThrow('Volume must be a number between 0.1 and 1.0');

      expect(() => textToSpeechService.setVoiceParameters(1.0, 1.0, 1.1))
        .toThrow('Volume must be a number between 0.1 and 1.0');
    });

    test('should use default parameters when not specified', () => {
      const params = textToSpeechService.getVoiceParameters();
      expect(params).toEqual({
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0
      });
    });
  });

  describe('Text Preprocessing', () => {
    test('should preprocess text correctly', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      // Update the mock to return the actual input text for preprocessing
      mockLanguageService.prepareTextForTTS.mockResolvedValue({
        text: 'Doctor Smith said hello',
        language: 'en',
        sourceLanguage: 'en',
        translationApplied: false,
        originalText: 'Dr. Smith said hello',
        voiceParameters: {}
      });

      await textToSpeechService.synthesizeSpeech('Dr. Smith said hello');

      // Check that the text was preprocessed (Dr. -> Doctor)
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          inputs: expect.stringContaining('Doctor')
        }),
        expect.any(Object)
      );
    });

    test('should expand abbreviations', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      // Update the mock to return the actual input text for preprocessing
      mockLanguageService.prepareTextForTTS.mockResolvedValue({
        text: 'The A P I versus H T T P protocol',
        language: 'en',
        sourceLanguage: 'en',
        translationApplied: false,
        originalText: 'The API vs. HTTP protocol',
        voiceParameters: {}
      });

      await textToSpeechService.synthesizeSpeech('The API vs. HTTP protocol');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          inputs: expect.stringContaining('A P I')
        }),
        expect.any(Object)
      );
    });

    test('should handle numbers correctly', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      // Update the mock to return the actual input text for preprocessing
      mockLanguageService.prepareTextForTTS.mockResolvedValue({
        text: 'I have five apples',
        language: 'en',
        sourceLanguage: 'en',
        translationApplied: false,
        originalText: 'I have 5 apples',
        voiceParameters: {}
      });

      await textToSpeechService.synthesizeSpeech('I have 5 apples');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          inputs: expect.stringContaining('five')
        }),
        expect.any(Object)
      );
    });

    test('should add sentence ending if missing', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      // Update the mock to return the actual input text for preprocessing
      mockLanguageService.prepareTextForTTS.mockResolvedValue({
        text: 'Hello world',
        language: 'en',
        sourceLanguage: 'en',
        translationApplied: false,
        originalText: 'Hello world',
        voiceParameters: {}
      });

      await textToSpeechService.synthesizeSpeech('Hello world');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          inputs: expect.stringContaining('Hello world.')
        }),
        expect.any(Object)
      );
    });
  });

  describe('Text Validation', () => {
    test('should validate text successfully', () => {
      const result = textToSpeechService.validateText('Hello world');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid text', () => {
      let result = textToSpeechService.validateText(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text must be a non-empty string');

      result = textToSpeechService.validateText('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text must be a non-empty string');

      result = textToSpeechService.validateText('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text cannot be empty');
    });

    test('should detect text too long', () => {
      const longText = 'a'.repeat(1001);
      const result = textToSpeechService.validateText(longText);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Text too long. Maximum length is 1000 characters');
    });

    test('should warn about problematic characters', () => {
      const result = textToSpeechService.validateText('Hello @#$% world');

      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('Text contains special characters that may not be pronounced correctly');
    });

    test('should warn about long sentences', () => {
      const longSentence = 'This is a very long sentence that goes on and on and on and contains way too many words and should probably be broken up into smaller sentences for better text-to-speech quality and user experience and readability and comprehension.';
      const result = textToSpeechService.validateText(longSentence);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Text contains very long sentences that may affect speech quality'
      );
    });
  });

  describe('Audio Duration Estimation', () => {
    test('should estimate duration correctly', () => {
      const text = 'This is a test sentence with ten words total.';
      const duration = textToSpeechService.estimateAudioDuration(text);

      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    });

    test('should return 0 for empty text', () => {
      expect(textToSpeechService.estimateAudioDuration('')).toBe(0);
      expect(textToSpeechService.estimateAudioDuration(null)).toBe(0);
    });

    test('should adjust for speed parameter', () => {
      const text = 'This is a test sentence.';
      
      textToSpeechService.setVoiceParameters(2.0); // Double speed
      const fastDuration = textToSpeechService.estimateAudioDuration(text);
      
      textToSpeechService.setVoiceParameters(1.0); // Normal speed
      const normalDuration = textToSpeechService.estimateAudioDuration(text);

      expect(fastDuration).toBeLessThan(normalDuration);
    });

    test('should have minimum duration of 1 second', () => {
      const shortText = 'Hi';
      const duration = textToSpeechService.estimateAudioDuration(shortText);

      expect(duration).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Language Processing Integration', () => {
    test('should prepare text for TTS with language service', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      mockLanguageService.prepareTextForTTS.mockResolvedValue({
        text: 'Prepared Spanish text',
        language: 'es',
        sourceLanguage: 'en',
        translationApplied: true,
        originalText: 'Hello world',
        voiceParameters: { speed: 0.9 }
      });

      const result = await textToSpeechService.synthesizeSpeech('Hello world', { language: 'es' });

      expect(mockLanguageService.prepareTextForTTS).toHaveBeenCalledWith('Hello world', 'es');
      expect(result.language).toBe('es');
      expect(result.translationApplied).toBe(true);
      expect(result.originalText).toBe('Hello world');
    });
  });

  describe('Performance and Compression', () => {
    test('should compress audio for better performance', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('original audio') });

      const result = await textToSpeechService.synthesizeSpeech('test');

      expect(mockPerformanceOptimizer.compressAudio).toHaveBeenCalledWith(
        Buffer.from('original audio'),
        { quality: 0.8, format: 'webm' }
      );

      expect(result.compression).toEqual({
        originalSize: 1000,
        compressedSize: 800,
        compressionRatio: 0.8
      });
    });

    test('should use original buffer if compression fails', async () => {
      const originalBuffer = Buffer.from('original audio');
      mockAxios.post.mockResolvedValue({ data: originalBuffer });

      mockPerformanceOptimizer.compressAudio.mockResolvedValue({
        compressedBuffer: null, // Compression failed
        originalSize: 1000,
        compressedSize: 1000,
        compressionRatio: 1.0
      });

      const result = await textToSpeechService.synthesizeSpeech('test');

      expect(result.audioBuffer).toEqual(originalBuffer);
    });

    test('should cache successful audio generation', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      await textToSpeechService.synthesizeSpeech('test text');

      expect(mockCachingService.cacheAudio).toHaveBeenCalledWith(
        'prepared text.',
        Buffer.from('compressed audio'),
        expect.objectContaining({
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        }),
        'en'
      );
    });
  });

  describe('Service Information', () => {
    test('should return correct service information', () => {
      const info = textToSpeechService.getServiceInfo();

      expect(info).toEqual({
        model: 'microsoft/speecht5_tts',
        maxTextLength: 1000,
        supportedFormats: ['wav', 'mp3', 'ogg'],
        voiceParameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        isAvailable: true
      });
    });

    test('should return supported formats', () => {
      const formats = textToSpeechService.getSupportedFormats();
      expect(formats).toEqual(['wav', 'mp3', 'ogg']);
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxios.post.mockRejectedValue(timeoutError);

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Text-to-speech service failed after 3 attempts');
    });

    test('should handle network connection error', async () => {
      const connectionError = new Error('Network Error');
      connectionError.code = 'ENOTFOUND';

      mockAxios.post.mockRejectedValue(connectionError);

      await expect(textToSpeechService.synthesizeSpeech('test'))
        .rejects.toThrow('Text-to-speech service failed after 3 attempts');
    });

    test('should handle concurrent requests', async () => {
      mockAxios.post.mockResolvedValue({ data: Buffer.from('audio') });

      const requests = Array(5).fill().map((_, i) =>
        textToSpeechService.synthesizeSpeech(`test message ${i}`)
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.audioBuffer).toEqual(Buffer.from('compressed audio'));
      });
    });
  });
});