const axios = require('axios');

class LanguageService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.supportedLanguages = {
      'en': {
        name: 'English',
        code: 'en',
        locale: 'en-US',
        conversationalModel: 'microsoft/DialoGPT-medium',
        speechToTextModel: 'openai/whisper-small',
        textToSpeechModel: 'microsoft/speecht5_tts',
        translationModel: null // No translation needed for English
      },
      'mr': {
        name: 'Marathi',
        code: 'mr',
        locale: 'mr-IN',
        conversationalModel: 'microsoft/DialoGPT-medium', // Will translate to/from English
        speechToTextModel: 'openai/whisper-small', // Whisper supports multiple languages
        textToSpeechModel: 'microsoft/speecht5_tts', // Will use translation
        translationModel: 'Helsinki-NLP/opus-mt-en-hi' // English to Hindi (closest to Marathi)
      }
    };
    
    this.defaultLanguage = 'en';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Check if the service is properly configured
   * @returns {boolean} True if API key is available
   */
  isServiceAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get supported languages
   * @returns {Object} Supported languages configuration
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Check if a language is supported
   * @param {string} languageCode - Language code to check
   * @returns {boolean} True if language is supported
   */
  isLanguageSupported(languageCode) {
    return languageCode in this.supportedLanguages;
  }

  /**
   * Get language configuration
   * @param {string} languageCode - Language code
   * @returns {Object|null} Language configuration or null if not supported
   */
  getLanguageConfig(languageCode) {
    return this.supportedLanguages[languageCode] || null;
  }

  /**
   * Get appropriate AI model for language and service type
   * @param {string} languageCode - Language code
   * @param {string} serviceType - Service type (conversational, speechToText, textToSpeech)
   * @returns {string} Model URL or identifier
   */
  getModelForLanguage(languageCode, serviceType) {
    const config = this.getLanguageConfig(languageCode);
    if (!config) {
      // Fallback to default language
      const defaultConfig = this.getLanguageConfig(this.defaultLanguage);
      return defaultConfig[`${serviceType}Model`];
    }

    return config[`${serviceType}Model`];
  }

  /**
   * Translate text between languages
   * @param {string} text - Text to translate
   * @param {string} fromLanguage - Source language code
   * @param {string} toLanguage - Target language code
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, fromLanguage, toLanguage) {
    if (!this.isServiceAvailable()) {
      throw new Error('Language service not configured');
    }

    // If same language, return original text
    if (fromLanguage === toLanguage) {
      return text;
    }

    // If translating to/from English, use appropriate model
    let modelUrl;
    let translationText = text;

    if (fromLanguage === 'en' && toLanguage === 'mr') {
      // English to Marathi (via Hindi)
      modelUrl = 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-hi';
    } else if (fromLanguage === 'mr' && toLanguage === 'en') {
      // Marathi to English (via Hindi)
      modelUrl = 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-hi-en';
    } else {
      // Unsupported translation pair, return original text
      console.warn(`Translation not supported from ${fromLanguage} to ${toLanguage}`);
      return text;
    }

    try {
      const translatedText = await this._makeTranslationRequest(modelUrl, translationText);
      return translatedText;
    } catch (error) {
      console.error('Translation failed:', error);
      // Return original text if translation fails
      return text;
    }
  }

  /**
   * Detect language of given text
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} Detected language code
   */
  async detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return this.defaultLanguage;
    }

    try {
      // Simple heuristic-based detection for Marathi vs English
      const marathiPattern = /[\u0900-\u097F]/; // Devanagari script range
      
      if (marathiPattern.test(text)) {
        return 'mr';
      } else {
        return 'en';
      }
    } catch (error) {
      console.error('Language detection failed:', error);
      return this.defaultLanguage;
    }
  }

  /**
   * Process AI response for specific language
   * @param {string} response - AI response in source language
   * @param {string} userLanguage - User's preferred language
   * @param {string} sourceLanguage - Language of the AI response
   * @returns {Promise<Object>} Processed response with language info
   */
  async processAIResponse(response, userLanguage, sourceLanguage = 'en') {
    if (!this.isLanguageSupported(userLanguage)) {
      userLanguage = this.defaultLanguage;
    }

    let processedResponse = response;
    let translationApplied = false;

    // Translate if needed
    if (sourceLanguage !== userLanguage) {
      try {
        processedResponse = await this.translateText(response, sourceLanguage, userLanguage);
        translationApplied = true;
      } catch (error) {
        console.error('Response translation failed:', error);
        // Keep original response if translation fails
        processedResponse = response;
        translationApplied = false;
      }
    }

    return {
      response: processedResponse,
      language: userLanguage,
      sourceLanguage: sourceLanguage,
      translationApplied: translationApplied,
      originalResponse: translationApplied ? response : null
    };
  }

  /**
   * Get language-specific voice parameters
   * @param {string} languageCode - Language code
   * @returns {Object} Voice parameters for the language
   */
  getVoiceParametersForLanguage(languageCode) {
    const config = this.getLanguageConfig(languageCode);
    
    // Default parameters
    const defaultParams = {
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0
    };

    // Language-specific adjustments
    const languageParams = {
      'en': defaultParams,
      'mr': {
        speed: 0.9, // Slightly slower for better pronunciation
        pitch: 1.0,
        volume: 1.0
      }
    };

    return languageParams[languageCode] || defaultParams;
  }

  /**
   * Prepare text for TTS in specific language
   * @param {string} text - Text to prepare
   * @param {string} languageCode - Target language
   * @returns {Promise<Object>} Prepared text with metadata
   */
  async prepareTextForTTS(text, languageCode) {
    if (!this.isLanguageSupported(languageCode)) {
      languageCode = this.defaultLanguage;
    }

    let preparedText = text;
    let translationApplied = false;

    // Detect source language
    const detectedLanguage = await this.detectLanguage(text);

    // Translate if needed
    if (detectedLanguage !== languageCode) {
      try {
        preparedText = await this.translateText(text, detectedLanguage, languageCode);
        translationApplied = true;
      } catch (error) {
        console.error('TTS text preparation failed:', error);
        // Use original text if translation fails
        preparedText = text;
      }
    }

    // Get language-specific voice parameters
    const voiceParams = this.getVoiceParametersForLanguage(languageCode);

    return {
      text: preparedText,
      language: languageCode,
      sourceLanguage: detectedLanguage,
      translationApplied: translationApplied,
      voiceParameters: voiceParams,
      originalText: translationApplied ? text : null
    };
  }

  /**
   * Process speech-to-text result for specific language
   * @param {string} transcription - Transcribed text
   * @param {string} expectedLanguage - Expected language of the speech
   * @returns {Promise<Object>} Processed transcription with language info
   */
  async processSpeechToTextResult(transcription, expectedLanguage) {
    if (!this.isLanguageSupported(expectedLanguage)) {
      expectedLanguage = this.defaultLanguage;
    }

    // Detect actual language of transcription
    const detectedLanguage = await this.detectLanguage(transcription);

    let processedTranscription = transcription;
    let translationApplied = false;

    // If detected language doesn't match expected, translate if needed
    if (detectedLanguage !== expectedLanguage && expectedLanguage !== 'auto') {
      try {
        processedTranscription = await this.translateText(transcription, detectedLanguage, expectedLanguage);
        translationApplied = true;
      } catch (error) {
        console.error('STT result processing failed:', error);
        // Keep original transcription if translation fails
      }
    }

    return {
      transcription: processedTranscription,
      detectedLanguage: detectedLanguage,
      expectedLanguage: expectedLanguage,
      translationApplied: translationApplied,
      originalTranscription: translationApplied ? transcription : null,
      confidence: this._calculateLanguageConfidence(transcription, detectedLanguage)
    };
  }

  /**
   * Get mental health resources for specific language
   * @param {string} languageCode - Language code
   * @returns {Array} Language-specific mental health resources
   */
  getMentalHealthResourcesForLanguage(languageCode) {
    const resources = {
      'en': [
        {
          name: 'National Suicide Prevention Lifeline',
          phone: '988',
          description: '24/7 crisis support',
          availability: '24/7'
        },
        {
          name: 'Crisis Text Line',
          phone: '741741',
          description: 'Text HOME for crisis support',
          availability: '24/7'
        }
      ],
      'mr': [
        {
          name: 'राष्ट्रीय आत्महत्या प्रतिबंध हेल्पलाइन',
          phone: '988',
          description: '२४/७ संकट सहाय्य',
          availability: '२४/७'
        },
        {
          name: 'संकट मजकूर लाइन',
          phone: '741741',
          description: 'संकट सहाय्यासाठी HOME मजकूर पाठवा',
          availability: '२४/७'
        }
      ]
    };

    return resources[languageCode] || resources[this.defaultLanguage];
  }

  /**
   * Make translation API request
   * @param {string} modelUrl - Translation model URL
   * @param {string} text - Text to translate
   * @returns {Promise<string>} Translated text
   * @private
   */
  async _makeTranslationRequest(modelUrl, text) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      inputs: text
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(modelUrl, payload, {
          headers,
          timeout: 30000
        });

        if (response.data && Array.isArray(response.data) && response.data[0]?.translation_text) {
          return response.data[0].translation_text.trim();
        } else if (response.data && response.data.translation_text) {
          return response.data.translation_text.trim();
        } else {
          throw new Error('Unexpected response format from translation API');
        }
        
      } catch (error) {
        lastError = error;
        
        // Handle specific error cases
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || this.retryDelay * attempt;
          if (attempt < this.maxRetries) {
            await this._sleep(retryAfter);
            continue;
          }
          throw new Error('Translation rate limit exceeded');
        }
        
        if (error.response?.status === 503) {
          if (attempt < this.maxRetries) {
            await this._sleep(this.retryDelay * attempt);
            continue;
          }
          throw new Error('Translation service temporarily unavailable');
        }
        
        if (error.response?.status === 400) {
          throw new Error('Invalid text for translation');
        }
        
        if (error.response?.status === 401) {
          throw new Error('Invalid API key for translation service');
        }
        
        // For other errors, retry with exponential backoff
        if (attempt < this.maxRetries) {
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }
    
    throw new Error(`Translation failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Calculate confidence score for language detection
   * @param {string} text - Text to analyze
   * @param {string} detectedLanguage - Detected language
   * @returns {number} Confidence score (0-1)
   * @private
   */
  _calculateLanguageConfidence(text, detectedLanguage) {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    const marathiPattern = /[\u0900-\u097F]/g;
    const marathiMatches = text.match(marathiPattern);
    const marathiRatio = marathiMatches ? marathiMatches.length / text.length : 0;

    if (detectedLanguage === 'mr') {
      // Higher confidence if more Devanagari characters
      return Math.min(0.5 + marathiRatio * 0.5, 1.0);
    } else {
      // Higher confidence if fewer Devanagari characters
      return Math.min(0.5 + (1 - marathiRatio) * 0.5, 1.0);
    }
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
   * Get service status and configuration
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return {
      isAvailable: this.isServiceAvailable(),
      supportedLanguages: Object.keys(this.supportedLanguages),
      defaultLanguage: this.defaultLanguage,
      features: {
        translation: true,
        languageDetection: true,
        multilingualTTS: true,
        multilingualSTT: true
      }
    };
  }
}

module.exports = LanguageService;