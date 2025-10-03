const axios = require('axios');
require('dotenv').config();

async function testHuggingFaceAPI() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    const modelUrl = 'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english';
    
    console.log('Testing Hugging Face API...');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
    console.log('Model URL:', modelUrl);
    
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    const payload = {
        inputs: "I love this!"
    };

    try {
        console.log('\nSending request to Hugging Face...');
        const response = await axios.post(modelUrl, payload, {
            headers,
            timeout: 30000
        });
        
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        if (response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
            const fullText = response.data[0].generated_text;
            const assistantResponse = fullText.split('Assistant:').pop().trim();
            console.log('\nExtracted response:', assistantResponse);
        }
        
    } catch (error) {
        console.error('Error:', error.response?.status, error.response?.statusText);
        console.error('Error data:', error.response?.data);
        console.error('Full error:', error.message);
    }
}

testHuggingFaceAPI();