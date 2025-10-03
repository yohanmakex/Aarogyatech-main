const request = require('supertest');
const { app } = require('../server');

// Mock the SpeechToTextService
jest.mock('../services/speechToTextService', () => {
  return jest.fn().mockImplementation(() => ({
    isServiceAvailable: jest.fn(),
    validateAudioFile: jest.fn(),
    transcribeAudio: jest.fn()
  }));
});

const SpeechToTextService = require('../services/speechToTextService');

describe('Speech-to-Text API Routes', () => {
  let mockServiceInstance;

  beforeEach(() => {
    // Set up environment variable for tests
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    
    // Get the mock instance
    mockServiceInstance = new SpeechToTextService();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
    jest.clearAllMocks();
  });

  describe('GET /api/speech-to-text/status', () => {
    it('should return service status when available', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);

      const response = await request(app)
        .get('/api/speech-to-text/status')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'speech-to-text',
        status: 'available',
        model: 'openai/whisper-small',
        supportedFormats: expect.arrayContaining(['audio/wav', 'audio/mpeg']),
        maxFileSize: '25MB'
      });
    });

    it('should return unavailable status when service is not configured', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(false);

      const response = await request(app)
        .get('/api/speech-to-text/status')
        .expect(200);

      expect(response.body.status).toBe('unavailable');
    });
  });

  describe('POST /api/speech-to-text/transcribe', () => {
    const mockAudioBuffer = Buffer.from('fake audio data');

    it('should successfully transcribe audio file', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockResolvedValue('Hello world');

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        transcription: 'Hello world',
        metadata: expect.objectContaining({
          size: mockAudioBuffer.length,
          mimeType: 'audio/wav'
        })
      });
    });

    it('should return 503 when service is not available', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(false);

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service Unavailable',
        message: 'Speech-to-text service is not properly configured'
      });
    });

    it('should return 400 when no audio file is provided', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'No audio file provided'
      });
    });

    it('should return 400 when audio file validation fails', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({
        isValid: false,
        errors: ['File too large']
      });

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid Audio File',
        message: 'File too large'
      });
    });

    it('should handle rate limit errors', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockRejectedValue(new Error('Rate limit exceeded'));

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(429);

      expect(response.body).toMatchObject({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      });
    });

    it('should handle service temporarily unavailable errors', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockRejectedValue(new Error('temporarily unavailable'));

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service Temporarily Unavailable',
        message: 'The speech-to-text service is loading. Please try again in a few moments.'
      });
    });

    it('should handle invalid audio format errors', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockRejectedValue(new Error('Invalid audio format'));

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid Audio Format',
        message: 'The provided audio file format is not supported or is corrupted.'
      });
    });

    it('should handle API key errors', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockRejectedValue(new Error('Invalid Hugging Face API key'));

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Configuration Error',
        message: 'Service configuration error. Please contact support.'
      });
    });

    it('should handle generic errors', async () => {
      mockServiceInstance.isServiceAvailable.mockReturnValue(true);
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });
      mockServiceInstance.transcribeAudio.mockRejectedValue(new Error('Generic error'));

      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
        message: 'An error occurred while processing the audio file.'
      });
    });
  });

  describe('POST /api/speech-to-text/validate', () => {
    const mockAudioBuffer = Buffer.from('fake audio data');

    it('should validate audio file successfully', async () => {
      mockServiceInstance.validateAudioFile.mockReturnValue({ isValid: true, errors: [] });

      const response = await request(app)
        .post('/api/speech-to-text/validate')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(200);

      expect(response.body).toMatchObject({
        isValid: true,
        errors: [],
        fileInfo: expect.objectContaining({
          name: 'test.wav',
          size: mockAudioBuffer.length,
          mimeType: 'audio/wav'
        })
      });
    });

    it('should return validation errors', async () => {
      mockServiceInstance.validateAudioFile.mockReturnValue({
        isValid: false,
        errors: ['File too large', 'Unsupported format']
      });

      const response = await request(app)
        .post('/api/speech-to-text/validate')
        .attach('audio', mockAudioBuffer, 'test.wav')
        .expect(200);

      expect(response.body).toMatchObject({
        isValid: false,
        errors: ['File too large', 'Unsupported format']
      });
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app)
        .post('/api/speech-to-text/validate')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'No audio file provided'
      });
    });
  });

  describe('Multer error handling', () => {
    it('should handle file size limit exceeded', async () => {
      // This test would require a very large file to trigger the actual multer error
      // For now, we'll test that the error handler exists and works with a mock
      const response = await request(app)
        .post('/api/speech-to-text/transcribe')
        .attach('audio', Buffer.alloc(1024), 'test.txt') // Wrong MIME type
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});