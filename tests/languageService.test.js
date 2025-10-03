const LanguageService = require('../services/languageService');

describe('LanguageService', () => {
  let languageService;

  beforeEach(() => {
    languageService = new LanguageService();
  });

  describe('Language Detection', () => {
    test('should detect English text', async () => {
      const text = 'Hello, how are you today?';
      const detectedLanguage = await languageService.detectLanguage(text);
      expect(detectedLanguage).toBe('en');
    });

    test('should detect Marathi text', async () => {
      const text = 'नमस्कार, आज तुम्हाला कसे वाटत आहे?';
      const detectedLanguage = await languageService.detectLanguage(text);
      expect(detectedLanguage).toBe('mr');
    });

    test('should return default language for empty text', async () => {
      const detectedLanguage = await languageService.detectLanguage('');
      expect(detectedLanguage).toBe('en');
    });
  });

  describe('Language Support', () => {
    test('should support English and Marathi', () => {
      expect(languageService.isLanguageSupported('en')).toBe(true);
      expect(languageService.isLanguageSupported('mr')).toBe(true);
      expect(languageService.isLanguageSupported('fr')).toBe(false);
    });

    test('should return language configuration', () => {
      const enConfig = languageService.getLanguageConfig('en');
      expect(enConfig).toBeDefined();
      expect(enConfig.code).toBe('en');
      expect(enConfig.name).toBe('English');

      const mrConfig = languageService.getLanguageConfig('mr');
      expect(mrConfig).toBeDefined();
      expect(mrConfig.code).toBe('mr');
      expect(mrConfig.name).toBe('Marathi');
    });
  });

  describe('Model Selection', () => {
    test('should return appropriate models for each language', () => {
      const enConversationalModel = languageService.getModelForLanguage('en', 'conversational');
      expect(enConversationalModel).toBe('microsoft/DialoGPT-medium');

      const mrConversationalModel = languageService.getModelForLanguage('mr', 'conversational');
      expect(mrConversationalModel).toBe('microsoft/DialoGPT-medium');
    });

    test('should fallback to default language for unsupported languages', () => {
      const model = languageService.getModelForLanguage('unsupported', 'conversational');
      expect(model).toBe('microsoft/DialoGPT-medium');
    });
  });

  describe('Voice Parameters', () => {
    test('should return appropriate voice parameters for each language', () => {
      const enParams = languageService.getVoiceParametersForLanguage('en');
      expect(enParams.speed).toBe(1.0);

      const mrParams = languageService.getVoiceParametersForLanguage('mr');
      expect(mrParams.speed).toBe(0.9); // Slightly slower for better pronunciation
    });
  });

  describe('Mental Health Resources', () => {
    test('should return language-specific crisis resources', () => {
      const enResources = languageService.getMentalHealthResourcesForLanguage('en');
      expect(enResources).toHaveLength(2);
      expect(enResources[0].name).toBe('National Suicide Prevention Lifeline');

      const mrResources = languageService.getMentalHealthResourcesForLanguage('mr');
      expect(mrResources).toHaveLength(2);
      expect(mrResources[0].name).toBe('राष्ट्रीय आत्महत्या प्रतिबंध हेल्पलाइन');
    });
  });

  describe('Service Status', () => {
    test('should return service status information', () => {
      const status = languageService.getServiceStatus();
      expect(status.supportedLanguages).toContain('en');
      expect(status.supportedLanguages).toContain('mr');
      expect(status.defaultLanguage).toBe('en');
      expect(status.features.translation).toBe(true);
      expect(status.features.languageDetection).toBe(true);
    });
  });
});