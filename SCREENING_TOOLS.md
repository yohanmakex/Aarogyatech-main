# Mental Health Screening Tools - Implementation Guide

## Overview

This implementation adds comprehensive mental health screening capabilities to the MindCare AI backend, including:

- **PHQ-9**: Patient Health Questionnaire for depression screening
- **GAD-7**: Generalized Anxiety Disorder 7-item scale
- **GHQ-12**: General Health Questionnaire for psychological distress

## Features

### Core Functionality
- ✅ Complete screening assessments with real-time scoring
- ✅ Crisis detection and intervention protocols
- ✅ Multiple scoring methods (standard and binary for GHQ-12)
- ✅ Result interpretation with severity levels
- ✅ Treatment and follow-up recommendations
- ✅ Data privacy and anonymization
- ✅ Conversational AI integration for contextual recommendations

### Security & Privacy
- ✅ Automatic data anonymization
- ✅ Configurable data retention (30-day TTL)
- ✅ Hashed IP addresses and user agents
- ✅ Crisis event logging and monitoring
- ✅ Response validity assessment

## API Endpoints

### Base URL: `/api/screening`

#### 1. Get Available Tools
```http
GET /api/screening/tools
```
Returns list of all available screening tools.

#### 2. Get Tool Details
```http
GET /api/screening/tools/{toolName}
```
Returns detailed information about a specific screening tool including questions and response options.

**Example:** `GET /api/screening/tools/PHQ-9`

#### 3. Process Assessment
```http
POST /api/screening/assess
```
Processes a completed screening assessment and returns results with interpretation.

**Request Body:**
```json
{
  "toolName": "PHQ-9",
  "responses": {
    "phq9_1": 2,
    "phq9_2": 1,
    "phq9_3": 3,
    // ... all 9 responses
  },
  "sessionId": "optional-session-id",
  "options": {
    "scoringMethod": "standard"
  }
}
```

#### 4. Get Recommendations
```http
POST /api/screening/recommend
```
Get screening tool recommendations based on symptoms or context.

**Request Body:**
```json
{
  "symptoms": ["depression", "anxiety"],
  "purpose": "initial",
  "riskLevel": "medium"
}
```

#### 5. Interpret Score
```http
POST /api/screening/interpret
```
Interpret a raw score without processing full assessment.

#### 6. Validate Responses
```http
POST /api/screening/validate
```
Validate screening responses without processing.

#### 7. Get Crisis Resources
```http
GET /api/screening/crisis-resources
```
Returns crisis intervention resources and contact information.

#### 8. Service Status
```http
GET /api/screening/status
```
Returns screening service status and capabilities.

#### 9. Help Documentation
```http
GET /api/screening/help
```
Returns comprehensive help information about the screening tools.

## Screening Tools Details

### PHQ-9 (Depression)
- **Questions:** 9 items
- **Timeframe:** Past 2 weeks
- **Scoring:** 0-27 points
- **Clinical Cutoff:** 10
- **Severity Levels:**
  - 0-4: Minimal depression
  - 5-9: Mild depression
  - 10-14: Moderate depression
  - 15-19: Moderately severe depression
  - 20-27: Severe depression

### GAD-7 (Anxiety)
- **Questions:** 7 items
- **Timeframe:** Past 2 weeks
- **Scoring:** 0-21 points
- **Clinical Cutoff:** 10
- **Severity Levels:**
  - 0-4: Minimal anxiety
  - 5-9: Mild anxiety
  - 10-14: Moderate anxiety
  - 15-21: Severe anxiety

### GHQ-12 (General Distress)
- **Questions:** 12 items
- **Timeframe:** Past few weeks
- **Scoring:** 0-36 points (standard) or 0-12 (binary)
- **Clinical Cutoff:** 12 (standard) or 3 (binary)
- **Severity Levels:**
  - 0-11: No psychological distress
  - 12-15: Mild psychological distress
  - 16-20: Moderate psychological distress
  - 21-36: Severe psychological distress

## Crisis Detection

### Crisis Indicators
- **Suicidal ideation:** Any positive response to PHQ-9 item 9
- **Severe depression:** PHQ-9 score ≥ 20
- **Severe anxiety:** GAD-7 score ≥ 15
- **Severe distress:** GHQ-12 score ≥ 21

### Crisis Resources
- **Emergency Services:** 911
- **National Suicide Prevention Lifeline:** 988
- **Crisis Text Line:** Text HOME to 741741
- **Emergency Room:** Visit nearest emergency room

## Conversational AI Integration

The system includes intelligent screening recommendations based on:

### Symptom Detection
- **Depression keywords:** sad, hopeless, worthless, tired, sleep problems
- **Anxiety keywords:** anxious, worried, panic, restless, racing thoughts
- **Stress keywords:** overwhelmed, pressure, burned out, can't cope

### Context Analysis
- **Session history patterns:** Recurring symptoms, escalating severity
- **Multi-domain symptoms:** Indicators across multiple mental health areas
- **User preferences:** Direct requests for specific assessments

### Recommendation Engine
- Analyzes conversation context
- Suggests appropriate screening tools
- Provides gentle, supportive recommendations
- Interprets results in conversational format

## Database Schema

### Collections
- **screeningAssessments**: Individual assessment records
- **screeningStatistics**: Aggregated daily statistics
- **userScreeningHistory**: User history (with consent)

### Data Retention
- **Default TTL:** 30 days for assessment records
- **Privacy:** IP addresses and user agents are hashed
- **Anonymization:** Automatic PII detection and anonymization

## Usage Examples

### Complete PHQ-9 Assessment
```javascript
// 1. Get tool questions
const toolResponse = await fetch('/api/screening/tools/PHQ-9');
const tool = await toolResponse.json();

// 2. Present questions to user and collect responses
const responses = {
  "phq9_1": 2, // Several days
  "phq9_2": 1, // Several days
  "phq9_3": 3, // Nearly every day
  // ... collect all 9 responses
};

// 3. Process assessment
const assessmentResponse = await fetch('/api/screening/assess', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolName: 'PHQ-9',
    responses: responses,
    sessionId: 'user-session-123'
  })
});

const results = await assessmentResponse.json();
console.log('Assessment results:', results.assessment);
```

### Get Recommendations Based on Symptoms
```javascript
const recommendResponse = await fetch('/api/screening/recommend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symptoms: ['depression', 'sleep problems'],
    purpose: 'initial'
  })
});

const recommendations = await recommendResponse.json();
console.log('Recommended tools:', recommendations.recommendations);
```

## Integration with Existing Services

The screening tools are integrated with:

- **Error Handling Middleware**: Consistent error responses
- **Analytics Service**: Usage tracking and statistics
- **Rate Limiting**: Protection against abuse
- **Session Management**: Secure session handling
- **Crisis Detection**: Automatic crisis intervention protocols

## Configuration

### Environment Variables
No additional environment variables required - the screening service works out of the box.

### Database Connection
Uses the existing MongoDB connection through Mongoose schemas.

## Testing the Implementation

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Check service status:**
   ```bash
   curl http://localhost:3000/api/screening/status
   ```

3. **Get available tools:**
   ```bash
   curl http://localhost:3000/api/screening/tools
   ```

4. **Get PHQ-9 questions:**
   ```bash
   curl http://localhost:3000/api/screening/tools/PHQ-9
   ```

## Security Considerations

- All responses are validated before processing
- Crisis detection triggers immediate intervention protocols
- Data is automatically anonymized and has configurable retention
- Rate limiting prevents abuse
- Response validity is assessed to detect invalid patterns

## Future Enhancements

The system is designed to easily accommodate additional screening tools:
- **PSS-10**: Perceived Stress Scale
- **DASS-21**: Depression, Anxiety and Stress Scale
- **PC-PTSD-5**: PTSD screening

## Support and Resources

For questions about the screening tools or implementation:

1. Check the help endpoint: `GET /api/screening/help`
2. Review the crisis resources: `GET /api/screening/crisis-resources`
3. Monitor service status: `GET /api/screening/status`

## Important Disclaimer

These screening tools are for informational purposes only and do not constitute clinical diagnoses. They should be used as part of a comprehensive mental health evaluation by qualified healthcare providers.