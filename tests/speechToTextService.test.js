const SpeechToTextService = require('../services/speechToTextService');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('SpeechToTextService', () => {
  let service;
  
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    service = new SpeechToTextService();
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
      service = new SpeechToTextService();
      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('validateAudioFile', () => {
    it('should validate a correct audio file', () => {
      const buffer = Buffer.from('fake audio data');
      const result = service.validateAudioFile(buffer, 'audio/wav');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.from('');
      const result = service.validateAudioFile(buffer, 'audio/wav');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Audio file is empty or invalid');
    });

    it('should reject unsupported format', () => {
      const buffer = Buffer.from('fake audio data');
      const result = service.validateAudioFile(buffer, 'video/mp4');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported audio format: video/mp4. Supported formats: audio/wav, audio/mpeg, audio/mp3, audio/webm, audio/ogg');
    });

    it('should reject files that are too large', () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB
      const result = service.validateAudioFile(largeBuffer, 'audio/wav');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Audio file too large. Maximum size is 25MB');
    });
  });

  describe('transcribeAudio', () => {
    const mockAudioBuffer = Buffer.from('fake audio data');

    it('should successfully transcribe audio', async () => {
      const mockResponse = {
        data: { text: 'Hello world' }
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.transcribeAudio(mockAudioBuffer, 'audio/wav');
      
      expect(result).toBe('Hello world');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-inference.huggingface.co/models/openai/whisper-small',
        mockAudioBuffer,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'audio/wav'
          })
        })
      );
    });

    it('should handle array response format', async () => {
      const mockResponse = {
        data: [{ text: 'Hello world from array' }]
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.transcribeAudio(mockAudioBuffer, 'audio/wav');
      
      expect(result).toBe('Hello world from array');
    });

    it('should throw error when API key is not configured', async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      service = new SpeechToTextService();

      await expect(service.transcribeAudio(mockAudioBuffer, 'audio/wav'))
        .rejects.toThrow('Hugging Face API key not configured');
    });

    it('should throw error for invalid audio buffer', async () => {
      await expect(service.transcribeAudio(null, 'audio/wav'))
        .rejects.toThrow('Invalid audio buffer provided');

      await expect(service.transcribeAudio(Buffer.from(''), 'audio/wav'))
        .rejects.toThrow('Invalid audio buffer provided');
    });

    it('should throw error for unsupported content type', async () => {
      await expect(service.transcribeAudio(mockAudioBuffer, 'video/mp4'))
        .rejects.toThrow('Unsupported audio format: video/mp4');
    });

    it('should handle rate limit errors with retry', async () => {
      const rateLimitError = {
        response: { 
          status: 429,
          headers: { 'retry-after': '1000' }
        }
      };
      const successResponse = {
        data: { text: 'Success after retry' }
      };

      mockedAxios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const result = await service.transcribeAudio(mockAudioBuffer, 'audio/wav');
      
      expect(result).toBe('Success after retry');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle model loading errors with retry', async () => {
      const modelLoadingError = {
        response: { status: 503 }
      };
      const successResponse = {
        data: { text: 'Success after model loaded' }
      };

      mockedAxios.post
        .mockRejectedValueOnce(modelLoadingError)
        .mockResolvedValueOnce(successResponse);

      const result = await service.transcribeAudio(mockAudioBuffer, 'audio/wav');
      
      expect(result).toBe('Success after model loaded');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 bad request errors', async () => {
      const badRequestError = {
        response: { status: 400 }
      };

      mockedAxios.post.mockRejectedValue(badRequestError);

      await expect(service.transcribeAudio(mockAudioBuffer, 'audio/wav'))
        .rejects.toThrow('Invalid audio format or corrupted audio file');
      
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 unauthorized errors', async () => {
      const unauthorizedError = {
        response: { status: 401 }
      };

      mockedAxios.post.mockRejectedValue(unauthorizedError);

      await expect(service.transcribeAudio(mockAudioBuffer, 'audio/wav'))
        .rejects.toThrow('Invalid Hugging Face API key');
      
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should fail after maximum retries', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(service.transcribeAudio(mockAudioBuffer, 'audio/wav'))
        .rejects.toThrow('Speech-to-text service failed after 3 attempts: Network error');
      
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should handle unexpected response format', async () => {
      const mockResponse = {
        data: { unexpected: 'format' }
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(service.transcribeAudio(mockAudioBuffer, 'audio/wav'))
        .rejects.toThrow('Unexpected response format from Hugging Face API');
    });
  });

  describe('convertAudioFormat', () => {
    it('should return the same buffer for now', async () => {
      const buffer = Buffer.from('audio data');
      const result = await service.convertAudioFormat(buffer, 'audio/mp3');
      
      expect(result).toBe(buffer);
    });
  });
});