const EventEmitter = require('events');

class CrisisDetectionService extends EventEmitter {
  constructor() {
    super();
    
    // Crisis keywords organized by severity levels
    this.crisisKeywords = {
      // Immediate danger - highest priority
      immediate: [
        'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
        'going to die', 'planning to die', 'ready to die', 'time to die',
        'hurt myself', 'harm myself', 'cut myself', 'cutting myself', 'cutting',
        'overdose', 'pills', 'jump off', 'hanging', 'rope', 'gun',
        'bridge', 'cliff', 'poison', 'blade', 'razor'
      ],
      
      // High risk - requires immediate attention
      high: [
        'worthless', 'hopeless', 'can\'t go on', 'better off dead',
        'no point living', 'life is meaningless', 'give up', 'can\'t take it',
        'too much pain', 'unbearable', 'desperate', 'trapped',
        'no way out', 'end it all', 'disappear forever'
      ],
      
      // Moderate risk - needs support and monitoring
      moderate: [
        'depressed', 'depression', 'anxiety attack', 'panic attack',
        'breakdown', 'mental breakdown', 'losing it', 'going crazy',
        'can\'t cope', 'overwhelmed', 'stressed out', 'breaking down',
        'falling apart', 'need help please', 'crisis'
      ],
      
      // Self-harm indicators
      selfHarm: [
        'self harm', 'self-harm', 'burning myself', 'hitting myself',
        'scratching', 'picking', 'pulling hair', 'starving myself',
        'not eating', 'binge eating', 'purging', 'throwing up'
      ]
    };
    
    // Crisis response templates by severity
    this.crisisResponses = {
      immediate: [
        "I'm very concerned about what you're sharing. Your safety is the most important thing right now. Please reach out for immediate help:\n\n🚨 **Emergency Services: 911**\n📞 **National Suicide Prevention Lifeline: 988**\n💬 **Crisis Text Line: Text HOME to 741741**\n\nYou don't have to go through this alone. There are people who want to help you.",
        
        "What you're feeling right now is temporary, even though it doesn't feel that way. Please reach out for immediate support:\n\n🚨 **If you're in immediate danger: Call 911**\n📞 **Suicide & Crisis Lifeline: 988 (24/7)**\n💬 **Text HOME to 741741 for crisis support**\n\nYour life has value, and there are people trained to help you through this crisis.",
        
        "I hear that you're in tremendous pain right now. Please don't face this alone - reach out for immediate help:\n\n🚨 **Emergency: 911**\n📞 **National Suicide Prevention Lifeline: 988**\n💬 **Crisis Text Line: Text HOME to 741741**\n\nThese feelings can change with proper support. Please reach out now."
      ],
      
      high: [
        "I'm concerned about how you're feeling. These thoughts and feelings are signs that you need support right now. Please consider reaching out:\n\n📞 **National Suicide Prevention Lifeline: 988**\n💬 **Crisis Text Line: Text HOME to 741741**\n🏥 **Campus Counseling Center: [Contact Info]**\n\nYou're not alone in this, and these feelings can improve with help.",
        
        "Thank you for sharing something so difficult with me. What you're experiencing sounds overwhelming, but there is help available:\n\n📞 **Suicide & Crisis Lifeline: 988 (24/7)**\n💬 **Text HOME to 741741**\n👥 **NAMI Helpline: 1-800-950-6264**\n\nPlease reach out to one of these resources. You deserve support.",
        
        "I hear how much pain you're in right now. These feelings are a signal that you need additional support:\n\n📞 **Crisis Support: 988**\n💬 **Text Crisis Line: 741741**\n🏥 **Local Emergency Room**\n\nPlease don't wait - reach out for help today."
      ],
      
      moderate: [
        "It sounds like you're going through a really difficult time. I want you to know that what you're feeling is valid, and there are people who can help:\n\n📞 **SAMHSA Helpline: 1-800-662-4357**\n💬 **Crisis Text Line: Text HOME to 741741**\n🏥 **Campus Counseling Services**\n\nWould you like to talk about some coping strategies that might help right now?",
        
        "I can hear that you're struggling, and I'm glad you're reaching out. That takes courage. Here are some resources that might help:\n\n📞 **Mental Health Support: 1-800-662-4357**\n💬 **Crisis Text Line: 741741**\n🧘 **Crisis support and coping strategies available 24/7**\n\nRemember, seeking help is a sign of strength, not weakness."
      ],
      
      selfHarm: [
        "I'm concerned about the self-harm you've mentioned. Your safety and wellbeing matter. Please consider reaching out for support:\n\n📞 **National Suicide Prevention Lifeline: 988**\n💬 **Crisis Text Line: Text HOME to 741741**\n🏥 **Campus Health Services**\n\nSelf-harm might feel like it helps in the moment, but there are healthier ways to cope with difficult emotions. Would you like to explore some alternatives?",
        
        "Thank you for trusting me with this. Self-harm is often a way of coping with overwhelming emotions, but there are safer alternatives that can help:\n\n📞 **Crisis Support: 988**\n💬 **Text HOME to 741741**\n🧘 **Alternative coping strategies available**\n\nYou deserve care and support. Please reach out to one of these resources."
      ]
    };
    
    // Crisis resources database
    this.crisisResources = [
      {
        name: 'National Suicide Prevention Lifeline',
        phoneNumber: '988',
        website: 'https://suicidepreventionlifeline.org',
        availability: '24/7',
        type: 'emergency',
        description: 'Free and confidential emotional support for people in suicidal crisis or emotional distress',
        languages: ['English', 'Spanish']
      },
      {
        name: 'Crisis Text Line',
        phoneNumber: 'Text HOME to 741741',
        website: 'https://www.crisistextline.org',
        availability: '24/7',
        type: 'emergency',
        description: 'Free, 24/7 support for those in crisis via text message',
        languages: ['English', 'Spanish']
      },
      {
        name: 'SAMHSA National Helpline',
        phoneNumber: '1-800-662-4357',
        website: 'https://www.samhsa.gov/find-help/national-helpline',
        availability: '24/7',
        type: 'counseling',
        description: 'Treatment referral and information service for mental health and substance abuse',
        languages: ['English', 'Spanish']
      },
      {
        name: 'National Alliance on Mental Illness (NAMI)',
        phoneNumber: '1-800-950-6264',
        website: 'https://www.nami.org',
        availability: 'Mon-Fri 10am-10pm ET',
        type: 'peer-support',
        description: 'Support, education and advocacy for individuals and families affected by mental illness',
        languages: ['English', 'Spanish']
      },
      {
        name: 'Trans Lifeline',
        phoneNumber: '877-565-8860',
        website: 'https://translifeline.org',
        availability: '24/7',
        type: 'emergency',
        description: 'Crisis support specifically for transgender individuals',
        languages: ['English', 'Spanish']
      },
      {
        name: 'LGBT National Hotline',
        phoneNumber: '1-888-843-4564',
        website: 'https://www.lgbthotline.org',
        availability: 'Mon-Fri 4pm-12am ET, Sat 12pm-5pm ET',
        type: 'peer-support',
        description: 'Confidential support for LGBTQ+ individuals',
        languages: ['English']
      },
      {
        name: 'Veterans Crisis Line',
        phoneNumber: '1-800-273-8255 (Press 1)',
        website: 'https://www.veteranscrisisline.net',
        availability: '24/7',
        type: 'emergency',
        description: 'Crisis support specifically for veterans and their families',
        languages: ['English', 'Spanish']
      }
    ];
    
    // Session tracking for escalation
    this.sessions = new Map();
    this.escalationThresholds = {
      immediateCount: 1, // Any immediate crisis keyword triggers escalation
      highCount: 2,      // 2 high-risk detections in session
      moderateCount: 3,  // 3 moderate detections in session
      timeWindow: 30 * 60 * 1000 // 30 minutes
    };
  }

  /**
   * Analyze message for crisis indicators
   * @param {string} message - User's message
   * @param {string} sessionId - Session identifier
   * @returns {Object} Crisis analysis result
   */
  analyzeMessage(message, sessionId) {
    if (!message || typeof message !== 'string') {
      return { isCrisis: false, severity: 'none', keywords: [], response: null };
    }

    const lowerMessage = message.toLowerCase();
    const detectedKeywords = [];
    let highestSeverity = 'none';
    
    // Check each severity level - order matters for priority
    const severityLevels = ['immediate', 'selfHarm', 'high', 'moderate'];
    
    for (const severity of severityLevels) {
      const keywords = this.crisisKeywords[severity];
      const foundKeywords = keywords.filter(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
      );
      
      if (foundKeywords.length > 0) {
        detectedKeywords.push(...foundKeywords);
        // Only update severity if this is higher priority (earlier in array)
        if (highestSeverity === 'none') {
          highestSeverity = severity;
        }
      }
    }
    
    const isCrisis = detectedKeywords.length > 0;
    
    if (isCrisis) {
      // Update session tracking
      this._updateSessionTracking(sessionId, highestSeverity, detectedKeywords);
      
      // Check for escalation
      const escalationLevel = this._checkEscalation(sessionId, highestSeverity);
      
      // Generate appropriate response
      const response = this._generateCrisisResponse(highestSeverity, escalationLevel);
      
      // Emit crisis event for logging/monitoring
      this.emit('crisisDetected', {
        sessionId,
        severity: highestSeverity,
        keywords: detectedKeywords,
        message: message.substring(0, 100), // First 100 chars for context
        timestamp: new Date(),
        escalationLevel
      });
      
      return {
        isCrisis: true,
        severity: highestSeverity,
        keywords: detectedKeywords,
        response,
        escalationLevel,
        resources: this._getRelevantResources(highestSeverity)
      };
    }
    
    return { isCrisis: false, severity: 'none', keywords: [], response: null };
  }

  /**
   * Get crisis resources filtered by type and severity
   * @param {string} severity - Crisis severity level
   * @param {string} resourceType - Type of resource needed
   * @returns {Array} Relevant crisis resources
   */
  getCrisisResources(severity = 'all', resourceType = 'all') {
    let resources = [...this.crisisResources];
    
    // Filter by severity
    if (severity === 'immediate' || severity === 'high' || severity === 'selfHarm') {
      resources = resources.filter(r => r.type === 'emergency');
    }
    
    // Filter by type
    if (resourceType !== 'all') {
      resources = resources.filter(r => r.type === resourceType);
    }
    
    return resources;
  }

  /**
   * Create crisis escalation workflow
   * @param {string} sessionId - Session identifier
   * @param {string} severity - Crisis severity
   * @returns {Object} Escalation workflow
   */
  createEscalationWorkflow(sessionId, severity) {
    const workflow = {
      sessionId,
      severity,
      timestamp: new Date(),
      steps: []
    };
    
    switch (severity) {
      case 'immediate':
        workflow.steps = [
          {
            action: 'display_emergency_resources',
            priority: 'critical',
            message: 'Show emergency contacts immediately'
          },
          {
            action: 'log_crisis_event',
            priority: 'high',
            message: 'Log for crisis monitoring'
          },
          {
            action: 'offer_emergency_contact',
            priority: 'high',
            message: 'Offer to help contact emergency services'
          }
        ];
        break;
        
      case 'high':
        workflow.steps = [
          {
            action: 'display_crisis_resources',
            priority: 'high',
            message: 'Show crisis support resources'
          },
          {
            action: 'log_crisis_event',
            priority: 'medium',
            message: 'Log for monitoring'
          },
          {
            action: 'follow_up_check',
            priority: 'medium',
            message: 'Schedule follow-up check in 15 minutes'
          }
        ];
        break;
        
      case 'moderate':
        workflow.steps = [
          {
            action: 'display_support_resources',
            priority: 'medium',
            message: 'Show mental health support resources'
          },
          {
            action: 'offer_coping_strategies',
            priority: 'medium',
            message: 'Provide immediate coping techniques'
          }
        ];
        break;
        
      case 'selfHarm':
        workflow.steps = [
          {
            action: 'display_crisis_resources',
            priority: 'high',
            message: 'Show crisis support and self-harm resources'
          },
          {
            action: 'offer_alternatives',
            priority: 'high',
            message: 'Provide healthy coping alternatives'
          },
          {
            action: 'log_crisis_event',
            priority: 'medium',
            message: 'Log self-harm indication'
          }
        ];
        break;
    }
    
    return workflow;
  }

  /**
   * Clear session data
   * @param {string} sessionId - Session identifier
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Get session crisis history
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session crisis data
   */
  getSessionCrisisHistory(sessionId) {
    return this.sessions.get(sessionId) || {
      crisisEvents: [],
      severityCounts: { immediate: 0, high: 0, moderate: 0, selfHarm: 0 },
      lastCrisisTime: null,
      escalationLevel: 0
    };
  }

  /**
   * Update session tracking for crisis patterns
   * @param {string} sessionId - Session identifier
   * @param {string} severity - Crisis severity
   * @param {Array} keywords - Detected keywords
   * @private
   */
  _updateSessionTracking(sessionId, severity, keywords) {
    let sessionData = this.sessions.get(sessionId) || {
      crisisEvents: [],
      severityCounts: { immediate: 0, high: 0, moderate: 0, selfHarm: 0 },
      lastCrisisTime: null,
      escalationLevel: 0
    };
    
    const now = new Date();
    
    // Add crisis event
    sessionData.crisisEvents.push({
      severity,
      keywords,
      timestamp: now
    });
    
    // Update severity counts
    sessionData.severityCounts[severity]++;
    sessionData.lastCrisisTime = now;
    
    // Clean old events (outside time window)
    const cutoffTime = now.getTime() - this.escalationThresholds.timeWindow;
    sessionData.crisisEvents = sessionData.crisisEvents.filter(
      event => event.timestamp.getTime() > cutoffTime
    );
    
    // Recalculate severity counts from remaining events
    sessionData.severityCounts = { immediate: 0, high: 0, moderate: 0, selfHarm: 0 };
    sessionData.crisisEvents.forEach(event => {
      sessionData.severityCounts[event.severity]++;
    });
    
    this.sessions.set(sessionId, sessionData);
  }

  /**
   * Check if crisis situation requires escalation
   * @param {string} sessionId - Session identifier
   * @param {string} currentSeverity - Current crisis severity
   * @returns {number} Escalation level (0-3)
   * @private
   */
  _checkEscalation(sessionId, currentSeverity) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return 0;
    
    const counts = sessionData.severityCounts;
    
    // Level 3: Immediate danger
    if (counts.immediate >= this.escalationThresholds.immediateCount) {
      sessionData.escalationLevel = 3;
      return 3;
    }
    
    // Level 2: High risk pattern
    if (counts.high >= this.escalationThresholds.highCount || 
        (counts.high >= 1 && counts.moderate >= 2)) {
      sessionData.escalationLevel = Math.max(sessionData.escalationLevel, 2);
      return sessionData.escalationLevel;
    }
    
    // Level 1: Moderate concern pattern
    if (counts.moderate >= this.escalationThresholds.moderateCount ||
        counts.selfHarm >= 2) {
      sessionData.escalationLevel = Math.max(sessionData.escalationLevel, 1);
      return sessionData.escalationLevel;
    }
    
    return sessionData.escalationLevel;
  }

  /**
   * Generate appropriate crisis response based on severity and escalation
   * @param {string} severity - Crisis severity
   * @param {number} escalationLevel - Escalation level
   * @returns {string} Crisis response message
   * @private
   */
  _generateCrisisResponse(severity, escalationLevel) {
    const responses = this.crisisResponses[severity] || this.crisisResponses.moderate;
    let response = responses[Math.floor(Math.random() * responses.length)];
    
    // Add escalation-specific messaging
    if (escalationLevel >= 3) {
      response += "\n\n⚠️ **This appears to be an emergency situation. Please contact emergency services immediately or go to your nearest emergency room.**";
    } else if (escalationLevel >= 2) {
      response += "\n\n⚠️ **I'm noticing a pattern of concerning thoughts. Please consider reaching out to a crisis counselor today.**";
    }
    
    return response;
  }

  /**
   * Get relevant resources based on crisis severity
   * @param {string} severity - Crisis severity
   * @returns {Array} Relevant resources
   * @private
   */
  _getRelevantResources(severity) {
    switch (severity) {
      case 'immediate':
        return this.crisisResources.filter(r => r.type === 'emergency');
      case 'high':
        return this.crisisResources.filter(r => r.type === 'emergency' || r.type === 'counseling');
      case 'selfHarm':
        return this.crisisResources.filter(r => r.type === 'emergency' || r.type === 'counseling');
      default:
        return this.crisisResources.filter(r => r.type !== 'emergency').slice(0, 3);
    }
  }

  /**
   * Get numeric severity level for comparison
   * @param {string} severity - Severity string
   * @returns {number} Numeric severity level
   * @private
   */
  _getSeverityLevel(severity) {
    const levels = { none: 0, moderate: 1, selfHarm: 2, high: 3, immediate: 4 };
    return levels[severity] || 0;
  }
}

module.exports = CrisisDetectionService;