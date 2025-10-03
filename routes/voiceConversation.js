/**
 * Voice Conversation API Routes
 * Handles voice-to-voice conversations with real-time processing
 */

const express = require('express');
const multer = require('multer');
const VoiceConversationService = require('../services/voiceConversationService');
const ErrorHandlingMiddleware = require('../middleware/errorHandlingMiddleware');

const router = express.Router();
const voiceConversationService = new VoiceConversationService();
const errorMiddleware = new ErrorHandlingMiddleware();
const { wrapAsyncRoute } = errorMiddleware.getMiddleware();

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/webm',
      'audio/ogg',
      'audio/m4a',
      'audio/x-wav',
      'audio/wave'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
    }
  }
});

/**
 * GET /api/voice-conversation/status
 * Get voice conversation service status
 */
router.get('/status', (req, res) => {
  try {
    const status = voiceConversationService.getServiceStatus();
    
    res.status(200).json({
      success: true,
      service: 'voice-conversation',
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/voice-conversation/start
 * Start a new voice conversation session
 */
router.post('/start', wrapAsyncRoute(async (req, res) => {
  try {
    if (!voiceConversationService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Voice conversation service is not properly configured'
      });
    }

    const { language, voiceProfile, user } = req.body;
    
    const options = {
      language: language || 'en',
      voiceProfile: voiceProfile || 'supportive',
      user: user || { anonymous: true }
    };

    const session = voiceConversationService.startConversation(options);
    
    res.status(200).json({
      success: true,
      session,
      message: 'Voice conversation session started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * POST /api/voice-conversation/process
 * Process voice input and return voice response
 */
router.post('/process', upload.single('audio'), wrapAsyncRoute(async (req, res) => {
  try {
    if (!voiceConversationService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Voice conversation service is not properly configured'
      });
    }

    // Validate request
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Audio file is required'
      });
    }

    // Process voice input
    const options = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const result = await voiceConversationService.processVoiceInput(
      sessionId,
      req.file.buffer,
      req.file.mimetype,
      options
    );

    if (result.success) {
      // Set appropriate headers for audio response
      res.set({
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
        'X-Processing-Time': result.performance.totalTime.toString(),
        'X-Voice-Profile': result.interaction.aiResponse.audio.voice
      });

      // Return complete interaction result
      res.status(200).json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } else {
      // Handle fallback response
      res.status(206).json({
        success: false,
        partial: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    if (error.message.includes('Invalid or expired conversation session')) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: error.message
      });
    }
    
    throw error;
  }
}));

/**
 * GET /api/voice-conversation/audio/:sessionId/:messageId
 * Get audio response for a specific message
 */
router.get('/audio/:sessionId/:messageId', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    
    // This would typically retrieve stored audio from a conversation
    // For now, return an error since we don't store audio separately
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Audio retrieval endpoint not yet implemented. Use the /process endpoint for real-time audio responses.'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/voice-conversation/:sessionId
 * Get conversation history
 */
router.get('/:sessionId', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const conversation = voiceConversationService.getConversation(sessionId);
    
    res.status(200).json({
      success: true,
      conversation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('Conversation session not found')) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: error.message
      });
    }
    
    throw error;
  }
}));

/**
 * DELETE /api/voice-conversation/:sessionId
 * End a voice conversation session
 */
router.delete('/:sessionId', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    
    const summary = voiceConversationService.endConversation(sessionId, reason || 'user');
    
    res.status(200).json({
      success: true,
      message: 'Conversation ended successfully',
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('Conversation session not found')) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: error.message
      });
    }
    
    throw error;
  }
}));

/**
 * GET /api/voice-conversation/voices/profiles
 * Get available voice profiles
 */
router.get('/voices/profiles', (req, res) => {
  try {
    const profiles = {
      supportive: {
        name: 'Supportive',
        description: 'Calm and empathetic voice for mental health support',
        voice: 'nova',
        speed: 0.9,
        bestFor: ['therapy', 'counseling', 'emotional support']
      },
      professional: {
        name: 'Professional',
        description: 'Clear and authoritative voice for clinical interactions',
        voice: 'onyx',
        speed: 1.0,
        bestFor: ['assessments', 'recommendations', 'clinical advice']
      },
      friendly: {
        name: 'Friendly',
        description: 'Warm and approachable voice for casual conversations',
        voice: 'alloy',
        speed: 1.1,
        bestFor: ['general chat', 'initial interactions', 'check-ins']
      },
      crisis: {
        name: 'Crisis',
        description: 'Slower, calmer voice specifically for crisis situations',
        voice: 'echo',
        speed: 0.8,
        bestFor: ['crisis intervention', 'emergency support', 'de-escalation']
      }
    };

    res.status(200).json({
      success: true,
      profiles,
      defaultProfile: 'supportive',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/voice-conversation/test-synthesis
 * Test text-to-speech synthesis with different voices
 */
router.post('/test-synthesis', wrapAsyncRoute(async (req, res) => {
  try {
    if (!voiceConversationService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Voice conversation service is not properly configured'
      });
    }

    const { text, voiceProfile = 'supportive' } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text is required and must be a string'
      });
    }

    // Use the internal TTS service for testing
    const voiceOptions = voiceConversationService.voiceProfiles[voiceProfile] || 
                        voiceConversationService.voiceProfiles.supportive;

    const speechResult = await voiceConversationService.textToSpeechService.synthesizeSpeech(
      text,
      voiceOptions
    );

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': speechResult.contentType,
      'Content-Length': speechResult.audioBuffer.length,
      'Content-Disposition': `inline; filename="test-speech.${speechResult.contentType.split('/')[1]}"`,
      'X-Voice-Profile': voiceProfile,
      'X-Duration': speechResult.duration.toString()
    });

    // Send the audio buffer directly
    res.status(200).send(speechResult.audioBuffer);

  } catch (error) {
    throw error;
  }
}));

/**
 * WebSocket endpoint setup would go here for real-time streaming
 * This is a placeholder for future WebSocket implementation
 */
router.get('/websocket-info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebSocket support for real-time voice streaming is planned for future implementation',
    currentSupport: {
      realTime: false,
      streaming: false,
      method: 'HTTP POST with file upload'
    },
    plannedFeatures: {
      webSocketStreaming: 'Real-time audio streaming',
      partialTranscription: 'Live transcription updates',
      interruptibleSpeech: 'Ability to interrupt AI responses',
      voiceActivityDetection: 'Automatic recording start/stop'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handler for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File Too Large',
        message: 'Audio file exceeds the maximum size limit of 25MB.'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too Many Files',
        message: 'Only one audio file can be uploaded at a time.'
      });
    }
  }
  
  if (error.message.includes('Unsupported audio format')) {
    return res.status(400).json({
      error: 'Unsupported Format',
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;