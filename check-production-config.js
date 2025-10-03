/**
 * Production Configuration Checker
 * Verifies that all required environment variables are set for production
 */

require('dotenv').config();

function checkProductionConfig() {
  console.log('🔧 Checking Production Configuration...\n');

  const requiredVars = [
    'NODE_ENV',
    'MONGODB_URI',
    'GROQ_API_KEY'
  ];

  const optionalVars = [
    'PORT',
    'ALLOWED_ORIGINS',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS'
  ];

  let allGood = true;

  console.log('📋 Required Environment Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName === 'GROQ_API_KEY' || varName === 'MONGODB_URI' ? '[HIDDEN]' : value}`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      allGood = false;
    }
  });

  console.log('\n📋 Optional Environment Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️  ${varName}: Using default`);
    }
  });

  console.log('\n🔍 Configuration Analysis:');
  
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ NODE_ENV is set to production');
  } else {
    console.log('⚠️  NODE_ENV is not set to production');
  }

  // Check MongoDB URI format
  if (process.env.MONGODB_URI) {
    if (process.env.MONGODB_URI.includes('mongodb://') || process.env.MONGODB_URI.includes('mongodb+srv://')) {
      console.log('✅ MongoDB URI format looks correct');
    } else {
      console.log('❌ MongoDB URI format may be incorrect');
      allGood = false;
    }
  }

  // Check GROQ API Key format
  if (process.env.GROQ_API_KEY) {
    if (process.env.GROQ_API_KEY.startsWith('gsk_')) {
      console.log('✅ GROQ API Key format looks correct');
    } else {
      console.log('⚠️  GROQ API Key format may be incorrect (should start with gsk_)');
    }
  }

  console.log('\n📊 Summary:');
  if (allGood) {
    console.log('🎉 Configuration looks good for production deployment!');
  } else {
    console.log('❌ Some required configuration is missing. Please fix before deploying.');
  }

  console.log('\n📝 Deployment Checklist:');
  console.log('□ All required environment variables set');
  console.log('□ MongoDB database created and accessible');
  console.log('□ GROQ API key is valid and has credits');
  console.log('□ CORS origins configured for your domain');
  console.log('□ Code pushed to GitHub repository');
  console.log('□ Render service created and configured');

  return allGood;
}

if (require.main === module) {
  const isReady = checkProductionConfig();
  process.exit(isReady ? 0 : 1);
}

module.exports = checkProductionConfig;