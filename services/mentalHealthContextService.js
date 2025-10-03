class MentalHealthContextService {
  constructor() {
    // Coping strategies database organized by situation type
    this.copingStrategies = {
      anxiety: [
        {
          name: "Deep Breathing Exercise",
          description: "Take slow, deep breaths. Inhale for 4 counts, hold for 4, exhale for 6.",
          technique: "breathing",
          immediacy: "immediate"
        },
        {
          name: "5-4-3-2-1 Grounding",
          description: "Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.",
          technique: "grounding",
          immediacy: "immediate"
        },
        {
          name: "Progressive Muscle Relaxation",
          description: "Tense and then relax each muscle group in your body, starting from your toes.",
          technique: "relaxation",
          immediacy: "short-term"
        }
      ],
      
      depression: [
        {
          name: "Gentle Movement",
          description: "Take a short walk, do light stretching, or try gentle yoga.",
          technique: "physical",
          immediacy: "immediate"
        },
        {
          name: "Behavioral Activation",
          description: "Do one small, meaningful activity that you used to enjoy.",
          technique: "behavioral",
          immediacy: "short-term"
        },
        {
          name: "Gratitude Practice",
          description: "Write down three things you're grateful for, no matter how small.",
          technique: "cognitive",
          immediacy: "immediate"
        }
      ],
      
      stress: [
        {
          name: "Time Management",
          description: "Break large tasks into smaller, manageable steps.",
          technique: "organizational",
          immediacy: "short-term"
        },
        {
          name: "Mindful Meditation",
          description: "Spend 5-10 minutes focusing on your breath and present moment.",
          technique: "mindfulness",
          immediacy: "immediate"
        },
        {
          name: "Social Support",
          description: "Reach out to a trusted friend, family member, or counselor.",
          technique: "social",
          immediacy: "immediate"
        }
      ],
      
      general: [
        {
          name: "Journaling",
          description: "Write down your thoughts and feelings to help process them.",
          technique: "expressive",
          immediacy: "immediate"
        },
        {
          name: "Self-Compassion",
          description: "Treat yourself with the same kindness you'd show a good friend.",
          technique: "cognitive",
          immediacy: "immediate"
        },
        {
          name: "Routine Building",
          description: "Establish small, consistent daily routines to create stability.",
          technique: "behavioral",
          immediacy: "long-term"
        }
      ]
    };
    
    // Professional resource recommendations
    this.professionalResources = {
      immediate: [
        {
          type: "Crisis Counseling",
          description: "Immediate professional support for crisis situations",
          resources: [
            "National Suicide Prevention Lifeline: 988",
            "Crisis Text Line: Text HOME to 741741",
            "Local Emergency Services: 911"
          ]
        }
      ],
      
      therapy: [
        {
          type: "Individual Therapy",
          description: "One-on-one counseling with a licensed mental health professional",
          resources: [
            "Psychology Today therapist finder",
            "Campus counseling center",
            "Community mental health centers",
            "Employee Assistance Programs (EAP)"
          ]
        },
        {
          type: "Group Therapy",
          description: "Therapeutic support in a group setting with peers",
          resources: [
            "Support groups through NAMI",
            "Campus group counseling",
            "Community support groups",
            "Online therapy groups"
          ]
        }
      ],
      
      specialized: [
        {
          type: "Specialized Treatment",
          description: "Targeted treatment for specific mental health conditions",
          resources: [
            "Anxiety and depression treatment centers",
            "Eating disorder treatment programs",
            "Trauma-informed therapy specialists",
            "Substance abuse counseling"
          ]
        }
      ],
      
      preventive: [
        {
          type: "Wellness Resources",
          description: "Preventive mental health and wellness support",
          resources: [
            "Campus wellness programs",
            "Mental health apps (Headspace, Calm, BetterHelp)",
            "Peer support programs",
            "Wellness workshops and seminars"
          ]
        }
      ]
    };
    
    // Response enhancement patterns
    this.enhancementPatterns = {
      validation: [
        "Your feelings are completely valid and understandable.",
        "It makes sense that you're feeling this way given what you're going through.",
        "Thank you for sharing something so personal with me.",
        "What you're experiencing is more common than you might think."
      ],
      
      normalization: [
        "Many people experience similar feelings, especially during stressful times.",
        "It's normal to feel overwhelmed when dealing with multiple challenges.",
        "These feelings are a natural response to difficult circumstances.",
        "You're not alone in feeling this way."
      ],
      
      hope: [
        "These difficult feelings are temporary, even though they feel overwhelming right now.",
        "With the right support and strategies, things can improve.",
        "You've shown strength by reaching out and talking about this.",
        "Taking this step to seek help shows your resilience."
      ],
      
      empowerment: [
        "You have more strength than you realize.",
        "You've overcome challenges before, and you can get through this too.",
        "Seeking help is a sign of courage, not weakness.",
        "You're taking positive steps by talking about your feelings."
      ]
    };
    
    // Emotional state detection patterns
    this.emotionalPatterns = {
      anxiety: [
        'anxious', 'worried', 'nervous', 'panic', 'scared', 'afraid',
        'restless', 'on edge', 'tense', 'racing thoughts', 'can\'t relax'
      ],
      
      depression: [
        'sad', 'down', 'empty', 'numb', 'hopeless', 'worthless',
        'tired', 'exhausted', 'no energy', 'can\'t enjoy', 'isolated', 'depressed'
      ],
      
      stress: [
        'stressed', 'overwhelmed', 'pressure', 'too much', 'can\'t handle',
        'burned out', 'stretched thin', 'deadline', 'workload'
      ],
      
      anger: [
        'angry', 'frustrated', 'irritated', 'mad', 'furious',
        'annoyed', 'rage', 'pissed off', 'fed up'
      ],
      
      loneliness: [
        'lonely', 'alone', 'isolated', 'disconnected', 'no one understands',
        'no friends', 'left out', 'abandoned'
      ]
    };
  }

  /**
   * Enhance AI response with mental health context
   * @param {string} originalResponse - Original AI response
   * @param {string} userMessage - User's original message
   * @param {Object} conversationContext - Previous conversation context
   * @returns {Object} Enhanced response with mental health context
   */
  enhanceResponse(originalResponse, userMessage, conversationContext = {}) {
    // Detect emotional state and needs
    const emotionalState = this.detectEmotionalState(userMessage);
    const needsAssessment = this.assessUserNeeds(userMessage, conversationContext);
    
    // Build enhanced response
    let enhancedResponse = originalResponse;
    const enhancements = {
      validation: null,
      copingStrategies: [],
      professionalResources: [],
      followUpSuggestions: []
    };
    
    // Add validation and normalization
    if (emotionalState.length > 0 || needsAssessment.hasExplicitHelpRequest) {
      const validation = this.getValidationResponse(emotionalState);
      if (validation && !this.containsValidation(originalResponse)) {
        enhancements.validation = validation;
        enhancedResponse = `${validation} ${enhancedResponse}`;
      }
    }
    
    // Add coping strategies if appropriate
    if (needsAssessment.needsCoping) {
      const strategies = this.getCopingStrategies(emotionalState, needsAssessment.urgency);
      enhancements.copingStrategies = strategies;
      
      if (strategies.length > 0 && !this.containsCopingAdvice(originalResponse)) {
        const strategyText = this.formatCopingStrategies(strategies.slice(0, 2)); // Limit to 2 strategies
        enhancedResponse += `\n\n${strategyText}`;
      }
    }
    
    // Add professional resource recommendations
    if (needsAssessment.needsProfessionalHelp) {
      const resources = this.getProfessionalResources(needsAssessment.resourceType);
      enhancements.professionalResources = resources;
      
      if (resources.length > 0 && !this.containsProfessionalRecommendation(originalResponse)) {
        const resourceText = this.formatProfessionalResources(resources.slice(0, 1)); // Limit to 1 resource type
        enhancedResponse += `\n\n${resourceText}`;
      }
    }
    
    // Add follow-up suggestions
    const followUp = this.generateFollowUpSuggestions(emotionalState, needsAssessment);
    if (followUp.length > 0) {
      enhancements.followUpSuggestions = followUp;
    }
    
    return {
      enhancedResponse,
      originalResponse,
      enhancements,
      detectedEmotions: emotionalState,
      needsAssessment
    };
  }

  /**
   * Detect emotional state from user message
   * @param {string} message - User's message
   * @returns {Array} Detected emotional states
   */
  detectEmotionalState(message) {
    const lowerMessage = message.toLowerCase();
    const detectedEmotions = [];
    
    for (const [emotion, patterns] of Object.entries(this.emotionalPatterns)) {
      const hasEmotion = patterns.some(pattern => 
        lowerMessage.includes(pattern.toLowerCase())
      );
      
      if (hasEmotion) {
        detectedEmotions.push(emotion);
      }
    }
    
    return detectedEmotions;
  }

  /**
   * Assess user's needs based on message and context
   * @param {string} message - User's message
   * @param {Object} context - Conversation context
   * @returns {Object} Needs assessment
   */
  assessUserNeeds(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Check for explicit help requests
    const helpKeywords = [
      'how do i', 'what should i do', 'can you help', 'i need',
      'what can i', 'how can i', 'advice', 'suggestions'
    ];
    
    const needsCoping = helpKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    ) || this.detectEmotionalDistress(message);
    
    // Assess urgency based on emotional intensity
    const urgencyKeywords = {
      high: ['can\'t take it', 'unbearable', 'too much', 'breaking down', 'can\'t take this anymore'],
      medium: ['really struggling', 'very difficult', 'hard time'],
      low: ['a bit', 'somewhat', 'little']
    };
    
    let urgency = 'low';
    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        urgency = level;
        break;
      }
    }
    
    // Determine if professional help is needed
    const professionalKeywords = [
      'therapist', 'counselor', 'professional help', 'treatment',
      'medication', 'therapy', 'psychiatrist'
    ];
    
    const needsProfessionalHelp = professionalKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    ) || urgency === 'high' || this.detectSevereMentalHealthConcerns(message);
    
    // Determine resource type needed
    let resourceType = 'preventive';
    if (urgency === 'high') {
      resourceType = 'immediate';
    } else if (needsProfessionalHelp) {
      resourceType = 'therapy';
    } else if (this.detectSpecializedNeeds(message)) {
      resourceType = 'specialized';
    }
    
    return {
      needsCoping,
      needsProfessionalHelp,
      urgency,
      resourceType,
      hasExplicitHelpRequest: helpKeywords.some(keyword => lowerMessage.includes(keyword))
    };
  }

  /**
   * Get appropriate validation response
   * @param {Array} emotionalStates - Detected emotional states
   * @returns {string} Validation response
   */
  getValidationResponse(emotionalStates) {
    // Choose validation based on primary emotion
    const primaryEmotion = emotionalStates[0];
    const validationTypes = ['validation', 'normalization'];
    
    if (emotionalStates.includes('depression') || emotionalStates.includes('loneliness')) {
      validationTypes.push('hope');
    }
    
    if (emotionalStates.includes('anxiety') || emotionalStates.includes('stress')) {
      validationTypes.push('empowerment');
    }
    
    const selectedType = validationTypes[Math.floor(Math.random() * validationTypes.length)];
    const responses = this.enhancementPatterns[selectedType];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get relevant coping strategies
   * @param {Array} emotionalStates - Detected emotional states
   * @param {string} urgency - Urgency level
   * @returns {Array} Relevant coping strategies
   */
  getCopingStrategies(emotionalStates, urgency) {
    const strategies = [];
    
    // Get strategies for each detected emotion
    for (const emotion of emotionalStates) {
      if (this.copingStrategies[emotion]) {
        strategies.push(...this.copingStrategies[emotion]);
      }
    }
    
    // Add general strategies if none found
    if (strategies.length === 0) {
      strategies.push(...this.copingStrategies.general);
    }
    
    // Filter by immediacy based on urgency
    const immediacyFilter = urgency === 'high' ? 'immediate' : 
                           urgency === 'medium' ? ['immediate', 'short-term'] : 
                           ['immediate', 'short-term', 'long-term'];
    
    const filteredStrategies = strategies.filter(strategy => {
      if (Array.isArray(immediacyFilter)) {
        return immediacyFilter.includes(strategy.immediacy);
      }
      return strategy.immediacy === immediacyFilter;
    });
    
    // Remove duplicates and limit results
    const uniqueStrategies = filteredStrategies.filter((strategy, index, self) => 
      index === self.findIndex(s => s.name === strategy.name)
    );
    
    return uniqueStrategies.slice(0, 3); // Limit to 3 strategies
  }

  /**
   * Get professional resource recommendations
   * @param {string} resourceType - Type of resource needed
   * @returns {Array} Professional resources
   */
  getProfessionalResources(resourceType) {
    return this.professionalResources[resourceType] || [];
  }

  /**
   * Format coping strategies for response
   * @param {Array} strategies - Coping strategies
   * @returns {string} Formatted strategies text
   */
  formatCopingStrategies(strategies) {
    if (strategies.length === 0) return '';
    
    const intro = strategies.length === 1 ? 
      "Here's a technique that might help:" :
      "Here are some techniques that might help:";
    
    const strategyList = strategies.map(strategy => 
      `**${strategy.name}**: ${strategy.description}`
    ).join('\n\n');
    
    return `${intro}\n\n${strategyList}`;
  }

  /**
   * Format professional resources for response
   * @param {Array} resources - Professional resources
   * @returns {string} Formatted resources text
   */
  formatProfessionalResources(resources) {
    if (resources.length === 0) return '';
    
    const resource = resources[0];
    const resourceList = resource.resources.slice(0, 3).map(r => `• ${r}`).join('\n');
    
    return `**${resource.type}**: ${resource.description}\n\n${resourceList}`;
  }

  /**
   * Generate follow-up suggestions
   * @param {Array} emotionalStates - Detected emotional states
   * @param {Object} needsAssessment - Needs assessment
   * @returns {Array} Follow-up suggestions
   */
  generateFollowUpSuggestions(emotionalStates, needsAssessment) {
    const suggestions = [];
    
    if (needsAssessment.needsCoping) {
      suggestions.push("Would you like to try one of these techniques together?");
    }
    
    if (needsAssessment.needsProfessionalHelp) {
      suggestions.push("Would you like help finding professional support in your area?");
    }
    
    if (emotionalStates.includes('loneliness')) {
      suggestions.push("Would you like to talk about ways to connect with others?");
    }
    
    if (emotionalStates.includes('stress')) {
      suggestions.push("Would you like to explore stress management strategies?");
    }
    
    return suggestions.slice(0, 2); // Limit to 2 suggestions
  }

  /**
   * Check if response already contains validation
   * @param {string} response - Response to check
   * @returns {boolean} True if contains validation
   */
  containsValidation(response) {
    const validationIndicators = [
      'valid', 'understand', 'makes sense', 'normal', 'common',
      'not alone', 'thank you for sharing'
    ];
    
    const lowerResponse = response.toLowerCase();
    return validationIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );
  }

  /**
   * Check if response already contains coping advice
   * @param {string} response - Response to check
   * @returns {boolean} True if contains coping advice
   */
  containsCopingAdvice(response) {
    const copingIndicators = [
      'try', 'technique', 'strategy', 'breathe', 'exercise',
      'practice', 'meditation', 'grounding'
    ];
    
    const lowerResponse = response.toLowerCase();
    return copingIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );
  }

  /**
   * Check if response already contains professional recommendation
   * @param {string} response - Response to check
   * @returns {boolean} True if contains professional recommendation
   */
  containsProfessionalRecommendation(response) {
    const professionalIndicators = [
      'therapist', 'counselor', 'professional', 'therapy',
      'treatment', 'psychiatrist', 'mental health professional'
    ];
    
    const lowerResponse = response.toLowerCase();
    return professionalIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );
  }

  /**
   * Detect emotional distress in message
   * @param {string} message - User's message
   * @returns {boolean} True if distress detected
   */
  detectEmotionalDistress(message) {
    const distressKeywords = [
      'struggling', 'difficult', 'hard time', 'can\'t handle',
      'overwhelming', 'overwhelmed', 'stressed', 'anxious', 'depressed',
      'sad', 'worried', 'scared', 'alone'
    ];
    
    const lowerMessage = message.toLowerCase();
    return distressKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Detect severe mental health concerns
   * @param {string} message - User's message
   * @returns {boolean} True if severe concerns detected
   */
  detectSevereMentalHealthConcerns(message) {
    const severeKeywords = [
      'can\'t function', 'can\'t get out of bed', 'can\'t work',
      'can\'t sleep', 'not eating', 'drinking too much',
      'using drugs', 'hallucinations', 'voices'
    ];
    
    const lowerMessage = message.toLowerCase();
    return severeKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Detect specialized treatment needs
   * @param {string} message - User's message
   * @returns {boolean} True if specialized needs detected
   */
  detectSpecializedNeeds(message) {
    const specializedKeywords = [
      'eating disorder', 'trauma', 'ptsd', 'addiction',
      'substance abuse', 'bipolar', 'ocd', 'adhd'
    ];
    
    const lowerMessage = message.toLowerCase();
    return specializedKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Validate response appropriateness for mental health context
   * @param {string} response - Response to validate
   * @returns {Object} Validation result
   */
  validateMentalHealthResponse(response) {
    const issues = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for inappropriate content
    const inappropriateKeywords = [
      'just get over it', 'think positive', 'others have it worse',
      'you\'re being dramatic', 'it\'s all in your head', 'snap out of it'
    ];
    
    inappropriateKeywords.forEach(keyword => {
      if (lowerResponse.includes(keyword)) {
        issues.push(`Contains potentially harmful phrase: "${keyword}"`);
      }
    });
    
    // Check for empathy and supportive language - more comprehensive and flexible
    const empathyIndicators = [
      // Direct empathy
      'understand', 'hear', 'feel', 'sorry', 'empathy', 'compassion',
      // Validation
      'valid', 'makes sense', 'sounds like', 'natural', 'normal', 'common', 'okay',
      // Support
      'help', 'support', 'care', 'listen', 'here', 'with you', 'not alone',
      // Acknowledgment
      'difficult', 'challenging', 'tough', 'hard', 'struggle', 'dealing with', 'going through',
      // Encouragement
      'brave', 'courage', 'strength', 'strong', 'capable', 'resilient', 'hope',
      // Engagement
      'sharing', 'telling', 'opening up', 'reaching out', 'talking', 'expressing',
      // Appreciation
      'thank', 'appreciate', 'glad', 'important', 'matter', 'value',
      // Questions showing care
      'how', 'what', 'when', 'would you', 'can you', 'have you', 'do you',
      // Gentle language
      'might', 'could', 'perhaps', 'maybe', 'sometimes', 'often', 'try', 'consider'
    ];
    
    const hasEmpathy = empathyIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );
    
    // Check for questions or engagement
    const hasEngagement = /[?]/.test(response) || 
                         /\b(tell me|share|how are|what's|would you|can you|have you)\b/i.test(response);
    
    // Only flag if it's a longer response with no empathy AND no engagement
    if (!hasEmpathy && !hasEngagement && response.length > 150) {
      issues.push('Response may lack empathetic language or engagement');
    }
    
    // Check response length - more reasonable limits
    if (response.length < 15) {
      issues.push('Response may be too brief for mental health context');
    }
    
    if (response.length > 1500) {
      issues.push('Response may be too lengthy and overwhelming');
    }
    

    
    return {
      isAppropriate: issues.length === 0,
      issues,
      hasEmpathy,
      length: response.length
    };
  }
}

module.exports = MentalHealthContextService;