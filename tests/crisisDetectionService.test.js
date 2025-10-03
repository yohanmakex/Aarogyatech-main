const CrisisDetectionService = require('../services/crisisDetectionService');

describe('CrisisDetectionService', () => {
  let crisisService;

  beforeEach(() => {
    crisisService = new CrisisDetectionService();
  });

  afterEach(() => {
    // Clean up any sessions
    crisisService.sessions.clear();
  });

  describe('Crisis Detection', () => {
    test('should detect immediate crisis keywords', () => {
      const testMessages = [
        'I want to kill myself',
        'I am going to end my life',
        'I want to die',
        'I am planning to hurt myself'
      ];

      testMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('immediate');
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.response).toContain('988');
      });
    });

    test('should detect high risk keywords', () => {
      const testMessages = [
        'I feel worthless',
        'Life is hopeless',
        'I can\'t go on anymore',
        'I am desperate'
      ];

      testMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.keywords.length).toBeGreaterThan(0);
      });
    });

    test('should detect moderate risk keywords', () => {
      const testMessages = [
        'I am feeling very depressed',
        'I am having a panic attack',
        'I am completely overwhelmed',
        'I am having a mental breakdown'
      ];

      testMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('moderate');
        expect(result.keywords.length).toBeGreaterThan(0);
      });
    });

    test('should detect self-harm keywords', () => {
      const testMessages = [
        'I am self harming',
        'I keep scratching myself',
        'I am not eating anything for days',
        'I have been purging after meals'
      ];

      testMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('selfHarm');
        expect(result.keywords.length).toBeGreaterThan(0);
      });
    });

    test('should not detect crisis in normal messages', () => {
      const testMessages = [
        'Hello, how are you?',
        'Can you help me with my homework?',
        'I had a good day at school',
        'What is the weather like today?'
      ];

      testMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(false);
        expect(result.severity).toBe('none');
        expect(result.keywords.length).toBe(0);
      });
    });
  });

  describe('Escalation Management', () => {
    test('should escalate immediate crisis situations', () => {
      const result = crisisService.analyzeMessage('I want to kill myself', 'escalation-test');
      expect(result.escalationLevel).toBe(3);
    });

    test('should track multiple crisis events in session', () => {
      const sessionId = 'multi-crisis-test';
      
      // First high-risk message
      crisisService.analyzeMessage('I feel hopeless', sessionId);
      
      // Second high-risk message should escalate
      const result = crisisService.analyzeMessage('I am worthless', sessionId);
      expect(result.escalationLevel).toBeGreaterThanOrEqual(2);
    });

    test('should create escalation workflow for immediate crisis', () => {
      const workflow = crisisService.createEscalationWorkflow('test-session', 'immediate');
      
      expect(workflow.severity).toBe('immediate');
      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].action).toBe('display_emergency_resources');
      expect(workflow.steps[0].priority).toBe('critical');
    });
  });

  describe('Crisis Resources', () => {
    test('should return emergency resources for immediate crisis', () => {
      const resources = crisisService.getCrisisResources('immediate');
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.every(r => r.type === 'emergency')).toBe(true);
    });

    test('should return all resources when no filter specified', () => {
      const resources = crisisService.getCrisisResources();
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.some(r => r.type === 'emergency')).toBe(true);
      expect(resources.some(r => r.type === 'counseling')).toBe(true);
    });

    test('should include required resource properties', () => {
      const resources = crisisService.getCrisisResources();
      resources.forEach(resource => {
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('availability');
        expect(resource).toHaveProperty('type');
        expect(resource.phoneNumber || resource.website).toBeTruthy();
      });
    });
  });

  describe('Session Management', () => {
    test('should track crisis history per session', () => {
      const sessionId = 'history-test';
      
      crisisService.analyzeMessage('I feel very depressed', sessionId);
      crisisService.analyzeMessage('I am having a panic attack', sessionId);
      
      const history = crisisService.getSessionCrisisHistory(sessionId);
      expect(history.crisisEvents.length).toBe(2);
      expect(history.severityCounts.moderate).toBe(2);
    });

    test('should clear session data', () => {
      const sessionId = 'clear-test';
      
      crisisService.analyzeMessage('I feel hopeless', sessionId);
      expect(crisisService.getSessionCrisisHistory(sessionId).crisisEvents.length).toBe(1);
      
      crisisService.clearSession(sessionId);
      expect(crisisService.getSessionCrisisHistory(sessionId).crisisEvents.length).toBe(0);
    });

    test('should clean old crisis events outside time window', () => {
      const sessionId = 'cleanup-test';
      
      // Mock old timestamp
      const oldTimestamp = new Date(Date.now() - (35 * 60 * 1000)); // 35 minutes ago
      crisisService.sessions.set(sessionId, {
        crisisEvents: [{
          severity: 'moderate',
          keywords: ['depressed'],
          timestamp: oldTimestamp
        }],
        severityCounts: { immediate: 0, high: 0, moderate: 1, selfHarm: 0 },
        lastCrisisTime: oldTimestamp,
        escalationLevel: 0
      });
      
      // Add new crisis event
      crisisService.analyzeMessage('I am anxious', sessionId);
      
      const history = crisisService.getSessionCrisisHistory(sessionId);
      expect(history.crisisEvents.length).toBe(1); // Old event should be cleaned up
      expect(history.severityCounts.moderate).toBe(1); // Count should be recalculated
    });
  });

  describe('Event Emission', () => {
    test('should emit crisis detected event', (done) => {
      crisisService.on('crisisDetected', (crisisData) => {
        expect(crisisData.severity).toBe('immediate');
        expect(crisisData.sessionId).toBe('event-test');
        expect(crisisData.keywords).toContain('suicide');
        done();
      });

      crisisService.analyzeMessage('I am thinking about suicide', 'event-test');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty or invalid messages', () => {
      const invalidMessages = ['', null, undefined, 123, {}];
      
      invalidMessages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'invalid-test');
        expect(result.isCrisis).toBe(false);
        expect(result.severity).toBe('none');
      });
    });

    test('should handle case insensitive detection', () => {
      const messages = [
        'I WANT TO KILL MYSELF',
        'i feel hopeless',
        'I Am DePrEsSeD'
      ];

      messages.forEach(message => {
        const result = crisisService.analyzeMessage(message, 'case-test');
        expect(result.isCrisis).toBe(true);
      });
    });

    test('should detect keywords within larger text', () => {
      const message = 'I have been having a really hard time lately and sometimes I think about suicide and wonder if anyone would care if I was gone.';
      
      const result = crisisService.analyzeMessage(message, 'context-test');
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe('immediate');
    });
  });
});