/**
 * Test script for Peer Support API endpoints
 * Run with: node test-peer-support.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/peer-support';

async function testPeerSupportAPI() {
  console.log('🧪 Testing Peer Support API...\n');

  try {
    // Test 1: Create a new post
    console.log('1. Testing POST /posts');
    const postResponse = await axios.post(`${BASE_URL}/posts`, {
      title: 'Test Post - Dealing with Study Stress',
      content: 'I\'ve been feeling overwhelmed with my coursework lately. Anyone have tips for managing study stress?',
      authorId: 'test_user_1',
      authorEmail: 'test@student.edu',
      authorName: 'Test Student',
      language: 'en'
    });
    
    console.log('✅ Post created:', postResponse.data.post.id);
    const postId = postResponse.data.post.id;

    // Test 2: Get all posts
    console.log('\n2. Testing GET /posts');
    const postsResponse = await axios.get(`${BASE_URL}/posts`);
    console.log('✅ Retrieved posts:', postsResponse.data.posts.length);

    // Test 3: Get specific post
    console.log('\n3. Testing GET /posts/:id');
    const postDetailResponse = await axios.get(`${BASE_URL}/posts/${postId}?viewerId=test_user_2`);
    console.log('✅ Post details retrieved:', postDetailResponse.data.post.title);

    // Test 4: Add a reply
    console.log('\n4. Testing POST /posts/:id/replies');
    const replyResponse = await axios.post(`${BASE_URL}/posts/${postId}/replies`, {
      content: 'I found that breaking tasks into smaller chunks really helps! Also, taking regular breaks is important.',
      authorId: 'test_user_2',
      authorEmail: 'test2@student.edu',
      authorName: 'Helpful Student'
    });
    console.log('✅ Reply added:', replyResponse.data.reply.id);

    // Test 5: Toggle support for post
    console.log('\n5. Testing POST /posts/:id/support');
    const supportResponse = await axios.post(`${BASE_URL}/posts/${postId}/support`, {
      userId: 'test_user_3'
    });
    console.log('✅ Support toggled:', supportResponse.data.supported, 'Count:', supportResponse.data.supportCount);

    // Test 6: Get categories
    console.log('\n6. Testing GET /categories');
    const categoriesResponse = await axios.get(`${BASE_URL}/categories`);
    console.log('✅ Categories retrieved:', categoriesResponse.data.categories.length);

    // Test 7: Get community stats
    console.log('\n7. Testing GET /stats');
    const statsResponse = await axios.get(`${BASE_URL}/stats`);
    console.log('✅ Stats retrieved:', JSON.stringify(statsResponse.data.stats, null, 2));

    // Test 8: Get posts by category
    console.log('\n8. Testing GET /posts?category=academic');
    const academicPostsResponse = await axios.get(`${BASE_URL}/posts?category=academic&sortBy=recent`);
    console.log('✅ Academic posts retrieved:', academicPostsResponse.data.posts.length);

    console.log('\n🎉 All tests passed! Peer Support API is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 500) {
      console.log('\n💡 This might be a database connection issue. Make sure MongoDB is running.');
    }
  }
}

// Run tests
testPeerSupportAPI();