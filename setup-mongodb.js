/**
 * MongoDB Setup Script for AarogyaTech
 * Run with: node setup-mongodb.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function setupMongoDB() {
    try {
        console.log('🔧 Setting up MongoDB for AarogyaTech...');
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aarogyatech';
        console.log(`📡 Connecting to: ${mongoUri}`);
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB successfully');
        
        // Import models to create collections
        const ScreeningResponse = require('./models/screeningResponse');
        
        // Create indexes
        console.log('📊 Creating database indexes...');
        await ScreeningResponse.createIndexes();
        console.log('✅ Indexes created successfully');
        
        // Test the model
        console.log('🧪 Testing model functionality...');
        const stats = await ScreeningResponse.getStatistics(30);
        console.log('✅ Model test successful:', stats);
        
        console.log('\n🎉 MongoDB setup completed successfully!');
        console.log('📋 Database is ready for screening responses');
        console.log('🚀 You can now start the server with: npm start');
        
    } catch (error) {
        console.error('❌ MongoDB setup failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Troubleshooting tips:');
            console.log('1. Make sure MongoDB is installed and running');
            console.log('2. Check if MongoDB service is started:');
            console.log('   - macOS: brew services start mongodb-community');
            console.log('   - Linux: sudo systemctl start mongod');
            console.log('   - Windows: net start MongoDB');
            console.log('3. Verify MongoDB is listening on port 27017');
            console.log('4. Check your MONGODB_URI in .env file');
        }
        
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run setup
setupMongoDB();