const express = require('express');
const AuthMiddleware = require('../middleware/authMiddleware');
const AnalyticsService = require('../services/analyticsService');

const router = express.Router();
const authMiddleware = new AuthMiddleware();
const analyticsService = new AnalyticsService();

// Middleware to ensure only admin and counselor access
const requireAdminOrCounselor = [
  authMiddleware.authenticate,
  authMiddleware.adminOrCounselor
];

// Get usage statistics (overview data)
router.get('/usage', requireAdminOrCounselor, (req, res) => {
  try {
    const stats = analyticsService.getUsageStatistics();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve usage statistics',
      message: error.message
    });
  }
});

// Get analytics by date range
router.get('/range', requireAdminOrCounselor, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      });
    }

    const analytics = analyticsService.getAnalyticsByDateRange(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: analytics,
      count: analytics.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve analytics data',
      message: error.message
    });
  }
});

// Get daily analytics
router.get('/daily/:date?', requireAdminOrCounselor, (req, res) => {
  try {
    const { date } = req.params;
    const analytics = analyticsService.getDailyAnalytics(date);
    
    if (!analytics) {
      return res.status(404).json({
        error: 'No data found',
        message: `No analytics data found for date: ${date || 'today'}`
      });
    }

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve daily analytics',
      message: error.message
    });
  }
});

// Get weekly analytics
router.get('/weekly', requireAdminOrCounselor, (req, res) => {
  try {
    const analytics = analyticsService.getWeeklyAnalytics();
    
    res.status(200).json({
      success: true,
      data: analytics,
      count: analytics.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve weekly analytics',
      message: error.message
    });
  }
});

// Get monthly analytics
router.get('/monthly', requireAdminOrCounselor, (req, res) => {
  try {
    const analytics = analyticsService.getMonthlyAnalytics();
    
    res.status(200).json({
      success: true,
      data: analytics,
      count: analytics.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve monthly analytics',
      message: error.message
    });
  }
});

// Get topic trends
router.get('/topics', requireAdminOrCounselor, (req, res) => {
  try {
    const { days = 7 } = req.query;
    const topics = analyticsService.getTopicTrends(parseInt(days));
    
    res.status(200).json({
      success: true,
      data: topics,
      count: topics.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve topic trends',
      message: error.message
    });
  }
});

// Get sentiment trends
router.get('/sentiment', requireAdminOrCounselor, (req, res) => {
  try {
    const { days = 7 } = req.query;
    const sentiment = analyticsService.getSentimentTrends(parseInt(days));
    
    res.status(200).json({
      success: true,
      data: sentiment,
      count: sentiment.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve sentiment trends',
      message: error.message
    });
  }
});

// Get crisis statistics
router.get('/crisis', requireAdminOrCounselor, (req, res) => {
  try {
    const { days = 7 } = req.query;
    const crisisStats = analyticsService.getCrisisStatistics(parseInt(days));
    
    res.status(200).json({
      success: true,
      data: crisisStats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve crisis statistics',
      message: error.message
    });
  }
});

// Record user interaction (for internal use by other services)
router.post('/interaction', authMiddleware.authenticate, (req, res) => {
  try {
    const { userId, interactionData } = req.body;
    
    if (!userId || !interactionData) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'userId and interactionData are required'
      });
    }

    const interactionId = analyticsService.recordUserInteraction(userId, interactionData);
    
    res.status(201).json({
      success: true,
      interactionId,
      message: 'Interaction recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to record interaction',
      message: error.message
    });
  }
});

// Export analytics data
router.get('/export', requireAdminOrCounselor, (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    let dateRange = null;
    if (startDate && endDate) {
      dateRange = { start: startDate, end: endDate };
    }

    const exportData = analyticsService.exportAnalyticsData(format, dateRange);
    
    // Set appropriate headers based on format
    if (format.toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.json"');
    }
    
    res.status(200).send(exportData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export analytics data',
      message: error.message
    });
  }
});

// Get system health metrics (admin only)
router.get('/health', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const health = analyticsService.getSystemHealth();
    
    res.status(200).json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system health',
      message: error.message
    });
  }
});

// Cleanup old data (admin only)
router.post('/cleanup', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const { retentionDays = 90 } = req.body;
    
    analyticsService.cleanupOldData(parseInt(retentionDays));
    
    res.status(200).json({
      success: true,
      message: `Old data cleaned up successfully. Retention: ${retentionDays} days`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cleanup old data',
      message: error.message
    });
  }
});

// Get peak hours analysis
router.get('/peak-hours', requireAdminOrCounselor, (req, res) => {
  try {
    const peakHours = analyticsService.getPeakHours();
    
    res.status(200).json({
      success: true,
      data: peakHours
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve peak hours data',
      message: error.message
    });
  }
});

// Get active sessions count
router.get('/active-sessions', requireAdminOrCounselor, (req, res) => {
  try {
    const activeCount = analyticsService.getActiveSessionsCount();
    
    res.status(200).json({
      success: true,
      data: {
        activeSessionsCount: activeCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve active sessions count',
      message: error.message
    });
  }
});

// Generate analytics report
router.post('/report', requireAdminOrCounselor, (req, res) => {
  try {
    const { reportType, dateRange, includeDetails = false } = req.body;
    
    let reportData = {};
    
    switch (reportType) {
      case 'usage':
        reportData = {
          type: 'Usage Report',
          period: dateRange,
          summary: analyticsService.getUsageStatistics(),
          trends: dateRange ? 
            analyticsService.getAnalyticsByDateRange(dateRange.start, dateRange.end) :
            analyticsService.getWeeklyAnalytics()
        };
        break;
        
      case 'mental-health':
        reportData = {
          type: 'Mental Health Trends Report',
          period: dateRange,
          sentimentTrends: analyticsService.getSentimentTrends(dateRange ? 
            Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24)) : 7),
          topicTrends: analyticsService.getTopicTrends(dateRange ? 
            Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24)) : 7),
          crisisStats: analyticsService.getCrisisStatistics(dateRange ? 
            Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24)) : 7)
        };
        break;
        
      case 'crisis':
        reportData = {
          type: 'Crisis Interventions Report',
          period: dateRange,
          crisisStatistics: analyticsService.getCrisisStatistics(dateRange ? 
            Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24)) : 7),
          peakHours: analyticsService.getPeakHours()
        };
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid report type',
          message: 'Supported types: usage, mental-health, crisis'
        });
    }
    
    reportData.generatedAt = new Date().toISOString();
    reportData.generatedBy = req.user.username;
    
    res.status(200).json({
      success: true,
      report: reportData
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate report',
      message: error.message
    });
  }
});

module.exports = router;