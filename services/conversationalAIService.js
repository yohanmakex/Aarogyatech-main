const axios = require('axios');
const GroqService = require('./groqService');
const CrisisDetectionService = require('./crisisDetectionService');
const MentalHealthContextService = require('./mentalHealthContextService');
const SessionManagementService = require('./sessionManagementService');
const PrivacyService = require('./privacyService');
const SecureApiService = require('./secureApiService');
const ErrorHandlingService = require('./errorHandlingService');
const FallbackResponseService = require('./fallbackResponseService');
const LanguageService = require('./languageService');
const PerformanceOptimizationService = require('./performanceOptimizationService');
const CachingService = require('./cachingService');

class ConversationalAIService {
  constructor() {
    // Initialize Groq service for AI generation
    this.groqService = new GroqService();
    
    // Legacy Hugging Face configuration (deprecated)
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.modelUrl = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-small';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.maxContextLength = 1000; // Maximum characters to keep in context
    
    // Initialize new security and privacy services
    this.sessionManager = new SessionManagementService();
    this.privacyService = new PrivacyService();
    this.secureApiService = new SecureApiService();
    
    // Initialize crisis detection service
    this.crisisDetection = new CrisisDetectionService();
    
    // Initialize mental health context service
    this.mentalHealthContext = new MentalHealthContextService();
    
    // Initialize error handling and fallback services
    this.errorHandler = new ErrorHandlingService();
    this.fallbackService = new FallbackResponseService();
    
    // Initialize language service
    this.languageService = new LanguageService();
    
    // Initialize performance optimization services
    this.performanceOptimizer = new PerformanceOptimizationService();
    this.cachingService = new CachingService();
    
    // Set up crisis event logging
    this.crisisDetection.on('crisisDetected', (crisisData) => {
      this._logCrisisEvent(crisisData);
    });
    
    // Mental health response templates
    this.mentalHealthResponses = {
      crisis: [
        "I'm concerned about what you're sharing. Please reach out to a crisis helpline immediately: National Suicide Prevention Lifeline at 988 or text HOME to 741741.",
        "Your safety is important. Please contact emergency services (911) or a mental health crisis line right away. You don't have to go through this alone.",
        "I hear that you're in pain. Please reach out for immediate help: call 988 for the Suicide & Crisis Lifeline or go to your nearest emergency room."
      ],
      supportive: [
        "I understand you're going through a difficult time. It's brave of you to reach out.",
        "Your feelings are valid, and it's okay to not be okay sometimes.",
        "Thank you for sharing with me. You're not alone in this.",
        "It sounds like you're dealing with a lot right now. How can I best support you?"
      ],
      copingStrategies: [
        "Have you tried any breathing exercises? Taking slow, deep breaths can help manage anxiety in the moment.",
        "Sometimes it helps to ground yourself by naming 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.",
        "Consider reaching out to a trusted friend, family member, or counselor when you're feeling overwhelmed.",
        "Regular exercise, even just a short walk, can help improve mood and reduce stress."
      ]
    };
  }

  /**
   * Check if the service is properly configured
   * @returns {boolean} True if Groq service is available
   */
  isServiceAvailable() {
    return this.groqService.isServiceAvailable();
  }

  /**
   * Process a message and generate an appropriate response
   * @param {string} message - User's message
   * @param {string} sessionId - Session identifier
   * @param {Object} requestInfo - Additional request information for security
   * @param {string} userLanguage - User's preferred language (default: 'en')
   * @returns {Promise<Object>} Response object with message and crisis info
   */
  async processMessage(message, sessionId, requestInfo = {}, userLanguage = 'en') {
    if (!this.isServiceAvailable()) {
      throw new Error('Conversational AI service not configured');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message provided');
    }

    // Get or create secure session
    let session = this.sessionManager.getSession(sessionId);
    if (!session) {
      const sessionInfo = this.sessionManager.createSession({
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        encryptionEnabled: true,
        anonymized: true
      });
      session = this.sessionManager.getSession(sessionInfo.sessionId);
      sessionId = sessionInfo.sessionId;
    }

    // Validate session security
    const securityValidation = this.sessionManager.validateSessionSecurity(sessionId, requestInfo);
    if (!securityValidation.valid) {
      throw new Error(`Session security validation failed: ${securityValidation.reason}`);
    }

    // Detect and process language
    const detectedLanguage = await this.languageService.detectLanguage(message);
    
    // Check cache first for quick responses
    const cachedResponse = this.cachingService.getCachedResponse(message, requestInfo, userLanguage);
    if (cachedResponse) {
      // Update session context with cached interaction
      this.sessionManager.updateSessionContext(sessionId, {
        message: {
          role: 'user',
          content: message,
          language: detectedLanguage,
          cached: true
        }
      });

      this.sessionManager.updateSessionContext(sessionId, {
        message: {
          role: 'assistant',
          content: cachedResponse.response,
          language: userLanguage,
          cached: true
        }
      });

      return {
        message: cachedResponse.response,
        isCrisis: false,
        crisisData: null,
        cached: true,
        sessionId: sessionId,
        languageInfo: {
          userLanguage: userLanguage,
          detectedLanguage: detectedLanguage,
          translationApplied: false
        },
        privacyInfo: {
          piiDetected: false,
          anonymized: false
        }
      };
    }

    // Anonymize user message for privacy
    const anonymizationResult = this.privacyService.anonymizeMessage(message);
    const processedMessage = anonymizationResult.anonymizedMessage;

    // Log PII detection if found
    if (anonymizationResult.piiDetected) {
      console.warn(`PII detected in session ${sessionId.substring(0, 8)}..., anonymized before processing`);
    }

    // Analyze message for crisis indicators using dedicated service
    const crisisAnalysis = this.crisisDetection.analyzeMessage(processedMessage, sessionId);
    
    // If crisis detected, return crisis response immediately
    if (crisisAnalysis.isCrisis) {
      let crisisResponse;
      
      try {
        // Generate crisis-specific response using Groq
        crisisResponse = await this.groqService.generateCrisisResponse(processedMessage, crisisAnalysis.severity);
      } catch (error) {
        console.warn('Groq crisis response generation failed, using fallback:', error.message);
        crisisResponse = crisisAnalysis.response; // Use crisis detection service fallback
      }
      
      // Process crisis response for user's language
      const languageProcessedCrisis = await this.languageService.processAIResponse(
        crisisResponse, 
        userLanguage, 
        'en'
      );
      
      // Get language-specific crisis resources
      const languageResources = this.languageService.getMentalHealthResourcesForLanguage(userLanguage);
      
      // Update session context with crisis interaction
      this.sessionManager.updateSessionContext(sessionId, {
        message: {
          role: 'user',
          content: processedMessage,
          originalPiiDetected: anonymizationResult.piiDetected,
          language: detectedLanguage,
          crisis: true
        }
      });

      this.sessionManager.updateSessionContext(sessionId, {
        message: {
          role: 'assistant',
          content: languageProcessedCrisis.response,
          language: userLanguage,
          crisis: true
        }
      });
      
      // Create escalation workflow if needed
      const workflow = this.crisisDetection.createEscalationWorkflow(
        sessionId, 
        crisisAnalysis.severity
      );
      
      return {
        message: languageProcessedCrisis.response,
        isCrisis: true,
        crisisData: {
          severity: crisisAnalysis.severity,
          keywords: crisisAnalysis.keywords,
          escalationLevel: crisisAnalysis.escalationLevel,
          resources: [...crisisAnalysis.resources, ...languageResources],
          workflow: workflow
        },
        sessionId: sessionId,
        languageInfo: {
          userLanguage: userLanguage,
          detectedLanguage: detectedLanguage,
          translationApplied: languageProcessedCrisis.translationApplied
        },
        privacyInfo: {
          piiDetected: anonymizationResult.piiDetected,
          anonymized: true
        }
      };
    }

    // Get session context for AI generation
    const sessionContext = session.context || { messages: [] };

    let response;
    let enhancementData = null;
    let languageProcessedResponse = null;
    
    try {
      // Translate user message to English for AI processing if needed
      let messageForAI = processedMessage;
      if (detectedLanguage !== 'en') {
        try {
          messageForAI = await this.languageService.translateText(processedMessage, detectedLanguage, 'en');
        } catch (error) {
          console.warn('Failed to translate user message to English, using original:', error);
        }
      }
      
      // Generate AI response using Groq service
      let rawResponse;
      try {
        // Prepare conversation history for Groq
        const conversationHistory = this._prepareConversationHistory(sessionContext);
        rawResponse = await this.groqService.generateResponse(messageForAI, conversationHistory);
        
        // Validate the Groq response
        const validation = this.groqService.validateResponse(rawResponse);
        if (!validation.isValid) {
          console.warn('Groq response validation failed:', validation.issues);
          throw new Error('Generated response failed validation: ' + validation.issues.join(', '));
        }
        
      } catch (error) {
        console.warn('Groq AI generation failed, using enhanced fallback:', error.message);
        // Use enhanced mental health responses instead of generic fallback
        rawResponse = this._getEnhancedMentalHealthResponse(messageForAI, sessionContext);
      }
      
      // Enhance response with mental health context using the dedicated service
      const enhancement = this.mentalHealthContext.enhanceResponse(
        rawResponse, 
        messageForAI, 
        { recentMessages: sessionContext.messages.slice(-3) }
      );
      
      response = enhancement.enhancedResponse;
      enhancementData = enhancement;
      
      // Validate the enhanced response
      const validation = this.mentalHealthContext.validateMentalHealthResponse(response);
      if (!validation.isAppropriate) {
        console.warn('Enhanced response failed validation:', validation.issues);
        // Try the original response
        const originalValidation = this.mentalHealthContext.validateMentalHealthResponse(rawResponse);
        if (originalValidation.isAppropriate) {
          response = rawResponse;
          enhancementData = null;
        } else {
          // Both failed, use a safe fallback
          console.warn('Both enhanced and original responses failed validation, using safe fallback');
          response = this._getSafeResponse(messageForAI);
          enhancementData = {
            type: 'safe_fallback',
            source: 'validation_failure',
            originalIssues: validation.issues,
            enhancedIssues: originalValidation.issues
          };
        }
      }
      
      // Process response for user's language
      languageProcessedResponse = await this.languageService.processAIResponse(
        response, 
        userLanguage, 
        'en'
      );
      
      response = languageProcessedResponse.response;
      
      // Cache the successful response for future use
      this.cachingService.cacheResponse(
        processedMessage, 
        response, 
        { 
          enhancementType: enhancementData?.type,
          sessionContext: sessionContext.messages.length 
        }, 
        userLanguage
      );
      
    } catch (error) {
      console.error('AI generation failed, using enhanced error handling:', error);
      
      // Use enhanced error handling
      const errorResult = await this.errorHandler.handleError(error, 'conversational-ai', {
        message: processedMessage,
        sessionId: sessionId,
        requestInfo: requestInfo
      });
      
      if (errorResult.fallback) {
        response = errorResult.fallback.message;
        enhancementData = {
          type: 'fallback',
          source: 'error-handler',
          errorType: errorResult.error.type
        };
      } else {
        response = this._getFallbackResponse(processedMessage);
      }
      
      // Process fallback response for user's language
      try {
        languageProcessedResponse = await this.languageService.processAIResponse(
          response, 
          userLanguage, 
          'en'
        );
        response = languageProcessedResponse.response;
      } catch (langError) {
        console.warn('Failed to process fallback response for language:', langError);
      }
    }

    // Update session context with both messages
    this.sessionManager.updateSessionContext(sessionId, {
      message: {
        role: 'user',
        content: processedMessage,
        originalPiiDetected: anonymizationResult.piiDetected,
        language: detectedLanguage
      }
    });

    this.sessionManager.updateSessionContext(sessionId, {
      message: {
        role: 'assistant',
        content: response,
        language: userLanguage
      }
    });

    return {
      message: response,
      isCrisis: false,
      crisisData: null,
      mentalHealthEnhancement: enhancementData,
      sessionId: sessionId,
      languageInfo: {
        userLanguage: userLanguage,
        detectedLanguage: detectedLanguage,
        translationApplied: languageProcessedResponse ? languageProcessedResponse.translationApplied : false,
        originalResponse: languageProcessedResponse ? languageProcessedResponse.originalResponse : null
      },
      privacyInfo: {
        piiDetected: anonymizationResult.piiDetected,
        anonymized: true,
        confidence: anonymizationResult.confidence
      }
    };
  }

  /**
   * Detect crisis keywords in user message (legacy method - now uses CrisisDetectionService)
   * @param {string} message - User's message
   * @returns {boolean} True if crisis keywords detected
   */
  detectCrisisKeywords(message) {
    const analysis = this.crisisDetection.analyzeMessage(message, 'temp-session');
    return analysis.isCrisis;
  }

  /**
   * Maintain conversation context
   * @param {string} sessionId - Session identifier
   * @param {string} userMessage - User's message
   * @param {string} aiResponse - AI's response
   */
  maintainContext(sessionId, userMessage, aiResponse) {
    let context = this.sessions.get(sessionId) || { messages: [] };
    
    context.messages.push(
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      },
      {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }
    );

    context = this._trimContext(context);
    this.sessions.set(sessionId, context);
  }

  /**
   * Clear session data
   * @param {string} sessionId - Session identifier
   */
  clearSession(sessionId) {
    // Clear session using secure session manager
    const success = this.sessionManager.clearSessionContext(sessionId);
    this.crisisDetection.clearSession(sessionId);
    return success;
  }

  /**
   * Destroy session completely
   * @param {string} sessionId - Session identifier
   */
  destroySession(sessionId) {
    const success = this.sessionManager.destroySession(sessionId);
    this.crisisDetection.clearSession(sessionId);
    return success;
  }

  /**
   * Get crisis resources
   * @param {string} severity - Crisis severity level
   * @param {string} type - Resource type filter
   * @returns {Array} List of crisis resources
   */
  getCrisisResources(severity = 'all', type = 'all') {
    return this.crisisDetection.getCrisisResources(severity, type);
  }

  /**
   * Prepare conversation history for Groq API format
   * @param {Object} sessionContext - Session context with messages
   * @returns {Array} Formatted conversation history
   * @private
   */
  _prepareConversationHistory(sessionContext) {
    if (!sessionContext || !sessionContext.messages) {
      return [];
    }

    // Convert session messages to Groq format
    const history = [];
    const recentMessages = sessionContext.messages.slice(-10); // Last 10 messages

    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        history.push({
          role: 'user',
          content: msg.content
        });
      } else if (msg.role === 'assistant') {
        history.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    return history;
  }

  /**
   * Generate AI response using secure API service (legacy Hugging Face method)
   * @param {string} message - User's message
   * @param {Object} context - Conversation context
   * @param {string} sessionId - Session identifier
   * @returns {Promise<string>} AI response
   * @private
   */
  async _generateSecureAIResponse(message, context, sessionId) {
    // Prepare conversation history for the model
    let conversationText = '';
    
    // Add recent context (last few messages)
    const recentMessages = context.messages.slice(-6); // Last 3 exchanges
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        conversationText += `Human: ${msg.content}\n`;
      } else {
        conversationText += `Assistant: ${msg.content}\n`;
      }
    }
    
    conversationText += `Human: ${message}\nAssistant:`;

    // Prepare secure request payload
    const requestPayload = {
      inputs: conversationText,
      parameters: {
        max_length: 150,
        temperature: 0.7,
        do_sample: true,
        pad_token_id: 50256
      }
    };

    // Encrypt payload if encryption is enabled
    const encryptedPayload = this.secureApiService.encryptRequestPayload(requestPayload, sessionId);

    try {
      // Make secure API request
      const response = await this.secureApiService.makeSecureRequest({
        url: this.modelUrl,
        method: 'POST',
        data: encryptedPayload,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        retries: this.maxRetries
      });

      if (response.success && response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
        // Extract only the new response part
        const fullText = response.data[0].generated_text;
        const assistantResponse = fullText.split('Assistant:').pop().trim();
        return assistantResponse || this._getFallbackResponse(message);
      } else {
        throw new Error('Unexpected response format from Hugging Face API');
      }

    } catch (error) {
      console.error('Secure AI generation failed:', error);
      // Fall back to original method if secure method fails
      return await this._generateAIResponse(message, context);
    }
  }

  /**
   * Generate AI response using Hugging Face model (legacy method)
   * @param {string} message - User's message
   * @param {Object} context - Conversation context
   * @returns {Promise<string>} AI response
   * @private
   */
  async _generateAIResponse(message, context) {
    // Prepare conversation history for the model
    let conversationText = '';
    
    // Add recent context (last few messages)
    const recentMessages = context.messages.slice(-6); // Last 3 exchanges
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        conversationText += `Human: ${msg.content}\n`;
      } else {
        conversationText += `Assistant: ${msg.content}\n`;
      }
    }
    
    conversationText += `Human: ${message}\nAssistant:`;

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this._makeApiRequest(conversationText);
        
        if (response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
          // Extract only the new response part
          const fullText = response.data[0].generated_text;
          const assistantResponse = fullText.split('Assistant:').pop().trim();
          return assistantResponse || this._getFallbackResponse(message);
        } else {
          throw new Error('Unexpected response format from Hugging Face API');
        }
        
      } catch (error) {
        lastError = error;
        
        // Handle specific error cases
        if (error.response?.status === 429) {
          // Rate limit exceeded
          const retryAfter = error.response.headers['retry-after'] || this.retryDelay * attempt;
          console.warn(`Rate limit exceeded, retrying after ${retryAfter}ms (attempt ${attempt}/${this.maxRetries})`);
          
          if (attempt < this.maxRetries) {
            await this._sleep(retryAfter);
            continue;
          }
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        if (error.response?.status === 503) {
          // Model loading
          console.warn(`Model is loading, retrying in ${this.retryDelay * attempt}ms (attempt ${attempt}/${this.maxRetries})`);
          
          if (attempt < this.maxRetries) {
            await this._sleep(this.retryDelay * attempt);
            continue;
          }
          throw new Error('Conversational AI service is temporarily unavailable. Please try again in a few moments.');
        }
        
        if (error.response?.status === 400) {
          // Bad request - don't retry
          throw new Error('Invalid request format');
        }
        
        if (error.response?.status === 401) {
          // Unauthorized - don't retry
          throw new Error('Invalid Hugging Face API key');
        }
        
        // For other errors, retry with exponential backoff
        if (attempt < this.maxRetries) {
          console.warn(`API request failed, retrying in ${this.retryDelay * attempt}ms (attempt ${attempt}/${this.maxRetries}):`, error.message);
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }
    
    // All retries failed
    throw new Error(`Conversational AI service failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Make the actual API request to Hugging Face
   * @param {string} conversationText - Formatted conversation text
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeApiRequest(conversationText) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      inputs: conversationText,
      parameters: {
        max_length: 150,
        temperature: 0.7,
        do_sample: true,
        pad_token_id: 50256
      }
    };

    const response = await axios.post(this.modelUrl, payload, {
      headers,
      timeout: 30000, // 30 second timeout
    });

    return response;
  }

  /**
   * Enhance AI response with mental health context (legacy method - now uses MentalHealthContextService)
   * @param {string} response - Original AI response
   * @param {string} userMessage - User's original message
   * @returns {string} Enhanced response
   * @private
   */
  _enhanceWithMentalHealthContext(response, userMessage) {
    const enhancement = this.mentalHealthContext.enhanceResponse(response, userMessage);
    return enhancement.enhancedResponse;
  }

  /**
   * Detect emotional distress in user message
   * @param {string} message - User's message
   * @returns {boolean} True if emotional distress detected
   * @private
   */
  _detectEmotionalDistress(message) {
    const distressKeywords = [
      'sad', 'depressed', 'anxious', 'worried', 'scared', 'lonely',
      'overwhelmed', 'stressed', 'tired', 'exhausted', 'frustrated',
      'angry', 'upset', 'crying', 'panic', 'fear'
    ];
    
    const lowerMessage = message.toLowerCase();
    return distressKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Detect need for coping strategies
   * @param {string} message - User's message
   * @returns {boolean} True if coping strategies might help
   * @private
   */
  _detectNeedForCoping(message) {
    const copingKeywords = [
      'how do i', 'what should i do', 'help me', 'i don\'t know',
      'can\'t handle', 'too much', 'overwhelmed', 'stressed'
    ];
    
    const lowerMessage = message.toLowerCase();
    return copingKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Check if response contains supportive language
   * @param {string} response - AI response
   * @returns {boolean} True if supportive language found
   * @private
   */
  _containsSupportiveLanguage(response) {
    const supportiveWords = [
      'understand', 'support', 'here for you', 'not alone',
      'valid', 'okay', 'brave', 'strong'
    ];
    
    const lowerResponse = response.toLowerCase();
    return supportiveWords.some(word => lowerResponse.includes(word));
  }

  /**
   * Check if response contains coping advice
   * @param {string} response - AI response
   * @returns {boolean} True if coping advice found
   * @private
   */
  _containsCopingAdvice(response) {
    const copingWords = [
      'try', 'breathe', 'exercise', 'talk to', 'reach out',
      'ground yourself', 'take a walk', 'practice'
    ];
    
    const lowerResponse = response.toLowerCase();
    return copingWords.some(word => lowerResponse.includes(word));
  }

  /**
   * Get a fallback response when AI generation fails
   * @param {string} message - User's message
   * @returns {string} Fallback response
   * @private
   */
  _getFallbackResponse(message) {
    // Use the enhanced fallback service
    const fallbackResponse = this.fallbackService.generateFallbackResponse(message, {
      service: 'conversational-ai',
      context: 'ai-generation-failed'
    });
    
    return fallbackResponse.message;
  }

  /**
   * Get a safe response when validation fails
   * @param {string} message - User's message
   * @returns {string} Safe response
   * @private
   */
  _getSafeResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Detect emotional context for appropriate response
    if (lowerMessage.includes('stress') || lowerMessage.includes('exam') || lowerMessage.includes('study')) {
      return "I understand you're dealing with stress right now. That's completely normal, especially with academic pressures. Have you tried taking a few deep breaths? Sometimes stepping back for a moment can help. What's been the most challenging part for you?";
    }
    
    if (lowerMessage.includes('anxious') || lowerMessage.includes('worried') || lowerMessage.includes('nervous')) {
      return "I hear that you're feeling anxious, and I want you to know that's a very common experience. Your feelings are valid. Try focusing on your breathing for a moment - breathe in slowly for 4 counts, then out for 6. What's been on your mind lately?";
    }
    
    if (lowerMessage.includes('sad') || lowerMessage.includes('down') || lowerMessage.includes('depressed')) {
      return "I'm sorry you're feeling this way. It takes courage to reach out when you're struggling. Your feelings matter, and you're not alone in this. Sometimes talking about what's bothering us can help. What's been weighing on you?";
    }
    
    if (lowerMessage.includes('lonely') || lowerMessage.includes('alone') || lowerMessage.includes('isolated')) {
      return "Feeling lonely can be really difficult, and I appreciate you sharing that with me. You're not alone, even when it feels that way. Connection is important for our wellbeing. Is there someone you feel comfortable reaching out to?";
    }
    
    if (lowerMessage.includes('overwhelmed') || lowerMessage.includes('too much') || lowerMessage.includes('can\'t handle')) {
      return "It sounds like you're dealing with a lot right now, and feeling overwhelmed is completely understandable. Let's take this one step at a time. What feels like the most pressing thing you're dealing with today?";
    }
    
    // Default safe response
    return "I understand you're going through something difficult right now. Thank you for sharing with me - it takes courage to reach out. Your feelings are valid, and you deserve support. What's been on your mind lately? I'm here to listen.";
  }

  /**
   * Get a random response from an array
   * @param {Array} responses - Array of response options
   * @returns {string} Random response
   * @private
   */
  _getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Trim conversation context to stay within limits
   * @param {Object} context - Conversation context
   * @returns {Object} Trimmed context
   * @private
   */
  _trimContext(context) {
    // Keep only recent messages to stay within context limits
    const maxMessages = 10; // Keep last 5 exchanges (10 messages)
    
    if (context.messages.length > maxMessages) {
      context.messages = context.messages.slice(-maxMessages);
    }
    
    return context;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate response appropriateness for mental health context
   * @param {string} response - AI response to validate
   * @returns {boolean} True if response is appropriate
   */
  validateResponseAppropriate(response) {
    // Use both Groq validation and mental health context validation
    const groqValidation = this.groqService.validateResponse(response);
    const mentalHealthValidation = this.mentalHealthContext.validateMentalHealthResponse(response);
    
    return groqValidation.isValid && mentalHealthValidation.isAppropriate;
  }

  /**
   * Get session statistics and privacy report
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session report
   */
  getSessionReport(sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Generate privacy report
    const privacyReport = this.privacyService.generatePrivacyReport(session);
    
    // Get session stats
    const sessionStats = this.sessionManager.getSessionStats();

    return {
      sessionInfo: {
        id: sessionId.substring(0, 8) + '...',
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.context.messages.length
      },
      privacy: privacyReport,
      security: {
        requestCount: session.security.requestCount,
        lastRequestTime: session.security.lastRequestTime,
        ipHash: session.security.ipHash ? 'present' : 'none'
      },
      systemStats: sessionStats
    };
  }

  /**
   * Generate comprehensive privacy and security report
   * @returns {Object} System-wide report
   */
  generateSystemReport() {
    const sessionStats = this.sessionManager.getSessionStats();
    const securityReport = this.secureApiService.generateSecurityReport(sessionStats);

    return {
      timestamp: new Date().toISOString(),
      sessions: sessionStats,
      security: securityReport,
      privacy: {
        anonymizationEnabled: this.privacyService.config.anonymizationEnabled,
        encryptionEnabled: this.privacyService.config.encryptionAlgorithm !== null,
        dataRetentionHours: this.privacyService.config.dataRetentionPeriod
      },
      services: {
        conversationalAI: this.isServiceAvailable() ? 'available' : 'unavailable',
        crisisDetection: 'available',
        mentalHealthContext: 'available',
        sessionManagement: 'available',
        privacyService: 'available',
        secureApiService: 'available'
      }
    };
  }

  /**
   * Validate session privacy compliance
   * @param {string} sessionId - Session identifier
   * @returns {Object} Compliance validation result
   */
  validateSessionCompliance(sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    return this.privacyService.validatePrivacyCompliance(session, {
      dataMinimization: true,
      encryption: true,
      anonymization: true,
      retention: true
    });
  }

  /**
   * Log crisis events for monitoring and analysis
   * @param {Object} crisisData - Crisis event data
   * @private
   */
  _logCrisisEvent(crisisData) {
    // Sanitize crisis data for logging
    const sanitizedData = this.privacyService.sanitizeForLogging(crisisData, [
      'sessionId', 'userId', 'personalInfo'
    ]);

    // Log crisis event (in production, this would go to a secure logging system)
    console.log(`[CRISIS DETECTED] Session: ${crisisData.sessionId.substring(0, 8)}..., Severity: ${crisisData.severity}, Escalation: ${crisisData.escalationLevel}`);
    
    // In a production environment, you would:
    // 1. Log to secure crisis monitoring system
    // 2. Alert crisis response team if escalation level is high
    // 3. Store anonymized data for analysis
    // 4. Trigger automated follow-up workflows
    
    // For now, we'll just log to console with timestamp
    const logEntry = {
      timestamp: crisisData.timestamp,
      sessionId: crisisData.sessionId.substring(0, 8) + '...', // Partial ID for privacy
      severity: crisisData.severity,
      escalationLevel: crisisData.escalationLevel,
      keywordCount: crisisData.keywords.length
    };
    
    console.log('[CRISIS LOG]', JSON.stringify(logEntry, null, 2));
  }
  /**
   * Get enhanced mental health response based on user message (fallback method)
   * @param {string} message - User's message
   * @param {Object} context - Session context
   * @returns {string} Enhanced mental health response
   * @private
   */
  _getEnhancedMentalHealthResponse(message, context) {
    // Use the mental health context service to generate an appropriate response
    const enhancement = this.mentalHealthContext.enhanceResponse(
      this._getFallbackResponse(message), 
      message, 
      { recentMessages: context.messages ? context.messages.slice(-3) : [] }
    );
    
    return enhancement.enhancedResponse;
  }

  /**
   * Get enhanced mental health response based on user message
   * @param {string} message - User's message
   * @param {Object} context - Session context
   * @returns {string} Enhanced mental health response
   * @private
   */
  _getEnhancedMentalHealthResponse(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Stress and anxiety responses
    if (lowerMessage.includes('stress') || lowerMessage.includes('anxious') || lowerMessage.includes('worried')) {
      const stressResponses = [
        "I understand you're feeling stressed. That's a very common experience, especially during challenging times. Can you tell me what's contributing most to your stress right now?",
        "Stress can feel overwhelming, but you're taking a positive step by talking about it. What specific situations or thoughts are causing you the most anxiety?",
        "It sounds like you're dealing with a lot of stress. Let's work together to identify some coping strategies. What usually helps you feel more calm and centered?"
      ];
      return stressResponses[Math.floor(Math.random() * stressResponses.length)];
    }
    
    // Depression and sadness responses
    if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('down') || lowerMessage.includes('hopeless')) {
      const sadnessResponses = [
        "I hear that you're feeling really down right now. Those feelings are valid and it's important that you're reaching out. What's been weighing on your mind lately?",
        "Feeling sad or depressed can be incredibly difficult. You're not alone in this. Can you share what's been making you feel this way?",
        "Thank you for trusting me with how you're feeling. Depression can make everything feel harder. What would feel most helpful for you right now?"
      ];
      return sadnessResponses[Math.floor(Math.random() * sadnessResponses.length)];
    }
    
    // Academic pressure responses
    if (lowerMessage.includes('exam') || lowerMessage.includes('study') || lowerMessage.includes('school') || lowerMessage.includes('grade')) {
      const academicResponses = [
        "Academic pressure can be really intense. It's normal to feel overwhelmed by exams and studies. What specific aspects of your academic work are causing you the most stress?",
        "I understand that school can feel overwhelming sometimes. You're not alone in feeling this way. What would help you feel more prepared and confident about your studies?",
        "Academic stress is something many students experience. Let's talk about some strategies that might help you manage both your studies and your wellbeing. What's your biggest concern right now?"
      ];
      return academicResponses[Math.floor(Math.random() * academicResponses.length)];
    }
    
    // Sleep issues
    if (lowerMessage.includes('sleep') || lowerMessage.includes('tired') || lowerMessage.includes('insomnia')) {
      const sleepResponses = [
        "Sleep issues can really affect how we feel during the day. Getting good rest is so important for your mental health. What's been interfering with your sleep?",
        "I'm sorry you're having trouble sleeping. This can make everything else feel more difficult. Can you tell me about your sleep patterns and what might be keeping you awake?",
        "Sleep problems are more common than you might think, especially when we're stressed. What does your bedtime routine look like, and what thoughts tend to keep you up?"
      ];
      return sleepResponses[Math.floor(Math.random() * sleepResponses.length)];
    }
    
    // Relationship issues
    if (lowerMessage.includes('friend') || lowerMessage.includes('relationship') || lowerMessage.includes('lonely') || lowerMessage.includes('alone')) {
      const relationshipResponses = [
        "Relationships can be both wonderful and challenging. It sounds like you're going through something difficult with people close to you. Would you like to share more about what's happening?",
        "Feeling lonely or having relationship troubles can be really painful. You're brave for reaching out. What's been going on in your relationships that's bothering you?",
        "Human connections are so important for our wellbeing. It sounds like you're struggling with some relationship issues. I'm here to listen - what would you like to talk about?"
      ];
      return relationshipResponses[Math.floor(Math.random() * relationshipResponses.length)];
    }
    
    // General supportive responses
    const generalResponses = [
      "Thank you for sharing with me. I'm here to listen and support you. Can you tell me more about what's on your mind today?",
      "I appreciate you opening up. Everyone goes through difficult times, and it's important to talk about how you're feeling. What would be most helpful for you right now?",
      "It takes courage to reach out when you're struggling. I'm glad you're here. What's been the most challenging part of your day or week?",
      "I'm here to support you through whatever you're experiencing. Sometimes just talking about our feelings can help. What would you like to explore together?",
      "Your feelings and experiences are important. I'm listening without judgment. What's been weighing on your heart or mind lately?"
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  }
}

module.exports = ConversationalAIService;