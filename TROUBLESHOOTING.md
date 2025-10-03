# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 🤖 AI Not Working

#### Problem: "Groq service not configured" error
**Solution:**
1. Check if you have a `.env` file in the root directory
2. Ensure `GROQ_API_KEY` is set in your `.env` file
3. Get your free API key from [Groq Console](https://console.groq.com/)
4. Run the setup script: `npm run setup`

```bash
# Test your API key
npm run test-groq
```

#### Problem: "Invalid Groq API key" error
**Solution:**
1. Verify your API key starts with `gsk_`
2. Check for extra spaces or characters in your `.env` file
3. Regenerate your API key from Groq Console if needed

#### Problem: AI responses are slow or timing out
**Solution:**
1. Check your internet connection
2. Verify Groq service status at [status.groq.com](https://status.groq.com)
3. Try a different AI model: `npm run check-models`

### 📱 Mobile Interface Issues

#### Problem: Interface not responsive on mobile
**Solution:**
1. Clear browser cache and reload
2. Check if CSS file loaded properly (view source)
3. Try different mobile browsers (Chrome, Safari, Firefox)

#### Problem: Voice features not working on mobile
**Solution:**
1. Ensure microphone permissions are granted
2. Use HTTPS (required for microphone access)
3. Try different browsers - some have better voice support

#### Problem: Text too small on mobile
**Solution:**
1. Check viewport meta tag is present
2. Ensure CSS media queries are loading
3. Try zooming out and back in

### 🔧 Server Issues

#### Problem: Server won't start
**Solution:**
1. Check if port 3000 is already in use
2. Install dependencies: `npm install`
3. Check Node.js version: `node --version` (requires v16+)

```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

#### Problem: "Module not found" errors
**Solution:**
1. Delete `node_modules` and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### 🌐 Network Issues

#### Problem: CORS errors in browser console
**Solution:**
1. Check `ALLOWED_ORIGINS` in your `.env` file
2. Add your domain to the allowed origins list
3. For local development, ensure `http://localhost:3000` is included

#### Problem: API requests failing
**Solution:**
1. Check server is running on correct port
2. Verify API endpoints in browser network tab
3. Check rate limiting settings in `.env`

### 🔒 Authentication Issues

#### Problem: Can't login with demo credentials
**Solution:**
1. Use any email/password combination for student login
2. For admin: `admin`/`admin123` or `counselor`/`counselor123`
3. Clear browser cookies and try again

### 📊 Data Issues

#### Problem: Bookings not saving
**Solution:**
1. Check if `data/bookings.json` file exists and is writable
2. Verify server has write permissions to data directory
3. Check server logs for error messages

#### Problem: Screening results not displaying
**Solution:**
1. Complete all required questions in the screening
2. Check browser console for JavaScript errors
3. Refresh page and try again

## 🚀 Performance Optimization

### Slow Loading
1. **Enable compression**: Server automatically compresses responses
2. **Clear cache**: Browser cache might be outdated
3. **Check network**: Slow internet affects AI response times

### High Memory Usage
1. **Restart server**: `npm start` to clear memory
2. **Check sessions**: Old sessions are automatically cleaned up
3. **Monitor logs**: Look for memory leak indicators

### Audio Issues
1. **Microphone permissions**: Grant access in browser settings
2. **Audio format**: Some browsers prefer different audio formats
3. **Network quality**: Poor connection affects voice processing

## 🔍 Debugging Tools

### Check Service Status
```bash
# Test all services
curl http://localhost:3000/api/status

# Test specific services
curl http://localhost:3000/api/conversational-ai/status
curl http://localhost:3000/health
```

### View Logs
```bash
# Start server with detailed logs
DEBUG=* npm start

# Or check specific components
DEBUG=groq* npm start
```

### Browser Developer Tools
1. **Console**: Check for JavaScript errors
2. **Network**: Monitor API requests and responses
3. **Application**: Check local storage and cookies
4. **Mobile Simulation**: Test responsive design

## 📞 Getting Help

### Before Asking for Help
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Test with different browsers/devices
4. Check server logs for error messages

### How to Report Issues
Include this information:
- Operating system and version
- Browser and version
- Node.js version (`node --version`)
- Error messages (full text)
- Steps to reproduce the issue
- Screenshots if applicable

### Contact Information
- **Email**: rajiv.magadum@gmail.com
- **GitHub Issues**: Create an issue with detailed information
- **Documentation**: Check README.md for additional help

## 🔄 Reset Everything

If all else fails, try a complete reset:

```bash
# Stop server
Ctrl+C

# Clean install
rm -rf node_modules package-lock.json
rm .env
npm install

# Reconfigure
npm run setup

# Restart
npm start
```

This will give you a fresh installation with clean configuration.

---

**💡 Pro Tip**: Most issues are resolved by ensuring your Groq API key is correctly configured and your server is running on the right port with proper permissions.