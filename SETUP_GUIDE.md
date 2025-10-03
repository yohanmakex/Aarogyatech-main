# 🚀 Quick Setup Guide

## Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Get Your Free Groq API Key
1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up for a free account
3. Go to "API Keys" section
4. Click "Create API Key"
5. Copy the key (starts with `gsk_`)

### Step 3: Configure Your Environment
```bash
# Option A: Automated setup (recommended)
npm run setup

# Option B: Manual setup
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### Step 4: Start the Application
```bash
npm start
```

Visit `http://localhost:3000` and you're ready to go!

## 🔧 Troubleshooting

### AI Not Working?
1. **Check your API key**: Make sure `GROQ_API_KEY` is set in `.env`
2. **Test the connection**: Run `npm run test-groq`
3. **Validate responses**: Run `npm run test-ai-validation`

### Mobile Interface Issues?
1. **Clear browser cache** and reload
2. **Test on different devices** - visit `http://localhost:3000/mobile-test.html`
3. **Check responsive design** by resizing your browser window

### Common Error Messages

#### "Groq service not configured"
- **Solution**: Add your Groq API key to `.env` file
- **Command**: `npm run setup` to configure automatically

#### "Lacks supportive language"
- **Solution**: This should be fixed now. Run `npm run test-ai-validation` to verify
- **If still occurring**: Restart the server with `npm start`

#### "Service Unavailable"
- **Solution**: Check your internet connection and Groq service status
- **Command**: `npm run test-groq` to test connectivity

## 📱 Mobile Optimization Features

✅ **Responsive Design**: Works on all screen sizes  
✅ **Touch-Friendly**: Large buttons and touch targets  
✅ **Voice Support**: Full speech-to-text and text-to-speech  
✅ **PWA Ready**: Install as mobile app  
✅ **Offline Indicators**: Clear connection status  

## 🧪 Testing Your Setup

### Test AI Functionality
```bash
npm run test-groq          # Test Groq API connection
npm run test-ai-validation # Test response validation
```

### Test Mobile Features
Visit `http://localhost:3000/mobile-test.html` to test:
- Responsive design
- Touch targets
- Mobile performance
- Device features

## 🆘 Need Help?

### Quick Fixes
1. **Restart the server**: `Ctrl+C` then `npm start`
2. **Clear cache**: Delete `node_modules` and run `npm install`
3. **Reset config**: Delete `.env` and run `npm run setup`

### Get Support
- **Email**: rajiv.magadum@gmail.com
- **Documentation**: Check `README.md` and `TROUBLESHOOTING.md`
- **Issues**: Create a GitHub issue with error details

## 🎯 What's Working Now

✅ **AI Integration**: Fixed validation issues  
✅ **Mobile Interface**: Fully responsive design  
✅ **Voice Features**: Speech-to-text and text-to-speech  
✅ **Crisis Detection**: Automatic crisis intervention  
✅ **Multi-language**: English and Marathi support  
✅ **Privacy**: Data anonymization and encryption  

## 🚀 Ready to Use!

Your AarogyaTech AI mental health assistant is now ready to provide:
- Empathetic AI conversations
- Mental health screening tools
- Crisis detection and resources
- Mobile-optimized interface
- Voice interaction capabilities

**Demo Login**: Use any email/password for student access, or `admin`/`admin123` for admin access.

---

**Remember**: This is a support tool, not a replacement for professional mental health care. In crisis situations, always seek immediate professional help.