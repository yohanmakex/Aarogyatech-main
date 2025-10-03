const express = require('express');
const multer = require('multer');
const SpeechToTextService = require('../services/speechToTextService');

const router = express.Router();
const speechToTextService = new SpeechToTextService();

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/webm',
      'audio/ogg',
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
 * POST /api/speech-to-text/transcribe
 * Transcribe audio file to text
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    // Check if service is available
    if (!speechToTextService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Speech-to-text service is not properly configured'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No audio file provided'
      });
    }

    // Validate the audio file
    const validation = speechToTextService.validateAudioFile(req.file.buffer, req.file.mimetype);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid Audio File',
        message: validation.errors.join(', ')
      });
    }

    // Get expected language from request body or query params
    const expectedLanguage = req.body.language || req.query.language || 'auto';

    // Transcribe the audio
    const transcriptionResult = await speechToTextService.transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
      expectedLanguage
    );

    res.status(200).json({
      success: true,
      transcription: transcriptionResult.text,
      text: transcriptionResult.text, // For backward compatibility
      language: {
        detected: transcriptionResult.detectedLanguage,
        expected: transcriptionResult.expectedLanguage,
        translationApplied: transcriptionResult.translationApplied,
        confidence: transcriptionResult.confidence
      },
      originalTranscription: transcriptionResult.originalText,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Speech-to-text transcription error:', error);

    // Handle specific error types
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60 // seconds
      });
    }

    if (error.message.includes('temporarily unavailable')) {
      return res.status(503).json({
        error: 'Service Temporarily Unavailable',
        message: 'The speech-to-text service is loading. Please try again in a few moments.'
      });
    }

    if (error.message.includes('Invalid audio format')) {
      return res.status(400).json({
        error: 'Invalid Audio Format',
        message: 'The provided audio file format is not supported or is corrupted.'
      });
    }

    if (error.message.includes('Invalid Hugging Face API key')) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Service configuration error. Please contact support.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while processing the audio file.'
    });
  }
});

/**
 * GET /api/speech-to-text/status
 * Check service status
 */
router.get('/status', (req, res) => {
  const isAvailable = speechToTextService.isServiceAvailable();
  
  res.status(200).json({
    service: 'speech-to-text',
    status: isAvailable ? 'available' : 'unavailable',
    model: 'openai/whisper-small',
    supportedFormats: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'],
    maxFileSize: '25MB',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/speech-to-text/validate
 * Validate audio file without transcribing
 */
router.post('/validate', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No audio file provided'
      });
    }

    const validation = speechToTextService.validateAudioFile(req.file.buffer, req.file.mimetype);
    
    res.status(200).json({
      isValid: validation.isValid,
      errors: validation.errors,
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        sizeInMB: (req.file.size / (1024 * 1024)).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Audio validation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while validating the audio file.'
    });
  }
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