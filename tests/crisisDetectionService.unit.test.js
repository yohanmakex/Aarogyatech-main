const CrisisDetectionService = require('../services/crisisDetectionService');

describe('CrisisDetectionService Unit Tests', () => {
  let crisisDetectionService;

  beforeEach(() => {
    crisisDetectionService = new CrisisDetectionService();
  });

  afterEach(() => {
    // Clear all sessions after each test
    crisisDetectionService.sessions.clear();
  });

  describe('Crisis Detection Accuracy', () => {
    test('should detect immediate crisis keywords', () => {
      const immediateMessages = [
        'I want to kill myself',
        'I am going to end my life',
        'I want to die tonight',
        'I am planning to hurt myself',
        'I have a rope and I am ready',
        'I took too many pills',
        'I am going to jump off the bridge'
      ];

      immediateMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('immediate');
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.response).toContain('911');
        expect(result.escalationLevel).toBeGreaterThanOrEqual(3);
      });
    });

    test('should detect high-risk crisis keywords', () => {
      const highRiskMessages = [
        'I feel worthless and hopeless',
        'Life is meaningless, I can\'t go on',
        'I am better off dead',
        'There is no point living anymore',
        'I give up, I can\'t take it anymore',
        'I feel trapped with no way out'
      ];

      highRiskMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.response).toContain('988');
      });
    });

    test('should detect moderate crisis keywords', () => {
      const moderateMessages = [
        'I am so depressed I can\'t function',
        'I am having a panic attack',
        'I am having a mental breakdown',
        'I am completely overwhelmed and stressed',
        'I feel like I am losing it',
        'I need help please, I am in crisis'
      ];

      moderateMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        
        expect(result.isCrisis).toBe(true);
        expect(result.severity).toBe('moderate');
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.response).toContain('1-800-662-4357');
      });
    });

    test('should detect self-harm indicators', () => {
      const selfHarmMessages = [
        'I have been doing self harm',
        'I keep burning myself',
        'I am hitting myself when angry',
        'I am scratching until I bleed',
        'I am starving myself',
        'I keep throwing up after meals'
      ];

      selfHarmMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        
        expect(result.isCrisis).toBe(true);
        // Note: some self-harm messages might be classified as immediate if they contain crisis keywords
        expect(['selfHarm', 'immediate']).toContain(result.severity);
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.response).toContain('741741');
      });
    });

    test('should not detect crisis in normal messages', () => {
      const normalMessages = [
        'I am feeling a bit sad today',
        'I had a stressful day at work',
        'I am worried about my exam tomorrow',
        'I feel tired after a long day',
        'I am having some relationship issues',
        'I need advice on managing my time'
      ];

      normalMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        
        expect(result.isCrisis).toBe(false);
        expect(result.severity).toBe('none');
        expect(result.keywords).toHaveLength(0);
        expect(result.response).toBeNull();
      });
    });

    test('should handle case-insensitive detection', () => {
      const mixedCaseMessages = [
        'I WANT TO KILL MYSELF',
        'i am going to end my life',
        'I Feel WORTHLESS and hopeless',
        'I AM HAVING A PANIC ATTACK'
      ];

      mixedCaseMessages.forEach(message => {
        const result = crisisDetectionService.analyzeMessage(message, 'test-session');
        expect(result.isCrisis).toBe(true);
      });
    });

    test('should detect multiple keywords in single message', () => {
      const message = 'I feel worthless and want to kill myself, I have no hope left';
      const result = crisisDetectionService.analyzeMessage(message, 'test-session');

      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe('immediate'); // Should prioritize highest severity
      expect(result.keywords.length).toBeGreaterThan(1);
    });

    test('should prioritize immediate severity over others', () => {
      const message = 'I am depressed and want to kill myself';
      const result = crisisDetectionService.analyzeMessage(message, 'test-session');

      expect(result.severity).toBe('immediate');
      expect(result.keywords).toContain('kill myself');
    });
  });

  describe('Session Tracking and Escalation', () => {
    test('should track crisis events in session', () => {
      const sessionId = 'test-session-123';
      
      crisisDetectionService.analyzeMessage('I feel hopeless', sessionId);
      crisisDetectionService.analyzeMessage('I am worthless', sessionId);
      
      const history = crisisDetectionService.getSessionCrisisHistory(sessionId);
      
      expect(history.crisisEvents).toHaveLength(2);
      expect(history.severityCounts.high).toBe(2);
      expect(history.lastCrisisTime).toBeInstanceOf(Date);
    });

    test('should escalate after multiple high-risk detections', () => {
      const sessionId = 'escalation-test';
      
      // First high-risk message
      let result = crisisDetectionService.analyzeMessage('I feel worthless', sessionId);
      expect(result.escalationLevel).toBeLessThan(2);
      
      // Second high-risk message should trigger escalation
      result = crisisDetectionService.analyzeMessage('I am hopeless', sessionId);
      expect(result.escalationLevel).toBeGreaterThanOrEqual(2);
    });

    test('should escalate immediately for immediate crisis', () => {
      const result = crisisDetectionService.analyzeMessage('I want to kill myself', 'immediate-test');
      
      expect(result.escalationLevel).toBe(3);
      expect(result.response).toContain('emergency situation');
    });

    test('should clean old events outside time window', () => {
      const sessionId = 'time-window-test';
      
      // Mock old timestamp
      const oldTimestamp = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
      
      // Manually add old event
      crisisDetectionService.sessions.set(sessionId, {
        crisisEvents: [{
          severity: 'high',
          keywords: ['hopeless'],
          timestamp: oldTimestamp
        }],
        severityCounts: { immediate: 0, high: 1, moderate: 0, selfHarm: 0 },
        lastCrisisTime: oldTimestamp,
        escalationLevel: 0
      });
      
      // Add new event that will trigger cleanup
      crisisDetectionService.analyzeMessage('I feel hopeless', sessionId);
      
      const history = crisisDetectionService.getSessionCrisisHistory(sessionId);
      
      // Old event should be cleaned up, but new event should be there
      expect(history.severityCounts.high).toBe(1); // Only the new event
      expect(history.crisisEvents).toHaveLength(1);
    });

    test('should clear session data', () => {
      const sessionId = 'clear-test';
      
      crisisDetectionService.analyzeMessage('I feel hopeless', sessionId);
      expect(crisisDetectionService.getSessionCrisisHistory(sessionId).crisisEvents).toHaveLength(1);
      
      crisisDetectionService.clearSession(sessionId);
      expect(crisisDetectionService.getSessionCrisisHistory(sessionId).crisisEvents).toHaveLength(0);
    });
  });

  describe('Crisis Response Generation', () => {
    test('should generate appropriate immediate crisis response', () => {
      const result = crisisDetectionService.analyzeMessage('I want to kill myself', 'test-session');
      
      expect(result.response).toContain('911');
      expect(result.response).toContain('988');
      expect(result.response).toContain('741741');
    });

    test('should generate appropriate high-risk response', () => {
      const result = crisisDetectionService.analyzeMessage('I feel worthless and hopeless', 'test-session');
      
      expect(result.response).toContain('988');
      expect(result.response).toContain('741741');
      expect(result.response).not.toContain('Emergency Services');
    });

    test('should generate appropriate moderate response', () => {
      const result = crisisDetectionService.analyzeMessage('I am having a panic attack', 'test-session');
      
      expect(result.response).toContain('SAMHSA Helpline');
      expect(result.response).toContain('coping strategies');
    });

    test('should generate appropriate self-harm response', () => {
      const result = crisisDetectionService.analyzeMessage('I have been doing self harm', 'test-session');
      
      expect(result.response).toContain('988');
      expect(result.response).toContain('741741');
      expect(result.response).toContain('Self-harm');
    });

    test('should add escalation messaging for high escalation levels', () => {
      const sessionId = 'escalation-message-test';
      
      // Trigger immediate crisis for maximum escalation
      const result = crisisDetectionService.analyzeMessage('I want to kill myself', sessionId);
      
      expect(result.response).toContain('emergency situation');
      expect(result.response).toContain('emergency services immediately');
    });
  });

  describe('Crisis Resources', () => {
    test('should return all crisis resources by default', () => {
      const resources = crisisDetectionService.getCrisisResources();
      
      expect(resources.length).toBeGreaterThan(0);
      expect(resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'National Suicide Prevention Lifeline',
            phoneNumber: '988',
            type: 'emergency'
          })
        ])
      );
    });

    test('should filter resources by severity', () => {
      const emergencyResources = crisisDetectionService.getCrisisResources('immediate');
      
      emergencyResources.forEach(resource => {
        expect(resource.type).toBe('emergency');
      });
    });

    test('should filter resources by type', () => {
      const counselingResources = crisisDetectionService.getCrisisResources('all', 'counseling');
      
      counselingResources.forEach(resource => {
        expect(resource.type).toBe('counseling');
      });
    });

    test('should return relevant resources for crisis analysis', () => {
      const result = crisisDetectionService.analyzeMessage('I want to kill myself', 'test-session');
      
      expect(result.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'emergency'
          })
        ])
      );
    });
  });

  describe('Escalation Workflow', () => {
    test('should create immediate crisis workflow', () => {
      const workflow = crisisDetectionService.createEscalationWorkflow('test-session', 'immediate');
      
      expect(workflow.severity).toBe('immediate');
      expect(workflow.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'display_emergency_resources',
            priority: 'critical'
          }),
          expect.objectContaining({
            action: 'log_crisis_event',
            priority: 'high'
          }),
          expect.objectContaining({
            action: 'offer_emergency_contact',
            priority: 'high'
          })
        ])
      );
    });

    test('should create high-risk workflow', () => {
      const workflow = crisisDetectionService.createEscalationWorkflow('test-session', 'high');
      
      expect(workflow.severity).toBe('high');
      expect(workflow.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'display_crisis_resources',
            priority: 'high'
          }),
          expect.objectContaining({
            action: 'follow_up_check',
            priority: 'medium'
          })
        ])
      );
    });

    test('should create moderate workflow', () => {
      const workflow = crisisDetectionService.createEscalationWorkflow('test-session', 'moderate');
      
      expect(workflow.severity).toBe('moderate');
      expect(workflow.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'display_support_resources',
            priority: 'medium'
          }),
          expect.objectContaining({
            action: 'offer_coping_strategies',
            priority: 'medium'
          })
        ])
      );
    });

    test('should create self-harm workflow', () => {
      const workflow = crisisDetectionService.createEscalationWorkflow('test-session', 'selfHarm');
      
      expect(workflow.severity).toBe('selfHarm');
      expect(workflow.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'display_crisis_resources',
            priority: 'high'
          }),
          expect.objectContaining({
            action: 'offer_alternatives',
            priority: 'high'
          })
        ])
      );
    });
  });

  describe('Event Emission', () => {
    test('should emit crisis detected event', (done) => {
      crisisDetectionService.on('crisisDetected', (crisisData) => {
        expect(crisisData).toEqual(
          expect.objectContaining({
            sessionId: 'event-test',
            severity: 'immediate',
            keywords: expect.arrayContaining(['kill myself']),
            escalationLevel: 3
          })
        );
        done();
      });

      crisisDetectionService.analyzeMessage('I want to kill myself', 'event-test');
    });

    test('should include message context in event', (done) => {
      const testMessage = 'I feel hopeless and want to end it all';
      
      crisisDetectionService.on('crisisDetected', (crisisData) => {
        expect(crisisData.message).toBe(testMessage.substring(0, 100));
        expect(crisisData.timestamp).toBeInstanceOf(Date);
        done();
      });

      crisisDetectionService.analyzeMessage(testMessage, 'context-test');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null or undefined messages', () => {
      let result = crisisDetectionService.analyzeMessage(null, 'test-session');
      expect(result.isCrisis).toBe(false);
      
      result = crisisDetectionService.analyzeMessage(undefined, 'test-session');
      expect(result.isCrisis).toBe(false);
      
      result = crisisDetectionService.analyzeMessage('', 'test-session');
      expect(result.isCrisis).toBe(false);
    });

    test('should handle non-string messages', () => {
      const result = crisisDetectionService.analyzeMessage(123, 'test-session');
      expect(result.isCrisis).toBe(false);
    });

    test('should handle very long messages', () => {
      const longMessage = 'I feel sad '.repeat(1000) + 'and want to kill myself';
      const result = crisisDetectionService.analyzeMessage(longMessage, 'test-session');
      
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe('immediate');
    });

    test('should handle messages with only whitespace', () => {
      const result = crisisDetectionService.analyzeMessage('   \n\t   ', 'test-session');
      expect(result.isCrisis).toBe(false);
    });

    test('should handle special characters and unicode', () => {
      const result = crisisDetectionService.analyzeMessage('I want to kill myself 😢💔', 'test-session');
      expect(result.isCrisis).toBe(true);
    });

    test('should handle concurrent session analysis', () => {
      const sessions = ['session1', 'session2', 'session3'];
      const messages = [
        'I want to kill myself',
        'I feel hopeless',
        'I am having a panic attack'
      ];

      const results = sessions.map((sessionId, index) =>
        crisisDetectionService.analyzeMessage(messages[index], sessionId)
      );

      expect(results[0].severity).toBe('immediate');
      expect(results[1].severity).toBe('high');
      expect(results[2].severity).toBe('moderate');

      // Each session should be tracked independently
      sessions.forEach(sessionId => {
        const history = crisisDetectionService.getSessionCrisisHistory(sessionId);
        expect(history.crisisEvents).toHaveLength(1);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid successive messages', () => {
      const sessionId = 'performance-test';
      const messages = Array(100).fill('I feel sad');

      const startTime = Date.now();
      
      messages.forEach((message, index) => {
        crisisDetectionService.analyzeMessage(`${message} ${index}`, sessionId);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second for 100 messages)
      expect(duration).toBeLessThan(1000);
    });

    test('should maintain accuracy under load', () => {
      const crisisMessages = [
        'I want to kill myself',
        'I feel worthless',
        'I am having a panic attack'
      ];

      const results = [];
      
      // Process many messages rapidly
      for (let i = 0; i < 50; i++) {
        const message = crisisMessages[i % crisisMessages.length];
        const result = crisisDetectionService.analyzeMessage(message, `session-${i}`);
        results.push(result);
      }

      // All crisis messages should be detected correctly
      results.forEach(result => {
        expect(result.isCrisis).toBe(true);
      });
    });
  });
});