/**
 * MongoDB Schemas for Mental Health Screening
 * Handles storage of screening assessments, results, and historical data
 */

const mongoose = require('mongoose');

// Schema for individual screening responses
const ScreeningResponseSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    index: true
  },
  questionNumber: {
    type: Number,
    required: true
  },
  responseValue: {
    type: Number,
    required: true,
    min: 0
  },
  adjustedValue: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    index: true
  }
});

// Schema for score interpretation
const ScoreInterpretationSchema = new mongoose.Schema({
  score: {
    type: Number,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'normal', 'distressed'],
    index: true
  },
  description: {
    type: String,
    required: true
  },
  isAboveThreshold: {
    type: Boolean,
    required: true,
    index: true
  },
  clinicalCutoff: {
    type: Number,
    required: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'unknown'],
    index: true
  },
  recommendations: [{
    type: String
  }],
  clinicalNotes: {
    type: String
  }
});

// Schema for crisis alerts
const CrisisAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['suicidalIdeation', 'severeDepression', 'severeAnxiety', 'severeDistress'],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low'],
    default: 'high'
  },
  action: {
    type: String,
    required: true,
    enum: ['immediate_intervention', 'urgent_referral'],
    index: true
  },
  message: {
    type: String,
    required: true
  },
  resources: {
    emergencyServices: String,
    nationalSuicidePrevention: String,
    crisisTextLine: String,
    emergencyRoom: String,
    note: String
  }
});

// Schema for validity assessment
const ValidityAssessmentSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['valid', 'questionable', 'invalid'],
    default: 'valid'
  },
  warnings: [{
    type: String
  }]
});

// Main screening assessment schema
const ScreeningAssessmentSchema = new mongoose.Schema({
  // Tool information
  toolName: {
    type: String,
    required: true,
    enum: ['PHQ-9', 'GAD-7', 'GHQ-12'],
    index: true
  },
  fullName: {
    type: String,
    required: true
  },
  
  // Session and user information (anonymized)
  sessionId: {
    type: String,
    index: true,
    sparse: true // Allow null values but create index for non-null
  },
  anonymousId: {
    type: String,
    index: true,
    default: function() {
      return new mongoose.Types.ObjectId().toString();
    }
  },
  
  // Assessment data
  responses: [ScreeningResponseSchema],
  
  // Scoring information
  score: {
    totalScore: {
      type: Number,
      required: true,
      index: true
    },
    maxScore: {
      type: Number,
      required: true
    },
    scoringMethod: {
      type: String,
      required: true,
      enum: ['standard', 'binary'],
      default: 'standard'
    },
    interpretation: ScoreInterpretationSchema
  },
  
  // Crisis detection
  crisisAlerts: [CrisisAlertSchema],
  requiresImmediateAttention: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  
  // Recommendations
  followUpRecommendations: [{
    type: String
  }],
  nextSteps: [{
    type: String
  }],
  
  // Quality and validity
  validity: ValidityAssessmentSchema,
  
  // Metadata
  metadata: {
    requestInfo: {
      timestamp: {
        type: Date,
        default: Date.now
      },
      sessionId: String,
      ipAddressHash: String, // Hashed for privacy
      userAgentHash: String   // Hashed for privacy
    },
    processing: {
      version: {
        type: String,
        default: '1.0.0'
      },
      processingTime: {
        type: Date,
        default: Date.now
      }
    }
  },
  
  // Privacy and data retention
  dataRetentionExpiry: {
    type: Date,
    index: { expireAfterSeconds: 0 } // TTL index for automatic deletion
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  collection: 'screeningAssessments'
});

// Schema for screening statistics and analytics
const ScreeningStatisticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true,
    default: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  },
  
  toolName: {
    type: String,
    required: true,
    enum: ['PHQ-9', 'GAD-7', 'GHQ-12'],
    index: true
  },
  
  // Daily statistics
  totalAssessments: {
    type: Number,
    default: 0
  },
  
  // Score distribution
  scoreDistribution: {
    minimal: { type: Number, default: 0 },
    mild: { type: Number, default: 0 },
    moderate: { type: Number, default: 0 },
    moderately_severe: { type: Number, default: 0 },
    severe: { type: Number, default: 0 },
    normal: { type: Number, default: 0 },
    distressed: { type: Number, default: 0 }
  },
  
  // Crisis statistics
  crisisDetections: {
    total: { type: Number, default: 0 },
    suicidalIdeation: { type: Number, default: 0 },
    severeDepression: { type: Number, default: 0 },
    severeAnxiety: { type: Number, default: 0 },
    severeDistress: { type: Number, default: 0 }
  },
  
  // Average scores
  averageScore: {
    type: Number,
    default: 0
  },
  
  // Validity statistics
  validityStats: {
    valid: { type: Number, default: 0 },
    questionable: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'screeningStatistics'
});

// Schema for user screening history (optional, requires user consent)
const UserScreeningHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  
  // Assessment references
  assessments: [{
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScreeningAssessment',
      required: true
    },
    toolName: String,
    date: Date,
    score: Number,
    level: String,
    hadCrisis: Boolean
  }],
  
  // Privacy settings
  consentToStore: {
    type: Boolean,
    required: true,
    default: false
  },
  consentDate: {
    type: Date
  },
  dataRetentionExpiry: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  
  // Summary statistics
  summary: {
    totalAssessments: { type: Number, default: 0 },
    toolsUsed: [String],
    lastAssessment: Date,
    averageScores: {
      'PHQ-9': Number,
      'GAD-7': Number,
      'GHQ-12': Number
    }
  }
}, {
  timestamps: true,
  collection: 'userScreeningHistory'
});

// Indexes for performance
ScreeningAssessmentSchema.index({ createdAt: -1 });
ScreeningAssessmentSchema.index({ toolName: 1, createdAt: -1 });
ScreeningAssessmentSchema.index({ 'score.interpretation.level': 1 });
ScreeningAssessmentSchema.index({ requiresImmediateAttention: 1, createdAt: -1 });
ScreeningAssessmentSchema.index({ sessionId: 1, createdAt: -1 }, { sparse: true });

ScreeningStatisticsSchema.index({ date: 1, toolName: 1 }, { unique: true });

UserScreeningHistorySchema.index({ userId: 1, 'assessments.date': -1 });

// Pre-save middleware for data privacy
ScreeningAssessmentSchema.pre('save', function(next) {
  // Hash IP address and user agent for privacy
  if (this.metadata && this.metadata.requestInfo) {
    if (this.metadata.requestInfo.ipAddress) {
      const crypto = require('crypto');
      this.metadata.requestInfo.ipAddressHash = crypto
        .createHash('sha256')
        .update(this.metadata.requestInfo.ipAddress)
        .digest('hex');
      delete this.metadata.requestInfo.ipAddress;
    }
    
    if (this.metadata.requestInfo.userAgent) {
      const crypto = require('crypto');
      this.metadata.requestInfo.userAgentHash = crypto
        .createHash('sha256')
        .update(this.metadata.requestInfo.userAgent)
        .digest('hex');
      delete this.metadata.requestInfo.userAgent;
    }
  }
  
  // Set data retention expiry (30 days by default)
  if (!this.dataRetentionExpiry) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.dataRetentionExpiry = expiryDate;
  }
  
  next();
});

// Static methods for analytics
ScreeningAssessmentSchema.statics.getStatistics = function(toolName, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        toolName: toolName || { $in: ['PHQ-9', 'GAD-7', 'GHQ-12'] },
        createdAt: {
          $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          $lte: endDate || new Date()
        }
      }
    },
    {
      $group: {
        _id: '$toolName',
        totalAssessments: { $sum: 1 },
        averageScore: { $avg: '$score.totalScore' },
        crisisCount: {
          $sum: { $cond: ['$requiresImmediateAttention', 1, 0] }
        },
        levelDistribution: {
          $push: '$score.interpretation.level'
        }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

ScreeningAssessmentSchema.statics.getCrisisAlerts = function(hours = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    requiresImmediateAttention: true,
    createdAt: { $gte: cutoffTime }
  })
  .select('toolName score.totalScore crisisAlerts createdAt metadata.requestInfo.sessionId')
  .sort({ createdAt: -1 });
};

// Create models
const ScreeningAssessment = mongoose.model('ScreeningAssessment', ScreeningAssessmentSchema);
const ScreeningStatistics = mongoose.model('ScreeningStatistics', ScreeningStatisticsSchema);
const UserScreeningHistory = mongoose.model('UserScreeningHistory', UserScreeningHistorySchema);

module.exports = {
  ScreeningAssessment,
  ScreeningStatistics,
  UserScreeningHistory,
  
  // Schema exports for reference
  ScreeningAssessmentSchema,
  ScreeningStatisticsSchema,
  UserScreeningHistorySchema
};