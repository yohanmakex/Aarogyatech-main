/**
 * Peer Support Model
 * Stores user posts and replies for peer support community
 */

const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },
  authorId: {
    type: String,
    required: true,
    index: true
  },
  authorEmail: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    default: 'Anonymous Student'
  },
  supportCount: {
    type: Number,
    default: 0,
    min: 0
  },
  supportedBy: [{
    userId: String,
    supportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isModerated: {
    type: Boolean,
    default: false
  },
  moderatedBy: {
    type: String
  },
  moderatedAt: {
    type: Date
  },
  moderationNotes: {
    type: String
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const PostSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  authorId: {
    type: String,
    required: true,
    index: true
  },
  authorEmail: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    default: 'Anonymous Student'
  },
  category: {
    type: String,
    enum: ['general', 'academic', 'anxiety', 'depression', 'relationships', 'success-story', 'advice-needed'],
    default: 'general',
    index: true
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  supportCount: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  supportedBy: [{
    userId: String,
    supportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  replies: [ReplySchema],
  replyCount: {
    type: Number,
    default: 0,
    min: 0
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isModerated: {
    type: Boolean,
    default: false,
    index: true
  },
  moderatedBy: {
    type: String
  },
  moderatedAt: {
    type: Date
  },
  moderationNotes: {
    type: String
  },
  isHidden: {
    type: Boolean,
    default: false,
    index: true
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lastActivityAt: {
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
  }
}, {
  timestamps: true,
  collection: 'peer_support_posts'
});

// Indexes for performance
PostSchema.index({ createdAt: -1 });
PostSchema.index({ lastActivityAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ supportCount: -1, createdAt: -1 });
PostSchema.index({ isHidden: 1, isPinned: -1, lastActivityAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });

// Virtual for formatted creation date
PostSchema.virtual('formattedCreatedAt').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return this.createdAt.toLocaleDateString();
  }
});

// Virtual for engagement score (for sorting)
PostSchema.virtual('engagementScore').get(function() {
  const ageInHours = (new Date() - this.createdAt) / (1000 * 60 * 60);
  const decayFactor = Math.exp(-ageInHours / 168); // Decay over a week
  return (this.supportCount * 2 + this.replyCount * 3 + this.viewCount * 0.1) * decayFactor;
});

// Pre-save middleware to update lastActivityAt and replyCount
PostSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.replyCount = this.replies.filter(reply => !reply.isHidden).length;
    this.lastActivityAt = new Date();
  }
  next();
});

// Static method to get community statistics
PostSchema.statics.getCommunityStats = async function(dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        isHidden: false
      }
    },
    {
      $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalReplies: { $sum: '$replyCount' },
        totalSupports: { $sum: '$supportCount' },
        totalViews: { $sum: '$viewCount' },
        averageRepliesPerPost: { $avg: '$replyCount' },
        categoryBreakdown: {
          $push: '$category'
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalPosts: 0,
    totalReplies: 0,
    totalSupports: 0,
    totalViews: 0,
    averageRepliesPerPost: 0,
    categoryBreakdown: []
  };
};

// Static method to get trending posts
PostSchema.statics.getTrendingPosts = async function(limit = 10) {
  return this.find({
    isHidden: false,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
  })
  .sort({ supportCount: -1, replyCount: -1, viewCount: -1 })
  .limit(limit)
  .select('id title content authorName category supportCount replyCount viewCount createdAt');
};

// Static method to get posts by category
PostSchema.statics.getPostsByCategory = async function(category, limit = 20, skip = 0) {
  const query = { isHidden: false };
  if (category && category !== 'all') {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ isPinned: -1, lastActivityAt: -1 })
    .limit(limit)
    .skip(skip)
    .select('id title content authorName category supportCount replyCount viewCount createdAt lastActivityAt isPinned');
};

module.exports = mongoose.model('PeerSupportPost', PostSchema);