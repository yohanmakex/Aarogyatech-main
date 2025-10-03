/**
 * Voice-to-Voice Conversation Service
 * Combines speech-to-text, conversational AI, and text-to-speech for complete voice interactions
 */

const SpeechToTextService = require('./speechToTextService');
const TextToSpeechService = require('./textToSpeechService');
const ConversationalAIService = require('./conversationalAIService');
const ScreeningIntegrationService = require('./screeningIntegrationService');
const EventEmitter = require('events');

class VoiceConversationService extends EventEmitter {
  constructor() {
    super();
    
    // Initialize all required services
    this.speechToTextService = new SpeechToTextService();
    this.textToSpeechService = new TextToSpeechService();
    this.conversationalAIService = new ConversationalAIService();
    this.screeningIntegrationService = new ScreeningIntegrationService();
    
    // Configuration
    this.config = {
      maxConversationDuration: 30 * 60 * 1000, // 30 minutes
      maxAudioFileSize: 25 * 1024 * 1024, // 25MB
      defaultLanguage: 'en',
      enableScreeningRecommendations: true,
      voiceResponseDelay: 500, // Small delay before TTS for natural feel
    };
    
    // Active conversations tracking
    this.activeConversations = new Map();
    
    // Voice parameters for different contexts
    this.voiceProfiles = {
      supportive: { voice: 'nova', speed: 0.9, pitch: 1.0 },
      professional: { voice: 'onyx', speed: 1.0, pitch: 1.0 },
      friendly: { voice: 'alloy', speed: 1.1, pitch: 1.0 },
      crisis: { voice: 'echo', speed: 0.8, pitch: 0.9 } // Slower, calmer for crisis
    };
  }

  /**
   * Check if voice conversation service is available
   * @returns {boolean} True if all required services are available
   */
  isServiceAvailable() {
    return this.speechToTextService.isServiceAvailable() && 
           this.textToSpeechService.isServiceAvailable() &&
           this.conversationalAIService.isServiceAvailable();
  }

  /**
   * Get service status and capabilities
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return {
      isAvailable: this.isServiceAvailable(),
      services: {
        speechToText: {
          available: this.speechToTextService.isServiceAvailable(),
          activeApi: this.speechToTextService.activeApi
        },
        textToSpeech: {
          available: this.textToSpeechService.isServiceAvailable(),
          activeApi: this.textToSpeechService.activeApi
        },
        conversationalAI: {
          available: this.conversationalAIService.isServiceAvailable()
        }
      },
      capabilities: {
        realTimeConversation: true,
        multipleLanguages: true,
        crisisDetection: true,
        screeningRecommendations: this.config.enableScreeningRecommendations,
        voiceProfiles: Object.keys(this.voiceProfiles),
        maxDuration: this.config.maxConversationDuration
      },
      activeConversations: this.activeConversations.size
    };
  }

  /**
   * Start a new voice conversation session
   * @param {Object} options - Conversation options
   * @returns {Object} Conversation session information
   */
  startConversation(options = {}) {
    const sessionId = this.generateSessionId();
    const conversation = {
      sessionId,
      startTime: new Date(),
      language: options.language || this.config.defaultLanguage,
      voiceProfile: options.voiceProfile || 'supportive',
      user: options.user || { anonymous: true },
      messages: [],
      context: {
        screeningRecommendations: [],
        detectedSymptoms: [],
        conversationState: 'active'
      },
      statistics: {
        totalMessages: 0,
        audioProcessingTime: 0,
        textProcessingTime: 0,
        voiceGenerationTime: 0
      }
    };

    this.activeConversations.set(sessionId, conversation);
    
    // Set up conversation timeout
    setTimeout(() => {
      if (this.activeConversations.has(sessionId)) {
        this.endConversation(sessionId, 'timeout');
      }
    }, this.config.maxConversationDuration);

    this.emit('conversationStarted', { sessionId, conversation });
    
    return {
      sessionId,
      status: 'started',
      capabilities: this.getServiceStatus().capabilities,
      voiceProfiles: this.voiceProfiles,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt']
    };
  }

  /**
   * Process voice input and return voice response
   * @param {string} sessionId - Conversation session ID
   * @param {Buffer} audioBuffer - Audio input buffer
   * @param {string} contentType - Audio content type
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Complete voice interaction result
   */
  async processVoiceInput(sessionId, audioBuffer, contentType, options = {}) {
    const startTime = Date.now();
    
    if (!this.activeConversations.has(sessionId)) {
      throw new Error('Invalid or expired conversation session');
    }

    const conversation = this.activeConversations.get(sessionId);
    const processingId = this.generateProcessingId();

    try {
      // Emit processing started event
      this.emit('processingStarted', { 
        sessionId, 
        processingId, 
        stage: 'speech-to-text',
        audioSize: audioBuffer.length 
      });

      // Step 1: Speech-to-Text
      const transcriptionStart = Date.now();
      const transcriptionResult = await this.speechToTextService.transcribeAudio(
        audioBuffer, 
        contentType, 
        conversation.language
      );
      const transcriptionTime = Date.now() - transcriptionStart;

      this.emit('processingProgress', { 
        sessionId, 
        processingId, 
        stage: 'conversational-ai',
        transcription: transcriptionResult.text
      });

      // Step 2: Conversational AI Processing
      const aiStart = Date.now();
      const aiResponse = await this.conversationalAIService.processMessage(
        transcriptionResult.text,
        sessionId,
        {
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          timestamp: new Date().toISOString()
        },
        conversation.language
      );
      const aiTime = Date.now() - aiStart;

      // Step 3: Check for screening recommendations
      let screeningRecommendation = null;
      if (this.config.enableScreeningRecommendations) {
        const analysis = this.screeningIntegrationService.analyzeMessageForScreeningRecommendation(
          transcriptionResult.text,
          conversation.messages.slice(-5) // Recent conversation history
        );
        
        if (analysis.shouldRecommendScreening) {
          screeningRecommendation = {
            recommended: true,
            tools: analysis.recommendedTools,
            message: this.screeningIntegrationService.generateRecommendationMessage(analysis),
            urgency: analysis.urgency
          };
          
          // Update conversation context
          conversation.context.screeningRecommendations.push({
            timestamp: new Date(),
            analysis: analysis,
            recommendation: screeningRecommendation
          });
        }
      }

      // Determine voice profile based on context
      const contextualVoiceProfile = this.determineVoiceProfile(aiResponse, conversation);
      const voiceOptions = {
        ...this.voiceProfiles[contextualVoiceProfile],
        language: conversation.language
      };

      this.emit('processingProgress', { 
        sessionId, 
        processingId, 
        stage: 'text-to-speech',
        responseText: aiResponse.message,
        voiceProfile: contextualVoiceProfile
      });

      // Add small delay for natural conversation flow
      if (this.config.voiceResponseDelay > 0) {
        await this.sleep(this.config.voiceResponseDelay);
      }

      // Step 4: Text-to-Speech
      const ttsStart = Date.now();
      const speechResult = await this.textToSpeechService.synthesizeSpeech(
        aiResponse.message,
        voiceOptions
      );
      const ttsTime = Date.now() - ttsStart;

      // Update conversation record
      const userMessage = {
        role: 'user',
        content: transcriptionResult.text,
        timestamp: new Date(),
        audio: {
          duration: transcriptionResult.duration,
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.detectedLanguage
        },
        processingTime: transcriptionTime
      };

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date(),
        audio: {
          duration: speechResult.duration,
          voice: contextualVoiceProfile,
          synthesized: true
        },
        processingTime: aiTime + ttsTime,
        crisis: aiResponse.isCrisis,
        crisisData: aiResponse.crisisData,
        screeningRecommendation
      };

      conversation.messages.push(userMessage, assistantMessage);
      conversation.statistics.totalMessages += 2;
      conversation.statistics.audioProcessingTime += transcriptionTime;
      conversation.statistics.textProcessingTime += aiTime;
      conversation.statistics.voiceGenerationTime += ttsTime;

      // Update conversation context
      if (screeningRecommendation) {
        conversation.context.detectedSymptoms = [
          ...new Set([
            ...conversation.context.detectedSymptoms,
            ...screeningRecommendation.analysis?.detectedSymptoms || []
          ])
        ];
      }

      const totalTime = Date.now() - startTime;
      
      // Prepare response
      const result = {
        success: true,
        sessionId,
        processingId,
        interaction: {
          userInput: {
            text: transcriptionResult.text,
            audio: {
              duration: transcriptionResult.duration,
              confidence: transcriptionResult.confidence,
              language: transcriptionResult.detectedLanguage,
              isFallback: transcriptionResult.isFallback
            }
          },
          aiResponse: {
            text: aiResponse.message,
            audio: {
              buffer: speechResult.audioBuffer,
              contentType: speechResult.contentType,
              duration: speechResult.duration,
              voice: contextualVoiceProfile,
              isFallback: speechResult.isFallback
            },
            crisis: aiResponse.isCrisis,
            crisisData: aiResponse.crisisData
          },
          screeningRecommendation
        },
        performance: {
          totalTime,
          breakdown: {
            speechToText: transcriptionTime,
            conversationalAI: aiTime,
            textToSpeech: ttsTime,
            delay: this.config.voiceResponseDelay
          }
        },
        conversation: {
          messageCount: conversation.messages.length,
          duration: Date.now() - conversation.startTime.getTime(),
          context: conversation.context.conversationState
        }
      };

      this.emit('processingCompleted', { sessionId, processingId, result });
      
      // Handle crisis situations
      if (aiResponse.isCrisis) {
        this.emit('crisisDetected', { 
          sessionId, 
          crisisData: aiResponse.crisisData,
          conversation: conversation
        });
      }

      return result;

    } catch (error) {
      const errorTime = Date.now() - startTime;
      
      this.emit('processingError', { 
        sessionId, 
        processingId, 
        error: error.message,
        stage: this.getProcessingStageFromError(error),
        duration: errorTime
      });

      // Return fallback response
      return this.generateFallbackResponse(sessionId, error, audioBuffer, contentType);
    }
  }

  /**
   * End a conversation session
   * @param {string} sessionId - Session ID to end
   * @param {string} reason - Reason for ending ('user', 'timeout', 'error')
   * @returns {Object} Conversation summary
   */
  endConversation(sessionId, reason = 'user') {
    if (!this.activeConversations.has(sessionId)) {
      throw new Error('Conversation session not found');
    }

    const conversation = this.activeConversations.get(sessionId);
    conversation.endTime = new Date();
    conversation.endReason = reason;
    
    const summary = {
      sessionId,
      duration: conversation.endTime - conversation.startTime,
      messageCount: conversation.messages.length,
      statistics: conversation.statistics,
      context: conversation.context,
      endReason: reason
    };

    this.activeConversations.delete(sessionId);
    this.emit('conversationEnded', { sessionId, summary });

    return summary;
  }

  /**
   * Get conversation history
   * @param {string} sessionId - Session ID
   * @returns {Object} Conversation data
   */
  getConversation(sessionId) {
    if (!this.activeConversations.has(sessionId)) {
      throw new Error('Conversation session not found');
    }

    const conversation = this.activeConversations.get(sessionId);
    return {
      sessionId,
      startTime: conversation.startTime,
      duration: Date.now() - conversation.startTime.getTime(),
      messageCount: conversation.messages.length,
      language: conversation.language,
      voiceProfile: conversation.voiceProfile,
      context: conversation.context,
      statistics: conversation.statistics,
      recentMessages: conversation.messages.slice(-10) // Last 10 messages
    };
  }

  // Helper methods
  generateSessionId() {
    return 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateProcessingId() {
    return 'proc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  determineVoiceProfile(aiResponse, conversation) {
    if (aiResponse.isCrisis) {
      return 'crisis';
    }
    
    if (conversation.context.detectedSymptoms.length > 0) {
      return 'supportive';
    }
    
    // Check message content for tone
    const message = aiResponse.message.toLowerCase();
    if (message.includes('professional') || message.includes('recommend') || message.includes('suggest')) {
      return 'professional';
    }
    
    return conversation.voiceProfile || 'friendly';
  }

  getProcessingStageFromError(error) {
    const message = error.message.toLowerCase();
    if (message.includes('speech') || message.includes('transcri')) return 'speech-to-text';
    if (message.includes('conversation') || message.includes('ai')) return 'conversational-ai';
    if (message.includes('speech') || message.includes('synthesis')) return 'text-to-speech';
    return 'unknown';
  }

  async generateFallbackResponse(sessionId, error, audioBuffer, contentType) {
    try {
      const fallbackText = "I apologize, but I'm having trouble processing your voice input right now. Could you please try again or type your message instead?";
      
      const fallbackAudio = await this.textToSpeechService.synthesizeSpeech(
        fallbackText,
        { voice: 'nova', speed: 0.9 }
      );

      return {
        success: false,
        sessionId,
        error: error.message,
        fallbackResponse: {
          text: fallbackText,
          audio: {
            buffer: fallbackAudio.audioBuffer,
            contentType: fallbackAudio.contentType,
            duration: fallbackAudio.duration
          }
        }
      };
    } catch (fallbackError) {
      return {
        success: false,
        sessionId,
        error: error.message,
        fallbackError: fallbackError.message
      };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VoiceConversationService;