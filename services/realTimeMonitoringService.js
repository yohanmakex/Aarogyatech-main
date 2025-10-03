const { Server } = require('socket.io');

class RealTimeMonitoringService {
  constructor(server, analyticsService) {
    this.analyticsService = analyticsService;
    this.connectedClients = new Map(); // Store connected admin/counselor clients
    this.activeAlerts = new Map(); // Store active crisis alerts
    this.systemMetrics = {
      apiResponseTimes: [],
      errorRates: {},
      activeConnections: 0,
      lastUpdated: new Date()
    };

    // Initialize Socket.IO
    this.io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io/'
    });

    this.setupSocketHandlers();
    this.startMonitoring();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle admin/counselor authentication
      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data);
      });

      // Handle subscription to monitoring updates
      socket.on('subscribe-monitoring', () => {
        this.handleMonitoringSubscription(socket);
      });

      // Handle crisis alert acknowledgment
      socket.on('acknowledge-alert', (alertId) => {
        this.handleAlertAcknowledgment(socket, alertId);
      });

      // Handle escalation request
      socket.on('escalate-alert', (alertId) => {
        this.handleAlertEscalation(socket, alertId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleAuthentication(socket, data) {
    try {
      const { token, userRole } = data;
      
      // Verify token and role (simplified - in production, use proper JWT verification)
      if (token && ['admin', 'counselor'].includes(userRole)) {
        socket.authenticated = true;
        socket.userRole = userRole;
        socket.userId = data.userId || socket.id;
        
        this.connectedClients.set(socket.id, {
          socket,
          userRole,
          userId: socket.userId,
          connectedAt: new Date(),
          lastActivity: new Date()
        });

        socket.emit('authenticated', { success: true });
        
        // Send initial monitoring data
        this.sendInitialMonitoringData(socket);
        
        console.log(`Admin/Counselor authenticated: ${socket.userId} (${userRole})`);
      } else {
        socket.emit('authentication-failed', { error: 'Invalid credentials or insufficient permissions' });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('authentication-failed', { error: 'Authentication failed' });
    }
  }

  handleMonitoringSubscription(socket) {
    if (!socket.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    socket.join('monitoring');
    socket.emit('monitoring-subscribed', { success: true });
    
    // Send current monitoring data
    this.sendMonitoringUpdate(socket);
  }

  handleAlertAcknowledgment(socket, alertId) {
    if (!socket.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledgedBy = socket.userId;
      alert.acknowledgedAt = new Date();
      alert.status = 'acknowledged';
      
      // Broadcast alert update to all monitoring clients
      this.io.to('monitoring').emit('alert-updated', {
        alertId,
        alert,
        acknowledgedBy: socket.userId
      });

      console.log(`Crisis alert ${alertId} acknowledged by ${socket.userId}`);
    }
  }

  handleAlertEscalation(socket, alertId) {
    if (!socket.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.escalatedBy = socket.userId;
      alert.escalatedAt = new Date();
      alert.status = 'escalated';
      alert.severity = 'critical';
      
      // Broadcast escalation to all monitoring clients
      this.io.to('monitoring').emit('alert-escalated', {
        alertId,
        alert,
        escalatedBy: socket.userId
      });

      console.log(`Crisis alert ${alertId} escalated by ${socket.userId}`);
    }
  }

  handleDisconnect(socket) {
    console.log('Client disconnected:', socket.id);
    this.connectedClients.delete(socket.id);
  }

  sendInitialMonitoringData(socket) {
    const monitoringData = this.getMonitoringData();
    socket.emit('monitoring-data', monitoringData);
  }

  sendMonitoringUpdate(socket = null) {
    const monitoringData = this.getMonitoringData();
    
    if (socket) {
      socket.emit('monitoring-update', monitoringData);
    } else {
      this.io.to('monitoring').emit('monitoring-update', monitoringData);
    }
  }

  getMonitoringData() {
    const activeSessionsCount = this.analyticsService.getActiveSessionsCount();
    const usageStats = this.analyticsService.getUsageStatistics();
    const crisisStats = this.analyticsService.getCrisisStatistics(1); // Today only
    
    return {
      timestamp: new Date().toISOString(),
      activeSessions: activeSessionsCount,
      activeAlerts: Array.from(this.activeAlerts.values()),
      systemMetrics: this.systemMetrics,
      usageStats: usageStats.today,
      crisisStats,
      connectedAdmins: this.connectedClients.size
    };
  }

  // Crisis alert management
  createCrisisAlert(alertData) {
    const alertId = this.generateAlertId();
    const alert = {
      id: alertId,
      userId: alertData.userId,
      sessionId: alertData.sessionId,
      severity: alertData.severity || 'medium',
      message: alertData.message || 'Crisis situation detected',
      keywords: alertData.keywords || [],
      sentiment: alertData.sentiment || null,
      createdAt: new Date(),
      status: 'active',
      acknowledgedBy: null,
      acknowledgedAt: null,
      escalatedBy: null,
      escalatedAt: null
    };

    this.activeAlerts.set(alertId, alert);

    // Broadcast to all monitoring clients
    this.io.to('monitoring').emit('new-crisis-alert', alert);

    // Send high-priority notification for critical alerts
    if (alert.severity === 'critical') {
      this.io.to('monitoring').emit('critical-alert', alert);
    }

    console.log(`New crisis alert created: ${alertId} (${alert.severity})`);
    return alertId;
  }

  resolveAlert(alertId, resolvedBy) {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();

      // Broadcast resolution to all monitoring clients
      this.io.to('monitoring').emit('alert-resolved', {
        alertId,
        alert,
        resolvedBy
      });

      // Remove from active alerts after a delay
      setTimeout(() => {
        this.activeAlerts.delete(alertId);
      }, 300000); // Keep for 5 minutes after resolution

      console.log(`Crisis alert ${alertId} resolved by ${resolvedBy}`);
    }
  }

  // System monitoring
  recordApiMetric(endpoint, responseTime, statusCode) {
    this.systemMetrics.apiResponseTimes.push({
      endpoint,
      responseTime,
      statusCode,
      timestamp: new Date()
    });

    // Keep only last 100 metrics
    if (this.systemMetrics.apiResponseTimes.length > 100) {
      this.systemMetrics.apiResponseTimes = this.systemMetrics.apiResponseTimes.slice(-100);
    }

    // Update error rates
    const errorKey = statusCode >= 400 ? 'errors' : 'success';
    this.systemMetrics.errorRates[errorKey] = (this.systemMetrics.errorRates[errorKey] || 0) + 1;

    this.systemMetrics.lastUpdated = new Date();
  }

  updateActiveConnections(count) {
    this.systemMetrics.activeConnections = count;
    this.systemMetrics.lastUpdated = new Date();
  }

  // Monitoring loop
  startMonitoring() {
    // Send monitoring updates every 30 seconds
    setInterval(() => {
      this.sendMonitoringUpdate();
    }, 30000);

    // Clean up old metrics every 5 minutes
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000);

    // Check for stale alerts every minute
    setInterval(() => {
      this.checkStaleAlerts();
    }, 60000);
  }

  cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
    
    this.systemMetrics.apiResponseTimes = this.systemMetrics.apiResponseTimes.filter(
      metric => metric.timestamp > cutoff
    );

    // Reset error rates periodically
    if (Object.keys(this.systemMetrics.errorRates).length > 0) {
      const total = Object.values(this.systemMetrics.errorRates).reduce((a, b) => a + b, 0);
      if (total > 1000) {
        this.systemMetrics.errorRates = {};
      }
    }
  }

  checkStaleAlerts() {
    const staleThreshold = new Date(Date.now() - 1800000); // 30 minutes ago
    
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.createdAt < staleThreshold && alert.status === 'active') {
        // Auto-escalate stale alerts
        alert.status = 'auto-escalated';
        alert.escalatedAt = new Date();
        alert.escalatedBy = 'system';
        
        this.io.to('monitoring').emit('alert-auto-escalated', {
          alertId,
          alert,
          reason: 'No response for 30 minutes'
        });
      }
    }
  }

  // Utility methods
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.values()).map(client => ({
      userId: client.userId,
      userRole: client.userRole,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity
    }));
  }

  getActiveAlertsCount() {
    return this.activeAlerts.size;
  }

  getSystemHealth() {
    const recentMetrics = this.systemMetrics.apiResponseTimes.filter(
      metric => metric.timestamp > new Date(Date.now() - 300000) // Last 5 minutes
    );

    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, metric) => sum + metric.responseTime, 0) / recentMetrics.length
      : 0;

    const errorRate = this.systemMetrics.errorRates.errors || 0;
    const successRate = this.systemMetrics.errorRates.success || 0;
    const totalRequests = errorRate + successRate;
    const errorPercentage = totalRequests > 0 ? (errorRate / totalRequests) * 100 : 0;

    return {
      avgResponseTime: Math.round(avgResponseTime),
      errorPercentage: Math.round(errorPercentage * 100) / 100,
      activeConnections: this.systemMetrics.activeConnections,
      connectedAdmins: this.connectedClients.size,
      activeAlerts: this.activeAlerts.size,
      lastUpdated: this.systemMetrics.lastUpdated
    };
  }

  // Notification methods
  sendNotification(userRole, notification) {
    for (const client of this.connectedClients.values()) {
      if (client.userRole === userRole || userRole === 'all') {
        client.socket.emit('notification', notification);
      }
    }
  }

  broadcastSystemAlert(alert) {
    this.io.to('monitoring').emit('system-alert', alert);
  }

  // Cleanup
  destroy() {
    if (this.io) {
      this.io.close();
    }
  }
}

module.exports = RealTimeMonitoringService;