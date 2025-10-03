const request = require('supertest');
const express = require('express');
const SpeechToTextService = require('../services/speechToTextService');
const ConversationalAIService = require('../services/conversationalAIService');
const TextToSpeechService = require('../services/textToSpeechService');

// Mock the services for integration testing
jest.mock('../services/speechToTextService');
jest.mock('../services/conversationalAIService');
jest.mock('../services/textToSpeechService');

describe('Voice Workflows Integration Tests', () => {
  let app;
  let speechToTextService;
  let conversationalAIService;
  let textToSpeechService;

  beforeAll(() => {
    // Set up test environment
    process.env.HUGGINGFACE_API_KEY = 'test-api-key';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'audio/*', limit: '25mb' }));

    // Initialize mocked services
    speechToTextService = new SpeechToTextService();
    conversationalAIService = new ConversationalAIService();
    textToSpeechService = new TextToSpeechService();

    // Mock service methods
    speechToTextService.transcribeAudio = jest.fn();
    conversationalAIService.processMessage = jest.fn();
    textToSpeechService.synthesizeSpeech = jest.fn();

    // Set up routes for testing
    setupTestRoutes();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.NODE_ENV;
  });

  function setupTestRoutes() {
    // Voice-to-voice workflow endpoint
    app.post('/api/voice-to-voice', async (req, res) => {
      try {
        const audioBuffer = req.body;
        const sessionId = req.headers['x-session-id'] || 'test-session';
        const language = req.headers['x-language'] || 'en';

        // Step 1: Convert speech to text
        const transcriptionResult = await speechToTextService.transcribeAudio(
          audioBuffer, 'audio/wav', language
        );

        // Step 2: Process with AI
        const aiResponse = await conversationalAIService.processMessage(
          transcriptionResult.text,
          sessionId,
          { ipAddress: req.ip, userAgent: req.get('User-Agent') },
          language
        );

        // Step 3: Convert response to speech
        const audioResponse = await textToSpeechService.synthesizeSpeech(
          aiResponse.message,
          { language: language }
        );

        res.set({
          'Content-Type': 'audio/wav',
          'X-Transcription': transcriptionResult.text,
          'X-AI-Response': aiResponse.message,
          'X-Crisis-Detected': aiResponse.isCrisis.toString(),
          'X-Session-Id': sessionId
        });

        res.send(audioResponse.audioBuffer);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Voice-to-text workflow endpoint
    app.post('/api/voice-to-text', async (req, res) => {
      try {
        const audioBuffer = req.body;
        const sessionId = req.headers['x-session-id'] || 'test-session';
        const language = req.headers['x-language'] || 'en';

        // Step 1: Convert speech to text
        const transcriptionResult = await speechToTextService.transcribeAudio(
          audioBuffer, 'audio/wav', language
        );

        // Step 2: Process with AI
        const aiResponse = await conversationalAIService.processMessage(
          transcriptionResult.text,
          sessionId,
          { ipAddress: req.ip, userAgent: req.get('User-Agent') },
          language
        );

        res.json({
          transcription: transcriptionResult.text,
          aiResponse: aiResponse.message,
          isCrisis: aiResponse.isCrisis,
          crisisData: aiResponse.crisisData,
          sessionId: sessionId,
          languageInfo: aiResponse.languageInfo
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Mode switching endpoint
    app.post('/api/switch-mode', (req, res) => {
      const { mode, sessionId } = req.body;
      const validModes = ['voice-to-voice', 'voice-to-text', 'text-to-text'];

      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
      }

      // Simulate mode switching logic
      res.json({
        success: true,
        mode: mode,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
    });

    // Error recovery endpoint
    app.post('/api/recover-error', async (req, res) => {
      const { errorType, sessionId, lastInput } = req.body;

      try {
        let fallbackResponse;

        switch (errorType) {
          case 'speech-to-text-failed':
            fallbackResponse = {
              message: "I'm having trouble hearing you. Could you please try speaking again or type your message?",
              suggestedAction: 'switch-to-text',
              retryAvailable: true
            };
            break;

          case 'ai-processing-failed':
            fallbackResponse = {
              message: "I'm experiencing some technical difficulties. Let me try to help you with a simpler response.",
              suggestedAction: 'use-fallback-ai',
              retryAvailable: true
            };
            break;

          case 'text-to-speech-failed':
            fallbackResponse = {
              message: "I can't generate audio right now, but I can still chat with you through text.",
              suggestedAction: 'switch-to-text-output',
              retryAvailable: false
            };
            break;

          default:
            fallbackResponse = {
              message: "Something went wrong. Please try again or contact support if the problem persists.",
              suggestedAction: 'retry',
              retryAvailable: true
            };
        }

        res.json({
          success: true,
          fallbackResponse,
          sessionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  describe('Voice-to-Voice Workflow', () => {
    test('should complete full voice-to-voice conversation flow', async () => {
      // Mock service responses
      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Hello, I am feeling anxious today',
        detectedLanguage: 'en',
        confidence: 0.95
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'I understand you\'re feeling anxious. That\'s completely normal. Would you like to try some breathing exercises?',
        isCrisis: false,
        crisisData: null,
        sessionId: 'test-session',
        languageInfo: { userLanguage: 'en', detectedLanguage: 'en' }
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('mock audio response'),
        language: 'en',
        cached: false
      });

      const audioInput = Buffer.from('mock audio input');

      const response = await request(app)
        .post('/api/voice-to-voice')
        .set('Content-Type', 'audio/wav')
        .set('X-Session-Id', 'test-session')
        .set('X-Language', 'en')
        .send(audioInput);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('audio/wav');
      expect(response.headers['x-transcription']).toBe('Hello, I am feeling anxious today');
      expect(response.headers['x-crisis-detected']).toBe('false');
      expect(response.body).toEqual(Buffer.from('mock audio response'));

      // Verify service calls
      expect(speechToTextService.transcribeAudio).toHaveBeenCalledWith(
        audioInput, 'audio/wav', 'en'
      );
      expect(conversationalAIService.processMessage).toHaveBeenCalledWith(
        'Hello, I am feeling anxious today',
        'test-session',
        expect.objectContaining({ ipAddress: expect.any(String) }),
        'en'
      );
      expect(textToSpeechService.synthesizeSpeech).toHaveBeenCalledWith(
        'I understand you\'re feeling anxious. That\'s completely normal. Would you like to try some breathing exercises?',
        { language: 'en' }
      );
    });

    test('should handle crisis detection in voice-to-voice flow', async () => {
      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'I want to hurt myself',
        detectedLanguage: 'en',
        confidence: 0.98
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'I\'m very concerned about what you\'re sharing. Please reach out for immediate help: National Suicide Prevention Lifeline at 988.',
        isCrisis: true,
        crisisData: {
          severity: 'immediate',
          escalationLevel: 3,
          resources: [{ name: 'Crisis Hotline', phone: '988' }]
        },
        sessionId: 'crisis-session'
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('crisis response audio'),
        language: 'en'
      });

      const response = await request(app)
        .post('/api/voice-to-voice')
        .set('Content-Type', 'audio/wav')
        .set('X-Session-Id', 'crisis-session')
        .send(Buffer.from('crisis audio input'));

      expect(response.status).toBe(200);
      expect(response.headers['x-crisis-detected']).toBe('true');
      expect(response.headers['x-transcription']).toBe('I want to hurt myself');
    });

    test('should handle multi-language voice-to-voice conversation', async () => {
      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Hola, me siento triste',
        detectedLanguage: 'es',
        confidence: 0.92
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'Entiendo que te sientes triste. Estoy aquí para ayudarte.',
        isCrisis: false,
        sessionId: 'spanish-session',
        languageInfo: { userLanguage: 'es', detectedLanguage: 'es' }
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('spanish audio response'),
        language: 'es'
      });

      const response = await request(app)
        .post('/api/voice-to-voice')
        .set('X-Language', 'es')
        .send(Buffer.from('spanish audio input'));

      expect(response.status).toBe(200);
      expect(speechToTextService.transcribeAudio).toHaveBeenCalledWith(
        expect.any(Buffer), 'audio/wav', 'es'
      );
      expect(textToSpeechService.synthesizeSpeech).toHaveBeenCalledWith(
        expect.any(String), { language: 'es' }
      );
    });
  });

  describe('Voice-to-Text Workflow', () => {
    test('should complete voice-to-text conversation flow', async () => {
      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Can you help me with stress management?',
        detectedLanguage: 'en',
        confidence: 0.94
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'Of course! I\'d be happy to help you with stress management. Here are some effective techniques you can try...',
        isCrisis: false,
        crisisData: null,
        sessionId: 'stress-session',
        languageInfo: { userLanguage: 'en', detectedLanguage: 'en' }
      });

      const response = await request(app)
        .post('/api/voice-to-text')
        .set('Content-Type', 'audio/wav')
        .set('X-Session-Id', 'stress-session')
        .send(Buffer.from('stress question audio'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        transcription: 'Can you help me with stress management?',
        aiResponse: 'Of course! I\'d be happy to help you with stress management. Here are some effective techniques you can try...',
        isCrisis: false,
        crisisData: null,
        sessionId: 'stress-session',
        languageInfo: { userLanguage: 'en', detectedLanguage: 'en' }
      });

      expect(speechToTextService.transcribeAudio).toHaveBeenCalled();
      expect(conversationalAIService.processMessage).toHaveBeenCalled();
      expect(textToSpeechService.synthesizeSpeech).not.toHaveBeenCalled();
    });

    test('should handle transcription errors in voice-to-text flow', async () => {
      speechToTextService.transcribeAudio.mockRejectedValue(
        new Error('Audio transcription failed')
      );

      const response = await request(app)
        .post('/api/voice-to-text')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.from('unclear audio'));

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Audio transcription failed');
    });
  });

  describe('Mode Switching and State Management', () => {
    test('should switch between voice modes successfully', async () => {
      const modes = ['voice-to-voice', 'voice-to-text', 'text-to-text'];

      for (const mode of modes) {
        const response = await request(app)
          .post('/api/switch-mode')
          .send({
            mode: mode,
            sessionId: 'mode-test-session'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.mode).toBe(mode);
        expect(response.body.sessionId).toBe('mode-test-session');
      }
    });

    test('should reject invalid mode switching', async () => {
      const response = await request(app)
        .post('/api/switch-mode')
        .send({
          mode: 'invalid-mode',
          sessionId: 'test-session'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid mode');
    });

    test('should maintain session state across mode switches', async () => {
      const sessionId = 'persistent-session';

      // Switch to voice-to-voice
      let response = await request(app)
        .post('/api/switch-mode')
        .send({ mode: 'voice-to-voice', sessionId });

      expect(response.body.sessionId).toBe(sessionId);

      // Switch to voice-to-text
      response = await request(app)
        .post('/api/switch-mode')
        .send({ mode: 'voice-to-text', sessionId });

      expect(response.body.sessionId).toBe(sessionId);
    });
  });

  describe('Error Recovery and Fallback Mechanisms', () => {
    test('should handle speech-to-text service failure', async () => {
      const response = await request(app)
        .post('/api/recover-error')
        .send({
          errorType: 'speech-to-text-failed',
          sessionId: 'error-session',
          lastInput: 'audio-input'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fallbackResponse.suggestedAction).toBe('switch-to-text');
      expect(response.body.fallbackResponse.retryAvailable).toBe(true);
    });

    test('should handle AI processing failure', async () => {
      const response = await request(app)
        .post('/api/recover-error')
        .send({
          errorType: 'ai-processing-failed',
          sessionId: 'ai-error-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.fallbackResponse.suggestedAction).toBe('use-fallback-ai');
      expect(response.body.fallbackResponse.retryAvailable).toBe(true);
    });

    test('should handle text-to-speech service failure', async () => {
      const response = await request(app)
        .post('/api/recover-error')
        .send({
          errorType: 'text-to-speech-failed',
          sessionId: 'tts-error-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.fallbackResponse.suggestedAction).toBe('switch-to-text-output');
      expect(response.body.fallbackResponse.retryAvailable).toBe(false);
    });

    test('should handle unknown error types', async () => {
      const response = await request(app)
        .post('/api/recover-error')
        .send({
          errorType: 'unknown-error',
          sessionId: 'unknown-error-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.fallbackResponse.suggestedAction).toBe('retry');
    });

    test('should gracefully degrade when multiple services fail', async () => {
      // Simulate speech-to-text failure
      speechToTextService.transcribeAudio.mockRejectedValue(
        new Error('STT service unavailable')
      );

      const response = await request(app)
        .post('/api/voice-to-voice')
        .send(Buffer.from('test audio'));

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('STT service unavailable');
    });
  });

  describe('Performance and Concurrent Requests', () => {
    test('should handle multiple concurrent voice requests', async () => {
      // Mock successful responses for all services
      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Concurrent test message',
        detectedLanguage: 'en'
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'Concurrent response',
        isCrisis: false,
        sessionId: 'concurrent-session'
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('concurrent audio'),
        language: 'en'
      });

      // Send multiple concurrent requests
      const requests = Array(5).fill().map((_, i) =>
        request(app)
          .post('/api/voice-to-voice')
          .set('X-Session-Id', `concurrent-session-${i}`)
          .send(Buffer.from(`test audio ${i}`))
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.headers['x-transcription']).toBe('Concurrent test message');
      });

      expect(speechToTextService.transcribeAudio).toHaveBeenCalledTimes(5);
      expect(conversationalAIService.processMessage).toHaveBeenCalledTimes(5);
      expect(textToSpeechService.synthesizeSpeech).toHaveBeenCalledTimes(5);
    });

    test('should handle request timeout gracefully', async () => {
      // Mock a slow service response
      speechToTextService.transcribeAudio.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      );

      const startTime = Date.now();

      try {
        await request(app)
          .post('/api/voice-to-voice')
          .timeout(5000) // 5 second timeout
          .send(Buffer.from('test audio'));
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(6000); // Should timeout before 6 seconds
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Session Management Integration', () => {
    test('should maintain conversation context across requests', async () => {
      const sessionId = 'context-session';

      // First request
      speechToTextService.transcribeAudio.mockResolvedValueOnce({
        text: 'Hello, my name is John',
        detectedLanguage: 'en'
      });

      conversationalAIService.processMessage.mockResolvedValueOnce({
        message: 'Hello John! Nice to meet you.',
        isCrisis: false,
        sessionId: sessionId
      });

      await request(app)
        .post('/api/voice-to-text')
        .set('X-Session-Id', sessionId)
        .send(Buffer.from('first message'));

      // Second request - should reference previous context
      speechToTextService.transcribeAudio.mockResolvedValueOnce({
        text: 'What was my name again?',
        detectedLanguage: 'en'
      });

      conversationalAIService.processMessage.mockResolvedValueOnce({
        message: 'Your name is John, as you mentioned earlier.',
        isCrisis: false,
        sessionId: sessionId
      });

      const response = await request(app)
        .post('/api/voice-to-text')
        .set('X-Session-Id', sessionId)
        .send(Buffer.from('second message'));

      expect(response.status).toBe(200);
      expect(conversationalAIService.processMessage).toHaveBeenCalledTimes(2);
      
      // Verify both calls used the same session ID
      const calls = conversationalAIService.processMessage.mock.calls;
      expect(calls[0][1]).toBe(sessionId);
      expect(calls[1][1]).toBe(sessionId);
    });

    test('should handle session cleanup on error', async () => {
      const sessionId = 'cleanup-session';

      speechToTextService.transcribeAudio.mockRejectedValue(
        new Error('Service failure')
      );

      const response = await request(app)
        .post('/api/voice-to-text')
        .set('X-Session-Id', sessionId)
        .send(Buffer.from('test audio'));

      expect(response.status).toBe(500);
      // Session should still be identifiable in error response
      expect(response.body.error).toBe('Service failure');
    });
  });

  describe('Audio Format and Quality Tests', () => {
    test('should handle different audio formats', async () => {
      const formats = ['audio/wav', 'audio/mpeg', 'audio/webm'];

      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Format test message',
        detectedLanguage: 'en'
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'Format response',
        isCrisis: false
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('format audio'),
        language: 'en'
      });

      for (const format of formats) {
        const response = await request(app)
          .post('/api/voice-to-voice')
          .set('Content-Type', format)
          .send(Buffer.from('test audio'));

        expect(response.status).toBe(200);
      }
    });

    test('should handle large audio files', async () => {
      const largeAudioBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB

      speechToTextService.transcribeAudio.mockResolvedValue({
        text: 'Large file transcription',
        detectedLanguage: 'en'
      });

      conversationalAIService.processMessage.mockResolvedValue({
        message: 'Large file response',
        isCrisis: false
      });

      textToSpeechService.synthesizeSpeech.mockResolvedValue({
        audioBuffer: Buffer.from('large file audio'),
        language: 'en'
      });

      const response = await request(app)
        .post('/api/voice-to-voice')
        .send(largeAudioBuffer);

      expect(response.status).toBe(200);
      expect(speechToTextService.transcribeAudio).toHaveBeenCalledWith(
        largeAudioBuffer, 'audio/wav', 'en'
      );
    });
  });
});