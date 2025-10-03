const AnalyticsService = require('../services/analyticsService');

describe('AnalyticsService', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    // Clean up any test data
    analyticsService.analytics.clear();
    analyticsService.conversations.clear();
    analyticsService.sessions.clear();
    analyticsService.crisisEvents.clear();
  });

  describe('Initialization', () => {
    test('should initialize with sample data', () => {
      expect(analyticsService.analytics.size).toBeGreaterThan(0);
      // Conversations are created when interactions are recorded, not during initialization
      expect(analyticsService.analytics.size).toBeGreaterThanOrEqual(30); // Should have ~30 days of data
    });

    test('should generate valid sample data structure', () => {
      const today = new Date().toISOString().split('T')[0];
      const todayData = analyticsService.analytics.get(today);
      
      expect(todayData).toBeDefined();
      expect(todayData).toHaveProperty('totalUsers');
      expect(todayData).toHaveProperty('totalConversations');
      expect(todayData).toHaveProperty('avgSentimentScore');
      expect(todayData).toHaveProperty('topTopics');
    });
  });

  describe('Recording Interactions', () => {
    test('should record user interaction successfully', () => {
      const userId = 'test-user-123';
      const interactionData = {
        type: 'text',
        messageLength: 50,
        responseTime: 1200,
        sentiment: 0.5,
        topics: ['anxiety', 'stress'],
        crisisDetected: false,
        language: 'en'
      };

      const interactionId = analyticsService.recordUserInteraction(userId, interactionData);
      
      expect(interactionId).toBeDefined();
      expect(typeof interactionId).toBe('string');
    });

    test('should anonymize user ID', () => {
      const userId = 'sensitive-user-id-123';
      const interactionData = {
        type: 'voice',
        messageLength: 30,
        responseTime: 800
      };

      analyticsService.recordUserInteraction(userId, interactionData);
      
      // Check that the stored user ID is anonymized
      const today = new Date().toISOString().split('T')[0];
      const conversations = analyticsService.conversations.get(today);
      
      expect(conversations).toBeDefined();
      expect(conversations.length).toBeGreaterThan(0);
      
      const interaction = conversations[conversations.length - 1];
      expect(interaction.userId).not.toBe(userId);
      expect(interaction.userId).toMatch(/^user_/);
    });

    test('should record crisis events when detected', () => {
      const userId = 'test-user-crisis';
      const interactionData = {
        type: 'text',
        messageLength: 100,
        sentiment: -0.8,
        topics: ['suicide', 'harm'],
        crisisDetected: true
      };

      analyticsService.recordUserInteraction(userId, interactionData);
      
      const today = new Date().toISOString().split('T')[0];
      const crisisEvents = analyticsService.crisisEvents.get(today);
      
      expect(crisisEvents).toBeDefined();
      expect(crisisEvents.length).toBeGreaterThan(0);
      
      const crisisEvent = crisisEvents[crisisEvents.length - 1];
      expect(crisisEvent.severity).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(crisisEvent.severity);
    });

    test('should update session data correctly', () => {
      const userId = 'test-user-session';
      const sessionId = 'test-session-123';
      
      const interactionData1 = {
        sessionId,
        type: 'text',
        messageLength: 50,
        sentiment: 0.3,
        topics: ['anxiety']
      };
      
      const interactionData2 = {
        sessionId,
        type: 'voice',
        messageLength: 75,
        sentiment: 0.1,
        topics: ['stress']
      };

      analyticsService.recordUserInteraction(userId, interactionData1);
      analyticsService.recordUserInteraction(userId, interactionData2);
      
      const session = analyticsService.sessions.get(sessionId);
      
      expect(session).toBeDefined();
      expect(session.totalMessages).toBe(2);
      expect(session.topics.size).toBe(2);
      expect(session.topics.has('anxiety')).toBe(true);
      expect(session.topics.has('stress')).toBe(true);
    });
  });

  describe('Analytics Retrieval', () => {
    test('should get usage statistics', () => {
      const stats = analyticsService.getUsageStatistics();
      
      expect(stats).toHaveProperty('today');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('peakHours');
      expect(stats).toHaveProperty('topTopics');
      
      expect(stats.today).toHaveProperty('totalUsers');
      expect(stats.today).toHaveProperty('totalConversations');
      expect(stats.today).toHaveProperty('avgSentiment');
    });

    test('should get analytics by date range', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      
      const analytics = analyticsService.getAnalyticsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      expect(Array.isArray(analytics)).toBe(true);
      expect(analytics.length).toBeGreaterThan(0);
      expect(analytics.length).toBeLessThanOrEqual(8); // 7 days + today
      
      // Check that results are sorted by date
      for (let i = 1; i < analytics.length; i++) {
        expect(new Date(analytics[i].date)).toBeInstanceOf(Date);
        expect(new Date(analytics[i].date) >= new Date(analytics[i-1].date)).toBe(true);
      }
    });

    test('should get weekly analytics', () => {
      const weeklyData = analyticsService.getWeeklyAnalytics();
      
      expect(Array.isArray(weeklyData)).toBe(true);
      expect(weeklyData.length).toBeGreaterThan(0);
      expect(weeklyData.length).toBeLessThanOrEqual(8); // Up to 8 days
    });

    test('should get monthly analytics', () => {
      const monthlyData = analyticsService.getMonthlyAnalytics();
      
      expect(Array.isArray(monthlyData)).toBe(true);
      expect(monthlyData.length).toBeGreaterThan(0);
      expect(monthlyData.length).toBeLessThanOrEqual(31); // Up to 31 days
    });

    test('should get topic trends', () => {
      const topics = analyticsService.getTopicTrends(7);
      
      expect(Array.isArray(topics)).toBe(true);
      
      if (topics.length > 0) {
        expect(topics[0]).toHaveProperty('topic');
        expect(topics[0]).toHaveProperty('totalCount');
        expect(topics[0]).toHaveProperty('avgSentiment');
        
        // Check that results are sorted by count (descending)
        for (let i = 1; i < topics.length; i++) {
          expect(topics[i].totalCount <= topics[i-1].totalCount).toBe(true);
        }
      }
    });

    test('should get sentiment trends', () => {
      const sentiment = analyticsService.getSentimentTrends(7);
      
      expect(Array.isArray(sentiment)).toBe(true);
      
      if (sentiment.length > 0) {
        expect(sentiment[0]).toHaveProperty('date');
        expect(sentiment[0]).toHaveProperty('sentiment');
        expect(sentiment[0]).toHaveProperty('totalInteractions');
        
        expect(typeof sentiment[0].sentiment).toBe('number');
        expect(sentiment[0].sentiment >= -1 && sentiment[0].sentiment <= 1).toBe(true);
      }
    });

    test('should get crisis statistics', () => {
      const crisisStats = analyticsService.getCrisisStatistics(7);
      
      expect(crisisStats).toHaveProperty('total');
      expect(crisisStats).toHaveProperty('resolved');
      expect(crisisStats).toHaveProperty('escalated');
      expect(crisisStats).toHaveProperty('pending');
      expect(crisisStats).toHaveProperty('bySeverity');
      
      expect(crisisStats.bySeverity).toHaveProperty('critical');
      expect(crisisStats.bySeverity).toHaveProperty('high');
      expect(crisisStats.bySeverity).toHaveProperty('medium');
      expect(crisisStats.bySeverity).toHaveProperty('low');
      
      expect(typeof crisisStats.total).toBe('number');
      expect(crisisStats.total >= 0).toBe(true);
    });
  });

  describe('Data Export', () => {
    test('should export data as JSON', () => {
      const jsonData = analyticsService.exportAnalyticsData('json');
      
      expect(typeof jsonData).toBe('string');
      
      const parsed = JSON.parse(jsonData);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test('should export data as CSV', () => {
      const csvData = analyticsService.exportAnalyticsData('csv');
      
      expect(typeof csvData).toBe('string');
      expect(csvData.includes(',')).toBe(true); // Should contain CSV separators
      
      const lines = csvData.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Should have header + data
    });

    test('should export data with date range', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 3);
      
      const dateRange = {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      };
      
      const jsonData = analyticsService.exportAnalyticsData('json', dateRange);
      const parsed = JSON.parse(jsonData);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeLessThanOrEqual(4); // Max 4 days
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        analyticsService.exportAnalyticsData('xml');
      }).toThrow('Unsupported export format');
    });
  });

  describe('Utility Functions', () => {
    test('should anonymize user ID consistently', () => {
      const userId = 'test-user-123';
      const anonymized1 = analyticsService.anonymizeUserId(userId);
      const anonymized2 = analyticsService.anonymizeUserId(userId);
      
      expect(anonymized1).toBe(anonymized2);
      expect(anonymized1).not.toBe(userId);
      expect(anonymized1).toMatch(/^user_/);
    });

    test('should generate unique IDs', () => {
      const id1 = analyticsService.generateId();
      const id2 = analyticsService.generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('should generate unique session IDs', () => {
      const sessionId1 = analyticsService.generateSessionId();
      const sessionId2 = analyticsService.generateSessionId();
      
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^session_/);
      expect(sessionId2).toMatch(/^session_/);
    });

    test('should calculate crisis severity correctly', () => {
      const criticalInteraction = {
        sentiment: -0.8,
        topics: ['suicide', 'harm']
      };
      
      const lowInteraction = {
        sentiment: 0.2,
        topics: ['general']
      };
      
      const criticalSeverity = analyticsService.calculateCrisisSeverity(criticalInteraction);
      const lowSeverity = analyticsService.calculateCrisisSeverity(lowInteraction);
      
      expect(['critical', 'high']).toContain(criticalSeverity);
      expect(['low', 'medium']).toContain(lowSeverity);
    });
  });

  describe('Data Cleanup', () => {
    test('should cleanup old data', () => {
      // Add some old data
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const oldDateKey = oldDate.toISOString().split('T')[0];
      
      analyticsService.analytics.set(oldDateKey, { date: oldDateKey, totalUsers: 10 });
      analyticsService.conversations.set(oldDateKey, []);
      
      const initialAnalyticsSize = analyticsService.analytics.size;
      const initialConversationsSize = analyticsService.conversations.size;
      
      // Cleanup with 90 day retention
      analyticsService.cleanupOldData(90);
      
      expect(analyticsService.analytics.size).toBeLessThan(initialAnalyticsSize);
      expect(analyticsService.conversations.size).toBeLessThan(initialConversationsSize);
      expect(analyticsService.analytics.has(oldDateKey)).toBe(false);
    });

    test('should cleanup old sessions', () => {
      // Add an old session
      const oldSession = {
        id: 'old-session',
        userId: 'test-user',
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000),
        interactions: [],
        totalMessages: 0
      };
      
      analyticsService.sessions.set('old-session', oldSession);
      
      const initialSessionsSize = analyticsService.sessions.size;
      
      analyticsService.cleanupOldData(90);
      
      expect(analyticsService.sessions.size).toBeLessThan(initialSessionsSize);
      expect(analyticsService.sessions.has('old-session')).toBe(false);
    });
  });

  describe('System Health', () => {
    test('should return system health metrics', () => {
      const health = analyticsService.getSystemHealth();
      
      expect(health).toHaveProperty('totalAnalyticsRecords');
      expect(health).toHaveProperty('totalConversationDays');
      expect(health).toHaveProperty('totalActiveSessions');
      expect(health).toHaveProperty('totalCrisisEventDays');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('uptime');
      
      expect(typeof health.totalAnalyticsRecords).toBe('number');
      expect(typeof health.uptime).toBe('number');
      expect(health.memoryUsage).toHaveProperty('rss');
      expect(health.memoryUsage).toHaveProperty('heapUsed');
    });
  });
});