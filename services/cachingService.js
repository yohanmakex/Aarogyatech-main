const crypto = require('crypto');

class CachingService {
  constructor() {
    // Response cache for AI responses
    this.responseCache = new Map();
    
    // Audio cache for TTS responses
    this.audioCache = new Map();
    
    // Translation cache for language service
    this.translationCache = new Map();
    
    // Configuration
    this.config = {
      response: {
        maxSize: 200,
        ttl: 600000, // 10 minutes
        enabled: true
      },
      audio: {
        maxSize: 50,
        ttl: 1800000, // 30 minutes
        enabled: true
      },
      translation: {
        maxSize: 500,
        ttl: 3600000, // 1 hour
        enabled: true
      }
    };

    // Statistics
    this.stats = {
      response: { hits: 0, misses: 0, evictions: 0 },
      audio: { hits: 0, misses: 0, evictions: 0 },
      translation: { hits: 0, misses: 0, evictions: 0 }
    };

    // Common response patterns for mental health
    this.commonPatterns = new Map([
      ['greeting', ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening']],
      ['feeling_bad', ['sad', 'depressed', 'down', 'upset', 'feeling bad', 'not good']],
      ['anxiety', ['anxious', 'worried', 'nervous', 'panic', 'stress', 'overwhelmed']],
      ['help_request', ['help me', 'what should i do', 'i need help', 'can you help']],
      ['gratitude', ['thank you', 'thanks', 'appreciate', 'grateful']],
      ['goodbye', ['bye', 'goodbye', 'see you', 'talk later', 'have a good day']]
    ]);

    // Pre-cached responses for common patterns
    this.preloadCommonResponses();

    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000); // Clean every 5 minutes
  }

  /**
   * Cache AI response
   * @param {string} query - User query
   * @param {string} response - AI response
   * @param {Object} metadata - Additional metadata
   * @param {string} language - Response language
   * @returns {boolean} Success status
   */
  cacheResponse(query, response, metadata = {}, language = 'en') {
    if (!this.config.response.enabled) return false;

    const cacheKey = this._generateResponseKey(query, metadata, language);
    const cacheEntry = {
      query: query.toLowerCase().trim(),
      response,
      metadata,
      language,
      timestamp: Date.now(),
      hitCount: 0,
      pattern: this._detectPattern(query)
    };

    // Check cache size limit
    if (this.responseCache.size >= this.config.response.maxSize) {
      this._evictLRU('response');
    }

    this.responseCache.set(cacheKey, cacheEntry);
    return true;
  }

  /**
   * Get cached AI response
   * @param {string} query - User query
   * @param {Object} metadata - Query metadata
   * @param {string} language - Desired language
   * @returns {Object|null} Cached response or null
   */
  getCachedResponse(query, metadata = {}, language = 'en') {
    if (!this.config.response.enabled) return null;

    const cacheKey = this._generateResponseKey(query, metadata, language);
    const cacheEntry = this.responseCache.get(cacheKey);

    if (!cacheEntry) {
      // Try pattern-based matching for similar queries
      const patternMatch = this._findPatternMatch(query, language);
      if (patternMatch) {
        this.stats.response.hits++;
        return patternMatch;
      }
      
      this.stats.response.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - cacheEntry.timestamp > this.config.response.ttl) {
      this.responseCache.delete(cacheKey);
      this.stats.response.misses++;
      return null;
    }

    // Update hit count and access time
    cacheEntry.hitCount++;
    cacheEntry.lastAccess = Date.now();
    this.stats.response.hits++;

    return {
      response: cacheEntry.response,
      metadata: cacheEntry.metadata,
      cached: true,
      hitCount: cacheEntry.hitCount,
      pattern: cacheEntry.pattern
    };
  }

  /**
   * Cache audio response
   * @param {string} text - Original text
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {Object} voiceParams - Voice parameters
   * @param {string} language - Audio language
   * @returns {boolean} Success status
   */
  cacheAudio(text, audioBuffer, voiceParams = {}, language = 'en') {
    if (!this.config.audio.enabled) return false;

    const cacheKey = this._generateAudioKey(text, voiceParams, language);
    const cacheEntry = {
      text: text.toLowerCase().trim(),
      audioBuffer,
      voiceParams,
      language,
      timestamp: Date.now(),
      hitCount: 0,
      size: audioBuffer.length
    };

    // Check cache size limit
    if (this.audioCache.size >= this.config.audio.maxSize) {
      this._evictLRU('audio');
    }

    this.audioCache.set(cacheKey, cacheEntry);
    return true;
  }

  /**
   * Get cached audio
   * @param {string} text - Text to synthesize
   * @param {Object} voiceParams - Voice parameters
   * @param {string} language - Audio language
   * @returns {Object|null} Cached audio or null
   */
  getCachedAudio(text, voiceParams = {}, language = 'en') {
    if (!this.config.audio.enabled) return null;

    const cacheKey = this._generateAudioKey(text, voiceParams, language);
    const cacheEntry = this.audioCache.get(cacheKey);

    if (!cacheEntry) {
      this.stats.audio.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - cacheEntry.timestamp > this.config.audio.ttl) {
      this.audioCache.delete(cacheKey);
      this.stats.audio.misses++;
      return null;
    }

    // Update hit count and access time
    cacheEntry.hitCount++;
    cacheEntry.lastAccess = Date.now();
    this.stats.audio.hits++;

    return {
      audioBuffer: cacheEntry.audioBuffer,
      voiceParams: cacheEntry.voiceParams,
      cached: true,
      hitCount: cacheEntry.hitCount,
      size: cacheEntry.size
    };
  }

  /**
   * Cache translation
   * @param {string} text - Original text
   * @param {string} fromLang - Source language
   * @param {string} toLang - Target language
   * @param {string} translation - Translated text
   * @returns {boolean} Success status
   */
  cacheTranslation(text, fromLang, toLang, translation) {
    if (!this.config.translation.enabled) return false;

    const cacheKey = this._generateTranslationKey(text, fromLang, toLang);
    const cacheEntry = {
      originalText: text,
      fromLang,
      toLang,
      translation,
      timestamp: Date.now(),
      hitCount: 0
    };

    // Check cache size limit
    if (this.translationCache.size >= this.config.translation.maxSize) {
      this._evictLRU('translation');
    }

    this.translationCache.set(cacheKey, cacheEntry);
    return true;
  }

  /**
   * Get cached translation
   * @param {string} text - Text to translate
   * @param {string} fromLang - Source language
   * @param {string} toLang - Target language
   * @returns {Object|null} Cached translation or null
   */
  getCachedTranslation(text, fromLang, toLang) {
    if (!this.config.translation.enabled) return null;

    const cacheKey = this._generateTranslationKey(text, fromLang, toLang);
    const cacheEntry = this.translationCache.get(cacheKey);

    if (!cacheEntry) {
      this.stats.translation.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - cacheEntry.timestamp > this.config.translation.ttl) {
      this.translationCache.delete(cacheKey);
      this.stats.translation.misses++;
      return null;
    }

    // Update hit count and access time
    cacheEntry.hitCount++;
    cacheEntry.lastAccess = Date.now();
    this.stats.translation.hits++;

    return {
      translation: cacheEntry.translation,
      fromLang: cacheEntry.fromLang,
      toLang: cacheEntry.toLang,
      cached: true,
      hitCount: cacheEntry.hitCount
    };
  }

  /**
   * Preload common mental health responses
   */
  preloadCommonResponses() {
    const commonResponses = {
      'en': {
        'hello': "Hello! I'm here to support you. How are you feeling today?",
        'hi': "Hi there! I'm glad you reached out. What's on your mind?",
        'sad': "I understand you're feeling sad. It's okay to feel this way sometimes. Would you like to talk about what's making you feel sad?",
        'anxious': "I hear that you're feeling anxious. Anxiety can be overwhelming, but there are ways to manage it. Have you tried any breathing exercises?",
        'help me': "I'm here to help you. Can you tell me more about what you're going through right now?",
        'thank you': "You're very welcome. I'm glad I could help. Remember, I'm here whenever you need support.",
        'goodbye': "Take care of yourself. Remember, you can always come back here when you need someone to talk to."
      },
      'mr': {
        'hello': "नमस्कार! मी तुम्हाला सहाय्य करण्यासाठी येथे आहे. आज तुम्हाला कसे वाटत आहे?",
        'hi': "नमस्कार! तुम्ही संपर्क साधला याचा मला आनंद आहे. तुमच्या मनात काय आहे?",
        'sad': "मला समजते की तुम्हाला दुःख होत आहे. कधीकधी असे वाटणे सामान्य आहे. तुम्हाला काय दुःख देत आहे याबद्दल बोलू इच्छिता?",
        'anxious': "मी ऐकतो की तुम्हाला चिंता होत आहे. चिंता खूप त्रासदायक असू शकते, पण त्यावर नियंत्रण ठेवण्याचे मार्ग आहेत. तुम्ही श्वासोच्छवासाचे व्यायाम करून पाहिले आहेत का?",
        'help me': "मी तुम्हाला मदत करण्यासाठी येथे आहे. सध्या तुम्ही कशातून जात आहात याबद्दल अधिक सांगू शकाल का?",
        'thank you': "तुमचे खूप स्वागत आहे. मी मदत करू शकलो याचा मला आनंद आहे. लक्षात ठेवा, तुम्हाला जेव्हा सहाय्याची गरज असेल तेव्हा मी येथे आहे.",
        'goodbye': "स्वतःची काळजी घ्या. लक्षात ठेवा, जेव्हा तुम्हाला कोणाशी तरी बोलण्याची गरज असेल तेव्हा तुम्ही नेहमी येथे येऊ शकता."
      }
    };

    // Cache common responses
    for (const [lang, responses] of Object.entries(commonResponses)) {
      for (const [query, response] of Object.entries(responses)) {
        this.cacheResponse(query, response, { preloaded: true }, lang);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const calculateHitRate = (stats) => {
      const total = stats.hits + stats.misses;
      return total > 0 ? (stats.hits / total) * 100 : 0;
    };

    return {
      response: {
        ...this.stats.response,
        hitRate: calculateHitRate(this.stats.response),
        cacheSize: this.responseCache.size,
        maxSize: this.config.response.maxSize
      },
      audio: {
        ...this.stats.audio,
        hitRate: calculateHitRate(this.stats.audio),
        cacheSize: this.audioCache.size,
        maxSize: this.config.audio.maxSize,
        totalSizeBytes: this._calculateAudioCacheSize()
      },
      translation: {
        ...this.stats.translation,
        hitRate: calculateHitRate(this.stats.translation),
        cacheSize: this.translationCache.size,
        maxSize: this.config.translation.maxSize
      }
    };
  }

  /**
   * Update cache configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    if (newConfig.response) {
      this.config.response = { ...this.config.response, ...newConfig.response };
    }
    if (newConfig.audio) {
      this.config.audio = { ...this.config.audio, ...newConfig.audio };
    }
    if (newConfig.translation) {
      this.config.translation = { ...this.config.translation, ...newConfig.translation };
    }
  }

  /**
   * Clear specific cache
   * @param {string} cacheType - Type of cache to clear
   */
  clearCache(cacheType = 'all') {
    switch (cacheType) {
      case 'response':
        this.responseCache.clear();
        this.stats.response = { hits: 0, misses: 0, evictions: 0 };
        break;
      case 'audio':
        this.audioCache.clear();
        this.stats.audio = { hits: 0, misses: 0, evictions: 0 };
        break;
      case 'translation':
        this.translationCache.clear();
        this.stats.translation = { hits: 0, misses: 0, evictions: 0 };
        break;
      case 'all':
        this.responseCache.clear();
        this.audioCache.clear();
        this.translationCache.clear();
        this.stats = {
          response: { hits: 0, misses: 0, evictions: 0 },
          audio: { hits: 0, misses: 0, evictions: 0 },
          translation: { hits: 0, misses: 0, evictions: 0 }
        };
        break;
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();

    // Cleanup response cache
    for (const [key, entry] of this.responseCache) {
      if (now - entry.timestamp > this.config.response.ttl) {
        this.responseCache.delete(key);
      }
    }

    // Cleanup audio cache
    for (const [key, entry] of this.audioCache) {
      if (now - entry.timestamp > this.config.audio.ttl) {
        this.audioCache.delete(key);
      }
    }

    // Cleanup translation cache
    for (const [key, entry] of this.translationCache) {
      if (now - entry.timestamp > this.config.translation.ttl) {
        this.translationCache.delete(key);
      }
    }
  }

  /**
   * Destroy cache service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearCache('all');
  }

  // Private methods

  /**
   * Generate cache key for response
   * @param {string} query - User query
   * @param {Object} metadata - Query metadata
   * @param {string} language - Language
   * @returns {string} Cache key
   * @private
   */
  _generateResponseKey(query, metadata, language) {
    const normalizedQuery = query.toLowerCase().trim();
    const metadataString = JSON.stringify(metadata);
    const keyString = `${normalizedQuery}|${metadataString}|${language}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Generate cache key for audio
   * @param {string} text - Text to synthesize
   * @param {Object} voiceParams - Voice parameters
   * @param {string} language - Language
   * @returns {string} Cache key
   * @private
   */
  _generateAudioKey(text, voiceParams, language) {
    const normalizedText = text.toLowerCase().trim();
    const paramsString = JSON.stringify(voiceParams);
    const keyString = `${normalizedText}|${paramsString}|${language}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Generate cache key for translation
   * @param {string} text - Text to translate
   * @param {string} fromLang - Source language
   * @param {string} toLang - Target language
   * @returns {string} Cache key
   * @private
   */
  _generateTranslationKey(text, fromLang, toLang) {
    const normalizedText = text.toLowerCase().trim();
    const keyString = `${normalizedText}|${fromLang}|${toLang}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Detect pattern in user query
   * @param {string} query - User query
   * @returns {string|null} Detected pattern
   * @private
   */
  _detectPattern(query) {
    const lowerQuery = query.toLowerCase();
    
    for (const [pattern, keywords] of this.commonPatterns) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Find pattern-based match for similar queries
   * @param {string} query - User query
   * @param {string} language - Desired language
   * @returns {Object|null} Pattern match or null
   * @private
   */
  _findPatternMatch(query, language) {
    const pattern = this._detectPattern(query);
    if (!pattern) return null;

    // Look for cached responses with the same pattern
    for (const [key, entry] of this.responseCache) {
      if (entry.pattern === pattern && entry.language === language) {
        // Check if not expired
        if (Date.now() - entry.timestamp <= this.config.response.ttl) {
          entry.hitCount++;
          entry.lastAccess = Date.now();
          
          return {
            response: entry.response,
            metadata: { ...entry.metadata, patternMatch: true },
            cached: true,
            hitCount: entry.hitCount,
            pattern: entry.pattern
          };
        }
      }
    }

    return null;
  }

  /**
   * Evict least recently used entry
   * @param {string} cacheType - Type of cache
   * @private
   */
  _evictLRU(cacheType) {
    let cache;
    let statsKey;

    switch (cacheType) {
      case 'response':
        cache = this.responseCache;
        statsKey = 'response';
        break;
      case 'audio':
        cache = this.audioCache;
        statsKey = 'audio';
        break;
      case 'translation':
        cache = this.translationCache;
        statsKey = 'translation';
        break;
      default:
        return;
    }

    let lruKey = null;
    let lruTime = Date.now();

    for (const [key, entry] of cache) {
      const accessTime = entry.lastAccess || entry.timestamp;
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
      this.stats[statsKey].evictions++;
    }
  }

  /**
   * Calculate total size of audio cache
   * @returns {number} Total size in bytes
   * @private
   */
  _calculateAudioCacheSize() {
    let totalSize = 0;
    for (const entry of this.audioCache.values()) {
      totalSize += entry.size || 0;
    }
    return totalSize;
  }
}

module.exports = CachingService;