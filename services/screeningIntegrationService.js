/**
 * Screening Integration Service for Conversational AI
 * Integrates mental health screening tools with conversational AI responses
 */

const ScreeningService = require('./screeningService');
const { SCREENING_RECOMMENDATIONS } = require('../models/screeningTools');

class ScreeningIntegrationService {
  constructor() {
    this.screeningService = new ScreeningService();
    
    // Keywords that might indicate need for specific screening tools
    this.screeningTriggers = {
      depression: [
        'sad', 'depressed', 'hopeless', 'worthless', 'empty', 'down',
        'crying', 'tears', 'unhappy', 'miserable', 'despair', 'blue',
        'sleep problems', 'sleeping too much', 'insomnia', 'tired', 'fatigue',
        'no energy', 'appetite', 'eating too much', 'not eating', 'weight',
        'concentrate', 'focus', 'memory', 'thinking', 'slow',
        'guilty', 'failure', 'disappointed', 'let down', 'suicide', 'die', 'death'
      ],
      anxiety: [
        'anxious', 'nervous', 'worried', 'worry', 'panic', 'fear', 'afraid',
        'scared', 'tense', 'on edge', 'restless', 'fidgety', 'agitated',
        'racing thoughts', 'racing heart', 'palpitations', 'sweating',
        'shaking', 'trembling', 'breathing', 'shortness of breath',
        'chest tight', 'chest pain', 'dizzy', 'lightheaded', 'nausea',
        'stomach problems', 'muscle tension', 'headache', 'irritable',
        'can\'t relax', 'overwhelmed', 'catastrophic', 'worst case'
      ],
      stress: [
        'stressed', 'pressure', 'overwhelmed', 'burden', 'too much',
        'can\'t cope', 'breaking point', 'exhausted', 'burned out',
        'strain', 'tension', 'demands', 'responsibilities', 'workload',
        'juggling', 'multitasking', 'deadlines', 'expectations',
        'struggling', 'difficult', 'hard', 'challenging', 'tough'
      ],
      general: [
        'mental health', 'psychological', 'emotional', 'mood', 'feeling',
        'counseling', 'therapy', 'help', 'support', 'treatment',
        'psychiatrist', 'psychologist', 'medication', 'diagnosis'
      ]
    };
    
    // Response templates for screening recommendations
    this.recommendationTemplates = {
      gentle: [
        "Based on what you're sharing, it might be helpful to complete a brief screening assessment. This can help us better understand what you're experiencing and provide more targeted support.",
        "I notice you're describing some symptoms that are commonly assessed through standardized screening tools. Would you be interested in taking a brief questionnaire?",
        "To better support you, I can recommend a short assessment that might help clarify what you're experiencing. These are confidential and can provide valuable insights."
      ],
      specific: {
        'PHQ-9': "It sounds like you might benefit from the PHQ-9 depression screening. It's a brief, 9-question assessment that can help evaluate depression symptoms and their severity.",
        'GAD-7': "Based on what you're describing, the GAD-7 anxiety screening might be helpful. It's a short questionnaire that assesses anxiety symptoms over the past two weeks.",
        'GHQ-12': "The GHQ-12 general health questionnaire might provide some insights into your overall psychological wellbeing. It's a comprehensive but brief screening tool."
      },
      followUp: [
        "After completing a screening, we can discuss the results and explore appropriate next steps together.",
        "The screening results can help guide our conversation and identify specific areas where you might want to focus on building coping strategies.",
        "Remember, these screenings are just tools to help us understand your situation better - they don't provide diagnoses, but they can be very informative."
      ]
    };
  }

  /**
   * Analyze a message and determine if screening tools should be recommended
   */
  analyzeMessageForScreeningRecommendation(message, sessionHistory = []) {
    const lowercaseMessage = message.toLowerCase();
    const symptoms = [];
    const confidence = {};
    
    // Check for depression indicators
    const depressionCount = this.screeningTriggers.depression.filter(trigger => 
      lowercaseMessage.includes(trigger.toLowerCase())
    ).length;
    if (depressionCount > 0) {
      symptoms.push('depression');
      confidence.depression = Math.min(depressionCount * 0.2, 1.0);
    }
    
    // Check for anxiety indicators
    const anxietyCount = this.screeningTriggers.anxiety.filter(trigger => 
      lowercaseMessage.includes(trigger.toLowerCase())
    ).length;
    if (anxietyCount > 0) {
      symptoms.push('anxiety');
      confidence.anxiety = Math.min(anxietyCount * 0.2, 1.0);
    }
    
    // Check for stress indicators
    const stressCount = this.screeningTriggers.stress.filter(trigger => 
      lowercaseMessage.includes(trigger.toLowerCase())
    ).length;
    if (stressCount > 0) {
      symptoms.push('stress');
      confidence.stress = Math.min(stressCount * 0.2, 1.0);
    }
    
    // Check for general mental health mentions
    const generalCount = this.screeningTriggers.general.filter(trigger => 
      lowercaseMessage.includes(trigger.toLowerCase())
    ).length;
    if (generalCount > 0) {
      symptoms.push('general');
      confidence.general = Math.min(generalCount * 0.3, 1.0);
    }
    
    // Analyze session history for patterns
    const historyAnalysis = this.analyzeSessionHistory(sessionHistory);
    
    return {
      shouldRecommendScreening: symptoms.length > 0 || historyAnalysis.shouldRecommend,
      detectedSymptoms: symptoms,
      confidence,
      historyAnalysis,
      recommendedTools: this.getRecommendedTools(symptoms, historyAnalysis),
      urgency: this.assessUrgency(message, symptoms, confidence)
    };
  }

  /**
   * Analyze session history for patterns indicating screening need
   */
  analyzeSessionHistory(sessionHistory) {
    if (!sessionHistory || sessionHistory.length < 2) {
      return { shouldRecommend: false, patterns: [] };
    }
    
    const patterns = [];
    let shouldRecommend = false;
    
    // Check for recurring themes
    const recentMessages = sessionHistory.slice(-5); // Last 5 messages
    const allText = recentMessages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();
    
    // Pattern: Repeated mentions of symptoms
    const symptomMentions = this.countSymptomMentions(allText);
    if (symptomMentions.total > 3) {
      patterns.push('recurring_symptoms');
      shouldRecommend = true;
    }
    
    // Pattern: Escalating severity
    const severityProgression = this.assessSeverityProgression(recentMessages);
    if (severityProgression.isEscalating) {
      patterns.push('escalating_severity');
      shouldRecommend = true;
    }
    
    // Pattern: Multiple symptom domains
    if (symptomMentions.domains.length >= 2) {
      patterns.push('multiple_domains');
      shouldRecommend = true;
    }
    
    return {
      shouldRecommend,
      patterns,
      symptomMentions,
      severityProgression
    };
  }

  /**
   * Get recommended screening tools based on symptoms and analysis
   */
  getRecommendedTools(symptoms, historyAnalysis) {
    const recommendations = [];
    
    if (symptoms.includes('depression')) {
      recommendations.push({
        toolName: 'PHQ-9',
        priority: 'high',
        reason: 'Depression symptoms detected'
      });
    }
    
    if (symptoms.includes('anxiety')) {
      recommendations.push({
        toolName: 'GAD-7',
        priority: 'high',
        reason: 'Anxiety symptoms detected'
      });
    }
    
    if (symptoms.includes('stress') || symptoms.includes('general') || 
        historyAnalysis.patterns.includes('multiple_domains')) {
      recommendations.push({
        toolName: 'GHQ-12',
        priority: 'medium',
        reason: 'General psychological distress indicators'
      });
    }
    
    // If no specific symptoms but session history indicates need
    if (recommendations.length === 0 && historyAnalysis.shouldRecommend) {
      recommendations.push({
        toolName: 'GHQ-12',
        priority: 'medium',
        reason: 'Session pattern analysis suggests benefit from general screening'
      });
    }
    
    // Sort by priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate a contextual recommendation message
   */
  generateRecommendationMessage(analysis, userPreferences = {}) {
    const { recommendedTools, detectedSymptoms, urgency } = analysis;
    
    if (!recommendedTools.length) {
      return null;
    }
    
    let message = '';
    
    // Choose appropriate introduction based on urgency and preference
    if (urgency === 'high' || userPreferences.directStyle) {
      message = this.recommendationTemplates.gentle[0];
    } else {
      const randomIntro = this.recommendationTemplates.gentle[
        Math.floor(Math.random() * this.recommendationTemplates.gentle.length)
      ];
      message = randomIntro;
    }
    
    // Add specific tool recommendations
    if (recommendedTools.length === 1) {
      const tool = recommendedTools[0];
      message += `\n\n${this.recommendationTemplates.specific[tool.toolName]}`;
    } else {
      message += '\n\nI would recommend considering these screening tools:';
      recommendedTools.slice(0, 2).forEach(tool => { // Limit to 2 tools to avoid overwhelming
        message += `\n• ${tool.toolName}: ${this.getToolDescription(tool.toolName)}`;
      });
    }
    
    // Add follow-up message
    const randomFollowUp = this.recommendationTemplates.followUp[
      Math.floor(Math.random() * this.recommendationTemplates.followUp.length)
    ];
    message += `\n\n${randomFollowUp}`;
    
    // Add call-to-action
    message += '\n\nWould you like me to provide one of these screening tools for you to complete?';
    
    return message;
  }

  /**
   * Generate interpretation message for screening results
   */
  generateResultInterpretationMessage(assessmentResult) {
    const { score, crisisAlerts, followUpRecommendations, nextSteps } = assessmentResult;
    const { interpretation } = score;
    
    let message = `Thank you for completing the ${assessmentResult.toolName} screening. `;
    
    // Add score interpretation
    message += `Your score of ${interpretation.score} suggests ${interpretation.description.toLowerCase()}. `;
    
    // Add context based on severity
    if (interpretation.severity === 'low') {
      message += 'This indicates minimal concerns in this area, which is positive. ';
    } else if (interpretation.severity === 'medium') {
      message += 'This suggests moderate symptoms that may benefit from attention and support strategies. ';
    } else if (interpretation.severity === 'high') {
      message += 'This indicates significant symptoms that warrant professional attention. ';
    }
    
    // Handle crisis situations
    if (crisisAlerts && crisisAlerts.length > 0) {
      message += '\n\n⚠️ Important: Your responses indicate some concerning symptoms. ';
      message += crisisAlerts[0].message + ' ';
      message += 'Please reach out for immediate support: National Suicide Prevention Lifeline at 988, ';
      message += 'Crisis Text Line (text HOME to 741741), or call emergency services (911).';
      return message; // Return early for crisis situations
    }
    
    // Add recommendations
    if (interpretation.recommendations && interpretation.recommendations.length > 0) {
      message += '\n\nBased on your results, here are some suggestions:\n';
      interpretation.recommendations.slice(0, 3).forEach((rec, index) => {
        message += `${index + 1}. ${rec}\n`;
      });
    }
    
    // Add next steps
    if (nextSteps && nextSteps.length > 0) {
      message += '\nConsidering your results, you might want to:\n';
      nextSteps.slice(0, 2).forEach((step, index) => {
        message += `• ${step}\n`;
      });
    }
    
    message += '\nRemember, this screening is for informational purposes and does not replace ';
    message += 'professional evaluation. Would you like to discuss these results further or ';
    message += 'explore specific coping strategies?';
    
    return message;
  }

  /**
   * Check if user message indicates interest in screening
   */
  detectScreeningInterest(message) {
    const lowercaseMessage = message.toLowerCase();
    const screeningInterestPhrases = [
      'screening', 'assessment', 'questionnaire', 'test', 'evaluation',
      'phq', 'gad', 'ghq', 'depression test', 'anxiety test',
      'mental health test', 'check my', 'assess my', 'measure my',
      'how bad is my', 'severity', 'score'
    ];
    
    return screeningInterestPhrases.some(phrase => 
      lowercaseMessage.includes(phrase)
    );
  }

  /**
   * Extract screening preferences from user message
   */
  extractScreeningPreferences(message) {
    const lowercaseMessage = message.toLowerCase();
    const preferences = {
      preferredTools: [],
      urgency: 'normal',
      specificConcerns: []
    };
    
    // Check for specific tool mentions
    if (lowercaseMessage.includes('phq') || lowercaseMessage.includes('depression')) {
      preferences.preferredTools.push('PHQ-9');
    }
    if (lowercaseMessage.includes('gad') || lowercaseMessage.includes('anxiety')) {
      preferences.preferredTools.push('GAD-7');
    }
    if (lowercaseMessage.includes('ghq') || lowercaseMessage.includes('general')) {
      preferences.preferredTools.push('GHQ-12');
    }
    
    // Check urgency indicators
    const urgentPhrases = ['urgent', 'immediately', 'right now', 'asap', 'emergency'];
    if (urgentPhrases.some(phrase => lowercaseMessage.includes(phrase))) {
      preferences.urgency = 'high';
    }
    
    return preferences;
  }

  // Helper methods
  countSymptomMentions(text) {
    const domains = ['depression', 'anxiety', 'stress', 'general'];
    const mentions = { total: 0, domains: [] };
    
    domains.forEach(domain => {
      const count = this.screeningTriggers[domain].filter(trigger => 
        text.includes(trigger.toLowerCase())
      ).length;
      if (count > 0) {
        mentions.total += count;
        mentions.domains.push(domain);
      }
    });
    
    return mentions;
  }

  assessSeverityProgression(messages) {
    // Simple heuristic: check if recent messages contain more severe language
    const severityKeywords = [
      'worse', 'getting worse', 'terrible', 'awful', 'unbearable',
      'can\'t take it', 'breaking point', 'give up', 'hopeless'
    ];
    
    const recentSeverity = messages.slice(-2).some(msg => 
      severityKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    );
    
    return { isEscalating: recentSeverity };
  }

  assessUrgency(message, symptoms, confidence) {
    const urgentKeywords = [
      'suicide', 'kill myself', 'end it all', 'can\'t go on',
      'emergency', 'crisis', 'help me', 'desperate'
    ];
    
    const hasUrgentKeywords = urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    const highConfidence = Object.values(confidence).some(conf => conf > 0.8);
    const multipleSymptoms = symptoms.length > 2;
    
    if (hasUrgentKeywords) return 'high';
    if (highConfidence && multipleSymptoms) return 'medium';
    return 'low';
  }

  getToolDescription(toolName) {
    const descriptions = {
      'PHQ-9': 'Assesses depression symptoms over the past 2 weeks',
      'GAD-7': 'Evaluates anxiety symptoms over the past 2 weeks', 
      'GHQ-12': 'General psychological wellbeing and distress screening'
    };
    return descriptions[toolName] || 'Mental health screening tool';
  }
}

module.exports = ScreeningIntegrationService;