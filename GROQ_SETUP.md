# 🧠 MindCare - Groq API Setup Guide

MindCare now uses **Groq's Llama 3.1 70B** model for enhanced mental health conversations. This guide will help you set up the Groq API integration.

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)
```bash
npm run setup-groq
```

### Option 2: Manual Setup

1. **Get your Groq API key:**
   - Visit [Groq Console](https://console.groq.com/)
   - Sign up or log in to your account
   - Navigate to "API Keys" section
   - Create a new API key
   - Copy the API key (starts with `gsk_`)

2. **Configure the API key:**
   - Open the `.env` file in your project root
   - Add or update the following line:
   ```
   GROQ_API_KEY=gsk_your_actual_api_key_here
   ```

3. **Test the connection:**
   ```bash
   npm run test-groq
   ```

4. **Check available models (optional):**
   ```bash
   npm run check-models
   ```

## 🧪 Testing

After setup, you can test the Groq integration:

```bash
# Test Groq API connection and responses
npm run test-groq

# Start the server
npm start
```

## 🔧 Configuration

### Model Settings
- **Primary Model**: `llama-3.1-8b-instant` (Llama 3.1 8B - fast and reliable)
- **Fallback Model**: `gemma2-9b-it` (Gemma2 9B - alternative option)
- **Max Tokens**: 300 (normal) / 150 (crisis responses) - optimized for concise, helpful responses
- **Temperature**: 0.7 (normal) / 0.3 (crisis responses)
- **Top P**: 0.9

**Note**: Using confirmed available Groq models. Qwen models are not available on Groq platform. The system uses Llama 3.1 8B with optimized prompts for concise, effective mental health support.

### Features
- ✅ Mental health-focused conversations
- ✅ Crisis detection and specialized responses
- ✅ Context-aware conversations
- ✅ Safety-prioritized responses
- ✅ Response validation
- ✅ Fallback mechanisms

## 🛡️ Safety Features

The Groq integration includes several safety measures:

1. **Response Validation**: All responses are validated for appropriateness
2. **Crisis Detection**: Specialized handling for crisis situations
3. **Mental Health Focus**: System prompts optimized for mental health support
4. **Fallback Responses**: Backup responses if AI generation fails
5. **Content Filtering**: Prevents harmful or inappropriate responses

## 🔄 Migration from Hugging Face

The system automatically falls back to enhanced mental health responses if Groq is unavailable. The Hugging Face integration is now deprecated but remains as a backup.

### Key Improvements with Groq:
- **Better Context Understanding**: Llama 3.1 70B provides more nuanced responses
- **Improved Safety**: Better crisis detection and appropriate responses
- **Faster Response Times**: Groq's infrastructure is optimized for speed
- **More Natural Conversations**: Advanced language model capabilities
- **Enhanced Mental Health Support**: Specialized prompts for mental health contexts

## 🚨 Troubleshooting

### Common Issues:

1. **"Groq service not configured"**
   - Check that `GROQ_API_KEY` is set in your `.env` file
   - Ensure the API key starts with `gsk_`
   - Verify the API key is valid on Groq Console

2. **"Rate limit exceeded"**
   - Groq has rate limits on API usage
   - The system will automatically retry with exponential backoff
   - Consider upgrading your Groq plan for higher limits

3. **"Invalid API key"**
   - Double-check your API key in the `.env` file
   - Regenerate the API key on Groq Console if needed

4. **Connection timeouts**
   - Check your internet connection
   - Groq servers might be experiencing issues
   - The system will fall back to enhanced responses

5. **"Model not found"**
   - The system automatically tries multiple model names
   - Run `npm run check-models` to see available models
   - The system will fall back to available models automatically

### Getting Help:

- Run `npm run test-groq` to diagnose issues
- Run `npm run check-models` to see available models
- Check the server logs for detailed error messages
- Ensure your `.env` file is properly configured

## 📊 Monitoring

The system provides detailed logging and monitoring:

- Response validation results
- API call success/failure rates
- Crisis detection events
- Fallback usage statistics

Check the server console for real-time monitoring information.

## 🔐 Security & Privacy

- API keys are stored securely in environment variables
- All conversations are processed with privacy protection
- No personal data is sent to Groq beyond the conversation context
- Crisis situations are handled with appropriate escalation

---

**Need help?** Run `npm run setup-groq` for guided setup or check the server logs for detailed error information.