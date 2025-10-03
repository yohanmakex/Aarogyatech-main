#!/usr/bin/env node

/**
 * Test AI Response Validation
 * Tests the AI response validation to ensure it's not too strict
 */

const GroqService = require('./services/groqService');
const MentalHealthContextService = require('./services/mentalHealthContextService');

async function testValidation() {
    console.log('🧪 Testing AI Response Validation');
    console.log('='.repeat(50));

    const groqService = new GroqService();
    const mentalHealthService = new MentalHealthContextService();

    // Test responses that should be valid
    const testResponses = [
        "I understand you're feeling stressed about exams. That's completely normal. Try taking deep breaths.",
        "It sounds like you're going through a difficult time. How are you feeling right now?",
        "Thank you for sharing that with me. What would help you feel better today?",
        "That sounds really challenging. You're brave for reaching out. What's been the hardest part?",
        "I hear you. Sometimes life can feel overwhelming. Would you like to talk about what's bothering you?",
        "Your feelings are completely valid. Many students experience this. What support do you have?",
        "I'm here to listen. It takes courage to open up about these things. How can I help?",
        "That must be tough to deal with. You're not alone in feeling this way. What helps you cope?",
        "I appreciate you telling me about this. It's okay to feel overwhelmed sometimes. What's your biggest concern?",
        "It's natural to feel this way given what you're experiencing. How long have you been feeling like this?"
    ];

    console.log('\n📝 Testing Groq Service Validation:');
    testResponses.forEach((response, index) => {
        const validation = groqService.validateResponse(response);
        const status = validation.isValid ? '✅' : '❌';
        console.log(`${status} Response ${index + 1}: ${validation.isValid ? 'VALID' : 'INVALID'}`);
        if (!validation.isValid) {
            console.log(`   Issues: ${validation.issues.join(', ')}`);
        }
    });

    console.log('\n🧠 Testing Mental Health Context Service Validation:');
    testResponses.forEach((response, index) => {
        const validation = mentalHealthService.validateMentalHealthResponse(response);
        const status = validation.isAppropriate ? '✅' : '❌';
        console.log(`${status} Response ${index + 1}: ${validation.isAppropriate ? 'APPROPRIATE' : 'INAPPROPRIATE'}`);
        if (!validation.isAppropriate) {
            console.log(`   Issues: ${validation.issues.join(', ')}`);
        }
    });

    // Test actual AI generation if API key is available
    if (groqService.isServiceAvailable()) {
        console.log('\n🤖 Testing Live AI Generation:');
        try {
            const testMessage = "I'm feeling really stressed about my upcoming exams and can't sleep.";
            console.log(`Input: "${testMessage}"`);
            
            const aiResponse = await groqService.generateResponse(testMessage);
            console.log(`AI Response: "${aiResponse}"`);
            
            const groqValidation = groqService.validateResponse(aiResponse);
            const mhValidation = mentalHealthService.validateMentalHealthResponse(aiResponse);
            
            console.log(`Groq Validation: ${groqValidation.isValid ? '✅ VALID' : '❌ INVALID'}`);
            if (!groqValidation.isValid) {
                console.log(`   Issues: ${groqValidation.issues.join(', ')}`);
            }
            
            console.log(`MH Validation: ${mhValidation.isAppropriate ? '✅ APPROPRIATE' : '❌ INAPPROPRIATE'}`);
            if (!mhValidation.isAppropriate) {
                console.log(`   Issues: ${mhValidation.issues.join(', ')}`);
            }
            
        } catch (error) {
            console.log(`❌ AI Generation failed: ${error.message}`);
        }
    } else {
        console.log('\n⚠️  Groq API not configured - skipping live AI test');
        console.log('   Set GROQ_API_KEY in .env to test live AI generation');
    }

    console.log('\n📊 Summary:');
    const groqValidCount = testResponses.filter(r => groqService.validateResponse(r).isValid).length;
    const mhValidCount = testResponses.filter(r => mentalHealthService.validateMentalHealthResponse(r).isAppropriate).length;
    
    console.log(`Groq Service: ${groqValidCount}/${testResponses.length} responses passed validation`);
    console.log(`Mental Health Service: ${mhValidCount}/${testResponses.length} responses passed validation`);
    
    if (groqValidCount === testResponses.length && mhValidCount === testResponses.length) {
        console.log('✅ All validation tests passed! AI should work properly now.');
    } else {
        console.log('❌ Some validation tests failed. AI responses may be rejected.');
    }
}

// Run the test
testValidation().catch(console.error);