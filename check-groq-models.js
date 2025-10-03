#!/usr/bin/env node

require('dotenv').config();
const Groq = require('groq-sdk');

async function checkAvailableModels() {
    console.log('Checking available Groq models...');
    console.log('='.repeat(50));
    
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        console.log('❌ GROQ_API_KEY not found in .env file');
        console.log('Please set up your Groq API key first.');
        return;
    }
    
    const groq = new Groq({ apiKey });
    
    try {
        // Try to list models (if the API supports it)
        console.log('Attempting to fetch available models...');
        
        // Test all possible Qwen and other models on Groq
        const commonModels = [
            // Qwen models (various naming conventions)
            'qwen/qwen2.5-32b-instruct',
            'qwen2.5-32b-instruct', 
            'qwen-2.5-32b-instruct',
            'qwen2-72b-instruct',
            'qwen-72b-instruct',
            'qwen/qwen-32b',
            'qwen32b',
            'qwen-32b',
            'qwen2-32b',
            'qwen2.5-32b',
            
            // Current Groq models
            'llama-3.1-8b-instant',
            'llama-3.1-70b-versatile', 
            'llama3-8b-8192',
            'llama3-70b-8192',
            'mixtral-8x7b-32768',
            'gemma-7b-it',
            'gemma2-9b-it',
            
            // Other possible models
            'claude-3-haiku',
            'gpt-3.5-turbo',
            'phi-3-medium'
        ];
        
        console.log('\nTesting common models...');
        
        for (const model of commonModels) {
            try {
                console.log(`\nTesting model: ${model}`);
                
                const completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello, this is a test message. Please respond briefly.'
                        }
                    ],
                    model: model,
                    max_tokens: 50,
                    temperature: 0.7
                });
                
                if (completion.choices && completion.choices[0]) {
                    console.log(`✅ ${model} - AVAILABLE`);
                    console.log(`   Response: ${completion.choices[0].message.content.substring(0, 100)}...`);
                } else {
                    console.log(`❌ ${model} - Invalid response format`);
                }
                
            } catch (error) {
                if (error.status === 404) {
                    console.log(`❌ ${model} - NOT FOUND`);
                } else if (error.status === 401) {
                    console.log(`❌ Authentication failed - check your API key`);
                    break;
                } else {
                    console.log(`❌ ${model} - ERROR: ${error.message}`);
                }
            }
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
    } catch (error) {
        console.error('Failed to check models:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Model check completed!');
    console.log('\nRecommendation: Use the first available model from the list above.');
}

checkAvailableModels().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});