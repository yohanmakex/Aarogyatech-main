/**
 * Screening Responses API Routes
 * Handles storing and retrieving mental health screening responses
 */

const express = require('express');
const router = express.Router();
const ScreeningResponse = require('../models/screeningResponse');
const { PHQ9, GAD7, GHQ12 } = require('../models/screeningTools');

// Middleware to log API usage
router.use((req, res, next) => {
  console.log(`Screening Response API: ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

/**
 * POST /api/screening-responses/submit
 * Submit a completed screening response
 */
router.post('/submit', async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      sessionId,
      toolName,
      responses,
      userDescription,
      results,
      crisisIndicators,
      recommendations,
      language = 'en'
    } = req.body;

    // Validate required fields
    if (!userId || !userEmail || !toolName || !responses || !results) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userEmail, toolName, responses, results'
      });
    }

    // Validate tool name
    if (!['PHQ-9', 'GAD-7', 'GHQ-12'].includes(toolName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tool name. Must be PHQ-9, GAD-7, or GHQ-12'
      });
    }

    // Check if database is connected
    if (!ScreeningResponse.db || ScreeningResponse.db.readyState !== 1) {
      console.warn('⚠️  Database not connected - screening response not saved:', {
        userId,
        toolName,
        severity: results.severityLevel,
        hasCrisis: crisisIndicators?.hasCrisisAlerts || false
      });
      
      return res.status(201).json({
        success: true,
        message: 'Screening completed (database unavailable)',
        responseId: null,
        riskLevel: 'unknown',
        requiresFollowUp: crisisIndicators?.hasCrisisAlerts || 
                         ['severe', 'moderately_severe'].includes(results.severityLevel)
      });
    }

    // Get client information
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Create screening response document
    const screeningResponse = new ScreeningResponse({
      userId,
      userEmail,
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      toolName,
      responses,
      userDescription: userDescription ? userDescription.trim() : '',
      results,
      crisisIndicators: crisisIndicators || {
        hasCrisisAlerts: false,
        crisisAlerts: [],
        requiresImmediateAttention: false
      },
      recommendations: recommendations || [],
      ipAddress,
      userAgent,
      language
    });

    // Save to database
    const savedResponse = await screeningResponse.save();

    // Log crisis alerts for immediate attention
    if (savedResponse.crisisIndicators.hasCrisisAlerts) {
      console.warn(`🚨 CRISIS ALERT: User ${userId} (${userEmail}) completed ${toolName} with crisis indicators`, {
        responseId: savedResponse._id,
        severity: savedResponse.results.severityLevel,
        crisisAlerts: savedResponse.crisisIndicators.crisisAlerts,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Screening response saved successfully',
      responseId: savedResponse._id,
      riskLevel: savedResponse.riskLevel,
      requiresFollowUp: savedResponse.crisisIndicators.hasCrisisAlerts || 
                       ['severe', 'moderately_severe'].includes(savedResponse.results.severityLevel)
    });

  } catch (error) {
    console.error('Error saving screening response:', error);
    
    // Still return success to user but log the error
    const hasFollowUp = (crisisIndicators && crisisIndicators.hasCrisisAlerts) || 
                       (results && ['severe', 'moderately_severe'].includes(results.severityLevel));
    
    res.status(201).json({
      success: true,
      message: 'Screening completed (save error)',
      responseId: null,
      riskLevel: 'unknown',
      requiresFollowUp: hasFollowUp,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/screening-responses/admin/overview
 * Get overview statistics for admin dashboard
 */
router.get('/admin/overview', async (req, res) => {
  try {
    // Check if database is connected
    if (!ScreeningResponse.db || ScreeningResponse.db.readyState !== 1) {
      return res.json({
        success: true,
        data: {
          overview: {
            totalScreenings: 0,
            crisisAlerts: 0,
            averageScore: 0,
            toolBreakdown: []
          },
          recentCrisisAlerts: [],
          trends: [],
          toolUsage: []
        },
        message: 'Database not connected - showing empty data'
      });
    }

    const { days = 30 } = req.query;
    
    // Get basic statistics
    const stats = await ScreeningResponse.getStatistics(parseInt(days));
    
    // Get recent crisis alerts
    const crisisAlerts = await ScreeningResponse.getRecentCrisisAlerts(5);
    
    // Get screening trends
    const trends = await ScreeningResponse.getScreeningTrends(7);
    
    // Get tool usage breakdown
    const toolUsage = await ScreeningResponse.aggregate([
      {
        $match: {
          completedAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$toolName',
          count: { $sum: 1 },
          averageScore: { $avg: '$results.percentage' },
          crisisCount: {
            $sum: { $cond: ['$crisisIndicators.hasCrisisAlerts', 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats,
        recentCrisisAlerts: crisisAlerts,
        trends,
        toolUsage
      }
    });

  } catch (error) {
    console.error('Error fetching admin overview:', error);
    
    // Return empty data instead of error for better UX
    res.json({
      success: true,
      data: {
        overview: {
          totalScreenings: 0,
          crisisAlerts: 0,
          averageScore: 0,
          toolBreakdown: []
        },
        recentCrisisAlerts: [],
        trends: [],
        toolUsage: []
      },
      message: 'Database error - showing empty data'
    });
  }
});

/**
 * GET /api/screening-responses/admin/responses
 * Get paginated list of screening responses for admin
 */
router.get('/admin/responses', async (req, res) => {
  try {
    // Check if database is connected
    if (!ScreeningResponse.db || ScreeningResponse.db.readyState !== 1) {
      return res.json({
        success: true,
        data: {
          responses: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        },
        message: 'Database not connected - showing empty data'
      });
    }

    const {
      page = 1,
      limit = 20,
      toolName,
      severityLevel,
      crisisOnly,
      dateFrom,
      dateTo,
      status,
      sortBy = 'completedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (toolName) filter.toolName = toolName;
    if (severityLevel) filter['results.severityLevel'] = severityLevel;
    if (crisisOnly === 'true') filter['crisisIndicators.hasCrisisAlerts'] = true;
    if (status) filter.status = status;
    
    if (dateFrom || dateTo) {
      filter.completedAt = {};
      if (dateFrom) filter.completedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.completedAt.$lte = new Date(dateTo);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [responses, totalCount] = await Promise.all([
      ScreeningResponse.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-responses -userAgent -ipAddress'), // Exclude detailed response data for list view
      ScreeningResponse.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        responses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + responses.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching screening responses:', error);
    
    // Return empty data instead of error for better UX
    res.json({
      success: true,
      data: {
        responses: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false
        }
      },
      message: 'Database error - showing empty data'
    });
  }
});

/**
 * GET /api/screening-responses/admin/response/:id
 * Get detailed screening response by ID
 */
router.get('/admin/response/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await ScreeningResponse.findById(id);
    
    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'Screening response not found'
      });
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error fetching screening response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch screening response'
    });
  }
});

/**
 * PUT /api/screening-responses/admin/response/:id
 * Update screening response (admin notes, status, etc.)
 */
router.put('/admin/response/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      adminNote,
      adminUser,
      followUpScheduled,
      followUpDate,
      counselorAssigned
    } = req.body;

    const updateData = {};
    
    if (status) {
      updateData.status = status;
      updateData.reviewedBy = adminUser;
      updateData.reviewedAt = new Date();
    }
    
    if (followUpScheduled !== undefined) updateData.followUpScheduled = followUpScheduled;
    if (followUpDate) updateData.followUpDate = new Date(followUpDate);
    if (counselorAssigned) updateData.counselorAssigned = counselorAssigned;

    const response = await ScreeningResponse.findById(id);
    
    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'Screening response not found'
      });
    }

    // Add admin note if provided
    if (adminNote) {
      response.adminNotes.push({
        note: adminNote,
        addedBy: adminUser || 'admin',
        addedAt: new Date()
      });
    }

    // Apply updates
    Object.assign(response, updateData);
    
    const updatedResponse = await response.save();

    res.json({
      success: true,
      message: 'Screening response updated successfully',
      data: updatedResponse
    });

  } catch (error) {
    console.error('Error updating screening response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update screening response'
    });
  }
});

/**
 * GET /api/screening-responses/admin/crisis-alerts
 * Get current crisis alerts requiring immediate attention
 */
router.get('/admin/crisis-alerts', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const crisisAlerts = await ScreeningResponse.find({
      $or: [
        { 'crisisIndicators.requiresImmediateAttention': true },
        { 'crisisIndicators.hasCrisisAlerts': true }
      ],
      status: { $in: ['completed', 'reviewed'] } // Exclude resolved cases
    })
    .sort({ completedAt: -1 })
    .limit(parseInt(limit))
    .select('userId userEmail toolName results crisisIndicators completedAt userDescription status');

    res.json({
      success: true,
      data: crisisAlerts
    });

  } catch (error) {
    console.error('Error fetching crisis alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crisis alerts'
    });
  }
});

/**
 * GET /api/screening-responses/admin/analytics
 * Get detailed analytics for reporting
 */
router.get('/admin/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let days;
    switch (period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
      default: days = 30;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Comprehensive analytics query
    const analytics = await ScreeningResponse.aggregate([
      {
        $match: { completedAt: { $gte: startDate } }
      },
      {
        $facet: {
          // Overall statistics
          overview: [
            {
              $group: {
                _id: null,
                totalScreenings: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                crisisAlerts: { $sum: { $cond: ['$crisisIndicators.hasCrisisAlerts', 1, 0] } },
                averageScore: { $avg: '$results.percentage' }
              }
            },
            {
              $project: {
                totalScreenings: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
                crisisAlerts: 1,
                averageScore: { $round: ['$averageScore', 2] }
              }
            }
          ],
          
          // Severity distribution
          severityDistribution: [
            {
              $group: {
                _id: '$results.severityLevel',
                count: { $sum: 1 }
              }
            }
          ],
          
          // Tool usage
          toolUsage: [
            {
              $group: {
                _id: '$toolName',
                count: { $sum: 1 },
                averageScore: { $avg: '$results.percentage' },
                crisisCount: { $sum: { $cond: ['$crisisIndicators.hasCrisisAlerts', 1, 0] } }
              }
            }
          ],
          
          // Daily trends
          dailyTrends: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
                count: { $sum: 1 },
                crisisCount: { $sum: { $cond: ['$crisisIndicators.hasCrisisAlerts', 1, 0] } }
              }
            },
            { $sort: { '_id': 1 } }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: analytics[0]
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

module.exports = router;