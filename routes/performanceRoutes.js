const express = require('express');
const router = express.Router();

// Import services (these would be initialized in the main app)
let performanceOptimizer = null;
let cachingService = null;
let batchingService = null;

// Initialize services (this would be called from the main app)
function initializeServices(services) {
  performanceOptimizer = services.performanceOptimizer;
  cachingService = services.cachingService;
  batchingService = services.batchingService;
}

/**
 * Get performance metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      performance: performanceOptimizer ? performanceOptimizer.getMetrics() : null,
      caching: cachingService ? cachingService.getStats() : null,
      batching: batchingService ? batchingService.getStats() : null,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
});

/**
 * Update performance settings
 */
router.post('/settings', (req, res) => {
  try {
    const { audioCompression, caching, batching, progressiveLoading } = req.body;

    if (performanceOptimizer && (audioCompression || progressiveLoading)) {
      performanceOptimizer.updateSettings({
        audioCompression,
        progressiveLoading
      });
    }

    if (cachingService && caching) {
      cachingService.updateConfig(caching);
    }

    if (batchingService && batching) {
      batchingService.updateConfig(batching);
    }

    res.json({
      success: true,
      message: 'Performance settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating performance settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update performance settings'
    });
  }
});

/**
 * Clear caches
 */
router.post('/cache/clear', (req, res) => {
  try {
    const { cacheType = 'all' } = req.body;

    if (cachingService) {
      cachingService.clearCache(cacheType);
    }

    if (performanceOptimizer) {
      performanceOptimizer.reset();
    }

    res.json({
      success: true,
      message: `Cache cleared: ${cacheType}`
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cachingService ? cachingService.getStats() : null;

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics'
    });
  }
});

/**
 * Get batching statistics
 */
router.get('/batching/stats', (req, res) => {
  try {
    const stats = batchingService ? batchingService.getStats() : null;

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting batching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batching statistics'
    });
  }
});

/**
 * Test performance optimization
 */
router.post('/test', async (req, res) => {
  try {
    const { testType, testData } = req.body;
    let result = null;

    switch (testType) {
      case 'audio_compression':
        if (performanceOptimizer && testData.audioBuffer) {
          result = await performanceOptimizer.compressAudio(
            Buffer.from(testData.audioBuffer, 'base64'),
            testData.options
          );
        }
        break;

      case 'progressive_loading':
        if (performanceOptimizer && testData.content) {
          result = await performanceOptimizer.progressiveLoad(
            testData.content,
            (chunk, isLast, progress) => {
              // Simulate progressive loading
              return { chunk, isLast, progress };
            }
          );
        }
        break;

      case 'caching':
        if (cachingService && testData.query && testData.response) {
          cachingService.cacheResponse(
            testData.query,
            testData.response,
            testData.metadata,
            testData.language
          );
          result = cachingService.getCachedResponse(
            testData.query,
            testData.metadata,
            testData.language
          );
        }
        break;

      default:
        throw new Error(`Unknown test type: ${testType}`);
    }

    res.json({
      success: true,
      testType,
      result
    });
  } catch (error) {
    console.error('Error running performance test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check for performance services
 */
router.get('/health', (req, res) => {
  try {
    const health = {
      performanceOptimizer: !!performanceOptimizer,
      cachingService: !!cachingService,
      batchingService: !!batchingService,
      timestamp: new Date().toISOString()
    };

    const allHealthy = Object.values(health).every(status => 
      typeof status === 'boolean' ? status : true
    );

    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      health
    });
  } catch (error) {
    console.error('Error checking performance health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check performance health'
    });
  }
});

module.exports = { router, initializeServices };