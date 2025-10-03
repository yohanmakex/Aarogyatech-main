const Groq = require('groq-sdk');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    
    // Available Groq models (confirmed working as of 2024)
    this.preferredModels = [
      'llama-3.1-8b-instant',     // Llama 3.1 8B (fast, reliable, confirmed working)
      'gemma2-9b-it'              // Gemma2 9B (alternative, confirmed working)
    ];
    
    this.model = 'llama-3.1-8b-instant'; // Start with working model
    this.maxTokens = 300; // Reduced to keep responses concise
    this.temperature = 0.7;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    if (this.apiKey) {
      this.groq = new Groq({
        apiKey: this.apiKey,
      });
    }
    
    // Mental health system prompt optimized for supportive, helpful responses
    this.systemPrompt = `You are AarogyaTech, a compassionate AI mental health assistant for students. Your role is to provide empathetic, supportive responses that validate feelings and offer practical help.

CORE PRINCIPLES:
• Always acknowledge and validate their feelings first
• Use supportive language like "I understand", "I hear you", "That sounds difficult"
• Offer practical, actionable advice they can use immediately
• Keep responses warm, caring, and conversational (2-4 sentences)
• Ask follow-up questions to show engagement when appropriate

RESPONSE STRUCTURE:
1. Acknowledge their feelings: "I understand that sounds really challenging..."
2. Validate their experience: "It's completely normal to feel this way..."
3. Offer practical help: "Here's something that might help right now..."
4. Encourage connection: "How are you feeling about trying this?" or "What feels most manageable for you?"

FOR CRISIS (suicide/self-harm mentions):
• Express immediate concern: "I'm very concerned about what you're sharing"
• Provide crisis resources: "Please reach out for immediate help - call 988 or text HOME to 741741"
• Emphasize support: "You don't have to go through this alone. Help is available right now"

EXAMPLE RESPONSES:
Student: "I'm so stressed about exams I can't sleep"
Response: "I understand how overwhelming exam stress can feel, and it's really common for it to affect sleep. That sounds exhausting. Try the 4-7-8 breathing technique before bed: breathe in for 4, hold for 7, exhale for 8. It can help calm your nervous system. What's your biggest worry about the exams right now?"

Remember: Be genuinely supportive, ask caring questions, and always validate their experience. Every response should feel like talking to a caring friend who understands.`;
  }

  /**
   * Check if the Groq service is properly configured
   * @returns {boolean} True if API key is available
   */
  isServiceAvailable() {
    return !!this.apiKey && !!this.groq;
  }

  /**
   * Find the best available model from the preferred list
   * @returns {Promise<string>} The best available model name
   */
  async findBestAvailableModel() {
    if (!this.isServiceAvailable()) {
      throw new Error('Groq service not configured');
    }

    console.log('Finding best available Groq model...');
    
    for (const model of this.preferredModels) {
      try {
        console.log(`Testing model: ${model}`);
        
        const completion = await this.groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: 'Test'
            }
          ],
          model: model,
          max_tokens: 10,
          temperature: 0.1
        });

        if (completion.choices && completion.choices[0]) {
          console.log(`✅ Using model: ${model}`);
          this.model = model;
          return model;
        }
      } catch (error) {
        if (error.status === 404) {
          console.log(`❌ Model ${model} not available`);
          continue;
        } else if (error.status === 401) {
          throw new Error('Invalid Groq API key');
        } else {
          console.log(`⚠️ Model ${model} error: ${error.message}`);
          continue;
        }
      }
    }
    
    throw new Error('No available models found on Groq');
  }

  /**
   * Generate AI response using Groq API
   * @param {string} message - User's message
   * @param {Array} conversationHistory - Previous messages in the conversation
   * @param {Object} options - Additional options
   * @returns {Promise<string>} AI response
   */
  async generateResponse(message, conversationHistory = [], options = {}) {
    if (!this.isServiceAvailable()) {
      throw new Error('Groq service not configured - API key missing');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message provided');
    }

    // Prepare messages for the API
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt
      }
    ];

    // Add conversation history (limit to last 10 messages to stay within context)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    let lastError;
    let modelToUse = this.model;
    let triedModelFallback = false;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const completion = await this.groq.chat.completions.create({
          messages: messages,
          model: modelToUse,
          max_tokens: options.maxTokens || this.maxTokens,
          temperature: options.temperature || this.temperature,
          top_p: 0.9,
          stream: false,
        });

        if (completion.choices && completion.choices[0] && completion.choices[0].message) {
          const response = completion.choices[0].message.content.trim();
          
          // Validate response length and content
          if (response.length === 0) {
            throw new Error('Empty response from Groq API');
          }
          
          return response;
        } else {
          throw new Error('Unexpected response format from Groq API');
        }

      } catch (error) {
        lastError = error;
        
        // Handle specific error cases
        if (error.status === 404 && !triedModelFallback) {
          // Model not found - try to find a better model
          console.warn(`Model ${modelToUse} not found, trying to find alternative...`);
          try {
            modelToUse = await this.findBestAvailableModel();
            triedModelFallback = true;
            continue; // Retry with new model
          } catch (modelError) {
            console.warn('Failed to find alternative model:', modelError.message);
          }
        }
        
        if (error.status === 429) {
          // Rate limit exceeded
          console.warn(`Groq rate limit exceeded, retrying in ${this.retryDelay * attempt}ms (attempt ${attempt}/${this.maxRetries})`);
          
          if (attempt < this.maxRetries) {
            await this._sleep(this.retryDelay * attempt);
            continue;
          }
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        if (error.status === 401) {
          // Unauthorized - don't retry
          throw new Error('Invalid Groq API key');
        }
        
        if (error.status === 400) {
          // Bad request - don't retry
          throw new Error('Invalid request format');
        }
        
        if (error.status >= 500) {
          // Server error - retry with exponential backoff
          if (attempt < this.maxRetries) {
            console.warn(`Groq server error, retrying in ${this.retryDelay * attempt}ms (attempt ${attempt}/${this.maxRetries}):`, error.message);
            await this._sleep(this.retryDelay * attempt);
            continue;
          }
        }
        
        // For other errors, retry with exponential backoff
        if (attempt < this.maxRetries) {
          console.warn(`Groq API request failed, retrying in ${this.retryDelay * attempt}ms (attempt ${attempt}/${this.maxRetries}):`, error.message);
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }
    
    // All retries failed
    throw new Error(`Groq service failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Generate a crisis-specific response
   * @param {string} message - User's message indicating crisis
   * @param {string} severity - Crisis severity level
   * @returns {Promise<string>} Crisis response
   */
  async generateCrisisResponse(message, severity = 'high') {
    const crisisPrompt = `CRISIS RESPONSE - Keep under 100 words, be direct and supportive.

User expressed: ${message}

Respond with:
1. "I'm very concerned about you"
2. Crisis resources: 988, text HOME to 741741
3. "You're not alone, help is available"
4. Encourage immediate action

Be compassionate but BRIEF and DIRECT. This is urgent.`;

    try {
      const messages = [
        {
          role: 'system',
          content: crisisPrompt
        },
        {
          role: 'user',
          content: message
        }
      ];

      const completion = await this.groq.chat.completions.create({
        messages: messages,
        model: this.model,
        max_tokens: 150, // Even shorter for crisis responses
        temperature: 0.3, // Lower temperature for more consistent crisis responses
        top_p: 0.8,
        stream: false,
      });

      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        return completion.choices[0].message.content.trim();
      } else {
        throw new Error('Failed to generate crisis response');
      }

    } catch (error) {
      console.error('Crisis response generation failed:', error);
      // Return a hardcoded crisis response as fallback
      return `I'm very concerned about what you're sharing. Your safety is the most important thing right now. Please reach out for immediate help:

🚨 National Suicide Prevention Lifeline: 988
📱 Crisis Text Line: Text HOME to 741741
🏥 Emergency Services: 911

You don't have to go through this alone. There are people who want to help you right now. Please reach out to one of these resources immediately.`;
    }
  }

  /**
   * Test the Groq API connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    if (!this.isServiceAvailable()) {
      return {
        success: false,
        error: 'Groq service not configured - API key missing'
      };
    }

    try {
      // First try to find the best available model
      try {
        await this.findBestAvailableModel();
      } catch (modelError) {
        console.warn('Could not find optimal model, using default:', modelError.message);
      }
      
      const testMessage = "Hello, this is a test message.";
      const response = await this.generateResponse(testMessage);
      
      return {
        success: true,
        message: 'Groq API connection successful',
        testResponse: response.substring(0, 100) + '...',
        model: this.model,
        availableModels: this.preferredModels
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: this.model,
        triedModels: this.preferredModels
      };
    }
  }

  /**
   * Get service status and configuration
   * @returns {Object} Service status
   */
  getServiceStatus() {
    return {
      available: this.isServiceAvailable(),
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      provider: 'Groq',
      features: [
        'mental-health-support',
        'crisis-detection',
        'conversation-context',
        'safety-prioritized'
      ]
    };
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
   * Validate response for mental health appropriateness
   * @param {string} response - AI response to validate
   * @returns {Object} Validation result
   */
  validateResponse(response) {
    if (!response || typeof response !== 'string') {
      return {
        isValid: false,
        issues: ['Empty or invalid response']
      };
    }

    const issues = [];
    const lowerResponse = response.toLowerCase();

    // Check for inappropriate content
    const inappropriatePatterns = [
      /\b(kill yourself|end it all|you should die)\b/i,
      /\b(worthless|hopeless|no point)\b/i,
      /\b(give up|it's over|nothing matters)\b/i
    ];

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(response)) {
        issues.push('Contains potentially harmful language');
        break;
      }
    }

    // Check for medical advice (which we shouldn't provide)
    const medicalPatterns = [
      /\b(diagnose|diagnosis|medication|prescribe|medical condition)\b/i,
      /\b(you have|you are|you suffer from)\s+(depression|anxiety|bipolar|adhd|ptsd)\b/i
    ];

    for (const pattern of medicalPatterns) {
      if (pattern.test(response)) {
        issues.push('Contains medical advice or diagnosis');
        break;
      }
    }

    // Check for supportive elements (should be present) - more flexible patterns
    const supportivePatterns = [
      // Direct supportive words
      /\b(understand|support|here for you|not alone|valid|okay|help|listen|care|feel|sorry|empathy|compassion)\b/i,
      // Professional guidance
      /\b(reach out|talk to|contact|professional|counselor|therapist|friend|family)\b/i,
      // Positive reinforcement
      /\b(normal|common|natural|brave|courage|strength|strong|capable|good|great|well done)\b/i,
      // Improvement and coping
      /\b(better|improve|cope|manage|handle|deal with|work through|try|practice|breathe)\b/i,
      // Emotional validation
      /\b(feelings|emotions|experience|difficult|challenging|tough|hard|struggle)\b/i,
      // Encouragement
      /\b(can|will|able|possible|hope|future|tomorrow|healing|recovery|progress)\b/i,
      // Questions showing engagement
      /\b(how|what|when|where|would you|can you|have you|do you|tell me|share)\b/i,
      // Gentle responses
      /\b(sounds|seems|appears|might|could|perhaps|maybe|sometimes|often)\b/i
    ];

    const hasSupportiveLanguage = supportivePatterns.some(pattern => pattern.test(response));
    
    // Only flag as lacking supportive language if it's a longer response (>150 chars) 
    // and has no supportive elements AND contains no questions or engagement
    const hasEngagement = /[?]/.test(response) || /\b(tell me|share|how|what|would you)\b/i.test(response);
    
    if (!hasSupportiveLanguage && !hasEngagement && response.length > 150) {
      issues.push('Lacks supportive language');
    }

    // Allow responses up to 1500 characters (more reasonable for mental health support)
    if (response.length > 1500) {
      issues.push('Response too long (over 1500 characters)');
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
      hasSupportiveLanguage: hasSupportiveLanguage,
      length: response.length
    };
  }
}

module.exports = GroqService;