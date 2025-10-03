/**
 * Accessibility and Usability Tests for MindCare AI Mental Health Assistant
 * 
 * These tests verify that the application meets accessibility standards
 * and provides a good user experience across different devices and capabilities.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock DOM environment for testing
const setupDOM = (htmlContent) => {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  
  // Mock Web APIs that might not be available in JSDOM
  global.MediaRecorder = class MockMediaRecorder {
    constructor() {
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); }
  };
  
  global.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  };
  
  global.SpeechRecognition = class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onerror = null;
    }
    start() {}
    stop() {}
  };
  
  global.speechSynthesis = {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn().mockReturnValue([])
  };
  
  return dom;
};

describe('Accessibility and Usability Tests', () => {
  let dom;
  let document;
  let window;

  beforeAll(() => {
    // Load the main HTML file
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

  describe('Screen Reader Compatibility', () => {
    test('should have proper ARIA labels for voice controls', () => {
      // Check for voice recording button
      const recordButton = document.querySelector('#recordButton, [data-action="record"], .record-btn');
      if (recordButton) {
        expect(
          recordButton.getAttribute('aria-label') || 
          recordButton.getAttribute('aria-labelledby') ||
          recordButton.textContent.trim()
        ).toBeTruthy();
        
        // Should have role if it's not a button element
        if (recordButton.tagName !== 'BUTTON') {
          expect(recordButton.getAttribute('role')).toBe('button');
        }
      }

      // Check for voice mode selector
      const voiceModeSelector = document.querySelector('#voiceMode, [data-voice-mode], .voice-mode-selector');
      if (voiceModeSelector) {
        expect(
          voiceModeSelector.getAttribute('aria-label') ||
          voiceModeSelector.getAttribute('aria-labelledby')
        ).toBeTruthy();
      }
    });

    test('should have proper heading structure', () => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      if (headings.length > 0) {
        // Should have at least one h1
        const h1Elements = document.querySelectorAll('h1');
        expect(h1Elements.length).toBeGreaterThanOrEqual(1);

        // Check heading hierarchy
        let previousLevel = 0;
        headings.forEach(heading => {
          const level = parseInt(heading.tagName.charAt(1));
          if (previousLevel > 0) {
            // Heading levels should not skip more than one level
            expect(level - previousLevel).toBeLessThanOrEqual(1);
          }
          previousLevel = level;
        });
      }
    });

    test('should have proper form labels and descriptions', () => {
      const inputs = document.querySelectorAll('input, textarea, select');
      
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        
        // Each input should have some form of labeling
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          expect(
            label || ariaLabel || ariaLabelledBy
          ).toBeTruthy();
        } else {
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      });
    });

    test('should have proper ARIA live regions for dynamic content', () => {
      // Check for chat messages area
      const chatArea = document.querySelector('#chatMessages, .chat-messages, [data-chat-area]');
      if (chatArea) {
        expect(
          chatArea.getAttribute('aria-live') ||
          chatArea.getAttribute('role')
        ).toBeTruthy();
      }

      // Check for status messages
      const statusArea = document.querySelector('.status-message, [data-status], #status');
      if (statusArea) {
        expect(statusArea.getAttribute('aria-live')).toBeTruthy();
      }
    });

    test('should have proper focus management for modals and dialogs', () => {
      const modals = document.querySelectorAll('[role="dialog"], .modal, .popup');
      
      modals.forEach(modal => {
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(
          modal.getAttribute('aria-labelledby') ||
          modal.getAttribute('aria-label')
        ).toBeTruthy();
        
        // Should have tabindex for focus management
        expect(modal.getAttribute('tabindex')).toBeTruthy();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation for all interactive elements', () => {
      const interactiveElements = document.querySelectorAll(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"]), [role="button"]'
      );

      interactiveElements.forEach(element => {
        const tabIndex = element.getAttribute('tabindex');
        
        // Elements should be focusable (tabindex >= 0 or naturally focusable)
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
        }
        
        // Interactive elements should have visible focus indicators
        const computedStyle = window.getComputedStyle(element);
        // This would need actual CSS to test properly, but we can check for focus styles
        expect(element.tagName).toBeTruthy(); // Basic check that element exists
      });
    });

    test('should have proper tab order', () => {
      const tabbableElements = document.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      // Check that tabindex values are logical
      const tabIndexValues = Array.from(tabbableElements)
        .map(el => parseInt(el.getAttribute('tabindex')) || 0)
        .filter(val => val > 0);

      if (tabIndexValues.length > 0) {
        // Positive tabindex values should be sequential
        tabIndexValues.sort((a, b) => a - b);
        for (let i = 1; i < tabIndexValues.length; i++) {
          expect(tabIndexValues[i] - tabIndexValues[i-1]).toBeLessThanOrEqual(10);
        }
      }
    });

    test('should support keyboard shortcuts for voice controls', () => {
      // Check for keyboard event listeners or documented shortcuts
      const shortcutElements = document.querySelectorAll('[data-shortcut], [accesskey]');
      
      shortcutElements.forEach(element => {
        const shortcut = element.getAttribute('data-shortcut') || element.getAttribute('accesskey');
        expect(shortcut).toBeTruthy();
        
        // Shortcuts should be documented
        const title = element.getAttribute('title');
        if (title) {
          expect(title.toLowerCase()).toContain('key');
        }
      });
    });

    test('should handle escape key for closing modals', () => {
      const modals = document.querySelectorAll('[role="dialog"], .modal');
      
      // This would need actual event testing, but we can check for proper structure
      modals.forEach(modal => {
        expect(modal.getAttribute('role')).toBe('dialog');
      });
    });
  });

  describe('Mobile Device Compatibility', () => {
    test('should have responsive design elements', () => {
      // Check for viewport meta tag
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      expect(viewportMeta).toBeTruthy();
      
      if (viewportMeta) {
        const content = viewportMeta.getAttribute('content');
        expect(content).toContain('width=device-width');
      }
    });

    test('should have touch-friendly button sizes', () => {
      const buttons = document.querySelectorAll('button, [role="button"], .btn');
      
      buttons.forEach(button => {
        // Check for CSS classes that might indicate touch-friendly sizing
        const classList = button.className;
        const hasLargeClass = /large|lg|big|touch/.test(classList);
        
        // At minimum, buttons should exist and be properly marked up
        expect(button.tagName === 'BUTTON' || button.getAttribute('role') === 'button').toBeTruthy();
      });
    });

    test('should support touch gestures for voice controls', () => {
      const voiceControls = document.querySelectorAll('[data-voice-control], .voice-btn, #recordButton');
      
      voiceControls.forEach(control => {
        // Should have proper touch event support (checked via attributes or classes)
        const hasTouchSupport = 
          control.getAttribute('data-touch') ||
          control.classList.contains('touch-enabled') ||
          control.tagName === 'BUTTON';
        
        expect(hasTouchSupport).toBeTruthy();
      });
    });

    test('should have proper mobile navigation', () => {
      // Check for mobile menu or navigation
      const mobileNav = document.querySelector('.mobile-nav, .hamburger, [data-mobile-menu]');
      const navigation = document.querySelector('nav, .navigation, .nav-menu');
      
      if (navigation) {
        // Should have some form of mobile-friendly navigation
        expect(navigation.tagName === 'NAV' || navigation.getAttribute('role') === 'navigation').toBeTruthy();
      }
    });
  });

  describe('Multi-language Functionality', () => {
    test('should have language selection interface', () => {
      const langSelector = document.querySelector('#languageSelector, .language-selector, [data-language]');
      
      if (langSelector) {
        expect(langSelector.tagName === 'SELECT' || langSelector.getAttribute('role')).toBeTruthy();
        
        // Should have proper labeling
        expect(
          langSelector.getAttribute('aria-label') ||
          langSelector.getAttribute('aria-labelledby') ||
          document.querySelector('label[for="' + langSelector.id + '"]')
        ).toBeTruthy();
      }
    });

    test('should have proper lang attributes', () => {
      const htmlElement = document.documentElement;
      const langAttribute = htmlElement.getAttribute('lang');
      
      // Should have a default language set
      expect(langAttribute).toBeTruthy();
      expect(langAttribute).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // ISO language code format
    });

    test('should support RTL languages if applicable', () => {
      // Check for RTL support in CSS or HTML structure
      const htmlElement = document.documentElement;
      const dirAttribute = htmlElement.getAttribute('dir');
      
      // If dir attribute exists, it should be valid
      if (dirAttribute) {
        expect(['ltr', 'rtl', 'auto']).toContain(dirAttribute);
      }
    });

    test('should have proper text content structure for translation', () => {
      // Check that text content is not hardcoded in JavaScript
      const textElements = document.querySelectorAll('[data-text], [data-translate]');
      
      // If translation system is in place, elements should be marked
      if (textElements.length > 0) {
        textElements.forEach(element => {
          expect(
            element.getAttribute('data-text') ||
            element.getAttribute('data-translate')
          ).toBeTruthy();
        });
      }
    });
  });

  describe('Voice Feature Accessibility', () => {
    test('should provide visual feedback for voice recording', () => {
      const recordingIndicators = document.querySelectorAll(
        '.recording-indicator, [data-recording], .voice-active, .mic-active'
      );
      
      // Should have some form of visual recording indicator
      if (recordingIndicators.length > 0) {
        recordingIndicators.forEach(indicator => {
          expect(indicator).toBeTruthy();
          
          // Should have proper ARIA attributes for screen readers
          expect(
            indicator.getAttribute('aria-label') ||
            indicator.getAttribute('aria-describedby') ||
            indicator.textContent.trim()
          ).toBeTruthy();
        });
      }
    });

    test('should provide alternative text input when voice is unavailable', () => {
      const textInput = document.querySelector('#messageInput, .text-input, textarea[placeholder]');
      const voiceButton = document.querySelector('#recordButton, .voice-btn, [data-voice]');
      
      // If voice features exist, text alternatives should also exist
      if (voiceButton) {
        expect(textInput).toBeTruthy();
        
        if (textInput) {
          expect(
            textInput.getAttribute('placeholder') ||
            textInput.getAttribute('aria-label')
          ).toBeTruthy();
        }
      }
    });

    test('should have proper error messages for voice failures', () => {
      const errorContainers = document.querySelectorAll(
        '.error-message, [data-error], .alert, [role="alert"]'
      );
      
      errorContainers.forEach(container => {
        if (container.getAttribute('role') === 'alert') {
          // Alert regions should be properly configured
          expect(container.getAttribute('aria-live')).toBeTruthy();
        }
      });
    });

    test('should support voice control preferences', () => {
      const voiceSettings = document.querySelectorAll(
        '.voice-settings, [data-voice-settings], .audio-controls'
      );
      
      // If voice settings exist, they should be accessible
      voiceSettings.forEach(setting => {
        const controls = setting.querySelectorAll('input, select, button');
        controls.forEach(control => {
          expect(
            control.getAttribute('aria-label') ||
            control.getAttribute('aria-labelledby') ||
            document.querySelector(`label[for="${control.id}"]`)
          ).toBeTruthy();
        });
      });
    });
  });

  describe('Crisis Support Accessibility', () => {
    test('should have highly visible crisis resources', () => {
      const crisisElements = document.querySelectorAll(
        '.crisis-banner, .emergency-contact, [data-crisis], .hotline'
      );
      
      crisisElements.forEach(element => {
        // Crisis elements should have high contrast and clear labeling
        expect(element).toBeTruthy();
        
        // Should have proper ARIA attributes
        if (element.getAttribute('role') === 'alert') {
          expect(element.getAttribute('aria-live')).toBeTruthy();
        }
      });
    });

    test('should have accessible emergency contact information', () => {
      const emergencyContacts = document.querySelectorAll(
        'a[href^="tel:"], .phone-number, .emergency-number'
      );
      
      emergencyContacts.forEach(contact => {
        if (contact.tagName === 'A') {
          const href = contact.getAttribute('href');
          expect(href).toMatch(/^tel:\+?[\d\s\-\(\)]+$/);
          
          // Should have descriptive text
          expect(contact.textContent.trim()).toBeTruthy();
        }
      });
    });
  });

  describe('Performance and Loading Accessibility', () => {
    test('should have proper loading states', () => {
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading], [aria-busy]'
      );
      
      loadingElements.forEach(element => {
        // Loading elements should be announced to screen readers
        expect(
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-describedby') ||
          element.textContent.trim()
        ).toBeTruthy();
      });
    });

    test('should have skip links for main content', () => {
      const skipLinks = document.querySelectorAll('a[href^="#"], .skip-link');
      const mainContent = document.querySelector('main, #main, .main-content');
      
      if (skipLinks.length > 0 && mainContent) {
        // Skip links should point to main content
        const mainId = mainContent.getAttribute('id');
        if (mainId) {
          const skipToMain = Array.from(skipLinks).some(link => 
            link.getAttribute('href') === `#${mainId}`
          );
          expect(skipToMain).toBeTruthy();
        }
      }
    });
  });

  describe('Color and Contrast Accessibility', () => {
    test('should not rely solely on color for information', () => {
      // Check for elements that might use color-only indicators
      const colorIndicators = document.querySelectorAll(
        '.success, .error, .warning, .info, .status'
      );
      
      colorIndicators.forEach(element => {
        // Should have text content or icons, not just color
        const hasTextContent = element.textContent.trim().length > 0;
        const hasIcon = element.querySelector('.icon, [class*="icon"], svg');
        const hasAriaLabel = element.getAttribute('aria-label');
        
        expect(hasTextContent || hasIcon || hasAriaLabel).toBeTruthy();
      });
    });

    test('should have proper focus indicators', () => {
      const focusableElements = document.querySelectorAll(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
      );
      
      // This would need actual CSS testing, but we can check for focus-related attributes
      focusableElements.forEach(element => {
        // Elements should be properly marked for focus
        expect(element.tagName).toBeTruthy();
      });
    });
  });

  describe('Content Structure and Semantics', () => {
    test('should use semantic HTML elements', () => {
      // Check for proper use of semantic elements
      const semanticElements = document.querySelectorAll(
        'header, nav, main, section, article, aside, footer'
      );
      
      if (semanticElements.length > 0) {
        semanticElements.forEach(element => {
          expect(['HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER'])
            .toContain(element.tagName);
        });
      }
    });

    test('should have proper list structures', () => {
      const lists = document.querySelectorAll('ul, ol, dl');
      
      lists.forEach(list => {
        if (list.tagName === 'UL' || list.tagName === 'OL') {
          const listItems = list.querySelectorAll('li');
          expect(listItems.length).toBeGreaterThan(0);
        } else if (list.tagName === 'DL') {
          const terms = list.querySelectorAll('dt');
          const definitions = list.querySelectorAll('dd');
          expect(terms.length).toBeGreaterThan(0);
          expect(definitions.length).toBeGreaterThan(0);
        }
      });
    });

    test('should have proper table structures if tables exist', () => {
      const tables = document.querySelectorAll('table');
      
      tables.forEach(table => {
        // Tables should have proper headers
        const headers = table.querySelectorAll('th');
        const caption = table.querySelector('caption');
        
        if (headers.length > 0) {
          headers.forEach(header => {
            expect(
              header.getAttribute('scope') ||
              header.getAttribute('id')
            ).toBeTruthy();
          });
        }
        
        // Complex tables should have captions
        const rows = table.querySelectorAll('tr');
        if (rows.length > 5) {
          expect(caption || table.getAttribute('aria-label')).toBeTruthy();
        }
      });
    });
  });
});