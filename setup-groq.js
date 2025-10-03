#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupGroq() {
  console.log('🧠 MindCare - Groq API Setup');
  console.log('='.repeat(40));
  console.log();
  console.log('This script will help you configure Groq API for the MindCare chatbot.');
  console.log();
  console.log('Steps to get your Groq API key:');
  console.log('1. Visit https://console.groq.com/');
  console.log('2. Sign up or log in to your account');
  console.log('3. Go to API Keys section');
  console.log('4. Create a new API key');
  console.log('5. Copy the API key');
  console.log();

  const apiKey = await question('Enter your Groq API key: ');

  if (!apiKey || apiKey.trim().length === 0) {
    console.log('❌ No API key provided. Setup cancelled.');
    rl.close();
    return;
  }

  if (!apiKey.startsWith('gsk_')) {
    console.log('⚠️  Warning: Groq API keys typically start with "gsk_"');
    const confirm = await question('Continue anyway? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  // Read current .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.log('⚠️  .env file not found, creating new one...');
  }

  // Update or add GROQ_API_KEY
  const lines = envContent.split('\n');
  let keyUpdated = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('GROQ_API_KEY=')) {
      lines[i] = `GROQ_API_KEY=${apiKey.trim()}`;
      keyUpdated = true;
      break;
    }
  }

  if (!keyUpdated) {
    lines.push(`GROQ_API_KEY=${apiKey.trim()}`);
  }

  // Write back to .env file
  try {
    fs.writeFileSync(envPath, lines.join('\n'));
    console.log('✅ Groq API key saved to .env file');
  } catch (error) {
    console.log('❌ Failed to save API key:', error.message);
    rl.close();
    return;
  }

  console.log();
  console.log('🎉 Setup complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Run "node test-groq.js" to test the API connection');
  console.log('2. Start the server with "node server.js"');
  console.log('3. Open http://localhost:3000 in your browser');
  console.log();
  console.log('The chatbot will now use Groq\'s Llama 3.1 70B model for mental health support.');

  rl.close();
}

setupGroq().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});