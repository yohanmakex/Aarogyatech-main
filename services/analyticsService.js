class AnalyticsService {
  constructor() {
    this.analytics = new Map(); // In-memory storage for demo - replace with database in production
    this.sessions = new Map(); // Active user sessions
    this.conversations = new Map(); // Conversation data
    this.crisisEvents = new Map(); // Crisis detection events
    this.sentimentData = new Map(); // Sentiment analysis results
    
    this.initializeAnalytics();
  }

  initializeAnalytics() {
    // Generate some sample historical data for demonstration
    this.generateSampleData();
  }

  generateSampleData() {
    const now = new Date();
    
    // Generate data for the last 30 days
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      // Generate daily analytics
      const dailyData = {
        date: dateKey,
        totalUsers: Math.floor(Math.random() * 100) + 50,
        totalConversations: Math.floor(Math.random() * 200) + 100,
        totalMessages: Math.floor(Math.random() * 1000) + 500,
        voiceInteractions: Math.floor(Math.random() * 150) + 75,
        textInteractions: Math.floor(Math.random() * 150) + 75,
        crisisAlerts: Math.floor(Math.random() * 5),
        avgSessionDuration: Math.floor(Math.random() * 600) + 300, // seconds
        avgSentimentScore: (Math.random() * 2 - 1).toFixed(2), // -1 to 1
        peakHour: Math.floor(Math.random() * 24),
        topTopics: this.generateTopTopics(),
        userSatisfaction: (Math.random() * 2 + 3).toFixed(1) // 3-5 rating
      };
      
      this.analytics.set(dateKey, dailyData);
    }

    // Generate hourly data for today
    this.generateHourlyData();
  }

  generateTopTopics() {
    const topics = ['anxiety', 'depression', 'stress', 'relationships', 'academic', 'sleep', 'family', 'social'];
    const selectedTopics = topics.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    return selectedTopics.map(topic => ({
      topic,
      count: Math.floor(Math.random() * 50) + 10,
      sentiment: (Math.random() * 2 - 1).toFixed(2)
    }));
  }

  generateHourlyData() {
    const today = new Date().toISOString().split('T')[0];
    const hourlyData = [];
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.push({
        hour,
        activeUsers: Math.floor(Math.random() * 50) + 5,
        conversations: Math.floor(Math.random() * 30) + 10,
        avgSentiment: (Math.random() * 2 - 1).toFixed(2)
      });
    }
    
    const todayData = this.analytics.get(today) || {};
    todayData.hourlyData = hourlyData;
    this.analytics.set(today, todayData);
  }

  // Record user interaction
  recordUserInteraction(userId, interactionData) {
    try {
      const sessionId = interactionData.sessionId || this.generateSessionId();
      const timestamp = new Date();
      const dateKey = timestamp.toISOString().split('T')[0];
      
      // Record interaction
      const interaction = {
        id: this.generateId(),
        userId: this.anonymizeUserId(userId),
        sessionId,
        timestamp,
        type: interactionData.type, // 'voice', 'text', 'voice-to-text'
        messageLength: interactionData.messageLength || 0,
        responseTime: interactionData.responseTime || 0,
        sentiment: interactionData.sentiment || null,
        topics: interactionData.topics || [],
        crisisDetected: interactionData.crisisDetected || false,
        language: interactionData.language || 'en'
      };

      // Store interaction
      if (!this.conversations.has(dateKey)) {
        this.conversations.set(dateKey, []);
      }
      this.conversations.get(dateKey).push(interaction);

      // Update session data
      this.updateSessionData(sessionId, interaction);

      // Update daily analytics
      this.updateDailyAnalytics(dateKey, interaction);

      // Record crisis event if detected
      if (interaction.crisisDetected) {
        this.recordCrisisEvent(interaction);
      }

      return interaction.id;
    } catch (error) {
      console.error('Failed to record user interaction:', error);
      throw error;
    }
  }

  updateSessionData(sessionId, interaction) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        userId: interaction.userId,
        startTime: interaction.timestamp,
        lastActivity: interaction.timestamp,
        interactions: [],
        totalMessages: 0,
        avgSentiment: 0,
        topics: new Set(),
        crisisDetected: false
      });
    }

    const session = this.sessions.get(sessionId);
    session.lastActivity = interaction.timestamp;
    session.interactions.push(interaction.id);
    session.totalMessages++;
    session.crisisDetected = session.crisisDetected || interaction.crisisDetected;

    // Update topics
    interaction.topics.forEach(topic => session.topics.add(topic));

    // Update average sentiment
    if (interaction.sentiment !== null) {
      const sentiments = session.interactions
        .map(id => this.getInteractionById(id))
        .filter(i => i && i.sentiment !== null)
        .map(i => parseFloat(i.sentiment));
      
      if (sentiments.length > 0) {
        session.avgSentiment = (sentiments.reduce((a, b) => a + b, 0) / sentiments.length).toFixed(2);
      }
    }
  }

  updateDailyAnalytics(dateKey, interaction) {
    let dailyData = this.analytics.get(dateKey);
    if (!dailyData) {
      dailyData = {
        date: dateKey,
        totalUsers: 0,
        totalConversations: 0,
        totalMessages: 0,
        voiceInteractions: 0,
        textInteractions: 0,
        crisisAlerts: 0,
        avgSessionDuration: 0,
        avgSentimentScore: 0,
        peakHour: 0,
        topTopics: [],
        userSatisfaction: 0
      };
    }

    // Update counters
    dailyData.totalMessages++;
    
    if (interaction.type === 'voice' || interaction.type === 'voice-to-voice') {
      dailyData.voiceInteractions++;
    } else {
      dailyData.textInteractions++;
    }

    if (interaction.crisisDetected) {
      dailyData.crisisAlerts++;
    }

    // Update unique users count
    const uniqueUsers = new Set();
    const dayConversations = this.conversations.get(dateKey) || [];
    dayConversations.forEach(conv => uniqueUsers.add(conv.userId));
    dailyData.totalUsers = uniqueUsers.size;

    // Update conversations count (unique sessions)
    const uniqueSessions = new Set();
    dayConversations.forEach(conv => uniqueSessions.add(conv.sessionId));
    dailyData.totalConversations = uniqueSessions.size;

    // Update sentiment
    const sentiments = dayConversations
      .filter(conv => conv.sentiment !== null)
      .map(conv => parseFloat(conv.sentiment));
    
    if (sentiments.length > 0) {
      dailyData.avgSentimentScore = (sentiments.reduce((a, b) => a + b, 0) / sentiments.length).toFixed(2);
    }

    this.analytics.set(dateKey, dailyData);
  }

  recordCrisisEvent(interaction) {
    const crisisEvent = {
      id: this.generateId(),
      userId: interaction.userId,
      sessionId: interaction.sessionId,
      timestamp: interaction.timestamp,
      severity: this.calculateCrisisSeverity(interaction),
      resolved: false,
      escalated: false,
      responseTime: null,
      notes: ''
    };

    const dateKey = interaction.timestamp.toISOString().split('T')[0];
    if (!this.crisisEvents.has(dateKey)) {
      this.crisisEvents.set(dateKey, []);
    }
    this.crisisEvents.get(dateKey).push(crisisEvent);

    return crisisEvent.id;
  }

  calculateCrisisSeverity(interaction) {
    // Simple severity calculation based on sentiment and keywords
    const sentiment = parseFloat(interaction.sentiment) || 0;
    const hasUrgentKeywords = interaction.topics.some(topic => 
      ['suicide', 'harm', 'emergency', 'crisis'].includes(topic.toLowerCase())
    );

    if (hasUrgentKeywords && sentiment < -0.7) return 'critical';
    if (hasUrgentKeywords || sentiment < -0.5) return 'high';
    if (sentiment < -0.3) return 'medium';
    return 'low';
  }

  // Analytics retrieval methods
  getAnalyticsByDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results = [];

    for (const [dateKey, data] of this.analytics.entries()) {
      const date = new Date(dateKey);
      if (date >= start && date <= end) {
        results.push(data);
      }
    }

    return results.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  getDailyAnalytics(date) {
    const dateKey = date || new Date().toISOString().split('T')[0];
    return this.analytics.get(dateKey) || null;
  }

  getWeeklyAnalytics() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    return this.getAnalyticsByDateRange(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  }

  getMonthlyAnalytics() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    return this.getAnalyticsByDateRange(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
  }

  getTopicTrends(days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const analytics = this.getAnalyticsByDateRange(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
    const topicCounts = {};
    
    analytics.forEach(day => {
      day.topTopics.forEach(topicData => {
        if (!topicCounts[topicData.topic]) {
          topicCounts[topicData.topic] = {
            topic: topicData.topic,
            totalCount: 0,
            avgSentiment: 0,
            sentimentSum: 0,
            days: 0
          };
        }
        
        topicCounts[topicData.topic].totalCount += topicData.count;
        topicCounts[topicData.topic].sentimentSum += parseFloat(topicData.sentiment);
        topicCounts[topicData.topic].days++;
      });
    });

    // Calculate averages and sort by count
    return Object.values(topicCounts)
      .map(topic => ({
        topic: topic.topic,
        totalCount: topic.totalCount,
        avgSentiment: (topic.sentimentSum / topic.days).toFixed(2)
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  getSentimentTrends(days = 7) {
    const analytics = this.getAnalyticsByDateRange(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );

    return analytics.map(day => ({
      date: day.date,
      sentiment: parseFloat(day.avgSentimentScore),
      totalInteractions: day.totalMessages
    }));
  }

  getCrisisStatistics(days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const crisisEvents = [];
    for (const [dateKey, events] of this.crisisEvents.entries()) {
      const date = new Date(dateKey);
      if (date >= startDate && date <= endDate) {
        crisisEvents.push(...events);
      }
    }

    const stats = {
      total: crisisEvents.length,
      resolved: crisisEvents.filter(e => e.resolved).length,
      escalated: crisisEvents.filter(e => e.escalated).length,
      pending: crisisEvents.filter(e => !e.resolved && !e.escalated).length,
      bySeverity: {
        critical: crisisEvents.filter(e => e.severity === 'critical').length,
        high: crisisEvents.filter(e => e.severity === 'high').length,
        medium: crisisEvents.filter(e => e.severity === 'medium').length,
        low: crisisEvents.filter(e => e.severity === 'low').length
      }
    };

    return stats;
  }

  getUsageStatistics() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = this.analytics.get(today) || {};
    
    return {
      today: {
        totalUsers: todayData.totalUsers || 0,
        totalConversations: todayData.totalConversations || 0,
        totalMessages: todayData.totalMessages || 0,
        crisisAlerts: todayData.crisisAlerts || 0,
        avgSentiment: parseFloat(todayData.avgSentimentScore) || 0
      },
      activeSessions: this.getActiveSessionsCount(),
      peakHours: this.getPeakHours(),
      topTopics: todayData.topTopics || []
    };
  }

  getActiveSessionsCount() {
    const now = new Date();
    const activeThreshold = 30 * 60 * 1000; // 30 minutes
    
    let activeCount = 0;
    for (const session of this.sessions.values()) {
      if (now - session.lastActivity < activeThreshold) {
        activeCount++;
      }
    }
    
    return activeCount;
  }

  getPeakHours() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = this.analytics.get(today);
    
    if (todayData && todayData.hourlyData) {
      return todayData.hourlyData
        .sort((a, b) => b.activeUsers - a.activeUsers)
        .slice(0, 3)
        .map(hour => ({
          hour: hour.hour,
          users: hour.activeUsers,
          conversations: hour.conversations
        }));
    }
    
    return [];
  }

  // Export functions
  exportAnalyticsData(format = 'json', dateRange = null) {
    let data;
    
    if (dateRange) {
      data = this.getAnalyticsByDateRange(dateRange.start, dateRange.end);
    } else {
      data = Array.from(this.analytics.values());
    }

    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      default:
        throw new Error('Unsupported export format');
    }
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).filter(key => typeof data[0][key] !== 'object');
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  // Utility methods
  anonymizeUserId(userId) {
    // Simple anonymization - in production, use proper hashing
    return `user_${Buffer.from(userId).toString('base64').substring(0, 8)}`;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateSessionId() {
    return 'session_' + this.generateId();
  }

  getInteractionById(id) {
    for (const dayConversations of this.conversations.values()) {
      const interaction = dayConversations.find(conv => conv.id === id);
      if (interaction) return interaction;
    }
    return null;
  }

  // Cleanup old data
  cleanupOldData(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffKey = cutoffDate.toISOString().split('T')[0];

    // Clean analytics data
    for (const dateKey of this.analytics.keys()) {
      if (dateKey < cutoffKey) {
        this.analytics.delete(dateKey);
      }
    }

    // Clean conversation data
    for (const dateKey of this.conversations.keys()) {
      if (dateKey < cutoffKey) {
        this.conversations.delete(dateKey);
      }
    }

    // Clean crisis events
    for (const dateKey of this.crisisEvents.keys()) {
      if (dateKey < cutoffKey) {
        this.crisisEvents.delete(dateKey);
      }
    }

    // Clean old sessions
    const sessionCutoff = new Date();
    sessionCutoff.setHours(sessionCutoff.getHours() - 24); // Keep sessions for 24 hours
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < sessionCutoff) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get system health metrics
  getSystemHealth() {
    return {
      totalAnalyticsRecords: this.analytics.size,
      totalConversationDays: this.conversations.size,
      totalActiveSessions: this.sessions.size,
      totalCrisisEventDays: this.crisisEvents.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}

module.exports = AnalyticsService;