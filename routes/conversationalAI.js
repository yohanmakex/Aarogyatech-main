const express = require('express');
const ConversationalAIService = require('../services/conversationalAIService');
const ErrorHandlingMiddleware = require('../middleware/errorHandlingMiddleware');

const router = express.Router();
const conversationalAIService = new ConversationalAIService();
const errorMiddleware = new ErrorHandlingMiddleware();
const { wrapAsyncRoute } = errorMiddleware.getMiddleware();

/**
 * POST /api/conversational-ai/chat
 * Process a chat message and return AI response with enhanced security and privacy
 */
router.post('/chat', wrapAsyncRoute(async (req, res) => {
  try {
    // Check if service is available
    if (!conversationalAIService.isServiceAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Conversational AI service is not properly configured'
      });
    }

    // Validate request body
    const { message, sessionId, history, language = 'en' } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required and must be a string'
      });
    }

    // Validate message length
    if (message.length > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is too long. Maximum length is 1000 characters.'
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message cannot be empty'
      });
    }

    // Prepare request information for security validation
    const requestInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      timestamp: new Date().toISOString()
    };

    // Use provided session ID or let the service create a new secure one
    const providedSessionId = sessionId || null;

    // Process the message with enhanced security and privacy
    const result = await conversationalAIService.processMessage(message, providedSessionId, requestInfo, language);

    // Handle the new response format (object with message and crisis data)
    const responseMessage = result.message || result; // Backward compatibility
    
    // Validate response appropriateness
    if (!conversationalAIService.validateResponseAppropriate(responseMessage)) {
      console.warn('Generated inappropriate response, using fallback');
      const fallbackResponse = "I want to help you, but I'm having trouble generating an appropriate response right now. Can you rephrase your question or tell me more about what you're experiencing?";
      
      return res.status(200).json({
        success: true,
        message: fallbackResponse,
        response: fallbackResponse, // For backward compatibility
        isCrisis: conversationalAIService.detectCrisisKeywords(message),
        crisisData: null,
        metadata: {
          sessionId: result.sessionId,
          timestamp: new Date().toISOString(),
          fallback: true,
          privacy: result.privacyInfo,
          language: result.languageInfo || { userLanguage: language }
        }
      });
    }

    // Return the response with enhanced metadata
    res.status(200).json({
      success: true,
      message: responseMessage,
      response: responseMessage, // For backward compatibility
      isCrisis: result.isCrisis || false,
      crisisData: result.crisisData || null,
      metadata: {
        sessionId: result.sessionId,
        timestamp: new Date().toISOString(),
        fallback: false,
        privacy: result.privacyInfo,
        language: result.languageInfo,
        enhancement: result.mentalHealthEnhancement ? 'applied' : 'none'
      }
    });

  } catch (error) {
    // Let the error handling middleware handle this
    throw error;
  }
}));

/**
 * GET /api/conversational-ai/status
 * Check service status
 */
router.get('/status', (req, res) => {
  const isAvailable = conversationalAIService.isServiceAvailable();
  const languageStatus = conversationalAIService.languageService.getServiceStatus();
  
  const groqStatus = conversationalAIService.groqService.getServiceStatus();
  
  res.status(200).json({
    service: 'conversational-ai',
    status: isAvailable ? 'available' : 'unavailable',
    provider: 'Groq',
    model: groqStatus.model,
    features: [
      'crisis-detection',
      'mental-health-enhancement',
      'context-management',
      'coping-strategies',
      'multi-language-support',
      'safety-prioritized'
    ],
    groq: groqStatus,
    language: languageStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/conversational-ai/languages
 * Get supported languages and their configurations
 */
router.get('/languages', (req, res) => {
  try {
    const supportedLanguages = conversationalAIService.languageService.getSupportedLanguages();
    const serviceStatus = conversationalAIService.languageService.getServiceStatus();
    
    res.status(200).json({
      success: true,
      supportedLanguages: supportedLanguages,
      defaultLanguage: serviceStatus.defaultLanguage,
      features: serviceStatus.features,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/conversational-ai/clear-session
 * Clear conversation session context while keeping session active
 */
router.post('/clear-session', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required and must be a string'
      });
    }

    const success = conversationalAIService.clearSession(sessionId);

    if (!success) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: 'The specified session was not found or has expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session context cleared successfully',
      sessionId: sessionId.substring(0, 8) + '...', // Partial ID for privacy
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * POST /api/conversational-ai/destroy-session
 * Completely destroy session and all associated data
 */
router.post('/destroy-session', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required and must be a string'
      });
    }

    const success = conversationalAIService.destroySession(sessionId);

    if (!success) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: 'The specified session was not found or has already been destroyed'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session destroyed successfully',
      sessionId: sessionId.substring(0, 8) + '...', // Partial ID for privacy
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/conversational-ai/crisis-resources
 * Get crisis resources
 */
router.get('/crisis-resources', wrapAsyncRoute(async (req, res) => {
  try {
    const resources = conversationalAIService.getCrisisResources();
    
    res.status(200).json({
      success: true,
      resources: resources,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * POST /api/conversational-ai/detect-crisis
 * Detect crisis keywords in a message
 */
router.post('/detect-crisis', wrapAsyncRoute(async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required and must be a string'
      });
    }

    const isCrisis = conversationalAIService.detectCrisisKeywords(message);
    
    res.status(200).json({
      success: true,
      isCrisis: isCrisis,
      resources: isCrisis ? conversationalAIService.getCrisisResources() : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/conversational-ai/session-report/:sessionId
 * Get privacy and security report for a specific session
 */
router.get('/session-report/:sessionId', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required and must be a string'
      });
    }

    const report = conversationalAIService.getSessionReport(sessionId);
    
    if (!report) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: 'The specified session was not found or has expired'
      });
    }

    res.status(200).json({
      success: true,
      report: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/conversational-ai/system-report
 * Get comprehensive system privacy and security report
 */
router.get('/system-report', wrapAsyncRoute(async (req, res) => {
  try {
    const report = conversationalAIService.generateSystemReport();
    
    res.status(200).json({
      success: true,
      report: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * POST /api/conversational-ai/validate-compliance
 * Validate privacy compliance for a session
 */
router.post('/validate-compliance', wrapAsyncRoute(async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required and must be a string'
      });
    }

    const validation = conversationalAIService.validateSessionCompliance(sessionId);
    
    res.status(200).json({
      success: true,
      validation: validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;