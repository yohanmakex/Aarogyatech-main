/**
 * Mental Health Screening API Routes
 * Handles screening assessments, scoring, and result interpretation
 */

const express = require('express');
const ScreeningService = require('../services/screeningService');
const ErrorHandlingMiddleware = require('../middleware/errorHandlingMiddleware');

const router = express.Router();
const screeningService = new ScreeningService();
const errorMiddleware = new ErrorHandlingMiddleware();
const { wrapAsyncRoute } = errorMiddleware.getMiddleware();

/**
 * GET /api/screening/tools
 * Get list of available screening tools
 */
router.get('/tools', (req, res) => {
  try {
    const tools = screeningService.getAvailableTools();
    
    res.status(200).json({
      success: true,
      tools,
      totalCount: tools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/screening/tools/:toolName
 * Get specific screening tool details and questions
 */
router.get('/tools/:toolName', (req, res) => {
  try {
    const { toolName } = req.params;
    
    // Validate tool name
    if (!toolName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tool name is required'
      });
    }

    const toolDetails = screeningService.getToolQuestions(toolName);
    
    res.status(200).json({
      success: true,
      tool: toolDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * POST /api/screening/assess
 * Process a screening assessment
 */
router.post('/assess', wrapAsyncRoute(async (req, res) => {
  try {
    const { toolName, responses, options = {}, sessionId } = req.body;
    
    // Validation
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tool name is required and must be a string'
      });
    }

    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Responses are required and must be an object'
      });
    }

    // Prepare request information for logging
    const requestInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'anonymous'
    };

    // Process the screening
    const result = await screeningService.processScreening(toolName, responses, options);
    
    // Log the assessment (without sensitive data)
    console.log(`Screening assessment completed: ${toolName}, Score: ${result.score.totalScore}/${result.score.maxScore}, Level: ${result.score.interpretation.level}, Crisis: ${result.requiresImmediateAttention}`);
    
    // If there are crisis indicators, log them appropriately
    if (result.requiresImmediateAttention) {
      console.warn(`Crisis indicators detected in screening: ${toolName}, Session: ${sessionId || 'anonymous'}`);
    }

    // Add request metadata to result
    result.metadata = {
      requestInfo: {
        timestamp: requestInfo.timestamp,
        sessionId: requestInfo.sessionId
      },
      processing: {
        version: '1.0.0',
        processingTime: new Date().toISOString()
      }
    };

    res.status(200).json({
      success: true,
      assessment: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Validation errors')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
    throw error;
  }
}));

/**
 * POST /api/screening/recommend
 * Get screening tool recommendations based on context
 */
router.post('/recommend', (req, res) => {
  try {
    const { symptoms, previousScores, riskLevel, purpose } = req.body;
    
    const context = {
      symptoms: symptoms || [],
      previousScores: previousScores || {},
      riskLevel: riskLevel || 'unknown',
      purpose: purpose || 'general'
    };

    const recommendations = screeningService.recommendTools(context);
    
    // Get detailed information about recommended tools
    const detailedRecommendations = recommendations.map(toolName => {
      try {
        const tool = screeningService.getTool(toolName);
        return {
          name: tool.name,
          fullName: tool.fullName,
          description: tool.description,
          type: tool.type,
          questionCount: tool.questions.length,
          estimatedTime: screeningService.calculateEstimatedTime(tool.questions.length)
        };
      } catch (err) {
        return null;
      }
    }).filter(Boolean);

    res.status(200).json({
      success: true,
      recommendations: detailedRecommendations,
      context: {
        symptoms: context.symptoms,
        purpose: context.purpose,
        riskLevel: context.riskLevel
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/screening/interpret
 * Interpret a score without processing full assessment
 */
router.post('/interpret', (req, res) => {
  try {
    const { toolName, score, scoringMethod = 'standard' } = req.body;
    
    // Validation
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tool name is required and must be a string'
      });
    }

    if (score === undefined || score === null || !Number.isInteger(score) || score < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Score is required and must be a non-negative integer'
      });
    }

    const interpretation = screeningService.interpretScore(toolName, score, scoringMethod);
    
    res.status(200).json({
      success: true,
      interpretation,
      metadata: {
        toolName,
        score,
        scoringMethod,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('outside valid range')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * GET /api/screening/crisis-resources
 * Get crisis intervention resources
 */
router.get('/crisis-resources', (req, res) => {
  try {
    const resources = screeningService.getCrisisResources();
    
    res.status(200).json({
      success: true,
      resources,
      message: 'If you are experiencing a mental health crisis, please reach out for help immediately',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/screening/status
 * Get screening service status
 */
router.get('/status', (req, res) => {
  try {
    const availableTools = screeningService.getAvailableTools();
    
    res.status(200).json({
      service: 'mental-health-screening',
      status: 'operational',
      version: '1.0.0',
      features: [
        'PHQ-9 Depression Screening',
        'GAD-7 Anxiety Screening', 
        'GHQ-12 General Distress Screening',
        'Crisis Detection',
        'Score Interpretation',
        'Treatment Recommendations',
        'Multi-scoring Methods'
      ],
      availableTools: availableTools.length,
      tools: availableTools.map(tool => ({
        name: tool.name,
        type: tool.type,
        questions: tool.questionCount
      })),
      capabilities: {
        crisisDetection: true,
        multipleScoring: true,
        realTimeAssessment: true,
        recommendationEngine: true,
        validityChecking: true
      },
      confidentiality: screeningService.getConfidentialityNote(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/screening/validate
 * Validate screening responses without processing
 */
router.post('/validate', (req, res) => {
  try {
    const { toolName, responses } = req.body;
    
    // Validation
    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tool name is required and must be a string'
      });
    }

    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Responses are required and must be an object'
      });
    }

    const tool = screeningService.getTool(toolName);
    
    try {
      screeningService.validateResponses(tool, responses);
      const validity = screeningService.assessValidity(responses, tool);
      
      res.status(200).json({
        success: true,
        valid: true,
        validity,
        message: 'Responses are valid',
        completeness: {
          totalQuestions: tool.questions.length,
          answeredQuestions: Object.keys(responses).length,
          isComplete: Object.keys(responses).length === tool.questions.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (validationError) {
      res.status(400).json({
        success: false,
        valid: false,
        error: 'Validation Error',
        message: validationError.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * GET /api/screening/help
 * Get help information about screening tools and their usage
 */
router.get('/help', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      help: {
        overview: 'Mental health screening tools to assess depression, anxiety, and general psychological distress',
        tools: {
          'PHQ-9': {
            purpose: 'Depression screening and severity assessment',
            duration: '2-3 minutes',
            scoring: 'Higher scores indicate more severe depression',
            clinicalCutoff: 10,
            interpretation: {
              '0-4': 'Minimal depression',
              '5-9': 'Mild depression', 
              '10-14': 'Moderate depression',
              '15-19': 'Moderately severe depression',
              '20-27': 'Severe depression'
            }
          },
          'GAD-7': {
            purpose: 'Generalized anxiety disorder screening',
            duration: '2-3 minutes',
            scoring: 'Higher scores indicate more severe anxiety',
            clinicalCutoff: 10,
            interpretation: {
              '0-4': 'Minimal anxiety',
              '5-9': 'Mild anxiety',
              '10-14': 'Moderate anxiety', 
              '15-21': 'Severe anxiety'
            }
          },
          'GHQ-12': {
            purpose: 'General psychological distress screening',
            duration: '3-4 minutes',
            scoring: 'Two scoring methods available (standard and binary)',
            clinicalCutoff: 12,
            interpretation: {
              '0-11': 'No psychological distress',
              '12-15': 'Mild psychological distress',
              '16-20': 'Moderate psychological distress',
              '21-36': 'Severe psychological distress'
            }
          }
        },
        usage: {
          assessment: 'POST /api/screening/assess - Complete a screening assessment',
          recommendations: 'POST /api/screening/recommend - Get tool recommendations',
          interpretation: 'POST /api/screening/interpret - Interpret a score',
          validation: 'POST /api/screening/validate - Validate responses'
        },
        privacy: 'All assessments are anonymous unless you provide a session ID. No personal information is stored.',
        disclaimer: 'These tools are for screening purposes only and do not provide clinical diagnoses. Always consult with a qualified healthcare provider for proper evaluation and treatment.'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
});

module.exports = router;