const axios = require('axios');
const LanguageService = require('./languageService');
const CachingService = require('./cachingService');
const PerformanceOptimizationService = require('./performanceOptimizationService');

class TextToSpeechService {
  constructor() {
    // Multiple API options for better reliability
    this.apiConfigs = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        url: 'https://api.openai.com/v1/audio/speech',
        model: 'tts-1',
        voice: 'nova'
      },
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY,
        url: 'https://api.elevenlabs.io/v1/text-to-speech',
        voiceId: 'ErXwobaYiN019PkySvjV' // Default voice
      },
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        url: 'https://api-inference.huggingface.co/models/microsoft/speecht5_tts',
        model: 'microsoft/speecht5_tts'
      }
    };
    
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.maxTextLength = 4000; // Increased limit
    
    // Voice parameters
    this.voiceParameters = {
      speed: 1.0, // Normal speed (0.25 to 4.0 for OpenAI)
      pitch: 1.0, // Normal pitch (not supported by OpenAI)
      volume: 1.0, // Normal volume (not supported by OpenAI)
      voice: 'nova' // Default voice for OpenAI
    };
    
    // Initialize services
    this.languageService = new LanguageService();
    this.cachingService = new CachingService();
    this.performanceOptimizer = new PerformanceOptimizationService();
    
    // Determine which API to use (priority: OpenAI > ElevenLabs > HuggingFace)
    this.activeApi = this.getActiveApi();
  }

  /**
   * Determine which API to use based on available keys
   * @returns {string|null} Active API name or null if none available
   */
  getActiveApi() {
    if (this.apiConfigs.openai.apiKey) return 'openai';
    if (this.apiConfigs.elevenlabs.apiKey) return 'elevenlabs';
    if (this.apiConfigs.huggingface.apiKey) return 'huggingface';
    return null;
  }

  /**
   * Get current API configuration
   * @returns {Object|null} Active API configuration
   */
  getActiveApiConfig() {
    return this.activeApi ? this.apiConfigs[this.activeApi] : null;
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
   * Check if the service is properly configured
   * @returns {boolean} True if at least one API key is available
   */
  isServiceAvailable() {
    return this.activeApi !== null;
  }

  /**
   * Convert text to speech using available TTS APIs
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Voice options (speed, voice, language, etc.)
   * @returns {Promise<Object>} Audio buffer with metadata
   */
  async synthesizeSpeech(text, options = {}) {
    if (!this.isServiceAvailable()) {
      throw new Error('No text-to-speech API configured. Please set OPENAI_API_KEY, ELEVENLABS_API_KEY, or HUGGINGFACE_API_KEY.');
    }

    const apiConfig = this.getActiveApiConfig();
    let lastError = null;

    // Validate text first
    const validation = this.validateText(text);
    if (!validation.isValid) {
      throw new Error(`Invalid text: ${validation.errors.join(', ')}`);
    }

    // Process text for TTS (clean up, handle length)
    const processedText = this._preprocessTextForTTS(text);
    
    // Merge options with voice parameters
    const mergedOptions = {
      ...this.voiceParameters,
      ...options
    };

    // Try synthesis with retries
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Text-to-speech attempt ${attempt}/${this.maxRetries} using ${this.activeApi}`);
        
        const result = await this._synthesizeWithApi(apiConfig, processedText, mergedOptions);
        
        // Enhance the result with metadata
        const enhancedResult = this._enhanceSynthesisResult(result, text, mergedOptions);
        
        console.log('Text-to-speech successful, audio length:', enhancedResult.audioBuffer.length);
        return enhancedResult;
        
      } catch (error) {
        lastError = error;
        console.warn(`Text-to-speech attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this._sleep(this.retryDelay * attempt);
        }
      }
    }

    // If all attempts failed, return a fallback response
    console.error('All text-to-speech attempts failed, using fallback');
    return this._getFallbackAudio(processedText, mergedOptions, lastError);
  }

  /**
   * Set voice parameters (speed, pitch, volume)
   * @param {number} speed - Speech speed (0.5 to 2.0)
   * @param {number} pitch - Voice pitch (0.5 to 2.0)
   * @param {number} volume - Audio volume (0.1 to 1.0)
   */
  setVoiceParameters(speed = 1.0, pitch = 1.0, volume = 1.0) {
    const parameters = { speed, pitch, volume };
    this._validateVoiceParameters(parameters);
    
    this.voiceParameters = parameters;
  }

  /**
   * Get current voice parameters
   * @returns {Object} Current voice parameters
   */
  getVoiceParameters() {
    return { ...this.voiceParameters };
  }

  /**
   * Estimate audio duration for given text
   * @param {string} text - Text to estimate duration for
   * @returns {number} Estimated duration in seconds
   */
  estimateAudioDuration(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Rough estimation: average speaking rate is about 150-160 words per minute
    const wordsPerMinute = 150;
    const words = text.trim().split(/\s+/).length;
    const baseDuration = (words / wordsPerMinute) * 60; // in seconds
    
    // Adjust for speed parameter
    const adjustedDuration = baseDuration / this.voiceParameters.speed;
    
    return Math.max(1, Math.round(adjustedDuration)); // Minimum 1 second
  }

  /**
   * Check if text is suitable for TTS
   * @param {string} text - Text to validate
   * @returns {Object} Validation result
   */
  validateText(text) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!text || typeof text !== 'string') {
      result.isValid = false;
      result.errors.push('Text must be a non-empty string');
      return result;
    }

    const cleanText = text.trim();
    
    if (cleanText.length === 0) {
      result.isValid = false;
      result.errors.push('Text cannot be empty');
    }

    if (cleanText.length > this.maxTextLength) {
      result.isValid = false;
      result.errors.push(`Text too long. Maximum length is ${this.maxTextLength} characters`);
    }

    // Check for potentially problematic characters
    const problematicChars = /[^\w\s.,!?;:'"()-]/g;
    const matches = cleanText.match(problematicChars);
    if (matches) {
      result.warnings.push(`Text contains special characters that may not be pronounced correctly: ${[...new Set(matches)].join(', ')}`);
    }

    // Check for very long sentences
    const sentences = cleanText.split(/[.!?]+/);
    const longSentences = sentences.filter(s => s.trim().length > 200);
    if (longSentences.length > 0) {
      result.warnings.push('Text contains very long sentences that may affect speech quality');
    }

    return result;
  }

  /**
   * Make API call to synthesize speech
   * @param {Object} apiConfig - API configuration
   * @param {string} text - Text to synthesize
   * @param {Object} options - Voice options
   * @returns {Promise<Object>} Synthesis result
   * @private
   */
  async _synthesizeWithApi(apiConfig, text, options) {
    if (this.activeApi === 'openai') {
      return await this._synthesizeOpenAI(apiConfig, text, options);
    } else if (this.activeApi === 'elevenlabs') {
      return await this._synthesizeElevenLabs(apiConfig, text, options);
    } else if (this.activeApi === 'huggingface') {
      return await this._synthesizeHuggingFace(apiConfig, text, options);
    } else {
      throw new Error('Unsupported API type');
    }
  }

  /**
   * Synthesize using OpenAI TTS API
   * @param {Object} apiConfig - API configuration
   * @param {string} text - Text to synthesize
   * @param {Object} options - Voice options
   * @returns {Promise<Object>} Synthesis result
   * @private
   */
  async _synthesizeOpenAI(apiConfig, text, options) {
    const payload = {
      model: apiConfig.model,
      input: text,
      voice: options.voice || apiConfig.voice,
      speed: Math.max(0.25, Math.min(4.0, options.speed || 1.0))
    };

    const headers = {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(apiConfig.url, payload, {
      headers,
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    if (!response.data) {
      throw new Error('No audio data received from OpenAI TTS');
    }

    return {
      audioBuffer: Buffer.from(response.data),
      contentType: 'audio/mpeg',
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16
    };
  }

  /**
   * Synthesize using ElevenLabs API
   * @param {Object} apiConfig - API configuration
   * @param {string} text - Text to synthesize
   * @param {Object} options - Voice options
   * @returns {Promise<Object>} Synthesis result
   * @private
   */
  async _synthesizeElevenLabs(apiConfig, text, options) {
    const voiceId = options.voiceId || apiConfig.voiceId;
    const url = `${apiConfig.url}/${voiceId}`;
    
    const payload = {
      text: text,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        speed: options.speed || 1.0
      }
    };

    const headers = {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiConfig.apiKey
    };

    const response = await axios.post(url, payload, {
      headers,
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    if (!response.data) {
      throw new Error('No audio data received from ElevenLabs');
    }

    return {
      audioBuffer: Buffer.from(response.data),
      contentType: 'audio/mpeg',
      sampleRate: 22050,
      channels: 1,
      bitDepth: 16
    };
  }

  /**
   * Synthesize using Hugging Face API (fallback)
   * @param {Object} apiConfig - API configuration
   * @param {string} text - Text to synthesize
   * @param {Object} options - Voice options
   * @returns {Promise<Object>} Synthesis result
   * @private
   */
  async _synthesizeHuggingFace(apiConfig, text, options) {
    const headers = {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      inputs: text
    };

    const response = await axios.post(apiConfig.url, payload, {
      headers,
      timeout: 120000, // HF can be slower
      responseType: 'arraybuffer'
    });

    if (!response.data) {
      throw new Error('No audio data received from Hugging Face');
    }

    return {
      audioBuffer: Buffer.from(response.data),
      contentType: 'audio/wav',
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16
    };
  }

  /**
   * Preprocess text for TTS
   * @param {string} text - Input text
   * @returns {string} Processed text
   * @private
   */
  _preprocessTextForTTS(text) {
    let processed = text.trim();
    
    // Remove markdown formatting
    processed = processed.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    processed = processed.replace(/\*(.*?)\*/g, '$1'); // Italic
    processed = processed.replace(/`(.*?)`/g, '$1'); // Code
    
    // Replace common abbreviations with full words
    processed = processed.replace(/\bDr\./g, 'Doctor');
    processed = processed.replace(/\bMr\./g, 'Mister');
    processed = processed.replace(/\bMrs\./g, 'Missus');
    processed = processed.replace(/\bMs\./g, 'Miss');
    processed = processed.replace(/\betc\./g, 'etcetera');
    processed = processed.replace(/\bi\.e\./g, 'that is');
    processed = processed.replace(/\be\.g\./g, 'for example');
    
    // Ensure proper spacing around punctuation
    processed = processed.replace(/([.!?])([A-Za-z])/g, '$1 $2');
    
    // Limit length if too long
    if (processed.length > this.maxTextLength) {
      processed = processed.substring(0, this.maxTextLength - 3) + '...';
    }
    
    return processed;
  }

  /**
   * Enhance synthesis result with metadata
   * @param {Object} result - Raw synthesis result
   * @param {string} originalText - Original text
   * @param {Object} options - Synthesis options
   * @returns {Object} Enhanced result
   * @private
   */
  _enhanceSynthesisResult(result, originalText, options) {
    const duration = this.estimateAudioDuration(originalText);
    
    return {
      audioBuffer: result.audioBuffer,
      contentType: result.contentType,
      language: options.language || 'en',
      sourceLanguage: 'en',
      translationApplied: false,
      duration: duration,
      sampleRate: result.sampleRate,
      channels: result.channels,
      bitDepth: result.bitDepth,
      voiceParameters: {
        speed: options.speed,
        voice: options.voice,
        pitch: options.pitch
      },
      textInfo: {
        originalLength: originalText.length,
        wordCount: originalText.trim().split(/\s+/).length
      },
      apiUsed: this.activeApi
    };
  }

  /**
   * Generate fallback audio when API fails
   * @param {string} text - Text that failed to synthesize
   * @param {Object} options - Synthesis options
   * @param {Error} lastError - Last error encountered
   * @returns {Object} Fallback audio result
   * @private
   */
  _getFallbackAudio(text, options, lastError) {
    console.log('Generating fallback audio for text length:', text.length);
    
    // Create simple beep tones to indicate TTS completion
    const sampleRate = 22050;
    const duration = Math.max(2, Math.min(8, text.length / 100)); // 2-8 seconds based on text length
    const bufferSize = Math.floor(sampleRate * duration);
    const audioBuffer = Buffer.alloc(bufferSize * 2); // 16-bit audio
    
    // Generate multiple tones to make it sound more like speech patterns
    const frequencies = [400, 350, 450, 380]; // Different frequencies for variety
    const segmentSize = Math.floor(bufferSize / 4);
    
    for (let segment = 0; segment < 4; segment++) {
      const freq = frequencies[segment];
      const startIdx = segment * segmentSize;
      const endIdx = Math.min(startIdx + segmentSize, bufferSize);
      
      for (let i = startIdx; i < endIdx; i++) {
        const timeInSegment = (i - startIdx) / segmentSize;
        const envelope = Math.sin(Math.PI * timeInSegment); // Fade in and out
        const sample = Math.sin(2 * Math.PI * freq * i / sampleRate) * envelope * 0.1;
        const intSample = Math.floor(sample * 32767);
        audioBuffer.writeInt16LE(intSample, i * 2);
      }
    }
    
    return {
      audioBuffer: audioBuffer,
      contentType: 'audio/wav',
      language: options.language || 'en',
      sourceLanguage: 'en',
      translationApplied: false,
      duration: duration,
      sampleRate: sampleRate,
      channels: 1,
      bitDepth: 16,
      voiceParameters: options,
      textInfo: {
        originalLength: text.length,
        wordCount: text.trim().split(/\s+/).length
      },
      isFallback: true,
      fallbackReason: lastError ? lastError.message : 'API unavailable',
      apiUsed: 'fallback'
    };
  }

  /**
   * Get service information
   * @returns {Object} Service information
   */
  getServiceInfo() {
    return {
      isAvailable: this.isServiceAvailable(),
      activeApi: this.activeApi,
      model: this.activeApi ? this.apiConfigs[this.activeApi].model : null,
      maxTextLength: this.maxTextLength,
      supportedFormats: ['audio/mpeg', 'audio/wav'],
      voiceParameters: {
        speed: { min: 0.25, max: 4.0, default: 1.0 },
        voices: this.activeApi === 'openai' ? ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] : ['default']
      },
      features: {
        realTime: this.activeApi === 'openai',
        multipleVoices: this.activeApi === 'openai' || this.activeApi === 'elevenlabs',
        speedControl: true,
        languageSupport: this.activeApi === 'openai'
      }
    };
  }
}

module.exports = TextToSpeechService;
