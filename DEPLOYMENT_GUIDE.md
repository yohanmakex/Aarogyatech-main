# AarogyaTech Deployment Guide - Render

This guide will help you deploy your AarogyaTech mental health application on Render.

## Prerequisites

1. **GitHub Account**: Your code should be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **GROQ API Key**: Get your API key from [console.groq.com](https://console.groq.com)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub with all the files:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

### 3. Deploy Using Blueprint (Recommended)

#### Option A: Using render.yaml (Automated)

1. In Render dashboard, click **"New +"** → **"Blueprint"**
2. Connect your GitHub repository
3. Render will automatically detect the `render.yaml` file
4. Click **"Apply"** to create services

#### Option B: Manual Setup

If you prefer manual setup:

1. **Create Web Service**:
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Choose your repository and branch (usually `main`)

2. **Configure Service**:
   - **Name**: `aarogyatech-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

3. **Create Database**:
   - Click **"New +"** → **"PostgreSQL"** or use MongoDB Atlas
   - For MongoDB: Use MongoDB Atlas (free tier available)

### 4. Set Environment Variables

In your Render web service dashboard, go to **Environment** and add:

```
NODE_ENV=production
GROQ_API_KEY=your_groq_api_key_here
MONGODB_URI=your_mongodb_connection_string
ALLOWED_ORIGINS=https://your-app-name.onrender.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. MongoDB Setup Options

#### Option A: MongoDB Atlas (Recommended)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Add to `MONGODB_URI` environment variable

#### Option B: Render PostgreSQL + Mongoose
If you want to use PostgreSQL instead, you'll need to modify the models.

### 6. Deploy

1. Click **"Deploy Latest Commit"** or push new code to trigger auto-deploy
2. Monitor the build logs
3. Once deployed, your app will be available at `https://your-app-name.onrender.com`

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (auto-set by Render) | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `GROQ_API_KEY` | GROQ API key for AI features | `gsk_...` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://your-app.onrender.com` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## Post-Deployment Setup

### 1. Test Your Deployment

Visit your deployed URL and test:
- ✅ Homepage loads
- ✅ API endpoints respond (`/api/status`)
- ✅ Database connection works
- ✅ AI features work (if GROQ_API_KEY is set)

### 2. Initialize Sample Data (Optional)

You can initialize sample data by running:
```bash
# This would need to be done via a one-time script or admin panel
# The setup-peer-support-data.js script can be adapted for production
```

### 3. Monitor Your Application

- Check Render dashboard for logs and metrics
- Monitor database usage
- Set up alerts for downtime

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check build logs in Render dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

2. **Database Connection Issues**
   - Verify `MONGODB_URI` is correct
   - Check MongoDB Atlas network access (allow all IPs: `0.0.0.0/0`)
   - Ensure database user has proper permissions

3. **Environment Variables Not Working**
   - Double-check variable names (case-sensitive)
   - Restart service after adding variables
   - Check for typos in values

4. **CORS Issues**
   - Update `ALLOWED_ORIGINS` with your Render URL
   - Check frontend is making requests to correct backend URL

5. **API Key Issues**
   - Verify GROQ API key is valid
   - Check API key permissions
   - Monitor API usage limits

### Debug Commands

Access logs in Render dashboard or use these endpoints:
- `GET /health` - Health check
- `GET /api/status` - Service status
- `GET /api/error-stats` - Error statistics

## Performance Optimization

### Free Tier Limitations
- Service sleeps after 15 minutes of inactivity
- 750 hours/month limit
- Slower cold starts

### Upgrade Considerations
- **Starter Plan ($7/month)**: No sleep, faster performance
- **Pro Plan ($25/month)**: More resources, better for production

### Optimization Tips
1. **Database Indexing**: Ensure proper indexes in MongoDB
2. **Caching**: Implement Redis caching for frequently accessed data
3. **CDN**: Use Render's CDN for static assets
4. **Monitoring**: Set up application monitoring

## Security Checklist

- ✅ Environment variables set correctly
- ✅ CORS configured properly
- ✅ Rate limiting enabled
- ✅ Helmet security headers active
- ✅ Database access restricted
- ✅ API keys secured
- ✅ No sensitive data in logs

## Maintenance

### Regular Tasks
1. **Monitor Logs**: Check for errors and performance issues
2. **Update Dependencies**: Keep packages up to date
3. **Database Maintenance**: Monitor storage and performance
4. **Backup Data**: Regular database backups
5. **Security Updates**: Apply security patches promptly

### Scaling
- Monitor resource usage in Render dashboard
- Upgrade plan when needed
- Consider database scaling (MongoDB Atlas auto-scaling)
- Implement horizontal scaling if needed

## Support Resources

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **GROQ API**: [console.groq.com/docs](https://console.groq.com/docs)

## Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Repository connected to Render
- [ ] Environment variables configured
- [ ] MongoDB database set up
- [ ] GROQ API key obtained
- [ ] Service deployed and running
- [ ] Basic functionality tested
- [ ] Domain configured (if custom domain needed)

Your AarogyaTech application should now be live and accessible to users worldwide! 🚀