/**
 * Setup script to add sample peer support data
 * Run with: node setup-peer-support-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const PeerSupportPost = require('./models/peerSupport');

const samplePosts = [
  {
    id: 'sample_1',
    title: 'Dealing with Exam Anxiety',
    content: 'I\'ve been struggling with severe anxiety before exams. My heart races and I can\'t focus. Has anyone found techniques that actually work?',
    authorId: 'student_1',
    authorEmail: 'student1@university.edu',
    authorName: 'Anonymous Student',
    category: 'anxiety',
    supportCount: 12,
    supportedBy: [
      { userId: 'user_1', supportedAt: new Date() },
      { userId: 'user_2', supportedAt: new Date() }
    ],
    replies: [
      {
        id: 'reply_1',
        content: 'Deep breathing exercises really helped me. Try the 4-7-8 technique: breathe in for 4, hold for 7, exhale for 8.',
        authorId: 'student_2',
        authorEmail: 'student2@university.edu',
        authorName: 'Helpful Student',
        supportCount: 5,
        supportedBy: [{ userId: 'user_3', supportedAt: new Date() }],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: 'sample_2',
    title: 'Feeling Overwhelmed with Course Load',
    content: 'Taking 6 courses this semester and working part-time. I feel like I\'m drowning. Any advice on time management?',
    authorId: 'student_3',
    authorEmail: 'student3@university.edu',
    authorName: 'Anonymous Student',
    category: 'academic',
    supportCount: 8,
    supportedBy: [
      { userId: 'user_4', supportedAt: new Date() }
    ],
    replies: [
      {
        id: 'reply_2',
        content: 'I use a planner and break everything into small tasks. Also, don\'t be afraid to ask for extensions if you need them!',
        authorId: 'student_4',
        authorEmail: 'student4@university.edu',
        authorName: 'Organized Student',
        supportCount: 3,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      },
      {
        id: 'reply_3',
        content: 'Same situation here! What helped me was prioritizing assignments by due date and difficulty. You got this! 💪',
        authorId: 'student_5',
        authorEmail: 'student5@university.edu',
        authorName: 'Supportive Peer',
        supportCount: 2,
        createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    lastActivityAt: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: 'sample_3',
    title: 'Success Story: Overcoming Social Anxiety',
    content: 'Just wanted to share that I finally joined a study group after months of avoiding social situations. Small steps really do work!',
    authorId: 'student_6',
    authorEmail: 'student6@university.edu',
    authorName: 'Anonymous Student',
    category: 'success-story',
    supportCount: 24,
    supportedBy: [
      { userId: 'user_5', supportedAt: new Date() },
      { userId: 'user_6', supportedAt: new Date() },
      { userId: 'user_7', supportedAt: new Date() }
    ],
    replies: [
      {
        id: 'reply_4',
        content: 'This is so inspiring! I\'ve been struggling with the same thing. How did you take that first step?',
        authorId: 'student_7',
        authorEmail: 'student7@university.edu',
        authorName: 'Inspired Student',
        supportCount: 1,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      },
      {
        id: 'reply_5',
        content: 'Congratulations! That takes real courage. You should be proud of yourself! 🎉',
        authorId: 'student_8',
        authorEmail: 'student8@university.edu',
        authorName: 'Cheerleader',
        supportCount: 6,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
      }
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    lastActivityAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
  },
  {
    id: 'sample_4',
    title: 'Struggling with Loneliness on Campus',
    content: 'I\'m a transfer student and finding it hard to make friends. Everyone seems to already have their groups. Any tips for connecting with people?',
    authorId: 'student_9',
    authorEmail: 'student9@university.edu',
    authorName: 'Anonymous Student',
    category: 'relationships',
    supportCount: 15,
    supportedBy: [
      { userId: 'user_8', supportedAt: new Date() },
      { userId: 'user_9', supportedAt: new Date() }
    ],
    replies: [],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    lastActivityAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
  },
  {
    id: 'sample_5',
    title: 'Tips for Better Sleep During Finals',
    content: 'Finals are coming up and my sleep schedule is completely messed up. I know I need sleep to perform well, but I\'m too stressed to fall asleep. What works for you?',
    authorId: 'student_10',
    authorEmail: 'student10@university.edu',
    authorName: 'Anonymous Student',
    category: 'general',
    supportCount: 7,
    supportedBy: [
      { userId: 'user_10', supportedAt: new Date() }
    ],
    replies: [
      {
        id: 'reply_6',
        content: 'Try the sleep hygiene basics: no screens 1 hour before bed, keep your room cool, and maybe try some chamomile tea.',
        authorId: 'student_11',
        authorEmail: 'student11@university.edu',
        authorName: 'Sleep Expert',
        supportCount: 4,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    ],
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  }
];

async function setupPeerSupportData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aarogyatech';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await PeerSupportPost.deleteMany({});
    console.log('🗑️  Cleared existing peer support posts');

    // Insert sample data
    await PeerSupportPost.insertMany(samplePosts);
    console.log('📝 Inserted sample peer support posts');

    // Update reply counts
    for (const post of samplePosts) {
      await PeerSupportPost.updateOne(
        { id: post.id },
        { replyCount: post.replies.length }
      );
    }
    console.log('🔄 Updated reply counts');

    console.log('\n🎉 Peer support sample data setup complete!');
    console.log(`📊 Created ${samplePosts.length} posts with replies`);
    
    // Display summary
    const stats = await PeerSupportPost.getCommunityStats(30);
    console.log('\n📈 Community Stats:');
    console.log(`- Total Posts: ${stats.totalPosts}`);
    console.log(`- Total Replies: ${stats.totalReplies}`);
    console.log(`- Total Supports: ${stats.totalSupports}`);

  } catch (error) {
    console.error('❌ Error setting up peer support data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run setup
setupPeerSupportData();