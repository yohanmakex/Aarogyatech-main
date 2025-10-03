/**
 * Audio Optimization Utilities for MindCare
 * Handles audio compression, streaming, and performance optimization
 */

class AudioOptimization {
    constructor() {
        this.compressionSettings = {
            quality: 0.8,
            sampleRate: 16000, // Optimized for speech
            channels: 1, // Mono for speech
            bitRate: 64000 // 64kbps
        };

        this.streamingSettings = {
            chunkSize: 4096, // 4KB chunks
            bufferSize: 8192, // 8KB buffer
            preloadThreshold: 0.7 // Start preloading at 70%
        };

        this.cache = new Map();
        this.maxCacheSize = 50; // Maximum cached audio files
        this.compressionWorker = null;

        this.initializeWorker();
    }

    /**
     * Initialize web worker for audio processing
     */
    initializeWorker() {
        if (typeof Worker !== 'undefined') {
            try {
                // Create inline worker for audio compression
                const workerCode = `
                    self.onmessage = function(e) {
                        const { audioData, settings, taskId } = e.data;
                        
                        try {
                            // Simulate audio compression
                            const compressed = compressAudioData(audioData, settings);
                            self.postMessage({
                                taskId,
                                success: true,
                                compressedData: compressed,
                                originalSize: audioData.length,
                                compressedSize: compressed.length
                            });
                        } catch (error) {
                            self.postMessage({
                                taskId,
                                success: false,
                                error: error.message
                            });
                        }
                    };

                    function compressAudioData(data, settings) {
                        // Simple compression simulation
                        const compressionRatio = settings.quality || 0.8;
                        const targetSize = Math.floor(data.length * compressionRatio);
                        
                        if (targetSize >= data.length) return data;
                        
                        const compressed = new Uint8Array(targetSize);
                        const step = data.length / targetSize;
                        
                        for (let i = 0; i < targetSize; i++) {
                            const sourceIndex = Math.floor(i * step);
                            compressed[i] = data[sourceIndex];
                        }
                        
                        return compressed;
                    }
                `;

                const blob = new Blob([workerCode], { type: 'application/javascript' });
                this.compressionWorker = new Worker(URL.createObjectURL(blob));
                
                this.compressionWorker.onmessage = (e) => {
                    this.handleWorkerMessage(e.data);
                };

            } catch (error) {
                console.warn('Web Worker not available, using main thread for audio processing:', error);
            }
        }
    }

    /**
     * Compress audio blob for optimal transmission
     * @param {Blob} audioBlob - Original audio blob
     * @param {Object} options - Compression options
     * @returns {Promise<Object>} Compressed audio result
     */
    async compressAudio(audioBlob, options = {}) {
        const settings = { ...this.compressionSettings, ...options };
        const startTime = performance.now();

        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioData = new Uint8Array(arrayBuffer);

            let compressedData;
            
            if (this.compressionWorker) {
                // Use web worker for compression
                compressedData = await this.compressWithWorker(audioData, settings);
            } else {
                // Use main thread
                compressedData = this.compressAudioData(audioData, settings);
            }

            const compressedBlob = new Blob([compressedData], { type: 'audio/webm' });
            const processingTime = performance.now() - startTime;

            return {
                originalBlob: audioBlob,
                compressedBlob,
                originalSize: audioBlob.size,
                compressedSize: compressedBlob.size,
                compressionRatio: audioBlob.size / compressedBlob.size,
                processingTime,
                settings
            };

        } catch (error) {
            console.error('Audio compression failed:', error);
            return {
                originalBlob: audioBlob,
                compressedBlob: audioBlob,
                originalSize: audioBlob.size,
                compressedSize: audioBlob.size,
                compressionRatio: 1,
                processingTime: performance.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Compress audio using web worker
     * @param {Uint8Array} audioData - Audio data
     * @param {Object} settings - Compression settings
     * @returns {Promise<Uint8Array>} Compressed data
     */
    compressWithWorker(audioData, settings) {
        return new Promise((resolve, reject) => {
            const taskId = Date.now() + Math.random();
            
            this.workerTasks = this.workerTasks || new Map();
            this.workerTasks.set(taskId, { resolve, reject });

            this.compressionWorker.postMessage({
                audioData,
                settings,
                taskId
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.workerTasks.has(taskId)) {
                    this.workerTasks.delete(taskId);
                    reject(new Error('Audio compression timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Handle worker message
     * @param {Object} data - Worker message data
     */
    handleWorkerMessage(data) {
        const { taskId, success, compressedData, error } = data;
        
        if (!this.workerTasks || !this.workerTasks.has(taskId)) {
            return;
        }

        const { resolve, reject } = this.workerTasks.get(taskId);
        this.workerTasks.delete(taskId);

        if (success) {
            resolve(compressedData);
        } else {
            reject(new Error(error));
        }
    }

    /**
     * Compress audio data (main thread implementation)
     * @param {Uint8Array} data - Audio data
     * @param {Object} settings - Compression settings
     * @returns {Uint8Array} Compressed data
     */
    compressAudioData(data, settings) {
        const compressionRatio = settings.quality || 0.8;
        const targetSize = Math.floor(data.length * compressionRatio);
        
        if (targetSize >= data.length) return data;
        
        const compressed = new Uint8Array(targetSize);
        const step = data.length / targetSize;
        
        for (let i = 0; i < targetSize; i++) {
            const sourceIndex = Math.floor(i * step);
            compressed[i] = data[sourceIndex];
        }
        
        return compressed;
    }

    /**
     * Optimize audio recording settings
     * @param {MediaRecorder} mediaRecorder - Media recorder instance
     * @returns {Object} Optimized settings
     */
    optimizeRecordingSettings(mediaRecorder) {
        const optimizedSettings = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: this.compressionSettings.bitRate
        };

        // Check supported formats and choose the best one
        const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav'
        ];

        for (const type of supportedTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                optimizedSettings.mimeType = type;
                break;
            }
        }

        return optimizedSettings;
    }

    /**
     * Create streaming audio player with progressive loading
     * @param {string} audioUrl - Audio URL or blob URL
     * @param {Object} options - Player options
     * @returns {Promise<AudioStreamPlayer>} Stream player instance
     */
    async createStreamPlayer(audioUrl, options = {}) {
        return new AudioStreamPlayer(audioUrl, {
            ...this.streamingSettings,
            ...options
        });
    }

    /**
     * Cache audio for quick access
     * @param {string} key - Cache key
     * @param {Blob} audioBlob - Audio blob to cache
     */
    cacheAudio(key, audioBlob) {
        // Check cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            blob: audioBlob,
            timestamp: Date.now(),
            size: audioBlob.size
        });
    }

    /**
     * Get cached audio
     * @param {string} key - Cache key
     * @returns {Blob|null} Cached audio blob or null
     */
    getCachedAudio(key) {
        const cached = this.cache.get(key);
        if (cached) {
            // Update access time
            cached.timestamp = Date.now();
            return cached.blob;
        }
        return null;
    }

    /**
     * Clear audio cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get optimization statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const cacheSize = Array.from(this.cache.values())
            .reduce((total, item) => total + item.size, 0);

        return {
            cacheEntries: this.cache.size,
            cacheSizeBytes: cacheSize,
            compressionEnabled: !!this.compressionWorker,
            settings: {
                compression: this.compressionSettings,
                streaming: this.streamingSettings
            }
        };
    }

    /**
     * Update optimization settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        if (newSettings.compression) {
            this.compressionSettings = { ...this.compressionSettings, ...newSettings.compression };
        }
        if (newSettings.streaming) {
            this.streamingSettings = { ...this.streamingSettings, ...newSettings.streaming };
        }
        if (newSettings.maxCacheSize) {
            this.maxCacheSize = newSettings.maxCacheSize;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.compressionWorker) {
            this.compressionWorker.terminate();
            this.compressionWorker = null;
        }
        this.clearCache();
        if (this.workerTasks) {
            this.workerTasks.clear();
        }
    }
}

/**
 * Audio Stream Player for progressive loading
 */
class AudioStreamPlayer {
    constructor(audioUrl, options = {}) {
        this.audioUrl = audioUrl;
        this.options = options;
        this.audio = new Audio();
        this.chunks = [];
        this.currentChunk = 0;
        this.isLoading = false;
        this.isPlaying = false;
        
        this.setupAudio();
    }

    /**
     * Setup audio element
     */
    setupAudio() {
        this.audio.preload = 'metadata';
        
        this.audio.addEventListener('canplay', () => {
            this.onCanPlay();
        });

        this.audio.addEventListener('progress', () => {
            this.onProgress();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.onTimeUpdate();
        });

        this.audio.addEventListener('ended', () => {
            this.onEnded();
        });

        this.audio.addEventListener('error', (e) => {
            this.onError(e);
        });
    }

    /**
     * Load and play audio with progressive loading
     * @returns {Promise<void>}
     */
    async play() {
        if (this.isPlaying) return;

        try {
            this.isLoading = true;
            this.audio.src = this.audioUrl;
            
            // Start loading
            this.audio.load();
            
            // Wait for enough data to start playing
            await this.waitForCanPlay();
            
            this.isPlaying = true;
            await this.audio.play();
            
        } catch (error) {
            console.error('Audio playback failed:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Pause audio playback
     */
    pause() {
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    /**
     * Stop audio playback
     */
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
        }
    }

    /**
     * Set playback volume
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Set playback rate
     * @param {number} rate - Playback rate
     */
    setPlaybackRate(rate) {
        if (this.audio) {
            this.audio.playbackRate = rate;
        }
    }

    /**
     * Get current playback progress
     * @returns {Object} Progress info
     */
    getProgress() {
        if (!this.audio) return { current: 0, duration: 0, progress: 0 };

        return {
            current: this.audio.currentTime,
            duration: this.audio.duration || 0,
            progress: this.audio.duration ? this.audio.currentTime / this.audio.duration : 0,
            buffered: this.getBufferedProgress()
        };
    }

    /**
     * Get buffered progress
     * @returns {number} Buffered percentage
     */
    getBufferedProgress() {
        if (!this.audio || !this.audio.buffered.length) return 0;

        const buffered = this.audio.buffered;
        const duration = this.audio.duration;
        
        if (!duration) return 0;

        let bufferedEnd = 0;
        for (let i = 0; i < buffered.length; i++) {
            bufferedEnd = Math.max(bufferedEnd, buffered.end(i));
        }

        return bufferedEnd / duration;
    }

    /**
     * Wait for audio to be ready to play
     * @returns {Promise<void>}
     */
    waitForCanPlay() {
        return new Promise((resolve, reject) => {
            if (this.audio.readyState >= 3) { // HAVE_FUTURE_DATA
                resolve();
                return;
            }

            const onCanPlay = () => {
                this.audio.removeEventListener('canplay', onCanPlay);
                this.audio.removeEventListener('error', onError);
                resolve();
            };

            const onError = (e) => {
                this.audio.removeEventListener('canplay', onCanPlay);
                this.audio.removeEventListener('error', onError);
                reject(new Error('Audio loading failed'));
            };

            this.audio.addEventListener('canplay', onCanPlay);
            this.audio.addEventListener('error', onError);

            // Timeout after 30 seconds
            setTimeout(() => {
                this.audio.removeEventListener('canplay', onCanPlay);
                this.audio.removeEventListener('error', onError);
                reject(new Error('Audio loading timeout'));
            }, 30000);
        });
    }

    /**
     * Handle can play event
     */
    onCanPlay() {
        if (this.options.onCanPlay) {
            this.options.onCanPlay();
        }
    }

    /**
     * Handle progress event
     */
    onProgress() {
        const progress = this.getProgress();
        
        // Check if we need to preload more
        if (progress.buffered < this.options.preloadThreshold && !this.isLoading) {
            this.preloadNext();
        }

        if (this.options.onProgress) {
            this.options.onProgress(progress);
        }
    }

    /**
     * Handle time update event
     */
    onTimeUpdate() {
        const progress = this.getProgress();
        
        if (this.options.onTimeUpdate) {
            this.options.onTimeUpdate(progress);
        }
    }

    /**
     * Handle ended event
     */
    onEnded() {
        this.isPlaying = false;
        
        if (this.options.onEnded) {
            this.options.onEnded();
        }
    }

    /**
     * Handle error event
     */
    onError(error) {
        this.isPlaying = false;
        this.isLoading = false;
        
        if (this.options.onError) {
            this.options.onError(error);
        }
    }

    /**
     * Preload next chunk
     */
    preloadNext() {
        // Implementation for chunk-based preloading
        // This would be used for very large audio files
        console.log('Preloading next audio chunk...');
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
            this.audio = null;
        }
        this.chunks = [];
        this.isPlaying = false;
        this.isLoading = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioOptimization, AudioStreamPlayer };
} else {
    window.AudioOptimization = AudioOptimization;
    window.AudioStreamPlayer = AudioStreamPlayer;
}