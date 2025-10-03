/**
 * Mental Health Screening Service
 * Handles screening logic, scoring, and result interpretation
 */

const { PHQ9, GAD7, GHQ12, CRISIS_INDICATORS, SCREENING_RECOMMENDATIONS } = require('../models/screeningTools');

class ScreeningService {
  constructor() {
    this.tools = {
      'PHQ-9': PHQ9,
      'GAD-7': GAD7,
      'GHQ-12': GHQ12
    };
  }

  /**
   * Get available screening tools
   */
  getAvailableTools() {
    return Object.keys(this.tools).map(key => ({
      name: key,
      fullName: this.tools[key].fullName,
      description: this.tools[key].description,
      type: this.tools[key].type,
      questionCount: this.tools[key].questions.length,
      estimatedTime: this.calculateEstimatedTime(this.tools[key].questions.length)
    }));
  }

  /**
   * Get a specific screening tool
   */
  getTool(toolName) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Screening tool '${toolName}' not found`);
    }
    return tool;
  }

  /**
   * Get screening tool questions for presentation
   */
  getToolQuestions(toolName) {
    const tool = this.getTool(toolName);
    return {
      name: tool.name,
      fullName: tool.fullName,
      description: tool.description,
      timeframe: tool.timeframe,
      questions: tool.questions.map((q, index) => ({
        id: q.id,
        number: index + 1,
        text: q.text,
        category: q.category,
        requiresFollowUp: q.requiresFollowUp || false
      })),
      responseOptions: tool.responseOptions,
      alternativeResponseOptions: tool.alternativeResponseOptions,
      instructions: this.getInstructions(toolName)
    };
  }

  /**
   * Calculate score for a screening tool
   */
  calculateScore(toolName, responses, scoringMethod = 'standard') {
    const tool = this.getTool(toolName);
    let totalScore = 0;
    const detailedScoring = [];

    // Validate responses
    this.validateResponses(tool, responses);

    tool.questions.forEach((question, index) => {
      const responseValue = responses[question.id];
      let adjustedValue = responseValue;

      // Handle reversed scoring for GHQ-12
      if (question.reversed && toolName === 'GHQ-12') {
        if (scoringMethod === 'binary') {
          // Binary GHQ scoring: 0-0-1-1
          adjustedValue = responseValue >= 2 ? 1 : 0;
        } else {
          // Standard GHQ scoring with reversed items
          adjustedValue = responseValue;
        }
      } else if (toolName === 'GHQ-12' && scoringMethod === 'binary') {
        // Binary scoring for non-reversed items
        adjustedValue = responseValue >= 2 ? 1 : 0;
      }

      totalScore += adjustedValue;
      detailedScoring.push({
        questionId: question.id,
        questionNumber: index + 1,
        responseValue: responseValue,
        adjustedValue: adjustedValue,
        category: question.category
      });
    });

    // Get scoring configuration
    const scoring = scoringMethod === 'binary' && tool.scoring.binaryScoring 
      ? tool.scoring.binaryScoring 
      : tool.scoring;

    return {
      totalScore,
      maxScore: scoring.maxScore,
      scoringMethod,
      detailedScoring,
      interpretation: this.interpretScore(toolName, totalScore, scoringMethod)
    };
  }

  /**
   * Interpret the score and provide severity level and recommendations
   */
  interpretScore(toolName, score, scoringMethod = 'standard') {
    const tool = this.getTool(toolName);
    const scoring = scoringMethod === 'binary' && tool.scoring.binaryScoring 
      ? tool.scoring.binaryScoring 
      : tool.scoring;

    // Find the appropriate range
    const range = scoring.ranges.find(r => score >= r.min && score <= r.max);
    
    if (!range) {
      throw new Error(`Score ${score} is outside valid range for ${toolName}`);
    }

    const isAboveThreshold = score >= scoring.clinicalCutoff;

    return {
      score,
      level: range.level,
      description: range.description,
      isAboveThreshold,
      clinicalCutoff: scoring.clinicalCutoff,
      severity: this.getSeverityLevel(range.level),
      recommendations: this.generateRecommendations(toolName, range.level, score),
      clinicalNotes: this.generateClinicalNotes(toolName, range.level, score)
    };
  }

  /**
   * Check for crisis indicators in responses
   */
  checkCrisisIndicators(toolName, responses, totalScore) {
    const crisisAlerts = [];

    // Check for specific crisis indicators
    Object.entries(CRISIS_INDICATORS).forEach(([indicatorType, indicator]) => {
      if (indicator.tools.includes(toolName)) {
        let isCrisis = false;

        if (indicator.questions) {
          // Check specific questions (e.g., suicidal ideation)
          indicator.questions.forEach(questionId => {
            if (responses[questionId] >= indicator.threshold) {
              isCrisis = true;
            }
          });
        } else if (indicator.threshold && totalScore >= indicator.threshold) {
          // Check total score threshold
          isCrisis = true;
        }

        if (isCrisis) {
          crisisAlerts.push({
            type: indicatorType,
            severity: 'high',
            action: indicator.action,
            message: this.getCrisisMessage(indicatorType),
            resources: this.getCrisisResources()
          });
        }
      }
    });

    return crisisAlerts;
  }

  /**
   * Process a complete screening assessment
   */
  processScreening(toolName, responses, options = {}) {
    try {
      const tool = this.getTool(toolName);
      const scoringMethod = options.scoringMethod || 'standard';
      
      // Calculate score
      const scoreResult = this.calculateScore(toolName, responses, scoringMethod);
      
      // Check for crisis indicators
      const crisisAlerts = this.checkCrisisIndicators(toolName, responses, scoreResult.totalScore);
      
      // Generate comprehensive result
      const result = {
        toolName: tool.name,
        fullName: tool.fullName,
        timestamp: new Date().toISOString(),
        score: scoreResult,
        crisisAlerts,
        followUpRecommendations: this.generateFollowUpRecommendations(
          toolName, 
          scoreResult.interpretation.level, 
          crisisAlerts.length > 0
        ),
        nextSteps: this.generateNextSteps(toolName, scoreResult.interpretation.level),
        confidentiality: this.getConfidentialityNote(),
        validity: this.assessValidity(responses, tool)
      };

      // Add crisis flag for easy checking
      result.requiresImmediateAttention = crisisAlerts.some(alert => 
        alert.action === 'immediate_intervention'
      );

      return result;
    } catch (error) {
      throw new Error(`Error processing screening: ${error.message}`);
    }
  }

  /**
   * Recommend appropriate screening tools based on symptoms or context
   */
  recommendTools(context) {
    const { symptoms, previousScores, riskLevel, purpose } = context;
    const recommendations = [];

    if (purpose && SCREENING_RECOMMENDATIONS[purpose]) {
      return SCREENING_RECOMMENDATIONS[purpose];
    }

    // Symptom-based recommendations
    if (symptoms) {
      if (symptoms.includes('depression') || symptoms.includes('sadness') || symptoms.includes('hopelessness')) {
        recommendations.push('PHQ-9');
      }
      if (symptoms.includes('anxiety') || symptoms.includes('worry') || symptoms.includes('nervousness')) {
        recommendations.push('GAD-7');
      }
      if (symptoms.includes('stress') || symptoms.includes('general') || !symptoms.length) {
        recommendations.push('GHQ-12');
      }
    }

    // Default recommendation for comprehensive assessment
    if (!recommendations.length) {
      recommendations.push('GHQ-12', 'PHQ-9');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Validate responses against tool requirements
   */
  validateResponses(tool, responses) {
    const errors = [];

    tool.questions.forEach(question => {
      const response = responses[question.id];
      
      if (response === undefined || response === null) {
        errors.push(`Missing response for question: ${question.id}`);
        return;
      }

      if (!Number.isInteger(response) || response < 0) {
        errors.push(`Invalid response for question ${question.id}: must be a non-negative integer`);
        return;
      }

      const maxValue = Math.max(...tool.responseOptions.map(opt => opt.value));
      if (response > maxValue) {
        errors.push(`Response for question ${question.id} exceeds maximum value of ${maxValue}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
  }

  /**
   * Assess validity of responses (detect patterns that might indicate invalid responses)
   */
  assessValidity(responses, tool) {
    const values = Object.values(responses);
    const allSame = values.every(val => val === values[0]);
    const allMaximum = values.every(val => val === Math.max(...tool.responseOptions.map(opt => opt.value)));
    const allMinimum = values.every(val => val === 0);

    let validity = 'valid';
    let warnings = [];

    if (allSame && values.length > 5) {
      validity = 'questionable';
      warnings.push('All responses are identical, which may indicate invalid responding');
    }

    if (allMaximum || allMinimum) {
      validity = 'questionable';
      warnings.push('All responses are at one extreme, results should be interpreted with caution');
    }

    return {
      status: validity,
      warnings
    };
  }

  // Helper methods for generating recommendations and messages
  calculateEstimatedTime(questionCount) {
    return Math.ceil(questionCount * 0.5); // Estimate 30 seconds per question
  }

  getInstructions(toolName) {
    const instructions = {
      'PHQ-9': 'Over the last 2 weeks, how often have you been bothered by any of the following problems? Please select the most appropriate response for each item.',
      'GAD-7': 'Over the last 2 weeks, how often have you been bothered by the following problems? Please select the most appropriate response.',
      'GHQ-12': 'We would like to know if you have had any medical complaints and how your health has been in general, over the past few weeks. Please answer ALL the questions by selecting the response that you think most nearly applies to you.'
    };
    return instructions[toolName] || 'Please answer all questions honestly based on your recent experiences.';
  }

  getSeverityLevel(level) {
    const severityMap = {
      minimal: 'low',
      mild: 'low',
      normal: 'low',
      moderate: 'medium',
      moderately_severe: 'high',
      severe: 'high',
      distressed: 'medium'
    };
    return severityMap[level] || 'unknown';
  }

  generateRecommendations(toolName, level, score) {
    const recommendations = [];

    if (level === 'minimal' || level === 'normal') {
      recommendations.push('Continue with self-care and healthy lifestyle practices');
      recommendations.push('Consider periodic re-assessment if concerns arise');
    } else if (level === 'mild') {
      recommendations.push('Consider self-help resources and stress management techniques');
      recommendations.push('Monitor symptoms and consider professional consultation if they worsen');
    } else if (level === 'moderate') {
      recommendations.push('Consider consulting with a mental health professional');
      recommendations.push('Implement coping strategies and self-care practices');
      recommendations.push('Consider additional screening tools for comprehensive assessment');
    } else if (level === 'moderately_severe' || level === 'severe') {
      recommendations.push('Strongly recommend consulting with a mental health professional');
      recommendations.push('Consider immediate professional support');
      recommendations.push('Implement safety planning if applicable');
    }

    return recommendations;
  }

  generateClinicalNotes(toolName, level, score) {
    if (level === 'minimal' || level === 'normal' || level === 'mild') {
      return 'Scores suggest low clinical concern. Monitor for changes.';
    } else if (level === 'moderate') {
      return 'Scores suggest moderate symptoms warranting clinical attention and possible intervention.';
    } else {
      return 'Scores suggest significant symptoms requiring professional clinical evaluation and intervention.';
    }
  }

  generateFollowUpRecommendations(toolName, level, hasCrisis) {
    if (hasCrisis) {
      return [
        'Immediate safety assessment required',
        'Contact crisis intervention services',
        'Arrange urgent professional evaluation'
      ];
    }

    const followUp = [];
    if (level === 'moderate' || level === 'moderately_severe' || level === 'severe') {
      followUp.push('Schedule follow-up screening in 2-4 weeks');
      followUp.push('Consider complementary screening tools');
      followUp.push('Monitor symptoms regularly');
    } else {
      followUp.push('Consider re-screening in 2-3 months if symptoms persist or worsen');
    }

    return followUp;
  }

  generateNextSteps(toolName, level) {
    if (level === 'severe' || level === 'moderately_severe') {
      return [
        'Seek professional mental health evaluation',
        'Contact healthcare provider',
        'Consider crisis support if needed'
      ];
    } else if (level === 'moderate') {
      return [
        'Consider counseling or therapy',
        'Discuss results with healthcare provider',
        'Implement self-care strategies'
      ];
    } else {
      return [
        'Continue self-care practices',
        'Monitor symptoms',
        'Seek support if symptoms worsen'
      ];
    }
  }

  getCrisisMessage(indicatorType) {
    const messages = {
      suicidalIdeation: 'Suicidal thoughts detected. Immediate professional intervention recommended.',
      severeDepression: 'Severe depression symptoms detected. Urgent professional evaluation recommended.',
      severeAnxiety: 'Severe anxiety symptoms detected. Urgent professional evaluation recommended.',
      severeDistress: 'Severe psychological distress detected. Urgent professional evaluation recommended.'
    };
    return messages[indicatorType] || 'Crisis level symptoms detected. Immediate professional attention recommended.';
  }

  getCrisisResources() {
    return {
      emergencyServices: '911',
      nationalSuicidePrevention: '988',
      crisisTextLine: 'Text HOME to 741741',
      emergencyRoom: 'Visit nearest emergency room',
      note: 'If you are in immediate danger, call 911 or go to your nearest emergency room'
    };
  }

  getConfidentialityNote() {
    return 'This screening is for informational purposes only and does not constitute a clinical diagnosis. All responses are confidential and should be discussed with a qualified healthcare provider.';
  }
}

module.exports = ScreeningService;