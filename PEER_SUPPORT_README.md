# Peer Support Feature - Implementation Guide

## Overview

The Peer Support feature allows students to create anonymous posts, reply to others' posts, and show support through a like system. All posts are automatically categorized and moderated for safety.

## Backend Implementation

### Database Model (`models/peerSupport.js`)
- **Posts**: Store community posts with title, content, author info, category, and engagement metrics
- **Replies**: Nested within posts, allowing threaded conversations
- **Support System**: Track who supported each post/reply with timestamps
- **Moderation**: Built-in content moderation with keyword detection and risk assessment

### API Endpoints (`routes/peerSupport.js`)

#### Posts
- `POST /api/peer-support/posts` - Create a new post
- `GET /api/peer-support/posts` - Get posts with filtering (category, sort)
- `GET /api/peer-support/posts/:id` - Get specific post with replies
- `POST /api/peer-support/posts/:id/support` - Toggle support for a post

#### Replies
- `POST /api/peer-support/posts/:id/replies` - Add reply to a post
- `POST /api/peer-support/posts/:postId/replies/:replyId/support` - Toggle support for a reply

#### Utility
- `GET /api/peer-support/categories` - Get available categories
- `GET /api/peer-support/stats` - Get community statistics
- `GET /api/peer-support/trending` - Get trending posts

### Service Layer (`services/peerSupportService.js`)
- **Content Moderation**: Automatic detection of crisis keywords
- **Auto-categorization**: Smart categorization based on content analysis
- **Engagement Tracking**: Support counts, view counts, reply counts
- **Time Formatting**: Human-readable time stamps

## Frontend Implementation

### JavaScript Functions (in `public/index.html`)
- `initializePeerSupport()` - Initialize when section is shown
- `submitPost()` - Create new posts with backend integration
- `loadPeerSupportPosts()` - Fetch and display posts
- `togglePostSupport()` - Handle support interactions
- `showPostDetails()` - Display post modal with replies
- `submitReply()` - Add replies to posts

### UI Features
- **Modal System**: Full-screen post details with replies
- **Real-time Updates**: Support counts update immediately
- **Responsive Design**: Works on mobile and desktop
- **Anonymous Posting**: All posts are anonymous by default
- **Auto-categorization**: Posts are automatically categorized

## Setup Instructions

### 1. Database Setup
Make sure MongoDB is running and connected. The models will be created automatically.

### 2. Install Sample Data
```bash
npm run setup-peer-support
```

### 3. Test the API
```bash
npm run test-peer-support
```

### 4. Start the Server
```bash
npm start
```

## Features

### Content Moderation
- **Keyword Detection**: Automatically flags posts with crisis-related keywords
- **Risk Assessment**: Three levels - low, medium, high
- **Auto-hiding**: High-risk posts are hidden until reviewed
- **Manual Moderation**: Admin tools for post management

### Categories
- **General**: General discussions
- **Academic**: Study, exams, academic stress
- **Anxiety**: Anxiety and panic-related discussions
- **Depression**: Depression and mood-related topics
- **Relationships**: Friends, family, dating
- **Success Story**: Victories and progress sharing
- **Advice Needed**: Seeking guidance and support

### Engagement Features
- **Support System**: Like/unlike posts and replies
- **Reply Threading**: Nested conversations
- **View Tracking**: Track post popularity
- **Time Stamps**: Human-readable time formatting

### Safety Features
- **Anonymous Posting**: All posts are anonymous
- **Content Filtering**: Automatic moderation
- **Crisis Detection**: Flags concerning content
- **Admin Controls**: Moderation tools for staff

## API Usage Examples

### Create a Post
```javascript
const response = await fetch('/api/peer-support/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Need advice on study stress',
    content: 'I\'m feeling overwhelmed with my coursework...',
    authorId: 'user123',
    authorEmail: 'student@university.edu',
    authorName: 'Anonymous Student'
  })
});
```

### Get Posts
```javascript
const response = await fetch('/api/peer-support/posts?category=anxiety&sortBy=recent&limit=20');
const data = await response.json();
```

### Add Reply
```javascript
const response = await fetch(`/api/peer-support/posts/${postId}/replies`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Here\'s what helped me...',
    authorId: 'user456',
    authorName: 'Helpful Student'
  })
});
```

## Database Schema

### Post Document
```javascript
{
  id: "unique_post_id",
  title: "Post title",
  content: "Post content",
  authorId: "user_id",
  authorEmail: "user@email.com",
  authorName: "Display name",
  category: "anxiety|depression|academic|etc",
  supportCount: 0,
  supportedBy: [{ userId: "user_id", supportedAt: Date }],
  replies: [ReplySchema],
  replyCount: 0,
  viewCount: 0,
  isModerated: false,
  isHidden: false,
  isPinned: false,
  isLocked: false,
  lastActivityAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Input Validation**: All inputs are validated and sanitized
2. **Rate Limiting**: API endpoints are rate-limited
3. **Content Moderation**: Automatic flagging of concerning content
4. **Anonymous Data**: No personally identifiable information stored
5. **Crisis Detection**: Immediate flagging of self-harm content

## Monitoring and Analytics

- **Community Stats**: Track engagement and activity
- **Moderation Queue**: Monitor flagged content
- **Usage Analytics**: Track feature adoption
- **Crisis Alerts**: Monitor concerning posts

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live updates
2. **Advanced Moderation**: AI-powered content analysis
3. **User Reputation**: Karma system for helpful contributors
4. **Search Functionality**: Full-text search across posts
5. **Notification System**: Alerts for replies and mentions
6. **Mobile App**: Native mobile application
7. **Multilingual Support**: Support for multiple languages

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure MongoDB is running
2. **Missing Posts**: Check if posts are hidden due to moderation
3. **API Errors**: Check server logs for detailed error messages
4. **Frontend Issues**: Check browser console for JavaScript errors

### Debug Commands
```bash
# Check database connection
node setup-mongodb.js

# Test API endpoints
node test-peer-support.js

# View server logs
npm start

# Reset sample data
npm run setup-peer-support
```

## Support

For issues or questions about the Peer Support feature:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Test API endpoints individually
4. Verify database connectivity

The peer support system is designed to be a safe, anonymous space for students to connect and support each other while maintaining appropriate safeguards and moderation.