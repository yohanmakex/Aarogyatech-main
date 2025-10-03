const request = require('supertest');
const { app } = require('../server');
const PerformanceOptimizationService = require('../services/performanceOptimizationService');
const CachingService = require('../services/cachingService');
const ApiBatchingService = require('../services/apiBatchingService');

describe('Performance Optimization', () => {
  let performanceOptimizer;
  let cachingService;
  let batchingService;

  beforeEach(() => {
    performanceOptimizer = new PerformanceOptimizationService();
    cachingService = new CachingService();
    batchingService = new ApiBatchingService();
  });

  afterAll(async () => {
    // Final cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    // Add small delay to allow async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (performanceOptimizer) {
      performanceOptimizer.destroy();
      performanceOptimizer = null;
    }
    if (cachingService) {
      cachingService.destroy();
      cachingService = null;
    }
    if (batchingService) {
      batchingService.destroy();
      batchingService = null;
    }
  });

  describe('PerformanceOptimizationService', () => {
    test('should compress audio buffer', async () => {
      const testBuffer = Buffer.alloc(1000, 'test data');
      
      const result = await performanceOptimizer.compressAudio(testBuffer, {
        quality: 0.5
      });

      expect(result).toHaveProperty('compressedBuffer');
      expect(result).toHaveProperty('originalSize', 1000);
      expect(result).toHaveProperty('compressedSize');
      expect(result).toHaveProperty('compressionRatio');
      expect(result.compressedSize).toBeLessThanOrEqual(result.originalSize);
    });

    test('should handle progressive loading', async () => {
      // Create content that's definitely long enough to be split
      const testContent = 'This is a test content for progressive loading that should be split into chunks. '.repeat(100);
      const chunks = [];

      await performanceOptimizer.progressiveLoad(testContent, (chunk, isLast, progress) => {
        chunks.push({ chunk, isLast, progress });
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[chunks.length - 1].isLast).toBe(true);
      expect(chunks[chunks.length - 1].progress.progress).toBe(1);
    });

    test('should cache and retrieve responses', () => {
      const query = 'test query';
      const response = 'test response';
      const metadata = { test: true };

      performanceOptimizer.cacheResponse(query, response, metadata);
      const cached = performanceOptimizer.getCachedResponse(query, metadata);

      expect(cached).toHaveProperty('response', response);
      expect(cached).toHaveProperty('cached', true);
    });

    test('should return metrics', () => {
      const metrics = performanceOptimizer.getMetrics();

      expect(metrics).toHaveProperty('audioCompressionRatio');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('batchEfficiency');
    });
  });

  describe('CachingService', () => {
    test('should cache and retrieve AI responses', () => {
      const query = 'How are you feeling?';
      const response = 'I am here to help you.';
      const language = 'en';

      const cached = cachingService.cacheResponse(query, response, {}, language);
      expect(cached).toBe(true);

      const retrieved = cachingService.getCachedResponse(query, {}, language);
      expect(retrieved).toHaveProperty('response', response);
      expect(retrieved).toHaveProperty('cached', true);
    });

    test('should cache and retrieve audio', () => {
      const text = 'Hello world';
      const audioBuffer = Buffer.alloc(100, 'audio data');
      const voiceParams = { speed: 1.0, pitch: 1.0 };
      const language = 'en';

      const cached = cachingService.cacheAudio(text, audioBuffer, voiceParams, language);
      expect(cached).toBe(true);

      const retrieved = cachingService.getCachedAudio(text, voiceParams, language);
      expect(retrieved).toHaveProperty('audioBuffer');
      expect(retrieved).toHaveProperty('cached', true);
      expect(retrieved.audioBuffer).toEqual(audioBuffer);
    });

    test('should cache and retrieve translations', () => {
      const text = 'Hello';
      const fromLang = 'en';
      const toLang = 'es';
      const translation = 'Hola';

      const cached = cachingService.cacheTranslation(text, fromLang, toLang, translation);
      expect(cached).toBe(true);

      const retrieved = cachingService.getCachedTranslation(text, fromLang, toLang);
      expect(retrieved).toHaveProperty('translation', translation);
      expect(retrieved).toHaveProperty('cached', true);
    });

    test('should return cache statistics', () => {
      const stats = cachingService.getStats();

      expect(stats).toHaveProperty('response');
      expect(stats).toHaveProperty('audio');
      expect(stats).toHaveProperty('translation');
      expect(stats.response).toHaveProperty('hitRate');
      expect(stats.response).toHaveProperty('cacheSize');
    });

    test('should clear specific cache types', () => {
      cachingService.cacheResponse('test', 'response', {}, 'en');
      cachingService.cacheAudio('test', Buffer.alloc(10), {}, 'en');

      cachingService.clearCache('response');
      
      const responseStats = cachingService.getStats().response;
      const audioStats = cachingService.getStats().audio;
      
      expect(responseStats.cacheSize).toBe(0);
      expect(audioStats.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('ApiBatchingService', () => {
    test('should add requests to batch queue', (done) => {
      const request1 = { text: 'Hello' };
      const request2 = { text: 'World' };

      let resolvedCount = 0;
      const checkComplete = () => {
        resolvedCount++;
        if (resolvedCount === 2) {
          done();
        }
      };

      batchingService.addToBatch('tts', request1, 
        (result) => {
          expect(result).toHaveProperty('batched');
          checkComplete();
        },
        (error) => done(error)
      );

      batchingService.addToBatch('tts', request2,
        (result) => {
          expect(result).toHaveProperty('batched');
          checkComplete();
        },
        (error) => done(error)
      );
    });

    test('should return batching statistics', () => {
      const stats = batchingService.getStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('batchedRequests');
      expect(stats).toHaveProperty('batchesSent');
      expect(stats).toHaveProperty('averageBatchSize');
      expect(stats).toHaveProperty('batchingEfficiency');
    });

    test('should update configuration', () => {
      const newConfig = {
        maxBatchSize: 10,
        batchTimeout: 200,
        enabled: false
      };

      batchingService.updateConfig(newConfig);
      const stats = batchingService.getStats();

      expect(stats.config.maxBatchSize).toBe(10);
      expect(stats.config.batchTimeout).toBe(200);
      expect(stats.config.enabled).toBe(false);
    });
  });

  describe('Performance API Endpoints', () => {
    test('GET /api/performance/metrics should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/performance/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('timestamp');
      expect(response.body.metrics).toHaveProperty('system');
    });

    test('GET /api/performance/health should return health status', async () => {
      const response = await request(app)
        .get('/api/performance/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('health');
    });

    test('POST /api/performance/cache/clear should clear caches', async () => {
      const response = await request(app)
        .post('/api/performance/cache/clear')
        .send({ cacheType: 'all' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    test('GET /api/performance/cache/stats should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/performance/cache/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
    });

    test('POST /api/performance/settings should update settings', async () => {
      const settings = {
        audioCompression: { quality: 0.9 },
        caching: { response: { maxSize: 150 } }
      };

      const response = await request(app)
        .post('/api/performance/settings')
        .send(settings)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Integration Tests', () => {
    test('should optimize full AI conversation workflow', async () => {
      // Simulate a full conversation with caching
      const query1 = 'I am feeling anxious';
      const response1 = 'I understand you are feeling anxious. Would you like to try some breathing exercises?';
      
      // Cache the response
      cachingService.cacheResponse(query1, response1, {}, 'en');
      
      // Retrieve from cache
      const cached = cachingService.getCachedResponse(query1, {}, 'en');
      expect(cached).toHaveProperty('response', response1);
      expect(cached).toHaveProperty('cached', true);

      // Test audio caching
      const audioBuffer = Buffer.alloc(1000, 'audio');
      cachingService.cacheAudio(response1, audioBuffer, { speed: 1.0 }, 'en');
      
      const cachedAudio = cachingService.getCachedAudio(response1, { speed: 1.0 }, 'en');
      expect(cachedAudio).toHaveProperty('audioBuffer');
      expect(cachedAudio).toHaveProperty('cached', true);
    });

    test('should handle performance optimization pipeline', async () => {
      // Create content that's long enough to be split into multiple chunks
      const testContent = 'This is a long response that should be processed through the optimization pipeline. '.repeat(50);
      
      // Test progressive loading
      const chunks = [];
      await performanceOptimizer.progressiveLoad(testContent, (chunk, isLast, progress) => {
        chunks.push({ chunk, isLast, progress });
      });
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Test audio compression
      const audioBuffer = Buffer.alloc(2000, 'test audio data');
      const compressionResult = await performanceOptimizer.compressAudio(audioBuffer);
      
      expect(compressionResult).toHaveProperty('compressedBuffer');
      expect(compressionResult).toHaveProperty('compressionRatio');
      
      // Test caching
      performanceOptimizer.cacheResponse(testContent, 'cached response');
      const cached = performanceOptimizer.getCachedResponse(testContent);
      
      expect(cached).toHaveProperty('cached', true);
    });
  });
});