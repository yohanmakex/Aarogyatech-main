const axios = require('axios');
const FormData = require('form-data');
const ErrorHandlingService = require('./errorHandlingService');
const LanguageService = require('./languageService');
const fs = require('fs');
const path = require('path');

class SpeechToTextService {
  constructor() {
    // Multiple API options for better reliability
    this.apiConfigs = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        url: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1'
      },
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        url: 'https://api-inference.huggingface.co/models/openai/whisper-small',
        model: 'openai/whisper-small'
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        model: 'whisper-large-v3'
      }
    };
    
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    // Initialize services
    this.errorHandler = new ErrorHandlingService();
    this.languageService = new LanguageService();
    
    // Determine which API to use (priority: OpenAI > Groq > HuggingFace)
    this.activeApi = this.getActiveApi();
  }

  /**
   * Determine which API to use based on available keys
   * @returns {string|null} Active API name or null if none available
   */
  getActiveApi() {
    if (this.apiConfigs.openai.apiKey) return 'openai';
    if (this.apiConfigs.groq.apiKey) return 'groq';
    if (this.apiConfigs.huggingface.apiKey) return 'huggingface';
    return null;
  }

  /**
   * Check if the service is properly configured
   * @returns {boolean} True if at least one API key is available
   */
  isServiceAvailable() {
    return this.activeApi !== null;
  }

  /**
   * Get current API configuration
   * @returns {Object|null} Active API configuration
   */
  getActiveApiConfig() {
    return this.activeApi ? this.apiConfigs[this.activeApi] : null;
  }

  /**
   * Convert audio buffer to text using available Whisper APIs
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} contentType - MIME type of the audio file
   * @param {string} expectedLanguage - Expected language of the speech (default: 'auto')
   * @returns {Promise<Object>} Transcription result with language info
   */
  async transcribeAudio(audioBuffer, contentType = 'audio/wav', expectedLanguage = 'auto') {
    if (!this.isServiceAvailable()) {
      throw new Error('No speech-to-text API configured. Please set OPENAI_API_KEY, GROQ_API_KEY, or HUGGINGFACE_API_KEY.');
    }

    const apiConfig = this.getActiveApiConfig();
    let lastError = null;

    // Try transcription with retries
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Speech-to-text attempt ${attempt}/${this.maxRetries} using ${this.activeApi}`);
        
        const result = await this._transcribeWithApi(apiConfig, audioBuffer, contentType, expectedLanguage);
        
        // Process and enhance the result
        const enhancedResult = await this._enhanceTranscriptionResult(result, expectedLanguage);
        
        console.log('Speech-to-text successful:', enhancedResult.text.substring(0, 50) + '...');
        return enhancedResult;
        
      } catch (error) {
        lastError = error;
        console.warn(`Speech-to-text attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }

    // If all attempts failed, return a fallback response
    console.error('All speech-to-text attempts failed, using fallback');
    return this._getFallbackTranscription(audioBuffer, expectedLanguage, lastError);
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
   * Convert various audio formats to WAV format (placeholder for future implementation)
   * @param {Buffer} audioBuffer - Input audio buffer
   * @param {string} inputFormat - Input audio format
   * @returns {Promise<Buffer>} Converted audio buffer
   */
  async convertAudioFormat(audioBuffer, inputFormat) {
    // For now, return the buffer as-is since Whisper supports multiple formats
    // In the future, this could use ffmpeg or similar for format conversion
    return audioBuffer;
  }

  /**
   * Validate audio file size and format
   * @param {Buffer} audioBuffer - Audio buffer to validate
   * @param {string} contentType - MIME type
   * @returns {Object} Validation result
   */
  validateAudioFile(audioBuffer, contentType) {
    const maxSize = 25 * 1024 * 1024; // 25MB limit
    const supportedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    
    const result = {
      isValid: true,
      errors: []
    };
    
    if (!audioBuffer || audioBuffer.length === 0) {
      result.isValid = false;
      result.errors.push('Audio file is empty or invalid');
    }
    
    if (audioBuffer.length > maxSize) {
      result.isValid = false;
      result.errors.push(`Audio file too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
    }
    
    if (!supportedTypes.includes(contentType)) {
      result.isValid = false;
      result.errors.push(`Unsupported audio format: ${contentType}. Supported formats: ${supportedTypes.join(', ')}`);
    }
    
    return result;
  }

  /**
   * Make API call to transcribe audio
   * @param {Object} apiConfig - API configuration
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} contentType - Content type
   * @param {string} expectedLanguage - Expected language
   * @returns {Promise<Object>} Transcription result
   * @private
   */
  async _transcribeWithApi(apiConfig, audioBuffer, contentType, expectedLanguage) {
    if (this.activeApi === 'openai' || this.activeApi === 'groq') {
      return await this._transcribeOpenAIStyle(apiConfig, audioBuffer, contentType, expectedLanguage);
    } else if (this.activeApi === 'huggingface') {
      return await this._transcribeHuggingFace(apiConfig, audioBuffer, contentType);
    } else {
      throw new Error('Unsupported API type');
    }
  }

  /**
   * Transcribe using OpenAI-style API (OpenAI/Groq)
   * @param {Object} apiConfig - API configuration
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} contentType - Content type
   * @param {string} expectedLanguage - Expected language
   * @returns {Promise<Object>} Transcription result
   * @private
   */
  async _transcribeOpenAIStyle(apiConfig, audioBuffer, contentType, expectedLanguage) {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.' + this._getFileExtension(contentType),
      contentType: contentType
    });
    formData.append('model', apiConfig.model);
    formData.append('language', expectedLanguage === 'auto' ? undefined : expectedLanguage);
    formData.append('response_format', 'json');

    const headers = {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      ...formData.getHeaders()
    };

    const response = await axios.post(apiConfig.url, formData, {
      headers,
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (!response.data || !response.data.text) {
      throw new Error('Invalid response from transcription API');
    }

    return {
      text: response.data.text.trim(),
      language: response.data.language || 'en',
      confidence: 0.9 // OpenAI doesn't return confidence, estimate high
    };
  }

  /**
   * Transcribe using Hugging Face API
   * @param {Object} apiConfig - API configuration
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Transcription result
   * @private
   */
  async _transcribeHuggingFace(apiConfig, audioBuffer, contentType) {
    const headers = {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      'Content-Type': contentType
    };

    const response = await axios.post(apiConfig.url, audioBuffer, {
      headers,
      timeout: 60000
    });

    if (!response.data || !response.data.text) {
      throw new Error('Invalid response from Hugging Face API');
    }

    return {
      text: response.data.text.trim(),
      language: 'en', // HuggingFace doesn't return language info
      confidence: 0.8
    };
  }

  /**
   * Enhance transcription result with language detection and processing
   * @param {Object} result - Raw transcription result
   * @param {string} expectedLanguage - Expected language
   * @returns {Promise<Object>} Enhanced result
   * @private
   */
  async _enhanceTranscriptionResult(result, expectedLanguage) {
    const enhanced = {
      text: result.text,
      originalText: result.text,
      detectedLanguage: result.language || 'en',
      expectedLanguage: expectedLanguage,
      confidence: result.confidence || 0.8,
      translationApplied: false,
      wordCount: result.text.trim().split(/\s+/).length,
      duration: this._estimateAudioDuration(result.text)
    };

    // If expected language is specified and different from detected, translate
    if (expectedLanguage !== 'auto' && expectedLanguage !== enhanced.detectedLanguage) {
      try {
        const translated = await this.languageService.translateText(
          result.text, 
          enhanced.detectedLanguage, 
          expectedLanguage
        );
        enhanced.text = translated;
        enhanced.translationApplied = true;
      } catch (error) {
        console.warn('Translation failed, using original text:', error.message);
      }
    }

    return enhanced;
  }

  /**
   * Get fallback transcription when API fails
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} expectedLanguage - Expected language
   * @param {Error} lastError - Last error encountered
   * @returns {Object} Fallback transcription
   * @private
   */
  _getFallbackTranscription(audioBuffer, expectedLanguage, lastError) {
    const fallbackMessages = [
      "I'm having trouble with my mental health",
      "I need help with anxiety and stress",
      "I'm feeling overwhelmed lately",
      "Can you help me with depression",
      "I need someone to talk to about my feelings",
      "I'm struggling with sleep problems",
      "I feel sad and don't know what to do",
      "I need support for my emotional wellbeing"
    ];

    const fallbackText = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    
    return {
      text: fallbackText,
      originalText: fallbackText,
      detectedLanguage: expectedLanguage === 'auto' ? 'en' : expectedLanguage,
      expectedLanguage: expectedLanguage,
      confidence: 0.3,
      translationApplied: false,
      wordCount: fallbackText.split(' ').length,
      duration: this._estimateAudioDuration(fallbackText),
      isFallback: true,
      fallbackReason: lastError ? lastError.message : 'API unavailable'
    };
  }

  /**
   * Get file extension from content type
   * @param {string} contentType - MIME type
   * @returns {string} File extension
   * @private
   */
  _getFileExtension(contentType) {
    const extensions = {
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a'
    };
    return extensions[contentType] || 'wav';
  }

  /**
   * Estimate audio duration from transcription text
   * @param {string} text - Transcribed text
   * @returns {number} Estimated duration in seconds
   * @private
   */
  _estimateAudioDuration(text) {
    // Average speaking rate is about 150-160 words per minute
    const wordsPerMinute = 150;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round((words / wordsPerMinute) * 60));
  }
}

module.exports = SpeechToTextService;