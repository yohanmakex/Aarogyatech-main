# 🧠 AarogyaTech - AI-powered Mental Health Assistant

**A comprehensive AI-driven mental health support platform designed specifically for students**

---

## 📋 Project Overview

AarogyaTech is an innovative mental health platform that combines artificial intelligence with human counseling services to provide comprehensive mental health support for students. The platform features multilingual support (English/Marathi), voice-to-voice AI interactions, professional counseling booking system, and real-time crisis detection.

### 🎯 Key Features

- **AI Voice Assistant**: Natural voice conversations with AI for mental health support
- **Mobile-First Design**: Fully responsive interface optimized for all devices
- **Counseling Booking System**: Complete appointment booking with counselor matching
- **Mental Health Screening**: Professional-grade screening tools (PHQ-9, GAD-7, GHQ-12)
- **Crisis Detection**: Real-time identification and intervention for mental health crises
- **Admin Dashboard**: Comprehensive management interface for counselors and administrators
- **Multilingual Support**: Full English and Marathi language support
- **Data Analytics**: Advanced analytics for mental health trends and usage patterns
- **PWA Ready**: Install as mobile app with offline capabilities

### 🛠 Technology Stack

- **Backend**: Node.js, Express.js
- **AI Integration**: Groq API with Llama models
- **Database**: JSON file storage (easily configurable for MongoDB)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Voice Processing**: Web Speech API, Text-to-Speech
- **Real-time Features**: WebSocket integration
- **Security**: JWT authentication, rate limiting, CORS protection

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- NPM or Yarn package manager
- Groq API key (for AI functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aarogyatech
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   # Option 1: Automated setup (recommended)
   npm run setup
   
   # Option 2: Manual setup
   cp .env.example .env
   # Edit .env file with your Groq API key
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**
   - Student Interface: http://localhost:3000
   - Admin Dashboard: http://localhost:3000/admin-dashboard.html

### 🔐 Admin Access

**Demo Credentials:**
- Administrator: `admin` / `admin123`
- Counselor: `counselor` / `counselor123`

## 📊 Core Functionality

### Student Features
- **AI Chat Support**: Voice and text-based mental health conversations
- **Mental Health Screening**: Self-assessment tools with instant results
- **Counseling Booking**: Easy appointment scheduling with preferred counselors
- **Resource Library**: Comprehensive mental health resources and exercises
- **Peer Support**: Anonymous community support forum

### Admin/Counselor Features
- **Dashboard Analytics**: Real-time usage and mental health trend analysis
- **Booking Management**: Complete appointment lifecycle management
- **User Monitoring**: Live session monitoring with crisis alert system
- **Report Generation**: Comprehensive reporting and data export
- **Crisis Response**: Immediate intervention tools for emergency situations

### API Endpoints

#### Booking Management
```
POST   /api/booking/appointments     # Create new booking
GET    /api/booking/appointments     # List all bookings (with filters)
GET    /api/booking/appointments/:id # Get specific booking
PUT    /api/booking/appointments/:id/status # Update booking status
DELETE /api/booking/appointments/:id # Cancel booking
GET    /api/booking/availability     # Check availability
GET    /api/booking/stats           # Get booking statistics
```

#### Mental Health Screening
```
POST   /api/screening/submit        # Submit screening results
GET    /api/screening/history       # Get screening history
GET    /api/screening/analytics     # Get screening analytics
```

#### AI Conversation
```
POST   /api/conversational-ai/chat  # Send message to AI
POST   /api/speech-to-text         # Convert speech to text
POST   /api/text-to-speech         # Convert text to speech
```

## 📁 Project Structure

```
aarogyatech/
├── server.js                    # Main server file
├── package.json                 # Project configuration
├── LICENSE                      # MIT License
├── COPYRIGHT                    # Copyright notice
├── README.md                    # Project documentation
├── config/
│   └── config.js               # Application configuration
├── routes/
│   ├── booking.js              # Booking API routes
│   ├── screening.js            # Mental health screening routes
│   ├── conversationalAI.js     # AI chat routes
│   └── ...                     # Other API routes
├── services/
│   ├── bookingService.js       # Booking business logic
│   ├── conversationalAIService.js # AI integration service
│   └── ...                     # Other services
├── middleware/
│   ├── authMiddleware.js       # Authentication middleware
│   ├── errorHandlingMiddleware.js # Error handling
│   └── ...                     # Other middleware
├── public/
│   ├── index.html              # Student interface
│   ├── admin-dashboard.html    # Admin interface
│   ├── styles.css              # Main styles
│   ├── admin-dashboard.js      # Admin functionality
│   └── ...                     # Static assets
└── data/
    └── bookings.json          # Booking data storage
```

## 🎨 User Interface

### Student Interface
- **Modern Design**: Clean, accessible interface with mental health focus
- **Voice Integration**: Seamless voice-to-voice interactions
- **Mobile-First**: Fully responsive design with touch-optimized controls
- **PWA Features**: Install as mobile app, offline support
- **Multilingual**: Complete English/Marathi language support
- **Accessibility**: WCAG compliant with screen reader support

### Admin Dashboard
- **Real-time Analytics**: Live charts and statistics
- **Comprehensive Management**: Full booking and user management
- **Crisis Alerts**: Immediate notifications for urgent situations
- **Export Capabilities**: Data export in multiple formats

## 🔒 Security & Privacy

- **Data Encryption**: All sensitive data encrypted in transit and at rest
- **Anonymous Options**: Complete anonymity available for sensitive bookings
- **HIPAA Compliant**: Designed with healthcare privacy standards in mind
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive input sanitization and validation

## 📈 Analytics & Monitoring

- **Usage Analytics**: Detailed usage patterns and trends
- **Mental Health Metrics**: Sentiment analysis and crisis detection rates
- **Performance Monitoring**: Real-time system performance tracking
- **Custom Reports**: Configurable reporting for different stakeholders

## 🌐 Multilingual Support

- **English**: Complete interface and AI responses
- **Marathi (मराठी)**: Full localization for regional users
- **Extensible**: Architecture supports additional languages

## 🤝 Contributing

This is a proprietary project. For contribution guidelines or collaboration opportunities, please contact the author.

## 📞 Support & Contact

For technical support, feature requests, or general inquiries:

**Rajiv Magadum**
- Email: rajiv.magadum@gmail.com
- LinkedIn: [Rajiv Magadum](https://linkedin.com/in/rajivmagadum)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Mental health professionals who provided guidance on clinical best practices
- Students who participated in user testing and feedback sessions
- Open-source communities for the underlying technologies
- Groq for providing AI infrastructure

---

## ⚡ Quick Start Commands

```bash
# Interactive setup (recommended for first-time users)
npm run setup

# Start development server
npm run dev

# Test Groq AI connection
npm run test-groq

# Check available AI models
npm run check-models

# Run tests
npm test

# Test booking functionality
node test-booking.js
```

## 📱 Mobile Optimization Features

### Responsive Design
- **Breakpoints**: Optimized for mobile (480px), tablet (768px), and desktop
- **Touch Targets**: Minimum 44px tap targets for accessibility
- **Viewport**: Prevents zoom on input focus (iOS)
- **Orientation**: Automatic layout adjustment for landscape/portrait

### Performance
- **Lazy Loading**: Progressive content loading for faster initial load
- **Audio Optimization**: Efficient voice processing and playback
- **Caching**: Smart response caching for offline functionality
- **Compression**: Optimized assets for mobile networks

### User Experience
- **Voice Controls**: Large, accessible voice interaction buttons
- **Swipe Gestures**: Natural mobile navigation patterns
- **Keyboard Handling**: Smart input positioning to avoid keyboard overlap
- **Offline Indicators**: Clear connection status and offline capabilities

### PWA Features
- **App Installation**: Install as native mobile app
- **Offline Support**: Core features work without internet
- **Push Notifications**: Crisis alerts and appointment reminders
- **Background Sync**: Sync data when connection is restored

---

**© 2025 Rajiv Magadum. All rights reserved.**

*AarogyaTech is committed to improving student mental health through innovative technology solutions.*
