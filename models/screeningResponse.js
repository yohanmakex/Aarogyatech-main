/**
 * Mental Health Screening Response Model
 * Stores user responses to screening tools with results and analysis
 */

const mongoose = require('mongoose');

const ScreeningResponseSchema = new mongoose.Schema({
  // User Information
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Screening Tool Information
  toolName: {
    type: String,
    required: true,
    enum: ['PHQ-9', 'GAD-7', 'GHQ-12'],
    index: true
  },
  toolVersion: {
    type: String,
    default: '1.0'
  },
  
  // User Responses
  responses: [{
    questionId: {
      type: String,
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    response: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },
    category: {
      type: String,
      required: true
    }
  }],
  
  // User's Additional Description
  userDescription: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Calculated Results
  results: {
    totalScore: {
      type: Number,
      required: true,
      min: 0
    },
    maxScore: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    severityLevel: {
      type: String,
      required: true,
      enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'normal', 'distressed']
    },
    description: {
      type: String,
      required: true
    },
    isAboveThreshold: {
      type: Boolean,
      required: true
    },
    clinicalThreshold: {
      type: Number,
      required: true
    }
  },
  
  // Crisis Detection
  crisisIndicators: {
    hasCrisisAlerts: {
      type: Boolean,
      default: false,
      index: true
    },
    crisisAlerts: [{
      type: {
        type: String,
        enum: ['suicidal_ideation', 'severe_depression', 'severe_anxiety', 'severe_distress']
      },
      severity: {
        type: String,
        enum: ['high', 'critical']
      },
      message: String,
      questionId: String
    }],
    requiresImmediateAttention: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  
  // Recommendations Generated
  recommendations: [{
    type: String
  }],
  
  // Metadata
  completedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'mr']
  },
  
  // Follow-up Information
  followUpScheduled: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  counselorAssigned: {
    type: String
  },
  
  // Admin Notes
  adminNotes: [{
    note: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status Tracking
  status: {
    type: String,
    enum: ['completed', 'reviewed', 'follow_up_needed', 'resolved'],
    default: 'completed',
    index: true
  },
  reviewedBy: {
    type: String
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'screening_responses'
});

// Indexes for performance
ScreeningResponseSchema.index({ completedAt: -1 });
ScreeningResponseSchema.index({ toolName: 1, completedAt: -1 });
ScreeningResponseSchema.index({ 'results.severityLevel': 1, completedAt: -1 });
ScreeningResponseSchema.index({ 'crisisIndicators.hasCrisisAlerts': 1, completedAt: -1 });
ScreeningResponseSchema.index({ status: 1, completedAt: -1 });
ScreeningResponseSchema.index({ userId: 1, toolName: 1, completedAt: -1 });

// Virtual for formatted completion date
ScreeningResponseSchema.virtual('formattedCompletedAt').get(function() {
  return this.completedAt.toLocaleDateString() + ' ' + this.completedAt.toLocaleTimeString();
});

// Virtual for risk level based on severity and crisis indicators
ScreeningResponseSchema.virtual('riskLevel').get(function() {
  if (this.crisisIndicators.requiresImmediateAttention) {
    return 'critical';
  }
  if (this.crisisIndicators.hasCrisisAlerts) {
    return 'high';
  }
  if (['severe', 'moderately_severe'].includes(this.results.severityLevel)) {
    return 'elevated';
  }
  if (this.results.severityLevel === 'moderate') {
    return 'moderate';
  }
  return 'low';
});

// Static method to get screening statistics
ScreeningResponseSchema.statics.getStatistics = async function(dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  const stats = await this.aggregate([
    {
      $match: {
        completedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalScreenings: { $sum: 1 },
        crisisAlerts: {
          $sum: {
            $cond: ['$crisisIndicators.hasCrisisAlerts', 1, 0]
          }
        },
        averageScore: { $avg: '$results.percentage' },
        toolBreakdown: {
          $push: {
            tool: '$toolName',
            severity: '$results.severityLevel'
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalScreenings: 0,
    crisisAlerts: 0,
    averageScore: 0,
    toolBreakdown: []
  };
};

// Static method to get recent crisis alerts
ScreeningResponseSchema.statics.getRecentCrisisAlerts = async function(limit = 10) {
  return this.find({
    'crisisIndicators.hasCrisisAlerts': true
  })
  .sort({ completedAt: -1 })
  .limit(limit)
  .select('userId userEmail toolName results.severityLevel crisisIndicators completedAt userDescription');
};

// Static method to get screening trends
ScreeningResponseSchema.statics.getScreeningTrends = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        completedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          tool: '$toolName'
        },
        count: { $sum: 1 },
        averageScore: { $avg: '$results.percentage' }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]);
};

module.exports = mongoose.model('ScreeningResponse', ScreeningResponseSchema);