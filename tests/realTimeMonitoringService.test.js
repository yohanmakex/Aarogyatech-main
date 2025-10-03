const RealTimeMonitoringService = require('../services/realTimeMonitoringService');
const AnalyticsService = require('../services/analyticsService');
const http = require('http');

// Mock Socket.IO
jest.mock('socket.io', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      close: jest.fn()
    }))
  };
});

describe('RealTimeMonitoringService', () => {
  let server;
  let analyticsService;
  let monitoringService;

  beforeEach(() => {
    server = http.createServer();
    analyticsService = new AnalyticsService();
    monitoringService = new RealTimeMonitoringService(server, analyticsService);
  });

  afterEach(() => {
    if (monitoringService) {
      monitoringService.destroy();
    }
    if (server) {
      server.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize with server and analytics service', () => {
      expect(monitoringService.analyticsService).toBe(analyticsService);
      expect(monitoringService.connectedClients).toBeInstanceOf(Map);
      expect(monitoringService.activeAlerts).toBeInstanceOf(Map);
      expect(monitoringService.io).toBeDefined();
    });

    test('should have system metrics initialized', () => {
      expect(monitoringService.systemMetrics).toHaveProperty('apiResponseTimes');
      expect(monitoringService.systemMetrics).toHaveProperty('errorRates');
      expect(monitoringService.systemMetrics).toHaveProperty('activeConnections');
      expect(monitoringService.systemMetrics).toHaveProperty('lastUpdated');
    });
  });

  describe('Crisis Alert Management', () => {
    test('should create crisis alert', () => {
      const alertData = {
        userId: 'test-user',
        sessionId: 'test-session',
        severity: 'high',
        message: 'Test crisis alert',
        keywords: ['help', 'crisis'],
        sentiment: -0.8
      };

      const alertId = monitoringService.createCrisisAlert(alertData);
      
      expect(alertId).toBeDefined();
      expect(typeof alertId).toBe('string');
      expect(alertId).toMatch(/^alert_/);
      
      const alert = monitoringService.activeAlerts.get(alertId);
      expect(alert).toBeDefined();
      expect(alert.userId).toBe(alertData.userId);
      expect(alert.severity).toBe(alertData.severity);
      expect(alert.status).toBe('active');
    });

    test('should resolve crisis alert', () => {
      const alertData = {
        userId: 'test-user',
        sessionId: 'test-session',
        severity: 'medium'
      };

      const alertId = monitoringService.createCrisisAlert(alertData);
      const resolvedBy = 'admin-user';
      
      monitoringService.resolveAlert(alertId, resolvedBy);
      
      const alert = monitoringService.activeAlerts.get(alertId);
      expect(alert.status).toBe('resolved');
      expect(alert.resolvedBy).toBe(resolvedBy);
      expect(alert.resolvedAt).toBeInstanceOf(Date);
    });

    test('should generate unique alert IDs', () => {
      const alertData = {
        userId: 'test-user',
        sessionId: 'test-session'
      };

      const alertId1 = monitoringService.createCrisisAlert(alertData);
      const alertId2 = monitoringService.createCrisisAlert(alertData);
      
      expect(alertId1).not.toBe(alertId2);
    });
  });

  describe('System Monitoring', () => {
    test('should record API metrics', () => {
      const endpoint = '/api/test';
      const responseTime = 150;
      const statusCode = 200;

      monitoringService.recordApiMetric(endpoint, responseTime, statusCode);
      
      expect(monitoringService.systemMetrics.apiResponseTimes.length).toBe(1);
      
      const metric = monitoringService.systemMetrics.apiResponseTimes[0];
      expect(metric.endpoint).toBe(endpoint);
      expect(metric.responseTime).toBe(responseTime);
      expect(metric.statusCode).toBe(statusCode);
      expect(metric.timestamp).toBeInstanceOf(Date);
    });

    test('should update active connections count', () => {
      const count = 5;
      monitoringService.updateActiveConnections(count);
      
      expect(monitoringService.systemMetrics.activeConnections).toBe(count);
      expect(monitoringService.systemMetrics.lastUpdated).toBeInstanceOf(Date);
    });

    test('should limit API metrics to 100 entries', () => {
      // Add 150 metrics
      for (let i = 0; i < 150; i++) {
        monitoringService.recordApiMetric(`/api/test${i}`, 100 + i, 200);
      }
      
      expect(monitoringService.systemMetrics.apiResponseTimes.length).toBe(100);
    });

    test('should track error rates', () => {
      monitoringService.recordApiMetric('/api/success', 100, 200);
      monitoringService.recordApiMetric('/api/error', 200, 500);
      monitoringService.recordApiMetric('/api/success2', 150, 201);
      
      expect(monitoringService.systemMetrics.errorRates.success).toBe(2);
      expect(monitoringService.systemMetrics.errorRates.errors).toBe(1);
    });
  });

  describe('Monitoring Data', () => {
    test('should get monitoring data', () => {
      const monitoringData = monitoringService.getMonitoringData();
      
      expect(monitoringData).toHaveProperty('timestamp');
      expect(monitoringData).toHaveProperty('activeSessions');
      expect(monitoringData).toHaveProperty('activeAlerts');
      expect(monitoringData).toHaveProperty('systemMetrics');
      expect(monitoringData).toHaveProperty('usageStats');
      expect(monitoringData).toHaveProperty('crisisStats');
      expect(monitoringData).toHaveProperty('connectedAdmins');
      
      expect(Array.isArray(monitoringData.activeAlerts)).toBe(true);
      expect(typeof monitoringData.activeSessions).toBe('number');
      expect(typeof monitoringData.connectedAdmins).toBe('number');
    });

    test('should get system health', () => {
      // Add some metrics
      monitoringService.recordApiMetric('/api/test1', 100, 200);
      monitoringService.recordApiMetric('/api/test2', 200, 200);
      monitoringService.recordApiMetric('/api/test3', 300, 500);
      
      const health = monitoringService.getSystemHealth();
      
      expect(health).toHaveProperty('avgResponseTime');
      expect(health).toHaveProperty('errorPercentage');
      expect(health).toHaveProperty('activeConnections');
      expect(health).toHaveProperty('connectedAdmins');
      expect(health).toHaveProperty('activeAlerts');
      expect(health).toHaveProperty('lastUpdated');
      
      expect(typeof health.avgResponseTime).toBe('number');
      expect(typeof health.errorPercentage).toBe('number');
      expect(health.errorPercentage).toBeGreaterThanOrEqual(0);
      expect(health.errorPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Connected Clients', () => {
    test('should get connected clients', () => {
      // Simulate connected clients
      const mockClient = {
        userId: 'admin1',
        userRole: 'admin',
        connectedAt: new Date(),
        lastActivity: new Date()
      };
      
      monitoringService.connectedClients.set('socket1', mockClient);
      
      const clients = monitoringService.getConnectedClients();
      
      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBe(1);
      expect(clients[0]).toHaveProperty('userId');
      expect(clients[0]).toHaveProperty('userRole');
      expect(clients[0]).toHaveProperty('connectedAt');
      expect(clients[0]).toHaveProperty('lastActivity');
    });

    test('should get active alerts count', () => {
      expect(monitoringService.getActiveAlertsCount()).toBe(0);
      
      monitoringService.createCrisisAlert({
        userId: 'test-user',
        sessionId: 'test-session'
      });
      
      expect(monitoringService.getActiveAlertsCount()).toBe(1);
    });
  });

  describe('Utility Methods', () => {
    test('should generate alert ID', () => {
      const alertId = monitoringService.generateAlertId();
      
      expect(typeof alertId).toBe('string');
      expect(alertId).toMatch(/^alert_\d+_[a-z0-9]+$/);
    });

    test('should cleanup old metrics', () => {
      // Add old metrics
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      monitoringService.systemMetrics.apiResponseTimes.push({
        endpoint: '/api/old',
        responseTime: 100,
        statusCode: 200,
        timestamp: oldTimestamp
      });

      // Add recent metric
      monitoringService.recordApiMetric('/api/recent', 150, 200);
      
      expect(monitoringService.systemMetrics.apiResponseTimes.length).toBe(2);
      
      monitoringService.cleanupOldMetrics();
      
      // Should keep only recent metrics (within 1 hour)
      expect(monitoringService.systemMetrics.apiResponseTimes.length).toBe(1);
      expect(monitoringService.systemMetrics.apiResponseTimes[0].endpoint).toBe('/api/recent');
    });

    test('should check stale alerts', () => {
      // Create an old alert
      const alertData = {
        userId: 'test-user',
        sessionId: 'test-session'
      };
      
      const alertId = monitoringService.createCrisisAlert(alertData);
      const alert = monitoringService.activeAlerts.get(alertId);
      
      // Make it stale (older than 30 minutes)
      alert.createdAt = new Date(Date.now() - 35 * 60 * 1000);
      
      monitoringService.checkStaleAlerts();
      
      // Should be auto-escalated
      expect(alert.status).toBe('auto-escalated');
      expect(alert.escalatedBy).toBe('system');
      expect(alert.escalatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    test('should destroy service properly', () => {
      const mockClose = jest.fn();
      monitoringService.io.close = mockClose;
      
      monitoringService.destroy();
      
      expect(mockClose).toHaveBeenCalled();
    });
  });
});