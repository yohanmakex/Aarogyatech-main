const express = require('express');
const TextToSpeechService = require('../services/textToSpeechService');

const router = express.Router();
const textToSpeechService = new TextToSpeechService();

/**
 * POST /api/text-to-speech/synthesize
 * Convert text to speech
 */
router.post('/synthesize', async (req, res) => {
  try {
    // Check if service is available
    if (!textToSpeechService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Text-to-speech service is not properly configured'
      });
    }

    // Validate request body
    const { text, options = {}, language = 'en' } = req.body;
    
    // Add language to options
    options.language = language;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text is required and must be a string'
      });
    }

    // Validate the text
    const validation = textToSpeechService.validateText(text);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid Text',
        message: validation.errors.join(', '),
        warnings: validation.warnings
      });
    }

    // Validate voice options if provided
    if (options.speed !== undefined || options.pitch !== undefined || options.volume !== undefined) {
      try {
        textToSpeechService.setVoiceParameters(options.speed, options.pitch, options.volume);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid Voice Parameters',
          message: error.message
        });
      }
    }

    // Synthesize speech
    const synthesisResult = await textToSpeechService.synthesizeSpeech(text, options);

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': synthesisResult.audioBuffer.length,
      'Content-Disposition': 'inline; filename="speech.wav"',
      'Cache-Control': 'no-cache',
      'X-Language': synthesisResult.language,
      'X-Translation-Applied': synthesisResult.translationApplied.toString(),
      'X-Source-Language': synthesisResult.sourceLanguage
    });

    // Send the audio buffer
    res.status(200).send(synthesisResult.audioBuffer);

  } catch (error) {
    console.error('Text-to-speech synthesis error:', error);

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
        message: 'The text-to-speech service is loading. Please try again in a few moments.'
      });
    }

    if (error.message.includes('Invalid text format')) {
      return res.status(400).json({
        error: 'Invalid Text Format',
        message: 'The provided text format is not supported or contains invalid characters.'
      });
    }

    if (error.message.includes('Invalid Hugging Face API key')) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Service configuration error. Please contact support.'
      });
    }

    if (error.message.includes('not configured')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Text-to-speech service is not properly configured'
      });
    }

    if (error.message.includes('Text too long')) {
      return res.status(400).json({
        error: 'Text Too Long',
        message: error.message
      });
    }

    if (error.message.includes('Text cannot be empty')) {
      return res.status(400).json({
        error: 'Empty Text',
        message: 'Text cannot be empty'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while synthesizing speech.'
    });
  }
});

/**
 * GET /api/text-to-speech/status
 * Check service status
 */
router.get('/status', (req, res) => {
  const serviceInfo = textToSpeechService.getServiceInfo();
  
  res.status(200).json({
    service: 'text-to-speech',
    status: serviceInfo.isAvailable ? 'available' : 'unavailable',
    model: serviceInfo.model,
    maxTextLength: serviceInfo.maxTextLength,
    supportedFormats: serviceInfo.supportedFormats,
    voiceParameters: serviceInfo.voiceParameters,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/text-to-speech/validate
 * Validate text for TTS without synthesizing
 */
router.post('/validate', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text is required and must be a string'
      });
    }

    const validation = textToSpeechService.validateText(text);
    const estimatedDuration = textToSpeechService.estimateAudioDuration(text);
    
    res.status(200).json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      textInfo: {
        length: text.length,
        wordCount: text.trim().split(/\s+/).length,
        estimatedDuration: estimatedDuration
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Text validation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while validating the text.'
    });
  }
});

/**
 * POST /api/text-to-speech/set-voice-parameters
 * Set voice parameters (speed, pitch, volume)
 */
router.post('/set-voice-parameters', (req, res) => {
  try {
    const { speed, pitch, volume } = req.body;
    
    // Validate and set parameters
    textToSpeechService.setVoiceParameters(speed, pitch, volume);
    
    const currentParameters = textToSpeechService.getVoiceParameters();
    
    res.status(200).json({
      success: true,
      message: 'Voice parameters updated successfully',
      parameters: currentParameters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Voice parameters error:', error);
    
    if (error.message.includes('must be a number between')) {
      return res.status(400).json({
        error: 'Invalid Parameters',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while setting voice parameters.'
    });
  }
});

/**
 * GET /api/text-to-speech/voice-parameters
 * Get current voice parameters
 */
router.get('/voice-parameters', (req, res) => {
  try {
    const parameters = textToSpeechService.getVoiceParameters();
    
    res.status(200).json({
      success: true,
      parameters: parameters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get voice parameters error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while retrieving voice parameters.'
    });
  }
});

/**
 * POST /api/text-to-speech/estimate-duration
 * Estimate audio duration for given text
 */
router.post('/estimate-duration', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text is required and must be a string'
      });
    }

    const duration = textToSpeechService.estimateAudioDuration(text);
    const wordCount = text.trim().split(/\s+/).length;
    
    res.status(200).json({
      success: true,
      estimatedDuration: duration,
      textInfo: {
        length: text.length,
        wordCount: wordCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Duration estimation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while estimating duration.'
    });
  }
});

module.exports = router;