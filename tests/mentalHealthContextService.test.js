const MentalHealthContextService = require('../services/mentalHealthContextService');

describe('MentalHealthContextService', () => {
  let mentalHealthService;

  beforeEach(() => {
    mentalHealthService = new MentalHealthContextService();
  });

  describe('Emotional State Detection', () => {
    test('should detect anxiety-related emotions', () => {
      const testMessages = [
        'I am feeling very anxious about my exam',
        'I am worried about the future',
        'I have been having panic attacks',
        'I feel nervous all the time'
      ];

      testMessages.forEach(message => {
        const emotions = mentalHealthService.detectEmotionalState(message);
        expect(emotions).toContain('anxiety');
      });
    });

    test('should detect depression-related emotions', () => {
      const testMessages = [
        'I feel so sad and empty',
        'I have been feeling down lately',
        'Everything feels hopeless',
        'I am exhausted all the time'
      ];

      testMessages.forEach(message => {
        const emotions = mentalHealthService.detectEmotionalState(message);
        expect(emotions).toContain('depression');
      });
    });

    test('should detect stress-related emotions', () => {
      const testMessages = [
        'I am so stressed about work',
        'I feel completely overwhelmed',
        'There is too much pressure on me',
        'I am burned out'
      ];

      testMessages.forEach(message => {
        const emotions = mentalHealthService.detectEmotionalState(message);
        expect(emotions).toContain('stress');
      });
    });

    test('should detect multiple emotions in one message', () => {
      const message = 'I am feeling anxious and very depressed about my future';
      const emotions = mentalHealthService.detectEmotionalState(message);
      
      expect(emotions).toContain('anxiety');
      expect(emotions).toContain('depression');
      expect(emotions.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty array for neutral messages', () => {
      const neutralMessages = [
        'Hello, how are you?',
        'What is the weather like today?',
        'I had a good day at school',
        'Can you help me with my homework?'
      ];

      neutralMessages.forEach(message => {
        const emotions = mentalHealthService.detectEmotionalState(message);
        expect(emotions.length).toBe(0);
      });
    });
  });

  describe('Needs Assessment', () => {
    test('should identify when user needs coping strategies', () => {
      const testMessages = [
        'How do I deal with anxiety?',
        'What should I do when I feel overwhelmed?',
        'I need help managing my stress',
        'Can you give me some advice?'
      ];

      testMessages.forEach(message => {
        const assessment = mentalHealthService.assessUserNeeds(message);
        expect(assessment.needsCoping).toBe(true);
      });
    });

    test('should identify when professional help is needed', () => {
      const testMessages = [
        'I think I need to see a therapist',
        'I can\'t take this anymore, it\'s unbearable',
        'I need professional help',
        'Should I get treatment for my depression?'
      ];

      testMessages.forEach(message => {
        const assessment = mentalHealthService.assessUserNeeds(message);
        expect(assessment.needsProfessionalHelp).toBe(true);
      });
    });

    test('should assess urgency levels correctly', () => {
      const highUrgencyMessage = 'I can\'t take it anymore, this is unbearable';
      const mediumUrgencyMessage = 'I am really struggling with this';
      const lowUrgencyMessage = 'I am a bit worried about this';

      const highAssessment = mentalHealthService.assessUserNeeds(highUrgencyMessage);
      const mediumAssessment = mentalHealthService.assessUserNeeds(mediumUrgencyMessage);
      const lowAssessment = mentalHealthService.assessUserNeeds(lowUrgencyMessage);

      expect(highAssessment.urgency).toBe('high');
      expect(mediumAssessment.urgency).toBe('medium');
      expect(lowAssessment.urgency).toBe('low');
    });

    test('should determine appropriate resource types', () => {
      const immediateMessage = 'I can\'t take this anymore';
      const therapyMessage = 'I think I need to see a counselor';
      const specializedMessage = 'I have been struggling with an eating disorder';
      const preventiveMessage = 'I want to learn about stress management';

      const immediateAssessment = mentalHealthService.assessUserNeeds(immediateMessage);
      const therapyAssessment = mentalHealthService.assessUserNeeds(therapyMessage);
      const specializedAssessment = mentalHealthService.assessUserNeeds(specializedMessage);
      const preventiveAssessment = mentalHealthService.assessUserNeeds(preventiveMessage);

      expect(immediateAssessment.resourceType).toBe('immediate');
      expect(therapyAssessment.resourceType).toBe('therapy');
      expect(specializedAssessment.resourceType).toBe('specialized');
      expect(preventiveAssessment.resourceType).toBe('preventive');
    });
  });

  describe('Response Enhancement', () => {
    test('should enhance response with validation for emotional messages', () => {
      const originalResponse = 'Here is some information about anxiety.'; // Response without validation
      const userMessage = 'I am feeling very anxious about my future';

      const enhancement = mentalHealthService.enhanceResponse(originalResponse, userMessage);

      expect(enhancement.enhancedResponse).toContain(originalResponse);
      expect(enhancement.enhancements.validation).toBeTruthy();
      expect(enhancement.detectedEmotions).toContain('anxiety');
    });

    test('should add coping strategies when user needs help', () => {
      const originalResponse = 'I can help you with that.';
      const userMessage = 'How do I deal with my anxiety attacks?';

      const enhancement = mentalHealthService.enhanceResponse(originalResponse, userMessage);

      expect(enhancement.enhancements.copingStrategies.length).toBeGreaterThan(0);
      expect(enhancement.enhancedResponse.length).toBeGreaterThan(originalResponse.length);
      expect(enhancement.needsAssessment.needsCoping).toBe(true);
    });

    test('should add professional resources when appropriate', () => {
      const originalResponse = 'That sounds very difficult.';
      const userMessage = 'I think I need to see a therapist for my depression';

      const enhancement = mentalHealthService.enhanceResponse(originalResponse, userMessage);

      expect(enhancement.enhancements.professionalResources.length).toBeGreaterThan(0);
      expect(enhancement.needsAssessment.needsProfessionalHelp).toBe(true);
    });

    test('should not over-enhance responses that already contain appropriate content', () => {
      const originalResponse = 'Your feelings are completely valid. Have you tried deep breathing exercises? You might also consider speaking with a counselor.';
      const userMessage = 'I am feeling anxious';

      const enhancement = mentalHealthService.enhanceResponse(originalResponse, userMessage);

      // Should not add much since original response already has validation, coping advice, and professional recommendation
      expect(enhancement.enhancedResponse.length).toBeLessThan(originalResponse.length * 1.5);
    });
  });

  describe('Coping Strategies', () => {
    test('should return anxiety-specific strategies for anxiety', () => {
      const strategies = mentalHealthService.getCopingStrategies(['anxiety'], 'medium');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name.includes('Breathing') || s.name.includes('Grounding'))).toBe(true);
    });

    test('should return depression-specific strategies for depression', () => {
      const strategies = mentalHealthService.getCopingStrategies(['depression'], 'medium');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.name.includes('Movement') || s.name.includes('Behavioral'))).toBe(true);
    });

    test('should prioritize immediate strategies for high urgency', () => {
      const strategies = mentalHealthService.getCopingStrategies(['anxiety'], 'high');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.every(s => s.immediacy === 'immediate')).toBe(true);
    });

    test('should return general strategies when no specific emotion detected', () => {
      const strategies = mentalHealthService.getCopingStrategies([], 'medium');
      
      expect(strategies.length).toBeGreaterThan(0);
      // Should include general strategies
      expect(strategies.some(s => s.name.includes('Journaling') || s.name.includes('Self-Compassion'))).toBe(true);
    });

    test('should limit number of strategies returned', () => {
      const strategies = mentalHealthService.getCopingStrategies(['anxiety', 'depression', 'stress'], 'low');
      
      expect(strategies.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Professional Resources', () => {
    test('should return immediate resources for immediate resource type', () => {
      const resources = mentalHealthService.getProfessionalResources('immediate');
      
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].type).toBe('Crisis Counseling');
    });

    test('should return therapy resources for therapy resource type', () => {
      const resources = mentalHealthService.getProfessionalResources('therapy');
      
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.some(r => r.type.includes('Therapy'))).toBe(true);
    });

    test('should return specialized resources for specialized resource type', () => {
      const resources = mentalHealthService.getProfessionalResources('specialized');
      
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].type).toBe('Specialized Treatment');
    });

    test('should return preventive resources for preventive resource type', () => {
      const resources = mentalHealthService.getProfessionalResources('preventive');
      
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0].type).toBe('Wellness Resources');
    });
  });

  describe('Response Validation', () => {
    test('should validate appropriate mental health responses', () => {
      const appropriateResponses = [
        'I understand that you\'re going through a difficult time. Your feelings are valid.',
        'It sounds like you\'re dealing with a lot of stress. Have you tried any relaxation techniques?',
        'Thank you for sharing this with me. It takes courage to talk about these feelings.'
      ];

      appropriateResponses.forEach(response => {
        const validation = mentalHealthService.validateMentalHealthResponse(response);
        expect(validation.isAppropriate).toBe(true);
        expect(validation.issues.length).toBe(0);
      });
    });

    test('should identify inappropriate mental health responses', () => {
      const inappropriateResponses = [
        'Just get over it and think positive',
        'Others have it worse than you',
        'You\'re being dramatic',
        'It\'s all in your head'
      ];

      inappropriateResponses.forEach(response => {
        const validation = mentalHealthService.validateMentalHealthResponse(response);
        expect(validation.isAppropriate).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
      });
    });

    test('should identify responses lacking empathy', () => {
      const response = 'Anxiety is a mental health condition. You can read about treatments online.'; // Factual but not empathetic
      const validation = mentalHealthService.validateMentalHealthResponse(response);
      
      expect(validation.hasEmpathy).toBe(false);
      expect(validation.issues.some(issue => issue.includes('empathetic'))).toBe(true);
    });

    test('should identify responses that are too brief', () => {
      const response = 'OK.';
      const validation = mentalHealthService.validateMentalHealthResponse(response);
      
      expect(validation.isAppropriate).toBe(false);
      expect(validation.issues.some(issue => issue.includes('brief'))).toBe(true);
    });

    test('should identify responses that are too lengthy', () => {
      const response = 'A'.repeat(900); // Very long response
      const validation = mentalHealthService.validateMentalHealthResponse(response);
      
      expect(validation.isAppropriate).toBe(false);
      expect(validation.issues.some(issue => issue.includes('lengthy'))).toBe(true);
    });
  });

  describe('Content Detection Methods', () => {
    test('should detect emotional distress correctly', () => {
      const distressMessages = [
        'I am struggling with this',
        'This is so difficult for me',
        'I can\'t handle this anymore',
        'I feel overwhelmed'
      ];

      const normalMessages = [
        'I had a good day',
        'How are you?',
        'What is the weather like?'
      ];

      distressMessages.forEach(message => {
        expect(mentalHealthService.detectEmotionalDistress(message)).toBe(true);
      });

      normalMessages.forEach(message => {
        expect(mentalHealthService.detectEmotionalDistress(message)).toBe(false);
      });
    });

    test('should detect severe mental health concerns', () => {
      const severeMessages = [
        'I can\'t function anymore',
        'I can\'t get out of bed',
        'I am hearing voices',
        'I am not eating at all'
      ];

      const normalMessages = [
        'I am feeling a bit sad',
        'I am worried about my exam'
      ];

      severeMessages.forEach(message => {
        expect(mentalHealthService.detectSevereMentalHealthConcerns(message)).toBe(true);
      });

      normalMessages.forEach(message => {
        expect(mentalHealthService.detectSevereMentalHealthConcerns(message)).toBe(false);
      });
    });

    test('should detect specialized treatment needs', () => {
      const specializedMessages = [
        'I have an eating disorder',
        'I have PTSD from trauma',
        'I struggle with addiction',
        'I have bipolar disorder'
      ];

      const generalMessages = [
        'I feel anxious',
        'I am stressed about work'
      ];

      specializedMessages.forEach(message => {
        expect(mentalHealthService.detectSpecializedNeeds(message)).toBe(true);
      });

      generalMessages.forEach(message => {
        expect(mentalHealthService.detectSpecializedNeeds(message)).toBe(false);
      });
    });
  });

  describe('Formatting Methods', () => {
    test('should format coping strategies correctly', () => {
      const strategies = [
        { name: 'Deep Breathing', description: 'Take slow, deep breaths' },
        { name: 'Grounding', description: 'Focus on your surroundings' }
      ];

      const formatted = mentalHealthService.formatCopingStrategies(strategies);
      
      expect(formatted).toContain('Deep Breathing');
      expect(formatted).toContain('Take slow, deep breaths');
      expect(formatted).toContain('Grounding');
      expect(formatted).toContain('Focus on your surroundings');
    });

    test('should format professional resources correctly', () => {
      const resources = [{
        type: 'Individual Therapy',
        description: 'One-on-one counseling',
        resources: ['Psychology Today', 'Campus counseling', 'Community centers']
      }];

      const formatted = mentalHealthService.formatProfessionalResources(resources);
      
      expect(formatted).toContain('Individual Therapy');
      expect(formatted).toContain('One-on-one counseling');
      expect(formatted).toContain('Psychology Today');
    });

    test('should return empty string for empty arrays', () => {
      expect(mentalHealthService.formatCopingStrategies([])).toBe('');
      expect(mentalHealthService.formatProfessionalResources([])).toBe('');
    });
  });
});