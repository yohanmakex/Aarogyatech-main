#!/usr/bin/env node

require('dotenv').config();
const GroqService = require('./services/groqService');

async function testGroqService() {
    console.log('Testing Groq Service...');
    console.log('='.repeat(50));
    
    const groqService = new GroqService();
    
    // Test 1: Check service availability
    console.log('\n1. Checking service availability...');
    const isAvailable = groqService.isServiceAvailable();
    console.log(`Service available: ${isAvailable}`);
    
    if (!isAvailable) {
        console.log('❌ Groq service not available. Please check your GROQ_API_KEY in .env file');
        return;
    }
    
    // Test 2: Get service status
    console.log('\n2. Getting service status...');
    const status = groqService.getServiceStatus();
    console.log('Status:', JSON.stringify(status, null, 2));
    
    // Test 3: Test connection
    console.log('\n3. Testing API connection...');
    try {
        const connectionTest = await groqService.testConnection();
        console.log('Connection test:', JSON.stringify(connectionTest, null, 2));
    } catch (error) {
        console.log('❌ Connection test failed:', error.message);
        return;
    }
    
    // Test 4: Generate a normal response
    console.log('\n4. Testing normal conversation...');
    try {
        const testMessage = "I'm feeling a bit stressed about my upcoming exams. Any advice?";
        console.log(`User: ${testMessage}`);
        
        const response = await groqService.generateResponse(testMessage);
        console.log(`AI: ${response}`);
        
        // Validate the response
        const validation = groqService.validateResponse(response);
        console.log('Validation:', JSON.stringify(validation, null, 2));
        
    } catch (error) {
        console.log('❌ Normal conversation test failed:', error.message);
    }
    
    // Test 5: Test crisis response
    console.log('\n5. Testing crisis response...');
    try {
        const crisisMessage = "I'm having thoughts of hurting myself and don't know what to do";
        console.log(`User: ${crisisMessage}`);
        
        const crisisResponse = await groqService.generateCrisisResponse(crisisMessage, 'high');
        console.log(`AI (Crisis): ${crisisResponse}`);
        
        // Validate the crisis response
        const validation = groqService.validateResponse(crisisResponse);
        console.log('Crisis validation:', JSON.stringify(validation, null, 2));
        
    } catch (error) {
        console.log('❌ Crisis response test failed:', error.message);
    }
    
    // Test 6: Test conversation with history
    console.log('\n6. Testing conversation with history...');
    try {
        const conversationHistory = [
            { role: 'user', content: 'Hi, I\'m feeling anxious lately' },
            { role: 'assistant', content: 'I understand that anxiety can be really challenging. Can you tell me more about what\'s been making you feel anxious?' },
            { role: 'user', content: 'It\'s mainly about my grades and future career' }
        ];
        
        const followUpMessage = "I keep worrying that I'm not good enough";
        console.log(`User: ${followUpMessage}`);
        
        const contextualResponse = await groqService.generateResponse(followUpMessage, conversationHistory);
        console.log(`AI (with context): ${contextualResponse}`);
        
    } catch (error) {
        console.log('❌ Contextual conversation test failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Groq service testing completed!');
}

// Run the test
testGroqService().catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
});