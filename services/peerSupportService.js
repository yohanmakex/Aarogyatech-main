/*
 * AarogyaTech - AI-powered Mental Health Assistant
 * Peer Support Service - Handles community posts and replies
 * 
 * Copyright (c) 2025 Rajiv Magadum
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * Author: Rajiv Magadum
 * Email: rajiv.magadum@gmail.com
 * Date: 2025
 */

const PeerSupportPost = require('../models/peerSupport');
const { v4: uuidv4 } = require('uuid');

class PeerSupportService {
  constructor() {
    this.moderationKeywords = [
      'suicide', 'kill myself', 'end it all', 'self harm', 'cutting',
      'overdose', 'pills', 'jump', 'bridge', 'rope', 'gun'
    ];
  }

  // Content moderation check
  checkContentForModeration(content) {
    const lowerContent = content.toLowerCase();
    const flaggedKeywords = this.moderationKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    );
    
    return {
      needsModeration: flaggedKeywords.length > 0,
      flaggedKeywords,
      riskLevel: flaggedKeywords.length > 2 ? 'high' : flaggedKeywords.length > 0 ? 'medium' : 'low'
    };
  }

  // Extract category from content
  extractCategory(title, content) {
    const text = (title + ' ' + content).toLowerCase();
    
    if (text.includes('exam') || text.includes('study') || text.includes('grade') || text.includes('course')) {
      return 'academic';
    }
    if (text.includes('anxious') || text.includes('anxiety') || text.includes('panic') || text.includes('worry')) {
      return 'anxiety';
    }
    if (text.includes('depressed') || text.includes('depression') || text.includes('sad') || text.includes('hopeless')) {
      return 'depression';
    }
    if (text.includes('relationship') || text.includes('friend') || text.includes('family') || text.includes('dating')) {
      return 'relationships';
    }
    if (text.includes('success') || text.includes('overcome') || text.includes('better') || text.includes('improved')) {
      return 'success-story';
    }
    if (text.includes('advice') || text.includes('help') || text.includes('what should') || text.includes('how to')) {
      return 'advice-needed';
    }
    
    return 'general';
  }

  // Create a new post
  async createPost(postData) {
    try {
      const { title, content, authorId, authorEmail, authorName, ipAddress, userAgent, language } = postData;

      // Content moderation check
      const moderationCheck = this.checkContentForModeration(title + ' ' + content);
      
      // Auto-categorize post
      const category = this.extractCategory(title, content);

      const newPost = new PeerSupportPost({
        id: uuidv4(),
        title: title.trim(),
        content: content.trim(),
        authorId,
        authorEmail,
        authorName: authorName || 'Anonymous Student',
        category,
        isModerated: moderationCheck.needsModeration,
        isHidden: moderationCheck.riskLevel === 'high', // Hide high-risk posts immediately
        ipAddress,
        userAgent,
        language: language || 'en',
        lastActivityAt: new Date()
      });

      await newPost.save();
      
      console.log('Peer support post created:', newPost.id, 'Category:', category, 'Moderation needed:', moderationCheck.needsModeration);
      
      return {
        post: newPost,
        moderationInfo: moderationCheck
      };
    } catch (error) {
      console.error('Error creating peer support post:', error);
      throw error;
    }
  }

  // Get posts with filtering and pagination
  async getPosts(filters = {}, pagination = { limit: 20, skip: 0 }) {
    try {
      const {
        category,
        sortBy = 'recent', // recent, popular, trending
        showHidden = false,
        authorId
      } = filters;

      const { limit, skip } = pagination;

      // Build query
      const query = {};
      
      if (!showHidden) {
        query.isHidden = false;
      }
      
      if (category && category !== 'all') {
        query.category = category;
      }
      
      if (authorId) {
        query.authorId = authorId;
      }

      // Build sort criteria
      let sortCriteria = {};
      switch (sortBy) {
        case 'popular':
          sortCriteria = { supportCount: -1, replyCount: -1, createdAt: -1 };
          break;
        case 'trending':
          // For trending, we'll use a combination of recent activity and engagement
          sortCriteria = { lastActivityAt: -1, supportCount: -1 };
          break;
        case 'recent':
        default:
          sortCriteria = { isPinned: -1, createdAt: -1 };
          break;
      }

      const posts = await PeerSupportPost.find(query)
        .sort(sortCriteria)
        .limit(limit)
        .skip(skip)
        .select('id title content authorName category supportCount replyCount viewCount createdAt lastActivityAt isPinned isModerated');

      const total = await PeerSupportPost.countDocuments(query);

      return {
        posts: posts.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content,
          authorName: post.authorName,
          category: post.category,
          supportCount: post.supportCount,
          replyCount: post.replyCount,
          viewCount: post.viewCount,
          createdAt: post.createdAt,
          lastActivityAt: post.lastActivityAt,
          isPinned: post.isPinned,
          isModerated: post.isModerated,
          timeAgo: this.getTimeAgo(post.createdAt)
        })),
        total,
        hasMore: total > (skip + posts.length)
      };
    } catch (error) {
      console.error('Error getting peer support posts:', error);
      throw error;
    }
  }

  // Get a single post with full details and replies
  async getPostById(postId, viewerId = null) {
    try {
      const post = await PeerSupportPost.findOne({ id: postId, isHidden: false });
      
      if (!post) {
        return null;
      }

      // Increment view count
      post.viewCount += 1;
      await post.save();

      // Filter out hidden replies
      const visibleReplies = post.replies.filter(reply => !reply.isHidden);

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        authorName: post.authorName,
        category: post.category,
        supportCount: post.supportCount,
        replyCount: visibleReplies.length,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        lastActivityAt: post.lastActivityAt,
        isPinned: post.isPinned,
        isLocked: post.isLocked,
        isModerated: post.isModerated,
        timeAgo: this.getTimeAgo(post.createdAt),
        userHasSupported: viewerId ? post.supportedBy.some(support => support.userId === viewerId) : false,
        replies: visibleReplies.map(reply => ({
          id: reply.id,
          content: reply.content,
          authorName: reply.authorName,
          supportCount: reply.supportCount,
          createdAt: reply.createdAt,
          timeAgo: this.getTimeAgo(reply.createdAt),
          userHasSupported: viewerId ? reply.supportedBy.some(support => support.userId === viewerId) : false,
          isModerated: reply.isModerated
        })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      };
    } catch (error) {
      console.error('Error getting peer support post by ID:', error);
      throw error;
    }
  }

  // Add a reply to a post
  async addReply(postId, replyData) {
    try {
      const { content, authorId, authorEmail, authorName } = replyData;

      const post = await PeerSupportPost.findOne({ id: postId, isHidden: false });
      
      if (!post) {
        throw new Error('Post not found');
      }

      if (post.isLocked) {
        throw new Error('Post is locked for replies');
      }

      // Content moderation check
      const moderationCheck = this.checkContentForModeration(content);

      const newReply = {
        id: uuidv4(),
        content: content.trim(),
        authorId,
        authorEmail,
        authorName: authorName || 'Anonymous Student',
        isModerated: moderationCheck.needsModeration,
        isHidden: moderationCheck.riskLevel === 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      post.replies.push(newReply);
      post.lastActivityAt = new Date();
      await post.save();

      console.log('Reply added to post:', postId, 'Reply ID:', newReply.id, 'Moderation needed:', moderationCheck.needsModeration);

      return {
        reply: {
          id: newReply.id,
          content: newReply.content,
          authorName: newReply.authorName,
          supportCount: newReply.supportCount,
          createdAt: newReply.createdAt,
          timeAgo: this.getTimeAgo(newReply.createdAt),
          isModerated: newReply.isModerated
        },
        moderationInfo: moderationCheck
      };
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  // Toggle support for a post
  async togglePostSupport(postId, userId) {
    try {
      const post = await PeerSupportPost.findOne({ id: postId, isHidden: false });
      
      if (!post) {
        throw new Error('Post not found');
      }

      const existingSupportIndex = post.supportedBy.findIndex(support => support.userId === userId);
      
      if (existingSupportIndex > -1) {
        // Remove support
        post.supportedBy.splice(existingSupportIndex, 1);
        post.supportCount = Math.max(0, post.supportCount - 1);
      } else {
        // Add support
        post.supportedBy.push({
          userId,
          supportedAt: new Date()
        });
        post.supportCount += 1;
      }

      await post.save();

      return {
        supported: existingSupportIndex === -1,
        supportCount: post.supportCount
      };
    } catch (error) {
      console.error('Error toggling post support:', error);
      throw error;
    }
  }

  // Toggle support for a reply
  async toggleReplySupport(postId, replyId, userId) {
    try {
      const post = await PeerSupportPost.findOne({ id: postId, isHidden: false });
      
      if (!post) {
        throw new Error('Post not found');
      }

      const reply = post.replies.id(replyId);
      if (!reply || reply.isHidden) {
        throw new Error('Reply not found');
      }

      const existingSupportIndex = reply.supportedBy.findIndex(support => support.userId === userId);
      
      if (existingSupportIndex > -1) {
        // Remove support
        reply.supportedBy.splice(existingSupportIndex, 1);
        reply.supportCount = Math.max(0, reply.supportCount - 1);
      } else {
        // Add support
        reply.supportedBy.push({
          userId,
          supportedAt: new Date()
        });
        reply.supportCount += 1;
      }

      await post.save();

      return {
        supported: existingSupportIndex === -1,
        supportCount: reply.supportCount
      };
    } catch (error) {
      console.error('Error toggling reply support:', error);
      throw error;
    }
  }

  // Get community statistics
  async getCommunityStats(dateRange = 30) {
    try {
      return await PeerSupportPost.getCommunityStats(dateRange);
    } catch (error) {
      console.error('Error getting community stats:', error);
      throw error;
    }
  }

  // Get trending posts
  async getTrendingPosts(limit = 10) {
    try {
      return await PeerSupportPost.getTrendingPosts(limit);
    } catch (error) {
      console.error('Error getting trending posts:', error);
      throw error;
    }
  }

  // Helper method to format time ago
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  }

  // Admin methods for moderation
  async moderatePost(postId, moderatorId, action, notes = '') {
    try {
      const post = await PeerSupportPost.findOne({ id: postId });
      
      if (!post) {
        throw new Error('Post not found');
      }

      switch (action) {
        case 'approve':
          post.isModerated = true;
          post.isHidden = false;
          break;
        case 'hide':
          post.isHidden = true;
          break;
        case 'pin':
          post.isPinned = true;
          break;
        case 'unpin':
          post.isPinned = false;
          break;
        case 'lock':
          post.isLocked = true;
          break;
        case 'unlock':
          post.isLocked = false;
          break;
      }

      post.moderatedBy = moderatorId;
      post.moderatedAt = new Date();
      post.moderationNotes = notes;

      await post.save();

      return post;
    } catch (error) {
      console.error('Error moderating post:', error);
      throw error;
    }
  }
}

module.exports = PeerSupportService;