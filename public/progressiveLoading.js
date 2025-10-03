/**
 * Progressive Loading Manager for MindCare
 * Handles progressive loading of content and responses
 */

class ProgressiveLoadingManager {
    constructor() {
        this.loadingQueue = [];
        this.isProcessing = false;
        this.chunkSize = 50; // Characters per chunk for text
        this.loadingDelay = 30; // ms between chunks
        this.preloadThreshold = 0.8; // Start preloading at 80%
        
        // Performance metrics
        this.metrics = {
            totalLoads: 0,
            averageLoadTime: 0,
            chunksProcessed: 0,
            preloadsTriggered: 0
        };

        // Cache for preloaded content
        this.preloadCache = new Map();
        this.maxCacheSize = 20;
    }

    /**
     * Load content progressively with visual feedback
     * @param {string} content - Content to load
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Loading options
     * @returns {Promise<void>}
     */
    async loadProgressively(content, container, options = {}) {
        const startTime = performance.now();
        
        const config = {
            chunkSize: options.chunkSize || this.chunkSize,
            delay: options.delay || this.loadingDelay,
            showTyping: options.showTyping !== false,
            onProgress: options.onProgress,
            onComplete: options.onComplete,
            preserveFormatting: options.preserveFormatting || false
        };

        // Clear container
        container.innerHTML = '';
        
        // Show typing indicator if enabled
        let typingIndicator;
        if (config.showTyping) {
            typingIndicator = this.createTypingIndicator();
            container.appendChild(typingIndicator);
        }

        // Split content into chunks
        const chunks = this.splitIntoChunks(content, config.chunkSize, config.preserveFormatting);
        let loadedContent = '';

        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                loadedContent += chunk;

                // Update container content
                if (config.preserveFormatting) {
                    container.innerHTML = this.formatContent(loadedContent);
                } else {
                    container.textContent = loadedContent;
                }

                // Remove typing indicator on first chunk
                if (i === 0 && typingIndicator) {
                    typingIndicator.remove();
                }

                // Call progress callback
                if (config.onProgress) {
                    config.onProgress({
                        progress: (i + 1) / chunks.length,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        loadedContent: loadedContent
                    });
                }

                // Check for preloading trigger
                const progress = (i + 1) / chunks.length;
                if (progress >= this.preloadThreshold && options.preloadNext) {
                    this.triggerPreload(options.preloadNext);
                }

                // Delay between chunks (except for last chunk)
                if (i < chunks.length - 1) {
                    await this.sleep(config.delay);
                }

                this.metrics.chunksProcessed++;
            }

            // Final formatting
            if (config.preserveFormatting) {
                container.innerHTML = this.formatContent(loadedContent);
            }

            // Call completion callback
            if (config.onComplete) {
                config.onComplete(loadedContent);
            }

        } catch (error) {
            console.error('Progressive loading failed:', error);
            // Fallback: load all content at once
            container.textContent = content;
        } finally {
            // Remove typing indicator if still present
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.remove();
            }
        }

        const loadTime = performance.now() - startTime;
        this.updateMetrics(loadTime);
    }

    /**
     * Load AI response with typing effect
     * @param {string} response - AI response text
     * @param {HTMLElement} messageElement - Message element
     * @param {Object} options - Loading options
     * @returns {Promise<void>}
     */
    async loadAIResponse(response, messageElement, options = {}) {
        const config = {
            chunkSize: 2, // Smaller chunks for typing effect
            delay: 20, // Faster typing
            showTyping: true,
            preserveFormatting: true,
            ...options
        };

        // Add message class for styling
        messageElement.classList.add('message', 'bot', 'loading');

        await this.loadProgressively(response, messageElement, {
            ...config,
            onProgress: (progress) => {
                // Update progress indicator if present
                const progressBar = document.getElementById('loadingProgress');
                if (progressBar) {
                    progressBar.style.width = `${progress.progress * 100}%`;
                }
                
                if (config.onProgress) {
                    config.onProgress(progress);
                }
            },
            onComplete: (content) => {
                messageElement.classList.remove('loading');
                messageElement.classList.add('loaded');
                
                if (config.onComplete) {
                    config.onComplete(content);
                }
            }
        });
    }

    /**
     * Preload content for faster access
     * @param {Function|string} preloadTarget - Function to call or content to preload
     */
    async triggerPreload(preloadTarget) {
        try {
            this.metrics.preloadsTriggered++;
            
            if (typeof preloadTarget === 'function') {
                const preloadedContent = await preloadTarget();
                if (preloadedContent) {
                    this.cachePreloadedContent(preloadedContent);
                }
            } else if (typeof preloadTarget === 'string') {
                this.cachePreloadedContent(preloadTarget);
            }
        } catch (error) {
            console.warn('Preloading failed:', error);
        }
    }

    /**
     * Cache preloaded content
     * @param {string} content - Content to cache
     */
    cachePreloadedContent(content) {
        const cacheKey = this.generateCacheKey(content);
        
        // Check cache size limit
        if (this.preloadCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.preloadCache.keys().next().value;
            this.preloadCache.delete(firstKey);
        }

        this.preloadCache.set(cacheKey, {
            content,
            timestamp: Date.now()
        });
    }

    /**
     * Get preloaded content
     * @param {string} content - Content to check
     * @returns {string|null} Cached content or null
     */
    getPreloadedContent(content) {
        const cacheKey = this.generateCacheKey(content);
        const cached = this.preloadCache.get(cacheKey);
        
        if (cached) {
            // Check if not too old (5 minutes)
            if (Date.now() - cached.timestamp < 300000) {
                return cached.content;
            } else {
                this.preloadCache.delete(cacheKey);
            }
        }
        
        return null;
    }

    /**
     * Split content into chunks
     * @param {string} content - Content to split
     * @param {number} chunkSize - Size of each chunk
     * @param {boolean} preserveWords - Whether to preserve word boundaries
     * @returns {Array<string>} Array of chunks
     */
    splitIntoChunks(content, chunkSize, preserveWords = true) {
        if (!content || chunkSize <= 0) return [content || ''];

        const chunks = [];
        let currentIndex = 0;

        while (currentIndex < content.length) {
            let endIndex = Math.min(currentIndex + chunkSize, content.length);
            
            // If preserving words, adjust to word boundary
            if (preserveWords && endIndex < content.length) {
                const nextChar = content[endIndex];
                const prevChar = content[endIndex - 1];
                
                // Don't break in the middle of a word
                if (nextChar !== ' ' && prevChar !== ' ') {
                    const spaceIndex = content.indexOf(' ', endIndex);
                    if (spaceIndex !== -1 && spaceIndex - currentIndex < chunkSize * 1.5) {
                        endIndex = spaceIndex;
                    }
                }
            }

            chunks.push(content.slice(currentIndex, endIndex));
            currentIndex = endIndex;
        }

        return chunks;
    }

    /**
     * Create typing indicator element
     * @returns {HTMLElement} Typing indicator element
     */
    createTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        // Add CSS if not already present
        this.ensureTypingCSS();
        
        return indicator;
    }

    /**
     * Ensure typing indicator CSS is present
     */
    ensureTypingCSS() {
        if (document.getElementById('typing-indicator-css')) return;

        const style = document.createElement('style');
        style.id = 'typing-indicator-css';
        style.textContent = `
            .typing-indicator {
                display: inline-block;
                padding: 8px 12px;
            }
            
            .typing-dots {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .typing-dots span {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #9ca3af;
                animation: typing-pulse 1.4s infinite ease-in-out;
            }
            
            .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
            .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
            .typing-dots span:nth-child(3) { animation-delay: 0s; }
            
            @keyframes typing-pulse {
                0%, 80%, 100% {
                    opacity: 0.3;
                    transform: scale(0.8);
                }
                40% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            .message.loading {
                opacity: 0.8;
            }
            
            .message.loaded {
                opacity: 1;
                transition: opacity 0.3s ease;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Format content with basic HTML support
     * @param {string} content - Content to format
     * @returns {string} Formatted HTML
     */
    formatContent(content) {
        // Basic formatting: convert newlines to <br> and preserve spaces
        return content
            .replace(/\n/g, '<br>')
            .replace(/  /g, '&nbsp;&nbsp;');
    }

    /**
     * Generate cache key for content
     * @param {string} content - Content to generate key for
     * @returns {string} Cache key
     */
    generateCacheKey(content) {
        // Simple hash function for cache key
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Update performance metrics
     * @param {number} loadTime - Load time in milliseconds
     */
    updateMetrics(loadTime) {
        this.metrics.totalLoads++;
        this.metrics.averageLoadTime = 
            (this.metrics.averageLoadTime * (this.metrics.totalLoads - 1) + loadTime) / this.metrics.totalLoads;
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.preloadCache.size,
            cacheHitRate: this.calculateCacheHitRate()
        };
    }

    /**
     * Calculate cache hit rate
     * @returns {number} Cache hit rate percentage
     */
    calculateCacheHitRate() {
        // This would need to be tracked separately in a real implementation
        return 0; // Placeholder
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.chunkSize) this.chunkSize = config.chunkSize;
        if (config.loadingDelay) this.loadingDelay = config.loadingDelay;
        if (config.preloadThreshold) this.preloadThreshold = config.preloadThreshold;
        if (config.maxCacheSize) this.maxCacheSize = config.maxCacheSize;
    }

    /**
     * Clear preload cache
     */
    clearCache() {
        this.preloadCache.clear();
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.clearCache();
        this.loadingQueue = [];
        this.isProcessing = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressiveLoadingManager;
} else {
    window.ProgressiveLoadingManager = ProgressiveLoadingManager;
}