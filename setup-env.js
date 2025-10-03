#!/usr/bin/env node

/**
 * Environment Setup Script for AarogyaTech AI Backend
 * Helps users configure their environment variables, especially GROQ_API_KEY
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🧠 AarogyaTech AI Backend - Environment Setup');
  console.log('='.repeat(50));
  console.log();

  const envPath = path.join(__dirname, '.env');
  let envExists = fs.existsSync(envPath);
  
  if (envExists) {
    console.log('✅ .env file already exists');
    const overwrite = await askQuestion('Do you want to update it? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  } else {
    console.log('📝 Creating new .env file...');
  }

  console.log();
  console.log('🔑 GROQ API Key Setup');
  console.log('To get your free Groq API key:');
  console.log('1. Visit: https://console.groq.com/');
  console.log('2. Sign up or log in');
  console.log('3. Go to API Keys section');
  console.log('4. Create a new API key');
  console.log('5. Copy the key (starts with "gsk_")');
  console.log();

  const groqApiKey = await askQuestion('Enter your Groq API key (or press Enter to skip): ');
  
  if (groqApiKey && !groqApiKey.startsWith('gsk_')) {
    console.log('⚠️  Warning: Groq API keys typically start with "gsk_"');
    const confirm = await askQuestion('Continue anyway? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log();
  const port = await askQuestion('Server port (default: 3000): ') || '3000';
  const nodeEnv = await askQuestion('Environment (development/production, default: development): ') || 'development';

  // Read existing .env or create new content
  let envContent = '';
  if (envExists) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add environment variables
  const envVars = {
    'GROQ_API_KEY': groqApiKey || 'your_groq_api_key_here',
    'PORT': port,
    'NODE_ENV': nodeEnv,
    'ALLOWED_ORIGINS': 'http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500',
    'RATE_LIMIT_WINDOW_MS': '900000',
    'RATE_LIMIT_MAX_REQUESTS': '100',
    'SESSION_TIMEOUT_MS': '1800000',
    'MAX_SESSIONS': '1000',
    'CLEANUP_INTERVAL_MS': '300000',
    'SESSION_ENCRYPTION_KEY': 'your_session_encryption_key_here',
    'DATA_RETENTION_HOURS': '24',
    'ANONYMIZATION_ENABLED': 'true',
    'PRIVACY_ENCRYPTION_KEY': 'your_privacy_encryption_key_here',
    'API_TIMEOUT_MS': '30000',
    'API_MAX_RETRIES': '3',
    'API_RETRY_DELAY_MS': '1000',
    'API_RATE_LIMIT_WINDOW_MS': '60000',
    'API_RATE_LIMIT_MAX': '100',
    'API_ENCRYPTION_ENABLED': 'true',
    'API_SIGNATURE_SECRET': 'your_api_signature_secret_here',
    'TRUSTED_PROXIES': ''
  };

  const lines = envContent.split('\n');
  const updatedLines = [];
  const processedKeys = new Set();

  // Update existing lines
  for (const line of lines) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key] = line.split('=', 1);
      if (envVars.hasOwnProperty(key)) {
        updatedLines.push(`${key}=${envVars[key]}`);
        processedKeys.add(key);
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  // Add new variables
  for (const [key, value] of Object.entries(envVars)) {
    if (!processedKeys.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  // Write the updated .env file
  const finalContent = updatedLines.join('\n');
  fs.writeFileSync(envPath, finalContent);

  console.log();
  console.log('✅ Environment file updated successfully!');
  console.log();

  if (groqApiKey && groqApiKey !== 'your_groq_api_key_here') {
    console.log('🧪 Testing Groq API connection...');
    try {
      // Test the API key
      const { spawn } = require('child_process');
      const testProcess = spawn('node', ['test-groq.js'], { stdio: 'inherit' });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Groq API test successful!');
        } else {
          console.log('❌ Groq API test failed. Please check your API key.');
        }
        
        console.log();
        console.log('🚀 Setup complete! You can now start the server with:');
        console.log('   npm start');
        console.log();
        console.log('📱 The application will be available at:');
        console.log(`   http://localhost:${port}`);
        
        rl.close();
      });
    } catch (error) {
      console.log('⚠️  Could not test API key automatically.');
      console.log('   Run "npm run test-groq" to test manually.');
      console.log();
      console.log('🚀 Setup complete! You can now start the server with:');
      console.log('   npm start');
      
      rl.close();
    }
  } else {
    console.log('⚠️  Remember to update your GROQ_API_KEY in .env file');
    console.log('   Get your free API key at: https://console.groq.com/');
    console.log();
    console.log('🚀 Setup complete! You can now start the server with:');
    console.log('   npm start');
    
    rl.close();
  }
}

main().catch(console.error);