/*
 * AarogyaTech - AI-powered Mental Health Assistant
 * Peer Support API Routes - Community posts and replies endpoints
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

const express = require('express');
const ErrorHandlingMiddleware = require('../middleware/errorHandlingMiddleware');
const PeerSupportService = require('../services/peerSupportService');

const router = express.Router();
const peerSupportService = new PeerSupportService();
const errorMiddleware = new ErrorHandlingMiddleware();
const { wrapAsyncRoute } = errorMiddleware.getMiddleware();

/**
 * POST /api/peer-support/posts
 * Create a new peer support post
 */
router.post('/posts', wrapAsyncRoute(async (req, res) => {
  try {
    const {
      title,
      content,
      authorId,
      authorEmail,
      authorName,
      language = 'en'
    } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title and content are required'
      });
    }

    // Validate content length
    if (title.length > 200) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title must be 200 characters or less'
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content must be 2000 characters or less'
      });
    }

    // Create post data
    const postData = {
      title: title.trim(),
      content: content.trim(),
      authorId: authorId || `anonymous_${Date.now()}`,
      authorEmail: authorEmail || 'anonymous@student.edu',
      authorName: authorName || 'Anonymous Student',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      language
    };

    // Create the post
    const result = await peerSupportService.createPost(postData);

    // Record analytics
    if (req.app.locals.analyticsService) {
      const userId = postData.authorId;
      
      req.app.locals.analyticsService.recordUserInteraction(userId, {
        sessionId: result.post.id,
        type: 'peer_support_post',
        messageLength: content.length,
        responseTime: 0,
        sentiment: null,
        topics: ['peer-support', 'community', result.post.category],
        crisisDetected: result.moderationInfo.riskLevel === 'high',
        language: language,
        success: true,
        statusCode: 201,
        endpoint: '/api/peer-support/posts',
        method: 'POST'
      });
    }

    // Response based on moderation status
    let responseMessage = 'Post created successfully';
    let statusCode = 201;

    if (result.moderationInfo.needsModeration) {
      if (result.moderationInfo.riskLevel === 'high') {
        responseMessage = 'Post submitted for review due to content concerns. Our team will review it shortly.';
        statusCode = 202; // Accepted but pending review
      } else {
        responseMessage = 'Post created and flagged for moderation review.';
      }
    }

    res.status(statusCode).json({
      success: true,
      message: responseMessage,
      post: {
        id: result.post.id,
        title: result.post.title,
        content: result.post.content,
        authorName: result.post.authorName,
        category: result.post.category,
        supportCount: result.post.supportCount,
        replyCount: result.post.replyCount,
        createdAt: result.post.createdAt,
        isModerated: result.post.isModerated,
        isHidden: result.post.isHidden
      },
      moderation: {
        needsReview: result.moderationInfo.needsModeration,
        riskLevel: result.moderationInfo.riskLevel
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/peer-support/posts
 * Get peer support posts with filtering and pagination
 */
router.get('/posts', wrapAsyncRoute(async (req, res) => {
  try {
    const {
      category = 'all',
      sortBy = 'recent',
      limit = 20,
      skip = 0,
      authorId
    } = req.query;

    // Validate parameters
    const validSortBy = ['recent', 'popular', 'trending'];
    if (!validSortBy.includes(sortBy)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid sortBy parameter. Must be: recent, popular, or trending'
      });
    }

    const validCategories = ['all', 'general', 'academic', 'anxiety', 'depression', 'relationships', 'success-story', 'advice-needed'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid category parameter'
      });
    }

    const filters = {
      category,
      sortBy,
      authorId: authorId || null
    };

    const pagination = {
      limit: Math.min(parseInt(limit), 50), // Max 50 posts per request
      skip: parseInt(skip)
    };

    const result = await peerSupportService.getPosts(filters, pagination);

    res.status(200).json({
      success: true,
      posts: result.posts,
      pagination: {
        total: result.total,
        limit: pagination.limit,
        skip: pagination.skip,
        hasMore: result.hasMore
      },
      filters: {
        category,
        sortBy
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/peer-support/posts/:id
 * Get a specific post with full details and replies
 */
router.get('/posts/:id', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId } = req.query;

    const post = await peerSupportService.getPostById(id, viewerId);

    if (!post) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Post not found'
      });
    }

    res.status(200).json({
      success: true,
      post: post
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * POST /api/peer-support/posts/:id/replies
 * Add a reply to a post
 */
router.post('/posts/:id/replies', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      content,
      authorId,
      authorEmail,
      authorName
    } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content is required'
      });
    }

    // Validate content length
    if (content.length > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Reply content must be 1000 characters or less'
      });
    }

    const replyData = {
      content: content.trim(),
      authorId: authorId || `anonymous_${Date.now()}`,
      authorEmail: authorEmail || 'anonymous@student.edu',
      authorName: authorName || 'Anonymous Student'
    };

    const result = await peerSupportService.addReply(id, replyData);

    // Record analytics
    if (req.app.locals.analyticsService) {
      const userId = replyData.authorId;
      
      req.app.locals.analyticsService.recordUserInteraction(userId, {
        sessionId: result.reply.id,
        type: 'peer_support_reply',
        messageLength: content.length,
        responseTime: 0,
        sentiment: null,
        topics: ['peer-support', 'community', 'reply'],
        crisisDetected: result.moderationInfo.riskLevel === 'high',
        language: 'en',
        success: true,
        statusCode: 201,
        endpoint: `/api/peer-support/posts/${id}/replies`,
        method: 'POST'
      });
    }

    // Response based on moderation status
    let responseMessage = 'Reply added successfully';
    let statusCode = 201;

    if (result.moderationInfo.needsModeration) {
      if (result.moderationInfo.riskLevel === 'high') {
        responseMessage = 'Reply submitted for review due to content concerns.';
        statusCode = 202;
      } else {
        responseMessage = 'Reply added and flagged for moderation review.';
      }
    }

    res.status(statusCode).json({
      success: true,
      message: responseMessage,
      reply: result.reply,
      moderation: {
        needsReview: result.moderationInfo.needsModeration,
        riskLevel: result.moderationInfo.riskLevel
      }
    });

  } catch (error) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Post not found'
      });
    }
    if (error.message === 'Post is locked for replies') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This post is locked and cannot receive new replies'
      });
    }
    throw error;
  }
}));

/**
 * POST /api/peer-support/posts/:id/support
 * Toggle support for a post
 */
router.post('/posts/:id/support', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User ID is required'
      });
    }

    const result = await peerSupportService.togglePostSupport(id, userId);

    res.status(200).json({
      success: true,
      message: result.supported ? 'Support added' : 'Support removed',
      supported: result.supported,
      supportCount: result.supportCount
    });

  } catch (error) {
    if (error.message === 'Post not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Post not found'
      });
    }
    throw error;
  }
}));

/**
 * POST /api/peer-support/posts/:postId/replies/:replyId/support
 * Toggle support for a reply
 */
router.post('/posts/:postId/replies/:replyId/support', wrapAsyncRoute(async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User ID is required'
      });
    }

    const result = await peerSupportService.toggleReplySupport(postId, replyId, userId);

    res.status(200).json({
      success: true,
      message: result.supported ? 'Support added' : 'Support removed',
      supported: result.supported,
      supportCount: result.supportCount
    });

  } catch (error) {
    if (error.message === 'Post not found' || error.message === 'Reply not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    throw error;
  }
}));

/**
 * GET /api/peer-support/stats
 * Get community statistics
 */
router.get('/stats', wrapAsyncRoute(async (req, res) => {
  try {
    const { dateRange = 30 } = req.query;
    
    const stats = await peerSupportService.getCommunityStats(parseInt(dateRange));

    res.status(200).json({
      success: true,
      stats: stats,
      period: {
        days: parseInt(dateRange),
        from: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/peer-support/trending
 * Get trending posts
 */
router.get('/trending', wrapAsyncRoute(async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const trendingPosts = await peerSupportService.getTrendingPosts(parseInt(limit));

    res.status(200).json({
      success: true,
      posts: trendingPosts,
      count: trendingPosts.length
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/peer-support/categories
 * Get available categories
 */
router.get('/categories', wrapAsyncRoute(async (req, res) => {
  try {
    const categories = [
      { id: 'all', name: 'All Posts', description: 'View all community posts' },
      { id: 'general', name: 'General', description: 'General discussions and topics' },
      { id: 'academic', name: 'Academic', description: 'Study, exams, and academic stress' },
      { id: 'anxiety', name: 'Anxiety', description: 'Anxiety and panic-related discussions' },
      { id: 'depression', name: 'Depression', description: 'Depression and mood-related topics' },
      { id: 'relationships', name: 'Relationships', description: 'Friends, family, and dating' },
      { id: 'success-story', name: 'Success Stories', description: 'Share your victories and progress' },
      { id: 'advice-needed', name: 'Advice Needed', description: 'Seeking guidance and support' }
    ];

    res.status(200).json({
      success: true,
      categories: categories
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;