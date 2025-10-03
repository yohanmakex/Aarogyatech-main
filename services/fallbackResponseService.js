/**
 * Fallback Response Service
 * Provides offline and fallback capabilities when main AI services are unavailable
 */
class FallbackResponseService {
  constructor() {
    // Cached responses for common mental health topics
    this.responseCache = new Map();
    
    // Template responses organized by category
    this.templateResponses = this.initializeTemplateResponses();
    
    // Coping strategies database
    this.copingStrategies = this.initializeCopingStrategies();
    
    // Crisis detection patterns (simplified)
    this.crisisPatterns = this.initializeCrisisPatterns();
    
    // Mental health resources
    this.mentalHealthResources = this.initializeMentalHealthResources();
    
    // Response quality metrics
    this.responseMetrics = {
      totalResponses: 0,
      fallbackResponses: 0,
      templateResponses: 0,
      cachedResponses: 0,
      userSatisfactionRating: 0
    };
  }

  /**
   * Initialize template responses for different mental health scenarios
   */
  initializeTemplateResponses() {
    return {
      greeting: [
        "Hello! I'm here to listen and support you. How are you feeling today?",
        "Hi there! I'm glad you reached out. What's on your mind?",
        "Welcome! I'm here to provide a safe space for you to share. How can I help?",
        "Hello! Thank you for being here. What would you like to talk about?"
      ],
      
      anxiety: [
        "I understand you're feeling anxious. That's a very common experience, and you're not alone. Let's try some grounding techniques together.",
        "Anxiety can feel overwhelming, but remember that this feeling will pass. Can you try taking slow, deep breaths with me?",
        "I hear that you're experiencing anxiety. It's okay to feel this way. Have you tried the 5-4-3-2-1 grounding technique?",
        "Anxiety is your body's way of trying to protect you, but sometimes it can be too much. Let's work on some coping strategies together."
      ],
      
      depression: [
        "I'm sorry you're going through this difficult time. Depression can make everything feel harder, but you're brave for reaching out.",
        "Thank you for sharing with me. Depression can feel isolating, but you're not alone in this experience.",
        "I hear you, and I want you to know that your feelings are valid. Depression is a real condition, and it's not your fault.",
        "It takes courage to talk about depression. I'm here to listen and support you through this."
      ],
      
      stress: [
        "Stress can really take a toll on both your mind and body. What's been causing you the most stress lately?",
        "I understand you're feeling stressed. Let's talk about some ways to manage these feelings and find some relief.",
        "Stress is a normal response to challenging situations, but it's important to take care of yourself. What helps you relax?",
        "It sounds like you're dealing with a lot right now. Stress can be overwhelming, but there are ways to cope."
      ],
      
      loneliness: [
        "Feeling lonely can be really painful. I want you to know that you're not alone, even when it feels that way.",
        "Loneliness is a difficult emotion to experience. Thank you for sharing this with me. You matter, and your feelings are important.",
        "I hear that you're feeling lonely. This is a common human experience, and it doesn't reflect your worth as a person.",
        "Loneliness can feel overwhelming, but reaching out like you're doing now is a positive step toward connection."
      ],
      
      overwhelmed: [
        "Feeling overwhelmed is a sign that you're dealing with a lot right now. Let's break things down into smaller, manageable pieces.",
        "When everything feels like too much, it's okay to take a step back and breathe. You don't have to handle everything at once.",
        "I understand that feeling of being overwhelmed. It's like having too many thoughts and responsibilities all at once.",
        "Being overwhelmed is exhausting. Let's talk about some strategies to help you feel more in control."
      ],
      
      anger: [
        "Anger is a valid emotion, and it's okay to feel this way. Let's talk about what's behind these feelings.",
        "I hear that you're feeling angry. Anger often comes from feeling hurt, frustrated, or misunderstood.",
        "It's important to acknowledge your anger rather than suppress it. What's been triggering these feelings?",
        "Anger can be a powerful emotion. Let's explore healthy ways to express and process these feelings."
      ],
      
      general_support: [
        "I'm here to listen and support you. Your feelings are valid, and you deserve care and understanding.",
        "Thank you for trusting me with your thoughts. You're taking a positive step by reaching out.",
        "I want you to know that you're not alone in whatever you're going through. I'm here to help.",
        "Your mental health matters, and so do you. I'm glad you're here and willing to talk.",
        "It's okay to not be okay sometimes. What's important is that you're seeking support."
      ],
      
      encouragement: [
        "You're stronger than you realize, and you've overcome challenges before. You can get through this too.",
        "Taking care of your mental health shows self-awareness and strength. I'm proud of you for reaching out.",
        "Every small step you take toward feeling better matters. You're doing the best you can.",
        "Remember that healing isn't linear. It's okay to have good days and difficult days.",
        "You have the strength within you to face whatever you're going through. I believe in you."
      ],
      
      coping_request: [
        "I'd be happy to share some coping strategies with you. What type of situation are you dealing with?",
        "There are many effective coping techniques we can explore together. What feels most challenging right now?",
        "Coping strategies can be really helpful. Let me share some techniques that many people find useful.",
        "I'm glad you're looking for healthy ways to cope. That shows great self-awareness."
      ],
      
      crisis_mild: [
        "I'm concerned about what you're sharing. While I want to help, please consider reaching out to a mental health professional for additional support.",
        "It sounds like you're going through a really difficult time. Have you considered talking to a counselor or therapist?",
        "I hear that you're struggling. In addition to our conversation, it might be helpful to connect with a mental health professional.",
        "Thank you for sharing something so personal with me. Professional support could be really beneficial for what you're experiencing."
      ],
      
      validation: [
        "Your feelings are completely valid and understandable given what you're going through.",
        "It makes perfect sense that you would feel this way. Your emotions are a normal response to your situation.",
        "I want to validate your experience. What you're feeling is real and important.",
        "Your feelings matter, and they deserve to be acknowledged and respected."
      ],
      
      self_care: [
        "Self-care isn't selfish - it's necessary. What are some things that usually help you feel better?",
        "Taking care of yourself is important, especially during difficult times. What does self-care look like for you?",
        "Remember to be gentle with yourself. You deserve the same kindness you would show a good friend.",
        "Self-care can be simple things like getting enough sleep, eating well, or doing something you enjoy."
      ]
    };
  }

  /**
   * Initialize coping strategies database
   */
  initializeCopingStrategies() {
    return {
      breathing: [
        "Try the 4-7-8 breathing technique: Breathe in for 4 counts, hold for 7, exhale for 8. Repeat 3-4 times.",
        "Practice box breathing: Breathe in for 4, hold for 4, exhale for 4, hold for 4. This can help calm your nervous system.",
        "Take slow, deep breaths. Focus on making your exhale longer than your inhale to activate your body's relaxation response."
      ],
      
      grounding: [
        "Try the 5-4-3-2-1 technique: Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.",
        "Ground yourself by pressing your feet firmly into the floor and noticing the sensation of being supported.",
        "Hold an ice cube or splash cold water on your face to help bring your attention to the present moment."
      ],
      
      movement: [
        "Even a short 5-minute walk can help improve your mood and reduce stress.",
        "Try some gentle stretching or yoga poses to release physical tension.",
        "Dance to your favorite song - movement can help shift your emotional state."
      ],
      
      mindfulness: [
        "Practice mindful observation: Choose an object and spend 2-3 minutes noticing every detail about it.",
        "Try a body scan: Start at your toes and slowly notice how each part of your body feels.",
        "Practice mindful listening: Focus completely on the sounds around you for a few minutes."
      ],
      
      social: [
        "Reach out to a trusted friend or family member, even if it's just to say hello.",
        "Consider joining a support group or online community where you can connect with others.",
        "Sometimes helping others can help us feel better too - consider volunteering or doing something kind for someone."
      ],
      
      creative: [
        "Try journaling about your thoughts and feelings - sometimes writing them down can provide clarity.",
        "Engage in a creative activity like drawing, painting, or crafting to express yourself.",
        "Listen to music that matches your mood, then gradually shift to more uplifting songs."
      ],
      
      cognitive: [
        "Challenge negative thoughts by asking: Is this thought realistic? What would I tell a friend in this situation?",
        "Practice gratitude by naming three things you're thankful for, no matter how small.",
        "Use positive self-talk: Speak to yourself with the same kindness you'd show a good friend."
      ]
    };
  }

  /**
   * Initialize crisis detection patterns
   */
  initializeCrisisPatterns() {
    return {
      high_risk: [
        'suicide', 'kill myself', 'end it all', 'not worth living', 'better off dead',
        'want to die', 'end my life', 'hurt myself', 'self harm', 'cut myself'
      ],
      
      medium_risk: [
        'hopeless', 'no point', 'give up', 'can\'t go on', 'too much pain',
        'nobody cares', 'alone forever', 'worthless', 'burden', 'trapped'
      ],
      
      emotional_distress: [
        'overwhelmed', 'can\'t cope', 'falling apart', 'breaking down',
        'panic', 'terrified', 'desperate', 'exhausted', 'empty'
      ]
    };
  }

  /**
   * Initialize mental health resources
   */
  initializeMentalHealthResources() {
    return {
      crisis: [
        {
          name: 'National Suicide Prevention Lifeline',
          contact: '988',
          description: '24/7 free and confidential support for people in distress',
          type: 'phone'
        },
        {
          name: 'Crisis Text Line',
          contact: 'Text HOME to 741741',
          description: '24/7 crisis support via text message',
          type: 'text'
        },
        {
          name: 'Emergency Services',
          contact: '911',
          description: 'For immediate life-threatening emergencies',
          type: 'emergency'
        }
      ],
      
      support: [
        {
          name: 'NAMI (National Alliance on Mental Illness)',
          contact: '1-800-950-NAMI (6264)',
          description: 'Information, referrals, and support for mental health',
          type: 'phone'
        },
        {
          name: 'SAMHSA National Helpline',
          contact: '1-800-662-4357',
          description: 'Treatment referral and information service',
          type: 'phone'
        }
      ],
      
      online: [
        {
          name: 'BetterHelp',
          contact: 'betterhelp.com',
          description: 'Online therapy and counseling services',
          type: 'website'
        },
        {
          name: 'Psychology Today',
          contact: 'psychologytoday.com',
          description: 'Find therapists and mental health professionals',
          type: 'website'
        }
      ]
    };
  }

  /**
   * Generate fallback response based on user input
   * @param {string} userMessage - User's message
   * @param {Object} context - Conversation context
   * @returns {Object} Fallback response
   */
  generateFallbackResponse(userMessage, context = {}) {
    this.responseMetrics.totalResponses++;
    this.responseMetrics.fallbackResponses++;

    // Check for crisis indicators first
    const crisisLevel = this.detectCrisisLevel(userMessage);
    if (crisisLevel === 'high') {
      return this.generateCrisisResponse(userMessage, 'high');
    }

    // Analyze message for emotional content and topics
    const analysis = this.analyzeMessage(userMessage);
    
    // Generate appropriate response based on analysis
    const response = this.selectResponse(analysis, context);
    
    // Add coping strategies if appropriate
    const copingStrategies = this.selectCopingStrategies(analysis);
    
    // Add resources if needed
    const resources = this.selectResources(analysis, crisisLevel);

    return {
      message: response,
      isFallback: true,
      fallbackType: 'template-response',
      analysis: {
        detectedEmotions: analysis.emotions,
        detectedTopics: analysis.topics,
        crisisLevel: crisisLevel
      },
      copingStrategies: copingStrategies,
      resources: resources,
      metadata: {
        responseSource: 'fallback-service',
        confidence: analysis.confidence,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Detect crisis level in user message
   * @param {string} message - User message
   * @returns {string} Crisis level: 'none', 'low', 'medium', 'high'
   */
  detectCrisisLevel(message) {
    const lowerMessage = message.toLowerCase();
    
    // Check for high-risk indicators
    for (const pattern of this.crisisPatterns.high_risk) {
      if (lowerMessage.includes(pattern)) {
        return 'high';
      }
    }
    
    // Check for medium-risk indicators
    for (const pattern of this.crisisPatterns.medium_risk) {
      if (lowerMessage.includes(pattern)) {
        return 'medium';
      }
    }
    
    // Check for emotional distress indicators
    for (const pattern of this.crisisPatterns.emotional_distress) {
      if (lowerMessage.includes(pattern)) {
        return 'low';
      }
    }
    
    return 'none';
  }

  /**
   * Generate crisis response
   * @param {string} message - User message
   * @param {string} level - Crisis level
   * @returns {Object} Crisis response
   */
  generateCrisisResponse(message, level) {
    const crisisResponses = {
      high: [
        "I'm very concerned about what you're sharing. Your life has value, and there are people who want to help. Please contact the National Suicide Prevention Lifeline at 988 or emergency services at 911 immediately.",
        "I hear that you're in a lot of pain right now. Please reach out for immediate help - call 988 for the Suicide & Crisis Lifeline or go to your nearest emergency room. You don't have to go through this alone.",
        "What you're feeling right now is temporary, even though it might not feel that way. Please contact emergency services (911) or the crisis lifeline (988) right away. Your life matters."
      ],
      medium: [
        "I'm concerned about what you're sharing. While I want to help, please consider reaching out to a mental health professional or crisis support line for additional help.",
        "It sounds like you're going through an incredibly difficult time. Have you considered contacting a crisis support line like 988 or speaking with a mental health professional?",
        "I hear how much pain you're in. Please know that professional help is available - consider calling 988 for the Suicide & Crisis Lifeline or reaching out to a therapist."
      ]
    };

    const responses = crisisResponses[level] || crisisResponses.medium;
    const selectedResponse = this.getRandomItem(responses);

    return {
      message: selectedResponse,
      isCrisis: true,
      crisisLevel: level,
      resources: this.mentalHealthResources.crisis,
      urgentAction: level === 'high',
      isFallback: true,
      fallbackType: 'crisis-response'
    };
  }

  /**
   * Analyze user message for emotional content and topics
   * @param {string} message - User message
   * @returns {Object} Message analysis
   */
  analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    const analysis = {
      emotions: [],
      topics: [],
      confidence: 0.7, // Default confidence for template matching
      needsCoping: false,
      needsValidation: false,
      needsEncouragement: false
    };

    // Emotion detection
    const emotionKeywords = {
      anxiety: ['anxious', 'worried', 'nervous', 'panic', 'fear', 'scared', 'stress'],
      depression: ['sad', 'depressed', 'down', 'hopeless', 'empty', 'numb'],
      anger: ['angry', 'mad', 'furious', 'irritated', 'frustrated', 'rage'],
      loneliness: ['lonely', 'alone', 'isolated', 'disconnected', 'abandoned'],
      overwhelmed: ['overwhelmed', 'too much', 'can\'t handle', 'drowning'],
      grief: ['loss', 'grief', 'mourning', 'miss', 'died', 'death']
    };

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.emotions.push(emotion);
      }
    }

    // Topic detection
    const topicKeywords = {
      work: ['work', 'job', 'career', 'boss', 'colleague', 'office'],
      relationships: ['relationship', 'partner', 'boyfriend', 'girlfriend', 'marriage', 'divorce'],
      family: ['family', 'parents', 'mother', 'father', 'siblings', 'children'],
      school: ['school', 'college', 'university', 'grades', 'exam', 'study'],
      health: ['health', 'illness', 'sick', 'medical', 'doctor', 'hospital'],
      finances: ['money', 'financial', 'debt', 'bills', 'budget', 'income']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.topics.push(topic);
      }
    }

    // Determine needs
    const copingKeywords = ['help', 'what should i do', 'how do i', 'strategies', 'cope'];
    analysis.needsCoping = copingKeywords.some(keyword => lowerMessage.includes(keyword));

    const validationKeywords = ['feel like', 'am i', 'is it normal', 'wrong with me'];
    analysis.needsValidation = validationKeywords.some(keyword => lowerMessage.includes(keyword));

    const encouragementKeywords = ['give up', 'can\'t do', 'not strong', 'failing'];
    analysis.needsEncouragement = encouragementKeywords.some(keyword => lowerMessage.includes(keyword));

    return analysis;
  }

  /**
   * Select appropriate response based on analysis
   * @param {Object} analysis - Message analysis
   * @param {Object} context - Conversation context
   * @returns {string} Selected response
   */
  selectResponse(analysis, context) {
    // Prioritize based on detected emotions and needs
    if (analysis.needsValidation) {
      return this.getRandomItem(this.templateResponses.validation);
    }

    if (analysis.needsEncouragement) {
      return this.getRandomItem(this.templateResponses.encouragement);
    }

    if (analysis.needsCoping) {
      return this.getRandomItem(this.templateResponses.coping_request);
    }

    // Select based on primary emotion
    if (analysis.emotions.length > 0) {
      const primaryEmotion = analysis.emotions[0];
      if (this.templateResponses[primaryEmotion]) {
        return this.getRandomItem(this.templateResponses[primaryEmotion]);
      }
    }

    // Check if this is a greeting
    const greetingKeywords = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
    const lowerMessage = context.message?.toLowerCase() || '';
    if (greetingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return this.getRandomItem(this.templateResponses.greeting);
    }

    // Default to general support
    return this.getRandomItem(this.templateResponses.general_support);
  }

  /**
   * Select appropriate coping strategies
   * @param {Object} analysis - Message analysis
   * @returns {Array} Selected coping strategies
   */
  selectCopingStrategies(analysis) {
    const strategies = [];

    if (analysis.emotions.includes('anxiety')) {
      strategies.push(...this.copingStrategies.breathing);
      strategies.push(...this.copingStrategies.grounding);
    }

    if (analysis.emotions.includes('overwhelmed')) {
      strategies.push(...this.copingStrategies.mindfulness);
      strategies.push(...this.copingStrategies.breathing);
    }

    if (analysis.emotions.includes('depression')) {
      strategies.push(...this.copingStrategies.movement);
      strategies.push(...this.copingStrategies.social);
    }

    if (analysis.emotions.includes('anger')) {
      strategies.push(...this.copingStrategies.movement);
      strategies.push(...this.copingStrategies.creative);
    }

    if (analysis.emotions.includes('loneliness')) {
      strategies.push(...this.copingStrategies.social);
      strategies.push(...this.copingStrategies.creative);
    }

    // If no specific strategies, provide general ones
    if (strategies.length === 0) {
      strategies.push(...this.copingStrategies.breathing.slice(0, 1));
      strategies.push(...this.copingStrategies.mindfulness.slice(0, 1));
    }

    // Return up to 3 strategies to avoid overwhelming the user
    return this.shuffleArray(strategies).slice(0, 3);
  }

  /**
   * Select appropriate resources
   * @param {Object} analysis - Message analysis
   * @param {string} crisisLevel - Crisis level
   * @returns {Array} Selected resources
   */
  selectResources(analysis, crisisLevel) {
    if (crisisLevel === 'high' || crisisLevel === 'medium') {
      return this.mentalHealthResources.crisis;
    }

    if (crisisLevel === 'low' || analysis.emotions.length > 0) {
      return [...this.mentalHealthResources.support, ...this.mentalHealthResources.online];
    }

    return [];
  }

  /**
   * Cache a response for future use
   * @param {string} key - Cache key
   * @param {Object} response - Response to cache
   */
  cacheResponse(key, response) {
    // Simple cache with size limit
    if (this.responseCache.size >= 100) {
      // Remove oldest entry
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
      useCount: 0
    });
  }

  /**
   * Get cached response if available
   * @param {string} key - Cache key
   * @returns {Object|null} Cached response or null
   */
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (cached) {
      cached.useCount++;
      this.responseMetrics.cachedResponses++;
      return cached.response;
    }
    return null;
  }

  /**
   * Generate a cache key from user message
   * @param {string} message - User message
   * @returns {string} Cache key
   */
  generateCacheKey(message) {
    // Simple hash-like key generation
    return message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .sort()
      .join('_')
      .substring(0, 50);
  }

  /**
   * Get a random item from an array
   * @param {Array} array - Array to select from
   * @returns {*} Random item
   */
  getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Shuffle an array
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    return {
      ...this.responseMetrics,
      cacheSize: this.responseCache.size,
      templateCategories: Object.keys(this.templateResponses).length,
      copingStrategiesCount: Object.values(this.copingStrategies).flat().length,
      resourcesCount: Object.values(this.mentalHealthResources).flat().length
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.responseMetrics = {
      totalResponses: 0,
      fallbackResponses: 0,
      templateResponses: 0,
      cachedResponses: 0,
      userSatisfactionRating: 0
    };
  }

  /**
   * Clear response cache
   */
  clearCache() {
    this.responseCache.clear();
  }

  /**
   * Update user satisfaction rating
   * @param {number} rating - Rating from 1-5
   */
  updateSatisfactionRating(rating) {
    if (rating >= 1 && rating <= 5) {
      // Simple moving average
      const currentRating = this.responseMetrics.userSatisfactionRating;
      const totalResponses = this.responseMetrics.totalResponses;
      
      this.responseMetrics.userSatisfactionRating = 
        ((currentRating * (totalResponses - 1)) + rating) / totalResponses;
    }
  }
}

module.exports = FallbackResponseService;