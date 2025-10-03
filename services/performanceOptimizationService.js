const crypto = require('crypto');

class PerformanceOptimizationService {
  constructor() {
    // Audio compression settings
    this.audioCompression = {
      enabled: true,
      quality: 0.8, // 0.1 to 1.0
      sampleRate: 16000, // Optimized for speech
      bitRate: 64000, // 64kbps for good quality/size balance
      format: 'webm' // Efficient format for web
    };

    // Response caching
    this.responseCache = new Map();
    this.cacheConfig = {
      maxSize: 100, // Maximum cached responses
      ttl: 300000, // 5 minutes TTL
      enabled: true
    };

    // API call batching
    this.batchConfig = {
      enabled: true,
      maxBatchSize: 5,
      batchTimeout: 100, // 100ms
      pendingRequests: new Map()
    };

    // Progressive loading
    this.progressiveLoading = {
      enabled: true,
      chunkSize: 1024 * 16, // 16KB chunks
      preloadThreshold: 0.8 // Start preloading at 80%
    };

    // Performance metrics
    this.metrics = {
      audioCompressionRatio: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      batchEfficiency: 0,
      totalRequests: 0,
      cachedRequests: 0,
      batchedRequests: 0
    };

    // Cleanup interval for cache
    this.cleanupInterval = setInterval(() => {
      this._cleanupCache();
    }, 60000); // Clean every minute
  }

  /**
   * Compress audio buffer for optimal transmission
   * @param {Buffer} audioBuffer - Original audio buffer
   * @param {Object} options - Compression options
   * @returns {Promise<Object>} Compressed audio with metadata
   */
  async compressAudio(audioBuffer, options = {}) {
    if (!this.audioCompression.enabled || !audioBuffer) {
      return {
        compressedBuffer: audioBuffer,
        originalSize: audioBuffer ? audioBuffer.length : 0,
        compressedSize: audioBuffer ? audioBuffer.length : 0,
        compressionRatio: 1,
        format: 'original'
      };
    }

    const startTime = Date.now();
    const originalSize = audioBuffer.length;

    try {
      // Simple compression simulation (in production, use actual audio compression)
      const compressionLevel = options.quality || this.audioCompression.quality;
      const targetSize = Math.floor(originalSize * compressionLevel);
      
      // For demonstration, we'll simulate compression by reducing buffer size
      // In production, use libraries like ffmpeg-node or similar
      const compressedBuffer = this._simulateAudioCompression(audioBuffer, targetSize);
      
      const compressionRatio = originalSize / compressedBuffer.length;
      this.metrics.audioCompressionRatio = 
        (this.metrics.audioCompressionRatio + compressionRatio) / 2;

      const processingTime = Date.now() - startTime;

      return {
        compressedBuffer,
        originalSize,
        compressedSize: compressedBuffer.length,
        compressionRatio,
        format: options.format || this.audioCompression.format,
        processingTime,
        quality: compressionLevel
      };

    } catch (error) {
      console.error('Audio compression failed:', error);
      return {
        compressedBuffer: audioBuffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        format: 'original',
        error: error.message
      };
    }
  }

  /**
   * Cache AI responses for common queries
   * @param {string} query - User query
   * @param {string} response - AI response
   * @param {Object} metadata - Additional metadata
   */
  cacheResponse(query, response, metadata = {}) {
    if (!this.cacheConfig.enabled) return;

    const cacheKey = this._generateCacheKey(query, metadata);
    const cacheEntry = {
      response,
      metadata,
      timestamp: Date.now(),
      hitCount: 0
    };

    // Check cache size limit
    if (this.responseCache.size >= this.cacheConfig.maxSize) {
      this._evictOldestCache();
    }

    this.responseCache.set(cacheKey, cacheEntry);
  }

  /**
   * Retrieve cached response if available
   * @param {string} query - User query
   * @param {Object} metadata - Query metadata
   * @returns {Object|null} Cached response or null
   */
  getCachedResponse(query, metadata = {}) {
    if (!this.cacheConfig.enabled) return null;

    const cacheKey = this._generateCacheKey(query, metadata);
    const cacheEntry = this.responseCache.get(cacheKey);

    if (!cacheEntry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - cacheEntry.timestamp;
    if (age > this.cacheConfig.ttl) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    // Update hit count and metrics
    cacheEntry.hitCount++;
    this.metrics.cachedRequests++;
    this._updateCacheHitRate();

    return {
      response: cacheEntry.response,
      metadata: cacheEntry.metadata,
      cached: true,
      age,
      hitCount: cacheEntry.hitCount
    };
  }

  /**
   * Batch API requests for efficiency
   * @param {string} requestType - Type of request (tts, stt, ai)
   * @param {Object} requestData - Request data
   * @returns {Promise<Object>} Batched request result
   */
  async batchRequest(requestType, requestData) {
    if (!this.batchConfig.enabled) {
      return { batched: false, data: requestData };
    }

    const batchKey = `${requestType}_${Date.now()}`;
    
    // Add to pending requests
    if (!this.batchConfig.pendingRequests.has(requestType)) {
      this.batchConfig.pendingRequests.set(requestType, []);
    }

    const pendingBatch = this.batchConfig.pendingRequests.get(requestType);
    pendingBatch.push({ key: batchKey, data: requestData, timestamp: Date.now() });

    // Check if batch is ready
    if (pendingBatch.length >= this.batchConfig.maxBatchSize) {
      return await this._processBatch(requestType);
    }

    // Set timeout for batch processing
    setTimeout(() => {
      if (this.batchConfig.pendingRequests.has(requestType) && 
          this.batchConfig.pendingRequests.get(requestType).length > 0) {
        this._processBatch(requestType);
      }
    }, this.batchConfig.batchTimeout);

    return { batched: true, batchKey, pending: true };
  }

  /**
   * Implement progressive loading for large responses
   * @param {string} content - Content to load progressively
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<void>}
   */
  async progressiveLoad(content, onChunk) {
    if (!this.progressiveLoading.enabled || !content) {
      if (onChunk) onChunk(content, true, { chunkIndex: 0, totalChunks: 1, progress: 1 });
      return;
    }

    const chunkSize = this.progressiveLoading.chunkSize;
    
    // Ensure we have a reasonable chunk size for text content
    const effectiveChunkSize = typeof content === 'string' ? 
      Math.min(chunkSize, Math.max(10, Math.floor(content.length / 4))) : chunkSize;
    
    const totalChunks = Math.ceil(content.length / effectiveChunkSize);

    // If content is too small, return as single chunk
    if (totalChunks <= 1) {
      if (onChunk) {
        await onChunk(content, true, {
          chunkIndex: 0,
          totalChunks: 1,
          progress: 1
        });
      }
      return;
    }

    for (let i = 0; i < totalChunks; i++) {
      const start = i * effectiveChunkSize;
      const end = Math.min(start + effectiveChunkSize, content.length);
      const chunk = content.slice(start, end);
      const isLast = i === totalChunks - 1;

      if (onChunk) {
        await onChunk(chunk, isLast, {
          chunkIndex: i,
          totalChunks,
          progress: (i + 1) / totalChunks
        });
      }

      // Small delay to prevent blocking
      if (!isLast) {
        await this._sleep(10);
      }
    }
  }

  /**
   * Optimize API call patterns
   * @param {Array} requests - Array of API requests
   * @returns {Promise<Array>} Optimized results
   */
  async optimizeApiCalls(requests) {
    const startTime = Date.now();
    const results = [];

    // Group requests by type for batching
    const requestGroups = this._groupRequestsByType(requests);

    // Process each group
    for (const [type, groupRequests] of requestGroups) {
      try {
        // Check cache first
        const cachedResults = [];
        const uncachedRequests = [];

        for (const request of groupRequests) {
          const cached = this.getCachedResponse(request.query, request.metadata);
          if (cached) {
            cachedResults.push({ ...request, result: cached });
          } else {
            uncachedRequests.push(request);
          }
        }

        results.push(...cachedResults);

        // Process uncached requests
        if (uncachedRequests.length > 0) {
          const batchResults = await this._processBatchedRequests(type, uncachedRequests);
          results.push(...batchResults);
        }

      } catch (error) {
        console.error(`Error processing ${type} requests:`, error);
        // Add error results
        groupRequests.forEach(request => {
          results.push({ ...request, error: error.message });
        });
      }
    }

    const processingTime = Date.now() - startTime;
    this._updatePerformanceMetrics(processingTime, requests.length);

    return results;
  }

  /**
   * Get performance metrics
   * @returns {Object} Current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.responseCache.size,
      cacheHitRate: this._calculateCacheHitRate(),
      compressionEnabled: this.audioCompression.enabled,
      batchingEnabled: this.batchConfig.enabled,
      progressiveLoadingEnabled: this.progressiveLoading.enabled
    };
  }

  /**
   * Update optimization settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    if (settings.audioCompression) {
      this.audioCompression = { ...this.audioCompression, ...settings.audioCompression };
    }

    if (settings.caching) {
      this.cacheConfig = { ...this.cacheConfig, ...settings.caching };
    }

    if (settings.batching) {
      this.batchConfig = { ...this.batchConfig, ...settings.batching };
    }

    if (settings.progressiveLoading) {
      this.progressiveLoading = { ...this.progressiveLoading, ...settings.progressiveLoading };
    }
  }

  /**
   * Clear all caches and reset metrics
   */
  reset() {
    this.responseCache.clear();
    this.batchConfig.pendingRequests.clear();
    this.metrics = {
      audioCompressionRatio: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      batchEfficiency: 0,
      totalRequests: 0,
      cachedRequests: 0,
      batchedRequests: 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.reset();
  }

  // Private methods

  /**
   * Simulate audio compression (placeholder for real implementation)
   * @param {Buffer} buffer - Original buffer
   * @param {number} targetSize - Target size
   * @returns {Buffer} Compressed buffer
   * @private
   */
  _simulateAudioCompression(buffer, targetSize) {
    if (targetSize >= buffer.length) {
      return buffer;
    }

    // Simple simulation: create a smaller buffer
    // In production, use actual audio compression libraries
    const compressionRatio = targetSize / buffer.length;
    const step = Math.ceil(1 / compressionRatio);
    
    const compressed = Buffer.alloc(targetSize);
    let writeIndex = 0;
    
    for (let i = 0; i < buffer.length && writeIndex < targetSize; i += step) {
      compressed[writeIndex++] = buffer[i];
    }
    
    return compressed.slice(0, writeIndex);
  }

  /**
   * Generate cache key for query
   * @param {string} query - User query
   * @param {Object} metadata - Query metadata
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(query, metadata) {
    const normalizedQuery = query.toLowerCase().trim();
    const metadataString = JSON.stringify(metadata);
    return crypto.createHash('md5').update(normalizedQuery + metadataString).digest('hex');
  }

  /**
   * Evict oldest cache entry
   * @private
   */
  _evictOldestCache() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.responseCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.responseCache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.responseCache) {
      if (now - entry.timestamp > this.cacheConfig.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.responseCache.delete(key));
  }

  /**
   * Process batch of requests
   * @param {string} requestType - Type of requests
   * @returns {Promise<Object>} Batch result
   * @private
   */
  async _processBatch(requestType) {
    const pendingBatch = this.batchConfig.pendingRequests.get(requestType) || [];
    this.batchConfig.pendingRequests.set(requestType, []);

    if (pendingBatch.length === 0) {
      return { batched: false, results: [] };
    }

    this.metrics.batchedRequests += pendingBatch.length;

    // Simulate batch processing (in production, implement actual batching)
    const results = pendingBatch.map(item => ({
      key: item.key,
      data: item.data,
      processed: true,
      batchSize: pendingBatch.length
    }));

    return { batched: true, results, batchSize: pendingBatch.length };
  }

  /**
   * Group requests by type
   * @param {Array} requests - Array of requests
   * @returns {Map} Grouped requests
   * @private
   */
  _groupRequestsByType(requests) {
    const groups = new Map();

    requests.forEach(request => {
      const type = request.type || 'default';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type).push(request);
    });

    return groups;
  }

  /**
   * Process batched requests
   * @param {string} type - Request type
   * @param {Array} requests - Requests to process
   * @returns {Promise<Array>} Results
   * @private
   */
  async _processBatchedRequests(type, requests) {
    // Simulate processing (implement actual batch processing in production)
    return requests.map(request => ({
      ...request,
      result: { processed: true, type, batched: true }
    }));
  }

  /**
   * Update cache hit rate
   * @private
   */
  _updateCacheHitRate() {
    this.metrics.totalRequests++;
    this.metrics.cacheHitRate = this.metrics.cachedRequests / this.metrics.totalRequests;
  }

  /**
   * Calculate current cache hit rate
   * @returns {number} Cache hit rate
   * @private
   */
  _calculateCacheHitRate() {
    return this.metrics.totalRequests > 0 ? 
      this.metrics.cachedRequests / this.metrics.totalRequests : 0;
  }

  /**
   * Update performance metrics
   * @param {number} processingTime - Processing time in ms
   * @param {number} requestCount - Number of requests processed
   * @private
   */
  _updatePerformanceMetrics(processingTime, requestCount) {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + processingTime) / 2;
    
    this.metrics.batchEfficiency = 
      this.metrics.batchedRequests / Math.max(this.metrics.totalRequests, 1);
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
}

module.exports = PerformanceOptimizationService;