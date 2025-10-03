class ApiBatchingService {
  constructor() {
    this.batchQueues = new Map();
    this.batchConfig = {
      maxBatchSize: 5,
      batchTimeout: 100, // 100ms
      maxWaitTime: 1000, // 1 second max wait
      enabled: true
    };

    this.processingBatches = new Set();
    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      batchesSent: 0,
      averageBatchSize: 0,
      averageWaitTime: 0
    };

    // Cleanup interval for stale batches
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleBatches();
    }, 5000);
  }

  /**
   * Add request to batch queue
   * @param {string} batchType - Type of batch (tts, stt, ai)
   * @param {Object} request - Request data
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   * @returns {string} Batch ID
   */
  addToBatch(batchType, request, resolve, reject) {
    if (!this.batchConfig.enabled) {
      // Process immediately if batching is disabled
      setImmediate(() => resolve({ batched: false, data: request }));
      return null;
    }

    const batchId = `${batchType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize batch queue if it doesn't exist
    if (!this.batchQueues.has(batchType)) {
      this.batchQueues.set(batchType, []);
    }

    const batch = this.batchQueues.get(batchType);
    const batchItem = {
      id: batchId,
      request,
      resolve,
      reject,
      timestamp: Date.now()
    };

    batch.push(batchItem);
    this.metrics.totalRequests++;

    // Check if batch is ready to process
    if (batch.length >= this.batchConfig.maxBatchSize) {
      setImmediate(() => this.processBatch(batchType));
    } else {
      // Set timeout for batch processing
      setTimeout(() => {
        if (this.batchQueues.has(batchType) && this.batchQueues.get(batchType).length > 0) {
          this.processBatch(batchType);
        }
      }, this.batchConfig.batchTimeout);
    }

    return batchId;
  }

  /**
   * Process batch of requests
   * @param {string} batchType - Type of batch to process
   */
  async processBatch(batchType) {
    if (this.processingBatches.has(batchType)) {
      return; // Already processing this batch type
    }

    const batch = this.batchQueues.get(batchType);
    if (!batch || batch.length === 0) {
      return;
    }

    // Mark as processing
    this.processingBatches.add(batchType);
    
    // Extract current batch items
    const batchItems = batch.splice(0, this.batchConfig.maxBatchSize);
    
    try {
      await this.executeBatch(batchType, batchItems);
    } catch (error) {
      console.error(`Batch processing failed for ${batchType}:`, error);
      // Reject all items in the failed batch
      batchItems.forEach(item => {
        item.reject(new Error(`Batch processing failed: ${error.message}`));
      });
    } finally {
      // Mark as no longer processing
      this.processingBatches.delete(batchType);
      
      // Update metrics
      this.updateBatchMetrics(batchItems.length);
    }
  }

  /**
   * Execute batch based on type
   * @param {string} batchType - Type of batch
   * @param {Array} batchItems - Items in the batch
   */
  async executeBatch(batchType, batchItems) {
    switch (batchType) {
      case 'tts':
        await this.executeTTSBatch(batchItems);
        break;
      case 'stt':
        await this.executeSTTBatch(batchItems);
        break;
      case 'ai':
        await this.executeAIBatch(batchItems);
        break;
      case 'translation':
        await this.executeTranslationBatch(batchItems);
        break;
      default:
        await this.executeGenericBatch(batchItems);
    }
  }

  /**
   * Execute Text-to-Speech batch
   * @param {Array} batchItems - TTS requests
   */
  async executeTTSBatch(batchItems) {
    // Group by similar voice parameters for efficiency
    const parameterGroups = this.groupByVoiceParameters(batchItems);
    
    for (const [paramKey, items] of parameterGroups) {
      try {
        // Process items with similar parameters together
        const results = await this.processTTSGroup(items);
        
        // Resolve individual promises
        items.forEach((item, index) => {
          if (results[index]) {
            item.resolve({
              batched: true,
              batchSize: items.length,
              result: results[index]
            });
          } else {
            item.reject(new Error('TTS batch processing failed for item'));
          }
        });
        
      } catch (error) {
        // Reject all items in this parameter group
        items.forEach(item => {
          item.reject(new Error(`TTS batch failed: ${error.message}`));
        });
      }
    }
  }

  /**
   * Execute Speech-to-Text batch
   * @param {Array} batchItems - STT requests
   */
  async executeSTTBatch(batchItems) {
    // STT requests are typically processed individually due to audio data
    // But we can optimize by processing them in parallel
    const promises = batchItems.map(async (item) => {
      try {
        const result = await this.processSTTItem(item.request);
        item.resolve({
          batched: true,
          batchSize: batchItems.length,
          result
        });
      } catch (error) {
        item.reject(new Error(`STT processing failed: ${error.message}`));
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Execute AI conversation batch
   * @param {Array} batchItems - AI requests
   */
  async executeAIBatch(batchItems) {
    // Group by session for context efficiency
    const sessionGroups = this.groupBySession(batchItems);
    
    for (const [sessionId, items] of sessionGroups) {
      try {
        // Process items from same session together for context efficiency
        const results = await this.processAIGroup(items, sessionId);
        
        // Resolve individual promises
        items.forEach((item, index) => {
          if (results[index]) {
            item.resolve({
              batched: true,
              batchSize: items.length,
              sessionId,
              result: results[index]
            });
          } else {
            item.reject(new Error('AI batch processing failed for item'));
          }
        });
        
      } catch (error) {
        // Reject all items in this session group
        items.forEach(item => {
          item.reject(new Error(`AI batch failed: ${error.message}`));
        });
      }
    }
  }

  /**
   * Execute translation batch
   * @param {Array} batchItems - Translation requests
   */
  async executeTranslationBatch(batchItems) {
    // Group by language pairs for efficiency
    const languageGroups = this.groupByLanguagePair(batchItems);
    
    for (const [langPair, items] of languageGroups) {
      try {
        // Process items with same language pair together
        const results = await this.processTranslationGroup(items, langPair);
        
        // Resolve individual promises
        items.forEach((item, index) => {
          if (results[index]) {
            item.resolve({
              batched: true,
              batchSize: items.length,
              languagePair: langPair,
              result: results[index]
            });
          } else {
            item.reject(new Error('Translation batch processing failed for item'));
          }
        });
        
      } catch (error) {
        // Reject all items in this language group
        items.forEach(item => {
          item.reject(new Error(`Translation batch failed: ${error.message}`));
        });
      }
    }
  }

  /**
   * Execute generic batch
   * @param {Array} batchItems - Generic requests
   */
  async executeGenericBatch(batchItems) {
    // Process all items in parallel
    const promises = batchItems.map(async (item) => {
      try {
        const result = await this.processGenericItem(item.request);
        item.resolve({
          batched: true,
          batchSize: batchItems.length,
          result
        });
      } catch (error) {
        item.reject(new Error(`Generic processing failed: ${error.message}`));
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Group TTS items by voice parameters
   * @param {Array} items - TTS items
   * @returns {Map} Grouped items
   */
  groupByVoiceParameters(items) {
    const groups = new Map();
    
    items.forEach(item => {
      const params = item.request.voiceParams || {};
      const key = JSON.stringify({
        language: item.request.language || 'en',
        speed: params.speed || 1.0,
        pitch: params.pitch || 1.0
      });
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
    
    return groups;
  }

  /**
   * Group AI items by session
   * @param {Array} items - AI items
   * @returns {Map} Grouped items
   */
  groupBySession(items) {
    const groups = new Map();
    
    items.forEach(item => {
      const sessionId = item.request.sessionId || 'default';
      
      if (!groups.has(sessionId)) {
        groups.set(sessionId, []);
      }
      groups.get(sessionId).push(item);
    });
    
    return groups;
  }

  /**
   * Group translation items by language pair
   * @param {Array} items - Translation items
   * @returns {Map} Grouped items
   */
  groupByLanguagePair(items) {
    const groups = new Map();
    
    items.forEach(item => {
      const fromLang = item.request.fromLang || 'auto';
      const toLang = item.request.toLang || 'en';
      const key = `${fromLang}-${toLang}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
    
    return groups;
  }

  /**
   * Process TTS group (placeholder - implement actual batching logic)
   * @param {Array} items - TTS items
   * @returns {Promise<Array>} Results
   */
  async processTTSGroup(items) {
    // Placeholder: In production, implement actual TTS batching
    // This could involve concatenating texts and splitting audio responses
    return items.map(item => ({
      audioBuffer: Buffer.alloc(0), // Placeholder
      text: item.request.text,
      processed: true
    }));
  }

  /**
   * Process STT item (placeholder)
   * @param {Object} request - STT request
   * @returns {Promise<Object>} Result
   */
  async processSTTItem(request) {
    // Placeholder: In production, implement actual STT processing
    return {
      transcription: 'placeholder transcription',
      confidence: 0.95,
      processed: true
    };
  }

  /**
   * Process AI group (placeholder)
   * @param {Array} items - AI items
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Results
   */
  async processAIGroup(items, sessionId) {
    // Placeholder: In production, implement actual AI batching
    // This could involve processing multiple messages in context
    return items.map(item => ({
      response: 'placeholder AI response',
      sessionId,
      processed: true
    }));
  }

  /**
   * Process translation group (placeholder)
   * @param {Array} items - Translation items
   * @param {string} langPair - Language pair
   * @returns {Promise<Array>} Results
   */
  async processTranslationGroup(items, langPair) {
    // Placeholder: In production, implement actual translation batching
    return items.map(item => ({
      translation: `translated: ${item.request.text}`,
      languagePair: langPair,
      processed: true
    }));
  }

  /**
   * Process generic item (placeholder)
   * @param {Object} request - Generic request
   * @returns {Promise<Object>} Result
   */
  async processGenericItem(request) {
    // Placeholder: In production, implement actual processing
    return {
      data: request,
      processed: true
    };
  }

  /**
   * Clean up stale batches
   */
  cleanupStaleBatches() {
    const now = Date.now();
    
    for (const [batchType, batch] of this.batchQueues) {
      const staleItems = [];
      
      // Find items that have been waiting too long
      for (let i = batch.length - 1; i >= 0; i--) {
        const item = batch[i];
        if (now - item.timestamp > this.batchConfig.maxWaitTime) {
          staleItems.push(batch.splice(i, 1)[0]);
        }
      }
      
      // Process stale items immediately
      if (staleItems.length > 0) {
        console.warn(`Processing ${staleItems.length} stale items for ${batchType}`);
        setImmediate(() => this.executeBatch(batchType, staleItems));
      }
    }
  }

  /**
   * Update batch metrics
   * @param {number} batchSize - Size of processed batch
   */
  updateBatchMetrics(batchSize) {
    this.metrics.batchedRequests += batchSize;
    this.metrics.batchesSent++;
    
    // Update average batch size
    this.metrics.averageBatchSize = 
      this.metrics.batchedRequests / this.metrics.batchesSent;
  }

  /**
   * Get batching statistics
   * @returns {Object} Batching statistics
   */
  getStats() {
    const batchingEfficiency = this.metrics.totalRequests > 0 ? 
      (this.metrics.batchedRequests / this.metrics.totalRequests) * 100 : 0;

    return {
      ...this.metrics,
      batchingEfficiency,
      queueSizes: Object.fromEntries(
        Array.from(this.batchQueues.entries()).map(([type, queue]) => [type, queue.length])
      ),
      processingBatches: Array.from(this.processingBatches),
      config: this.batchConfig
    };
  }

  /**
   * Update batching configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.batchConfig = { ...this.batchConfig, ...newConfig };
  }

  /**
   * Clear all batch queues
   */
  clearQueues() {
    for (const [batchType, batch] of this.batchQueues) {
      // Reject all pending items
      batch.forEach(item => {
        item.reject(new Error('Batch queue cleared'));
      });
    }
    
    this.batchQueues.clear();
    this.processingBatches.clear();
  }

  /**
   * Destroy the batching service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clearQueues();
    
    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      batchesSent: 0,
      averageBatchSize: 0,
      averageWaitTime: 0
    };
  }
}

module.exports = ApiBatchingService;