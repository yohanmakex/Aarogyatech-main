#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function checkQwenAvailability() {
    console.log('Checking Qwen model availability across different providers...');
    console.log('='.repeat(60));
    
    // Check Hugging Face for Qwen models
    console.log('\n1. Checking Hugging Face Inference API...');
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (hfApiKey) {
        const qwenModels = [
            'Qwen/Qwen2.5-32B-Instruct',
            'Qwen/Qwen2-72B-Instruct', 
            'Qwen/Qwen-32B-Chat',
            'Qwen/Qwen2.5-7B-Instruct'
        ];
        
        for (const model of qwenModels) {
            try {
                console.log(`Testing HF model: ${model}`);
                const response = await axios.post(
                    `https://api-inference.huggingface.co/models/${model}`,
                    { inputs: "Hello, this is a test." },
                    {
                        headers: {
                            'Authorization': `Bearer ${hfApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
                
                if (response.status === 200) {
                    console.log(`✅ ${model} - AVAILABLE on Hugging Face`);
                } else {
                    console.log(`❌ ${model} - Response status: ${response.status}`);
                }
            } catch (error) {
                if (error.response?.status === 503) {
                    console.log(`⏳ ${model} - Model loading (available but not ready)`);
                } else if (error.response?.status === 404) {
                    console.log(`❌ ${model} - NOT FOUND on Hugging Face`);
                } else {
                    console.log(`⚠️ ${model} - Error: ${error.message}`);
                }
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } else {
        console.log('❌ No Hugging Face API key found');
    }
    
    // Check other providers
    console.log('\n2. Other API Providers for Qwen:');
    console.log('   - Alibaba Cloud (Qwen official): https://dashscope.aliyun.com/');
    console.log('   - Together AI: https://api.together.xyz/');
    console.log('   - Replicate: https://replicate.com/');
    console.log('   - OpenRouter: https://openrouter.ai/');
    
    console.log('\n3. Recommendations:');
    console.log('   Option 1: Use Hugging Face API with Qwen models');
    console.log('   Option 2: Use Together AI or OpenRouter for Qwen access');
    console.log('   Option 3: Use Qwen official API (Alibaba Cloud DashScope)');
    console.log('   Option 4: Continue with Groq Llama 3.1 (best available on Groq)');
    
    console.log('\n' + '='.repeat(60));
}

checkQwenAvailability().catch(error => {
    console.error('Check failed:', error.message);
});