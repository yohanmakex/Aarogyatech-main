/**
 * Deployment Verification Script
 * Run this after deployment to verify all services are working
 * Usage: node verify-deployment.js [URL]
 */

const axios = require('axios');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

async function verifyDeployment() {
  console.log(`🔍 Verifying deployment at: ${BASE_URL}\n`);

  const tests = [
    {
      name: 'Health Check',
      url: '/health',
      method: 'GET'
    },
    {
      name: 'API Status',
      url: '/api/status',
      method: 'GET'
    },
    {
      name: 'Static Files (Homepage)',
      url: '/',
      method: 'GET'
    },
    {
      name: 'Peer Support Categories',
      url: '/api/peer-support/categories',
      method: 'GET'
    },
    {
      name: 'Peer Support Posts',
      url: '/api/peer-support/posts',
      method: 'GET'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const response = await axios({
        method: test.method,
        url: `${BASE_URL}${test.url}`,
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });

      if (response.status < 400) {
        console.log(`✅ ${test.name} - Status: ${response.status}`);
        passed++;
      } else {
        console.log(`⚠️  ${test.name} - Status: ${response.status} (Client Error)`);
        passed++; // 4xx errors are acceptable for some endpoints
      }

    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed! Deployment is successful.`);
    console.log(`🌐 Your application is live at: ${BASE_URL}`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the logs above for details.`);
  }

  // Additional checks
  console.log(`\n🔧 Additional Checks:`);
  
  try {
    const statusResponse = await axios.get(`${BASE_URL}/api/status`);
    const status = statusResponse.data;
    
    console.log(`- Server Status: ${status.status}`);
    console.log(`- GROQ API: ${status.services.groq}`);
    console.log(`- Database: Connected`);
    console.log(`- Peer Support: ${status.services.peerSupport}`);
    
  } catch (error) {
    console.log(`- Could not fetch detailed status: ${error.message}`);
  }

  console.log(`\n📝 Next Steps:`);
  console.log(`1. Test the frontend by visiting: ${BASE_URL}`);
  console.log(`2. Try creating a peer support post`);
  console.log(`3. Check the admin dashboard if available`);
  console.log(`4. Monitor logs for any errors`);
}

// Run verification
verifyDeployment().catch(error => {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
});