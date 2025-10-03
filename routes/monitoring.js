const express = require('express');
const AuthMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Middleware to ensure only admin and counselor access
const requireAdminOrCounselor = [
  authMiddleware.authenticate,
  authMiddleware.adminOrCounselor
];

// Get real-time monitoring data
router.get('/status', requireAdminOrCounselor, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const monitoringData = realTimeMonitoring.getMonitoringData();
    
    res.status(200).json({
      success: true,
      data: monitoringData
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve monitoring status',
      message: error.message
    });
  }
});

// Get system health metrics
router.get('/health', requireAdminOrCounselor, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const systemHealth = realTimeMonitoring.getSystemHealth();
    
    res.status(200).json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve system health',
      message: error.message
    });
  }
});

// Get connected clients information
router.get('/clients', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const connectedClients = realTimeMonitoring.getConnectedClients();
    
    res.status(200).json({
      success: true,
      data: {
        clients: connectedClients,
        count: connectedClients.length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve connected clients',
      message: error.message
    });
  }
});

// Create a crisis alert (for testing or manual creation)
router.post('/alert', requireAdminOrCounselor, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const { userId, sessionId, severity, message, keywords, sentiment } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId is required'
      });
    }

    const alertData = {
      userId,
      sessionId,
      severity: severity || 'medium',
      message: message || 'Manual crisis alert',
      keywords: keywords || [],
      sentiment: sentiment || null
    };

    const alertId = realTimeMonitoring.createCrisisAlert(alertData);
    
    res.status(201).json({
      success: true,
      alertId,
      message: 'Crisis alert created successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create crisis alert',
      message: error.message
    });
  }
});

// Resolve a crisis alert
router.post('/alert/:alertId/resolve', requireAdminOrCounselor, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const { alertId } = req.params;
    const resolvedBy = req.user.username;

    realTimeMonitoring.resolveAlert(alertId, resolvedBy);
    
    res.status(200).json({
      success: true,
      message: 'Crisis alert resolved successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve crisis alert',
      message: error.message
    });
  }
});

// Record API metric (for internal use)
router.post('/metric', authMiddleware.authenticate, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const { endpoint, responseTime, statusCode } = req.body;
    
    if (!endpoint || responseTime === undefined || !statusCode) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'endpoint, responseTime, and statusCode are required'
      });
    }

    realTimeMonitoring.recordApiMetric(endpoint, responseTime, statusCode);
    
    res.status(200).json({
      success: true,
      message: 'Metric recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to record metric',
      message: error.message
    });
  }
});

// Send notification to connected clients
router.post('/notify', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const { userRole, notification } = req.body;
    
    if (!userRole || !notification) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userRole and notification are required'
      });
    }

    realTimeMonitoring.sendNotification(userRole, notification);
    
    res.status(200).json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send notification',
      message: error.message
    });
  }
});

// Broadcast system alert
router.post('/system-alert', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const { alert } = req.body;
    
    if (!alert) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'alert is required'
      });
    }

    realTimeMonitoring.broadcastSystemAlert(alert);
    
    res.status(200).json({
      success: true,
      message: 'System alert broadcasted successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to broadcast system alert',
      message: error.message
    });
  }
});

// Get active alerts
router.get('/alerts', requireAdminOrCounselor, (req, res) => {
  try {
    const realTimeMonitoring = req.app.locals.realTimeMonitoring;
    
    if (!realTimeMonitoring) {
      return res.status(503).json({
        error: 'Monitoring service unavailable',
        message: 'Real-time monitoring service is not initialized'
      });
    }

    const monitoringData = realTimeMonitoring.getMonitoringData();
    
    res.status(200).json({
      success: true,
      data: {
        alerts: monitoringData.activeAlerts,
        count: monitoringData.activeAlerts.length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve active alerts',
      message: error.message
    });
  }
});

module.exports = router;