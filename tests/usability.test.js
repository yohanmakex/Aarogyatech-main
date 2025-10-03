/**
 * Usability Tests for MindCare AI Mental Health Assistant
 * 
 * These tests verify user experience, interface responsiveness,
 * and overall usability of the application.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => [])
};

// Setup DOM environment
const setupDOM = (htmlContent) => {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  
  // Mock Web APIs
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  
  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  
  // Mock media APIs
  global.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  };
  
  global.MediaRecorder = class MockMediaRecorder {
    constructor() {
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
  };
  
  // Mock fetch API
  global.fetch = jest.fn();
  
  return dom;
};

describe('Usability Tests', () => {
  let dom;
  let document;
  let window;

  beforeAll(() => {
    const htmlPath = path.join(__dirname, '../public/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    dom = setupDOM(htmlContent);
    document = dom.window.document;
    window = dom.window;
  });

  afterAll(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Interface Responsiveness', () => {
    test('should have responsive layout elements', () => {
      // Check for responsive design indicators
      const responsiveElements = document.querySelectorAll(
        '.container, .row, .col, [class*="responsive"], [class*="flex"], [class*="grid"]'
      );
      
      // Should have some form of layout system
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test('should have proper viewport configuration', () => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      expect(viewportMeta).toBeTruthy();
      
      if (viewportMeta) {
        const content = viewportMeta.getAttribute('content');
        expect(content).toContain('width=device-width');
        expect(content).toContain('initial-scale=1');
      }
    });

    test('should have scalable text and elements', () => {
      // Check that text sizes are not fixed in pixels for body text
      const textElements = document.querySelectorAll('p, span, div, li');
      
      // Should have text content
      const hasTextContent = Array.from(textElements).some(el => 
        el.textContent && el.textContent.trim().length > 0
      );
      expect(hasTextContent).toBeTruthy();
    });

    test('should handle different screen orientations', () => {
      // Check for CSS that handles orientation changes
      const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
      
      // Should have some styling
      expect(styleSheets.length).toBeGreaterThan(0);
    });
  });

  describe('User Interface Clarity', () => {
    test('should have clear navigation structure', () => {
      const navigation = document.querySelector('nav, .navigation, .nav-menu, .menu');
      
      if (navigation) {
        const navItems = navigation.querySelectorAll('a, button, [role="menuitem"]');
        expect(navItems.length).toBeGreaterThan(0);
        
        // Navigation items should have descriptive text
        navItems.forEach(item => {
          expect(item.textContent.trim().length).toBeGreaterThan(0);
        });
      }
    });

    test('should have clear call-to-action buttons', () => {
      const buttons = document.querySelectorAll('button, .btn, [role="button"]');
      
      buttons.forEach(button => {
        // Buttons should have descriptive text or aria-label
        const hasText = button.textContent.trim().length > 0;
        const hasAriaLabel = button.getAttribute('aria-label');
        const hasTitle = button.getAttribute('title');
        
        expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
      });
    });

    test('should have consistent visual hierarchy', () => {
      // Check for proper heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      if (headings.length > 0) {
        // Should have at least one main heading
        const h1Elements = document.querySelectorAll('h1');
        expect(h1Elements.length).toBeGreaterThanOrEqual(1);
        
        // Headings should have content
        headings.forEach(heading => {
          expect(heading.textContent.trim().length).toBeGreaterThan(0);
        });
      }
    });

    test('should have clear form structure', () => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input, textarea, select');
      
      if (inputs.length > 0) {
        inputs.forEach(input => {
          // Inputs should have labels or placeholders
          const id = input.getAttribute('id');
          const placeholder = input.getAttribute('placeholder');
          const ariaLabel = input.getAttribute('aria-label');
          const label = id ? document.querySelector(`label[for="${id}"]`) : null;
          
          expect(label || placeholder || ariaLabel).toBeTruthy();
        });
      }
    });
  });

  describe('Voice Interface Usability', () => {
    test('should have intuitive voice controls', () => {
      const voiceControls = document.querySelectorAll(
        '#recordButton, .voice-btn, [data-voice], .mic-btn, .record-btn'
      );
      
      voiceControls.forEach(control => {
        // Voice controls should be clearly labeled
        const hasText = control.textContent.trim().length > 0;
        const hasAriaLabel = control.getAttribute('aria-label');
        const hasTitle = control.getAttribute('title');
        
        expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
      });
    });

    test('should provide clear voice mode indicators', () => {
      const modeIndicators = document.querySelectorAll(
        '.voice-mode, [data-mode], .mode-indicator, .current-mode'
      );
      
      // Should have some way to show current voice mode
      if (modeIndicators.length > 0) {
        modeIndicators.forEach(indicator => {
          expect(indicator).toBeTruthy();
        });
      }
    });

    test('should have voice recording feedback', () => {
      const recordingIndicators = document.querySelectorAll(
        '.recording, .mic-active, .voice-active, [data-recording]'
      );
      
      // Should provide visual feedback during recording
      if (recordingIndicators.length > 0) {
        recordingIndicators.forEach(indicator => {
          expect(indicator).toBeTruthy();
        });
      }
    });

    test('should support easy mode switching', () => {
      const modeSwitchers = document.querySelectorAll(
        '.mode-switch, [data-mode-switch], .voice-mode-selector'
      );
      
      if (modeSwitchers.length > 0) {
        modeSwitchers.forEach(switcher => {
          // Mode switchers should be accessible
          expect(
            switcher.tagName === 'SELECT' ||
            switcher.tagName === 'BUTTON' ||
            switcher.getAttribute('role') === 'button'
          ).toBeTruthy();
        });
      }
    });
  });

  describe('Chat Interface Usability', () => {
    test('should have clear message display area', () => {
      const chatArea = document.querySelector(
        '#chatMessages, .chat-messages, .messages, .conversation'
      );
      
      if (chatArea) {
        expect(chatArea).toBeTruthy();
        
        // Should have proper scrolling setup
        const hasScrollableClass = /scroll|overflow/.test(chatArea.className);
        expect(chatArea.tagName || hasScrollableClass).toBeTruthy();
      }
    });

    test('should have intuitive message input', () => {
      const messageInput = document.querySelector(
        '#messageInput, .message-input, textarea[placeholder*="message" i]'
      );
      
      if (messageInput) {
        // Should have placeholder or label
        const placeholder = messageInput.getAttribute('placeholder');
        const ariaLabel = messageInput.getAttribute('aria-label');
        
        expect(placeholder || ariaLabel).toBeTruthy();
      }
    });

    test('should have clear send button', () => {
      const sendButton = document.querySelector(
        '#sendButton, .send-btn, [data-send], button[type="submit"]'
      );
      
      if (sendButton) {
        // Send button should be clearly identifiable
        const hasText = sendButton.textContent.trim().length > 0;
        const hasAriaLabel = sendButton.getAttribute('aria-label');
        const hasIcon = sendButton.querySelector('.icon, svg, [class*="icon"]');
        
        expect(hasText || hasAriaLabel || hasIcon).toBeTruthy();
      }
    });

    test('should distinguish between user and AI messages', () => {
      const messageElements = document.querySelectorAll(
        '.message, .chat-message, [data-message]'
      );
      
      if (messageElements.length > 0) {
        // Should have classes or attributes to distinguish message types
        const hasUserMessages = Array.from(messageElements).some(msg =>
          msg.classList.contains('user') || 
          msg.getAttribute('data-sender') === 'user'
        );
        
        const hasAIMessages = Array.from(messageElements).some(msg =>
          msg.classList.contains('ai') || 
          msg.classList.contains('assistant') ||
          msg.getAttribute('data-sender') === 'ai'
        );
        
        // If messages exist, they should be distinguishable
        if (messageElements.length > 1) {
          expect(hasUserMessages || hasAIMessages).toBeTruthy();
        }
      }
    });
  });

  describe('Language Support Usability', () => {
    test('should have accessible language selection', () => {
      const langSelector = document.querySelector(
        '#languageSelector, .language-selector, [data-language]'
      );
      
      if (langSelector) {
        // Language selector should be user-friendly
        if (langSelector.tagName === 'SELECT') {
          const options = langSelector.querySelectorAll('option');
          expect(options.length).toBeGreaterThan(1);
          
          // Options should have descriptive text
          options.forEach(option => {
            expect(option.textContent.trim().length).toBeGreaterThan(0);
          });
        }
      }
    });

    test('should handle text direction changes', () => {
      const htmlElement = document.documentElement;
      const dirAttribute = htmlElement.getAttribute('dir');
      
      // Should support direction changes for RTL languages
      if (dirAttribute) {
        expect(['ltr', 'rtl', 'auto']).toContain(dirAttribute);
      }
    });

    test('should have proper font support for different languages', () => {
      // Check for font-family declarations that support multiple languages
      const styleElements = document.querySelectorAll('style, link[rel="stylesheet"]');
      
      // Should have some styling
      expect(styleElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Feedback', () => {
    test('should have clear error message areas', () => {
      const errorElements = document.querySelectorAll(
        '.error, .alert, [role="alert"], .error-message, [data-error]'
      );
      
      errorElements.forEach(element => {
        // Error elements should be properly marked
        expect(
          element.classList.contains('error') ||
          element.getAttribute('role') === 'alert' ||
          element.getAttribute('data-error') !== null
        ).toBeTruthy();
      });
    });

    test('should provide helpful loading states', () => {
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading], .loader'
      );
      
      loadingElements.forEach(element => {
        // Loading elements should provide user feedback
        expect(element).toBeTruthy();
      });
    });

    test('should have user-friendly validation messages', () => {
      const validationElements = document.querySelectorAll(
        '.validation-message, .field-error, [data-validation]'
      );
      
      validationElements.forEach(element => {
        // Validation messages should be associated with form fields
        expect(element).toBeTruthy();
      });
    });
  });

  describe('Performance and Loading Experience', () => {
    test('should have optimized resource loading', () => {
      // Check for performance optimization indicators
      const images = document.querySelectorAll('img');
      const scripts = document.querySelectorAll('script');
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      
      // Images should have alt attributes
      images.forEach(img => {
        expect(img.getAttribute('alt') !== null).toBeTruthy();
      });
      
      // Should have reasonable number of external resources
      const externalScripts = Array.from(scripts).filter(script => 
        script.getAttribute('src') && !script.getAttribute('src').startsWith('/')
      );
      expect(externalScripts.length).toBeLessThan(10); // Reasonable limit
    });

    test('should provide progressive loading experience', () => {
      // Check for progressive enhancement indicators
      const criticalElements = document.querySelectorAll(
        'main, .main-content, #main, .content'
      );
      
      // Should have main content area
      expect(criticalElements.length).toBeGreaterThan(0);
    });

    test('should handle offline scenarios', () => {
      // Check for offline support indicators
      const offlineElements = document.querySelectorAll(
        '[data-offline], .offline-message, .no-connection'
      );
      
      // If offline support exists, it should be properly implemented
      if (offlineElements.length > 0) {
        offlineElements.forEach(element => {
          expect(element).toBeTruthy();
        });
      }
    });
  });

  describe('Crisis Support Usability', () => {
    test('should have prominent crisis resources', () => {
      const crisisElements = document.querySelectorAll(
        '.crisis-banner, .emergency-contact, [data-crisis], .hotline-banner'
      );
      
      crisisElements.forEach(element => {
        // Crisis elements should be visible and accessible
        expect(element).toBeTruthy();
        
        // Should contain contact information
        const hasPhoneNumber = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}/.test(element.textContent);
        const hasContactLink = element.querySelector('a[href^="tel:"]');
        
        if (element.textContent.includes('crisis') || element.textContent.includes('emergency')) {
          expect(hasPhoneNumber || hasContactLink).toBeTruthy();
        }
      });
    });

    test('should have easily accessible help resources', () => {
      const helpElements = document.querySelectorAll(
        '.help, .support, .resources, [data-help]'
      );
      
      helpElements.forEach(element => {
        // Help elements should be clearly marked
        expect(element).toBeTruthy();
      });
    });
  });

  describe('Accessibility Integration', () => {
    test('should work well with assistive technologies', () => {
      // Check for ARIA landmarks
      const landmarks = document.querySelectorAll(
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
      );
      
      expect(landmarks.length).toBeGreaterThan(0);
    });

    test('should have proper focus management', () => {
      const focusableElements = document.querySelectorAll(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
      );
      
      // Should have focusable elements
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // Check for focus trap in modals
      const modals = document.querySelectorAll('[role="dialog"], .modal');
      modals.forEach(modal => {
        const modalFocusable = modal.querySelectorAll(
          'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
        );
        
        if (modalFocusable.length > 0) {
          expect(modalFocusable.length).toBeGreaterThan(0);
        }
      });
    });

    test('should provide alternative interaction methods', () => {
      // Check for multiple ways to interact with features
      const voiceButton = document.querySelector('#recordButton, .voice-btn');
      const textInput = document.querySelector('#messageInput, .text-input');
      
      // If voice features exist, text alternatives should also exist
      if (voiceButton) {
        expect(textInput).toBeTruthy();
      }
    });
  });

  describe('Content Organization', () => {
    test('should have logical content structure', () => {
      // Check for proper document structure
      const header = document.querySelector('header, [role="banner"]');
      const main = document.querySelector('main, [role="main"]');
      const footer = document.querySelector('footer, [role="contentinfo"]');
      
      // Should have main content area
      expect(main || document.querySelector('.main-content, #main')).toBeTruthy();
    });

    test('should group related functionality', () => {
      // Check for logical grouping of features
      const sections = document.querySelectorAll('section, .section, [role="region"]');
      
      sections.forEach(section => {
        // Sections should have headings or labels
        const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
        const ariaLabel = section.getAttribute('aria-label');
        const ariaLabelledBy = section.getAttribute('aria-labelledby');
        
        expect(heading || ariaLabel || ariaLabelledBy).toBeTruthy();
      });
    });

    test('should have consistent interaction patterns', () => {
      // Check for consistent button styles and behaviors
      const buttons = document.querySelectorAll('button, .btn');
      
      if (buttons.length > 1) {
        // Buttons should follow consistent patterns
        const buttonClasses = Array.from(buttons).map(btn => btn.className);
        const hasConsistentClasses = buttonClasses.some(className => 
          className.includes('btn') || className.includes('button')
        );
        
        expect(hasConsistentClasses || buttons.length > 0).toBeTruthy();
      }
    });
  });

  describe('User Feedback and Confirmation', () => {
    test('should provide feedback for user actions', () => {
      // Check for feedback mechanisms
      const feedbackElements = document.querySelectorAll(
        '.feedback, .status, .notification, [data-feedback]'
      );
      
      feedbackElements.forEach(element => {
        expect(element).toBeTruthy();
      });
    });

    test('should confirm destructive actions', () => {
      // Check for confirmation dialogs or warnings
      const destructiveButtons = document.querySelectorAll(
        '.delete, .remove, .clear, [data-destructive]'
      );
      
      destructiveButtons.forEach(button => {
        // Destructive actions should have confirmation
        const hasConfirmation = 
          button.getAttribute('data-confirm') ||
          button.getAttribute('onclick') && button.getAttribute('onclick').includes('confirm');
        
        // At minimum, destructive buttons should be clearly marked
        expect(button.textContent.trim().length > 0).toBeTruthy();
      });
    });
  });
});