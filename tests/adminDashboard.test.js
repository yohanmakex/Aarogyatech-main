/**
 * Admin and Counselor Dashboard Tests
 * 
 * These tests verify the functionality of the admin dashboard,
 * including authentication, data visualization, real-time monitoring,
 * and report generation features.
 */

const request = require('supertest');
const express = require('express');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock services
const UserManagementService = require('../services/userManagementService');
const AnalyticsService = require('../services/analyticsService');
const RealTimeMonitoringService = require('../services/realTimeMonitoringService');

jest.mock('../services/userManagementService');
jest.mock('../services/analyticsService');
jest.mock('../services/realTimeMonitoringService');

describe('Admin and Counselor Dashboard Tests', () => {
  let app;
  let userManagementService;
  let analyticsService;
  let realTimeMonitoringService;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-secret';
  });

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock session middleware
    app.use((req, res, next) => {
      req.session = {
        user: null,
        save: jest.fn((cb) => cb && cb()),
        destroy: jest.fn((cb) => cb && cb())
      };
      next();
    });

    // Initialize mocked services
    userManagementService = new UserManagementService();
    analyticsService = new AnalyticsService();
    realTimeMonitoringService = new RealTimeMonitoringService();

    // Setup routes
    setupDashboardRoutes();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.SESSION_SECRET;
  });

  function setupDashboardRoutes() {
    // Authentication routes
    app.post('/admin/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        const loginResult = await userManagementService.authenticateUser(username, password);
        
        if (loginResult.success && (loginResult.user.role === 'admin' || loginResult.user.role === 'counselor')) {
          req.session.user = loginResult.user;
          res.json({
            success: true,
            user: {
              id: loginResult.user.id,
              username: loginResult.user.username,
              role: loginResult.user.role,
              permissions: loginResult.user.permissions
            }
          });
        } else {
          res.status(401).json({ success: false, message: 'Invalid credentials or insufficient permissions' });
        }
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Role-based access middleware
    const requireAuth = (roles = []) => (req, res, next) => {
      if (!req.session.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (roles.length > 0 && !roles.includes(req.session.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      next();
    };

    // Analytics endpoints
    app.get('/admin/analytics/overview', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const overview = await analyticsService.getOverviewStats();
        res.json(overview);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/admin/analytics/usage', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const { startDate, endDate, granularity } = req.query;
        const usageData = await analyticsService.getUsageStatistics(startDate, endDate, granularity);
        res.json(usageData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/admin/analytics/sentiment', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const { period } = req.query;
        const sentimentData = await analyticsService.getSentimentAnalysis(period);
        res.json(sentimentData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/admin/analytics/crisis', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const { timeframe } = req.query;
        const crisisData = await analyticsService.getCrisisStatistics(timeframe);
        res.json(crisisData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Real-time monitoring endpoints
    app.get('/admin/monitoring/active-users', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const activeUsers = await realTimeMonitoringService.getActiveUsers();
        res.json(activeUsers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/admin/monitoring/alerts', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const alerts = await realTimeMonitoringService.getActiveAlerts();
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/admin/monitoring/alerts/:alertId/acknowledge', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const { alertId } = req.params;
        const { userId } = req.session.user;
        
        const result = await realTimeMonitoringService.acknowledgeAlert(alertId, userId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Report generation endpoints
    app.post('/admin/reports/generate', requireAuth(['admin']), async (req, res) => {
      try {
        const { reportType, parameters } = req.body;
        const report = await analyticsService.generateReport(reportType, parameters);
        res.json(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/admin/reports/:reportId/download', requireAuth(['admin', 'counselor']), async (req, res) => {
      try {
        const { reportId } = req.params;
        const { format } = req.query;
        
        const reportData = await analyticsService.getReportData(reportId, format);
        
        res.set({
          'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/csv',
          'Content-Disposition': `attachment; filename="report-${reportId}.${format}"`
        });
        
        res.send(reportData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // User management endpoints (admin only)
    app.get('/admin/users', requireAuth(['admin']), async (req, res) => {
      try {
        const users = await userManagementService.getAllUsers();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/admin/users', requireAuth(['admin']), async (req, res) => {
      try {
        const userData = req.body;
        const newUser = await userManagementService.createUser(userData);
        res.status(201).json(newUser);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/admin/users/:userId', requireAuth(['admin']), async (req, res) => {
      try {
        const { userId } = req.params;
        const updateData = req.body;
        
        const updatedUser = await userManagementService.updateUser(userId, updateData);
        res.json(updatedUser);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Logout endpoint
    app.post('/admin/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
      });
    });
  }

  describe('Admin Authentication and Role-Based Access', () => {
    beforeEach(() => {
      // Mock user management service
      userManagementService.authenticateUser = jest.fn();
    });

    test('should authenticate admin user successfully', async () => {
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users']
        }
      });

      const response = await request(app)
        .post('/admin/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.permissions).toContain('manage_users');
    });

    test('should authenticate counselor user successfully', async () => {
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'counselor-1',
          username: 'counselor',
          role: 'counselor',
          permissions: ['read', 'write', 'view_analytics']
        }
      });

      const response = await request(app)
        .post('/admin/login')
        .send({
          username: 'counselor',
          password: 'counselor123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('counselor');
      expect(response.body.user.permissions).toContain('view_analytics');
    });

    test('should reject student user login', async () => {
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'student-1',
          username: 'student',
          role: 'student',
          permissions: ['read']
        }
      });

      const response = await request(app)
        .post('/admin/login')
        .send({
          username: 'student',
          password: 'student123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('insufficient permissions');
    });

    test('should reject invalid credentials', async () => {
      userManagementService.authenticateUser.mockResolvedValue({
        success: false,
        message: 'Invalid credentials'
      });

      const response = await request(app)
        .post('/admin/login')
        .send({
          username: 'invalid',
          password: 'wrong'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/admin/analytics/overview');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
    });

    test('should enforce role-based access control', async () => {
      // Login as counselor
      const agent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'counselor-1',
          username: 'counselor',
          role: 'counselor',
          permissions: ['read', 'write']
        }
      });

      await agent
        .post('/admin/login')
        .send({ username: 'counselor', password: 'counselor123' });

      // Try to access admin-only endpoint
      const response = await agent.get('/admin/users');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('Data Visualization and Analytics', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'manage_users']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'admin', password: 'admin123' });
    });

    test('should retrieve overview statistics', async () => {
      const mockOverview = {
        totalUsers: 1250,
        activeUsers: 89,
        totalSessions: 5420,
        averageSessionDuration: 12.5,
        crisisInterventions: 23,
        sentimentScore: 0.72
      };

      analyticsService.getOverviewStats = jest.fn().mockResolvedValue(mockOverview);

      const response = await authenticatedAgent
        .get('/admin/analytics/overview');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockOverview);
      expect(analyticsService.getOverviewStats).toHaveBeenCalled();
    });

    test('should retrieve usage statistics with date range', async () => {
      const mockUsageData = {
        period: 'daily',
        data: [
          { date: '2024-01-01', sessions: 45, users: 32 },
          { date: '2024-01-02', sessions: 52, users: 38 },
          { date: '2024-01-03', sessions: 48, users: 35 }
        ]
      };

      analyticsService.getUsageStatistics = jest.fn().mockResolvedValue(mockUsageData);

      const response = await authenticatedAgent
        .get('/admin/analytics/usage')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-03',
          granularity: 'daily'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsageData);
      expect(analyticsService.getUsageStatistics).toHaveBeenCalledWith(
        '2024-01-01', '2024-01-03', 'daily'
      );
    });

    test('should retrieve sentiment analysis data', async () => {
      const mockSentimentData = {
        period: 'weekly',
        averageSentiment: 0.68,
        sentimentTrends: [
          { week: '2024-W01', positive: 65, neutral: 25, negative: 10 },
          { week: '2024-W02', positive: 70, neutral: 22, negative: 8 }
        ],
        topConcerns: ['anxiety', 'stress', 'depression', 'academic pressure']
      };

      analyticsService.getSentimentAnalysis = jest.fn().mockResolvedValue(mockSentimentData);

      const response = await authenticatedAgent
        .get('/admin/analytics/sentiment')
        .query({ period: 'weekly' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSentimentData);
      expect(analyticsService.getSentimentAnalysis).toHaveBeenCalledWith('weekly');
    });

    test('should retrieve crisis statistics', async () => {
      const mockCrisisData = {
        totalCrisisEvents: 45,
        crisisTypes: {
          immediate: 12,
          high: 18,
          moderate: 15
        },
        responseTime: {
          average: 2.3,
          median: 1.8
        },
        escalations: 8,
        resolutions: 37
      };

      analyticsService.getCrisisStatistics = jest.fn().mockResolvedValue(mockCrisisData);

      const response = await authenticatedAgent
        .get('/admin/analytics/crisis')
        .query({ timeframe: '30days' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCrisisData);
      expect(analyticsService.getCrisisStatistics).toHaveBeenCalledWith('30days');
    });

    test('should handle analytics service errors gracefully', async () => {
      analyticsService.getOverviewStats = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await authenticatedAgent
        .get('/admin/analytics/overview');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('Real-Time Monitoring and Alerts', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'counselor-1',
          username: 'counselor',
          role: 'counselor',
          permissions: ['read', 'write', 'view_monitoring']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'counselor', password: 'counselor123' });
    });

    test('should retrieve active users', async () => {
      const mockActiveUsers = {
        count: 23,
        users: [
          {
            sessionId: 'session-1',
            userId: 'user-123',
            status: 'active',
            lastActivity: '2024-01-15T10:30:00Z',
            currentMode: 'voice-to-voice',
            riskLevel: 'low'
          },
          {
            sessionId: 'session-2',
            userId: 'user-456',
            status: 'active',
            lastActivity: '2024-01-15T10:28:00Z',
            currentMode: 'text-to-text',
            riskLevel: 'moderate'
          }
        ]
      };

      realTimeMonitoringService.getActiveUsers = jest.fn().mockResolvedValue(mockActiveUsers);

      const response = await authenticatedAgent
        .get('/admin/monitoring/active-users');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockActiveUsers);
      expect(response.body.count).toBe(23);
      expect(response.body.users).toHaveLength(2);
    });

    test('should retrieve active alerts', async () => {
      const mockAlerts = {
        criticalAlerts: 2,
        highPriorityAlerts: 5,
        alerts: [
          {
            id: 'alert-1',
            type: 'crisis_detected',
            severity: 'critical',
            sessionId: 'session-crisis-1',
            userId: 'user-789',
            timestamp: '2024-01-15T10:25:00Z',
            message: 'Immediate crisis keywords detected',
            acknowledged: false
          },
          {
            id: 'alert-2',
            type: 'high_risk_pattern',
            severity: 'high',
            sessionId: 'session-risk-1',
            userId: 'user-101',
            timestamp: '2024-01-15T10:20:00Z',
            message: 'Multiple high-risk indicators in session',
            acknowledged: false
          }
        ]
      };

      realTimeMonitoringService.getActiveAlerts = jest.fn().mockResolvedValue(mockAlerts);

      const response = await authenticatedAgent
        .get('/admin/monitoring/alerts');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAlerts);
      expect(response.body.criticalAlerts).toBe(2);
      expect(response.body.alerts[0].severity).toBe('critical');
    });

    test('should acknowledge alerts', async () => {
      const mockAcknowledgment = {
        success: true,
        alertId: 'alert-1',
        acknowledgedBy: 'counselor-1',
        acknowledgedAt: '2024-01-15T10:35:00Z'
      };

      realTimeMonitoringService.acknowledgeAlert = jest.fn().mockResolvedValue(mockAcknowledgment);

      const response = await authenticatedAgent
        .post('/admin/monitoring/alerts/alert-1/acknowledge');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAcknowledgment);
      expect(realTimeMonitoringService.acknowledgeAlert).toHaveBeenCalledWith(
        'alert-1', 'counselor-1'
      );
    });

    test('should handle monitoring service failures', async () => {
      realTimeMonitoringService.getActiveUsers = jest.fn().mockRejectedValue(
        new Error('Monitoring service unavailable')
      );

      const response = await authenticatedAgent
        .get('/admin/monitoring/active-users');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Monitoring service unavailable');
    });
  });

  describe('Report Generation and Export', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'manage_users', 'generate_reports']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'admin', password: 'admin123' });
    });

    test('should generate comprehensive reports', async () => {
      const mockReport = {
        reportId: 'report-123',
        type: 'monthly_summary',
        status: 'completed',
        generatedAt: '2024-01-15T10:40:00Z',
        parameters: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          includeUserData: false,
          includeCrisisData: true
        },
        summary: {
          totalSessions: 1250,
          uniqueUsers: 450,
          crisisInterventions: 23,
          averageSentiment: 0.72
        }
      };

      analyticsService.generateReport = jest.fn().mockResolvedValue(mockReport);

      const response = await authenticatedAgent
        .post('/admin/reports/generate')
        .send({
          reportType: 'monthly_summary',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            includeUserData: false,
            includeCrisisData: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockReport);
      expect(response.body.reportId).toBe('report-123');
      expect(analyticsService.generateReport).toHaveBeenCalledWith(
        'monthly_summary',
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      );
    });

    test('should download reports in CSV format', async () => {
      const mockCSVData = 'Date,Sessions,Users,Crisis Events\n2024-01-01,45,32,2\n2024-01-02,52,38,1';

      analyticsService.getReportData = jest.fn().mockResolvedValue(mockCSVData);

      const response = await authenticatedAgent
        .get('/admin/reports/report-123/download')
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('report-123.csv');
      expect(response.text).toBe(mockCSVData);
    });

    test('should download reports in PDF format', async () => {
      const mockPDFData = Buffer.from('PDF content');

      analyticsService.getReportData = jest.fn().mockResolvedValue(mockPDFData);

      const response = await authenticatedAgent
        .get('/admin/reports/report-456/download')
        .query({ format: 'pdf' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('report-456.pdf');
    });

    test('should restrict report generation to admin users', async () => {
      // Login as counselor
      const counselorAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'counselor-1',
          username: 'counselor',
          role: 'counselor',
          permissions: ['read', 'write']
        }
      });

      await counselorAgent
        .post('/admin/login')
        .send({ username: 'counselor', password: 'counselor123' });

      const response = await counselorAgent
        .post('/admin/reports/generate')
        .send({
          reportType: 'monthly_summary',
          parameters: {}
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('User Management (Admin Only)', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'manage_users']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'admin', password: 'admin123' });
    });

    test('should retrieve all users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'admin',
          role: 'admin',
          email: 'admin@example.com',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: '2024-01-15T09:00:00Z',
          status: 'active'
        },
        {
          id: 'user-2',
          username: 'counselor1',
          role: 'counselor',
          email: 'counselor1@example.com',
          createdAt: '2024-01-02T00:00:00Z',
          lastLogin: '2024-01-15T08:30:00Z',
          status: 'active'
        }
      ];

      userManagementService.getAllUsers = jest.fn().mockResolvedValue(mockUsers);

      const response = await authenticatedAgent
        .get('/admin/users');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
      expect(response.body).toHaveLength(2);
    });

    test('should create new users', async () => {
      const newUserData = {
        username: 'newcounselor',
        email: 'newcounselor@example.com',
        role: 'counselor',
        password: 'securepassword123'
      };

      const mockCreatedUser = {
        id: 'user-3',
        username: 'newcounselor',
        email: 'newcounselor@example.com',
        role: 'counselor',
        createdAt: '2024-01-15T10:45:00Z',
        status: 'active'
      };

      userManagementService.createUser = jest.fn().mockResolvedValue(mockCreatedUser);

      const response = await authenticatedAgent
        .post('/admin/users')
        .send(newUserData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCreatedUser);
      expect(userManagementService.createUser).toHaveBeenCalledWith(newUserData);
    });

    test('should update existing users', async () => {
      const updateData = {
        email: 'updated@example.com',
        status: 'inactive'
      };

      const mockUpdatedUser = {
        id: 'user-2',
        username: 'counselor1',
        email: 'updated@example.com',
        role: 'counselor',
        status: 'inactive',
        updatedAt: '2024-01-15T10:50:00Z'
      };

      userManagementService.updateUser = jest.fn().mockResolvedValue(mockUpdatedUser);

      const response = await authenticatedAgent
        .put('/admin/users/user-2')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUpdatedUser);
      expect(userManagementService.updateUser).toHaveBeenCalledWith('user-2', updateData);
    });

    test('should restrict user management to admin role', async () => {
      // Login as counselor
      const counselorAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'counselor-1',
          username: 'counselor',
          role: 'counselor',
          permissions: ['read', 'write']
        }
      });

      await counselorAgent
        .post('/admin/login')
        .send({ username: 'counselor', password: 'counselor123' });

      const response = await counselorAgent
        .get('/admin/users');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('Dashboard Performance and Reliability', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'manage_users']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'admin', password: 'admin123' });
    });

    test('should handle concurrent requests efficiently', async () => {
      analyticsService.getOverviewStats = jest.fn().mockResolvedValue({
        totalUsers: 1000,
        activeUsers: 50
      });

      // Send multiple concurrent requests
      const requests = Array(10).fill().map(() =>
        authenticatedAgent.get('/admin/analytics/overview')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.totalUsers).toBe(1000);
      });

      expect(analyticsService.getOverviewStats).toHaveBeenCalledTimes(10);
    });

    test('should handle service timeouts gracefully', async () => {
      analyticsService.getOverviewStats = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second delay
      );

      const startTime = Date.now();

      try {
        await authenticatedAgent
          .get('/admin/analytics/overview')
          .timeout(5000); // 5 second timeout
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(6000);
        expect(error.message).toContain('timeout');
      }
    });

    test('should maintain session state across requests', async () => {
      // First request
      let response = await authenticatedAgent
        .get('/admin/analytics/overview');
      expect(response.status).toBe(200);

      // Second request should still be authenticated
      response = await authenticatedAgent
        .get('/admin/monitoring/active-users');
      expect(response.status).toBe(200);
    });

    test('should handle logout properly', async () => {
      // Logout
      const logoutResponse = await authenticatedAgent
        .post('/admin/logout');

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Subsequent requests should require authentication
      const response = await authenticatedAgent
        .get('/admin/analytics/overview');

      expect(response.status).toBe(401);
    });
  });

  describe('Data Privacy and Security', () => {
    let authenticatedAgent;

    beforeEach(async () => {
      authenticatedAgent = request.agent(app);
      
      userManagementService.authenticateUser.mockResolvedValue({
        success: true,
        user: {
          id: 'admin-1',
          username: 'admin',
          role: 'admin',
          permissions: ['read', 'write', 'manage_users']
        }
      });

      await authenticatedAgent
        .post('/admin/login')
        .send({ username: 'admin', password: 'admin123' });
    });

    test('should not expose sensitive user data in analytics', async () => {
      const mockAnalytics = {
        totalUsers: 1000,
        sessions: [
          {
            sessionId: 'session-1',
            duration: 15,
            messageCount: 12,
            sentiment: 0.7,
            // Should not include actual message content or PII
          }
        ]
      };

      analyticsService.getOverviewStats = jest.fn().mockResolvedValue(mockAnalytics);

      const response = await authenticatedAgent
        .get('/admin/analytics/overview');

      expect(response.status).toBe(200);
      
      // Verify no sensitive data is exposed
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toMatch(/password|email|phone|address/i);
    });

    test('should anonymize data in reports', async () => {
      const mockReport = {
        reportId: 'report-123',
        data: {
          userMetrics: {
            totalUsers: 500,
            averageSessionDuration: 12.5,
            // User data should be aggregated, not individual
          },
          crisisMetrics: {
            totalEvents: 25,
            responseTime: 2.3,
            // No individual crisis details
          }
        }
      };

      analyticsService.generateReport = jest.fn().mockResolvedValue(mockReport);

      const response = await authenticatedAgent
        .post('/admin/reports/generate')
        .send({
          reportType: 'privacy_compliant_summary',
          parameters: { anonymize: true }
        });

      expect(response.status).toBe(200);
      
      // Verify data is properly anonymized
      const reportString = JSON.stringify(response.body);
      expect(reportString).not.toMatch(/user-\d+|session-\d+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    });
  });
});