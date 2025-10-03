// Global variables
let currentLanguage = 'en';
let currentVoiceMode = 'text';
let aiLanguage = 'en'; // Language for AI interactions
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;

// Crisis response integration
let crisisResponseEnabled = true;

// Performance optimization instances
let audioOptimizer = null;
let progressiveLoader = null;

// Initialize performance optimizations and mobile enhancements
document.addEventListener('DOMContentLoaded', function() {
    if (typeof AudioOptimization !== 'undefined') {
        audioOptimizer = new AudioOptimization();
    }
    if (typeof ProgressiveLoadingManager !== 'undefined') {
        progressiveLoader = new ProgressiveLoadingManager();
    }
    
    // Mobile-specific optimizations
    initializeMobileOptimizations();
});

// Mobile optimization functions
function initializeMobileOptimizations() {
    // Prevent zoom on input focus for iOS
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
        inputs.forEach(input => {
            if (input.style.fontSize === '' || parseFloat(input.style.fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        });
    }
    
    // Add touch-friendly classes for mobile devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.add('touch-device');
    }
    
    // Optimize viewport for mobile
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // Add mobile-specific event listeners
    addMobileEventListeners();
}

function addMobileEventListeners() {
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            // Recalculate chat container height on orientation change
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                const windowHeight = window.innerHeight;
                const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
                const navHeight = document.querySelector('.main-nav')?.offsetHeight || 0;
                const inputHeight = document.querySelector('.chat-input-container')?.offsetHeight || 0;
                
                const availableHeight = windowHeight - headerHeight - navHeight - inputHeight - 100; // 100px for margins
                chatContainer.style.height = Math.max(300, availableHeight) + 'px';
            }
        }, 100);
    });
    
    // Improve touch scrolling for chat messages
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.style.webkitOverflowScrolling = 'touch';
        chatMessages.style.overflowScrolling = 'touch';
    }
    
    // Add swipe gestures for navigation (optional enhancement)
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    });
    
    function handleSwipeGesture() {
        const swipeThreshold = 100;
        const swipeDistance = touchEndX - touchStartX;
        
        if (Math.abs(swipeDistance) > swipeThreshold) {
            // Optional: Add swipe navigation between sections
            // This can be implemented based on user feedback
        }
    }
}

// Voice Recording State Management
const VoiceRecorder = {
    isSupported: function() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    },

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                } 
            });
            return stream;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.showError('Microphone access denied. Please allow microphone access to use voice features.');
            throw error;
        }
    },

    async startRecording() {
        if (isRecording) return;

        try {
            const stream = await this.requestMicrophonePermission();
            
            // Initialize MediaRecorder
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            };

            // Fallback for browsers that don't support webm
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/mp4';
            }

            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showError('Recording error occurred. Please try again.');
                this.stopRecording();
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms
            isRecording = true;
            
            this.updateUI('recording');
            this.startVisualFeedback(stream);

        } catch (error) {
            console.error('Failed to start recording:', error);
            this.handleRecordingError(error, 'start_recording_failed');
        }
    },

    stopRecording() {
        if (!isRecording || !mediaRecorder) return;

        try {
            mediaRecorder.stop();
            isRecording = false;
            this.updateUI('processing');
            this.stopVisualFeedback();
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showError('Error stopping recording.');
        }
    },

    async processRecording() {
        if (audioChunks.length === 0) {
            this.showError('No audio data recorded.');
            this.updateUI('idle');
            return;
        }

        try {
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { 
                type: mediaRecorder.mimeType || 'audio/webm' 
            });

            // Validate audio blob
            if (audioBlob.size === 0) {
                this.showError('Empty audio recording. Please try again.');
                this.updateUI('idle');
                return;
            }

            console.log('Audio blob created:', audioBlob.size, 'bytes');

            // Send to backend for processing
            await this.sendAudioToBackend(audioBlob);

        } catch (error) {
            console.error('Error processing recording:', error);
            this.showError('Error processing audio. Please try again.');
            this.updateUI('idle');
        }
    },

    async sendAudioToBackend(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('language', aiLanguage); // Include expected language

            const response = await fetch('/api/speech-to-text/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Speech-to-text service unavailable');
            }

            const result = await response.json();
            
            if (result.text && result.text.trim()) {
                this.handleTranscriptionResult(result.text.trim(), result.language);
            } else if (result.transcription && result.transcription.trim()) {
                this.handleTranscriptionResult(result.transcription.trim(), result.language);
            } else {
                this.showError('No speech detected. Please try speaking more clearly.');
            }

        } catch (error) {
            console.error('Error sending audio to backend:', error);
            this.showError('Failed to process speech. Please check your connection and try again.');
        } finally {
            this.updateUI('idle');
        }
    },

    handleTranscriptionResult(transcribedText, languageInfo = null) {
        console.log('Transcribed text:', transcribedText);
        
        // Show language detection info if available
        if (languageInfo && languageInfo.detected !== languageInfo.expected) {
            console.log(`Language detected: ${languageInfo.detected}, expected: ${languageInfo.expected}`);
        }
        
        // Insert transcribed text into chat input
        const chatInput = document.getElementById('chatInput');
        chatInput.value = transcribedText;

        // Get current mode workflow
        const workflow = VoiceModeManager.getWorkflowForMode(currentVoiceMode);
        
        // Auto-send based on mode configuration
        if (workflow && workflow.autoSend) {
            sendMessage();
        } else {
            // Show visual indication that text was transcribed
            chatInput.focus();
            chatInput.select();
        }

        this.clearError();
    },

    startVisualFeedback(stream) {
        try {
            // Create audio context for visualization
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            microphone.connect(analyser);
            
            // Start visual feedback animation
            this.animateVisualFeedback();
        } catch (error) {
            console.error('Error setting up visual feedback:', error);
        }
    },

    animateVisualFeedback() {
        if (!isRecording || !analyser) return;

        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Update visual indicator based on volume
        const recordingDot = document.querySelector('.recording-dot');
        if (recordingDot) {
            const intensity = Math.min(average / 50, 1);
            recordingDot.style.opacity = 0.3 + (intensity * 0.7);
        }

        // Continue animation
        requestAnimationFrame(() => this.animateVisualFeedback());
    },

    stopVisualFeedback() {
        if (audioContext) {
            audioContext.close();
            audioContext = null;
            analyser = null;
            microphone = null;
            dataArray = null;
        }
    },

    updateUI(state) {
        const voiceBtn = document.getElementById('voiceBtn');
        const stopBtn = document.getElementById('stopVoiceBtn');
        const voiceIndicator = document.getElementById('voiceIndicator');
        const processingIndicator = document.getElementById('processingIndicator');

        // Reset all states
        voiceBtn.classList.remove('listening');
        stopBtn.style.display = 'none';
        voiceIndicator.style.display = 'none';
        processingIndicator.style.display = 'none';

        switch (state) {
            case 'recording':
                voiceBtn.classList.add('listening');
                stopBtn.style.display = 'inline-block';
                voiceIndicator.style.display = 'flex';
                break;
            case 'processing':
                processingIndicator.style.display = 'inline-block';
                break;
            case 'idle':
            default:
                // All indicators already hidden
                break;
        }
    },

    showError(message) {
        const errorElement = document.getElementById('voiceError');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.clearError();
        }, 5000);
    },

    clearError() {
        const errorElement = document.getElementById('voiceError');
        errorElement.style.display = 'none';
        errorElement.textContent = '';
    },

    /**
     * Enhanced error handling with recovery options
     * @param {Error} error - Error object
     * @param {string} errorType - Type of error
     * @param {Object} context - Additional context
     */
    handleRecordingError(error, errorType, context = {}) {
        console.error(`Recording error [${errorType}]:`, error);
        
        // Classify the error
        const classification = this.classifyError(error, errorType);
        
        // Show appropriate error message with recovery options
        this.showErrorWithRecovery(classification);
        
        // Update UI state
        this.updateUI('error');
        
        // Attempt automatic recovery if possible
        if (classification.autoRecovery) {
            setTimeout(() => {
                this.attemptRecovery(classification);
            }, classification.recoveryDelay || 2000);
        }
    },

    /**
     * Classify error for appropriate handling
     * @param {Error} error - Error object
     * @param {string} errorType - Error type
     * @returns {Object} Error classification
     */
    classifyError(error, errorType) {
        const errorMessage = error.message.toLowerCase();
        
        // Permission errors
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorType === 'permission_denied') {
            return {
                type: 'permission',
                severity: 'high',
                userMessage: 'Microphone access is required for voice features. Please allow microphone access and try again.',
                recoveryOptions: ['grant_permission', 'use_text_mode'],
                autoRecovery: false
            };
        }
        
        // Device/hardware errors
        if (errorMessage.includes('device') || errorMessage.includes('hardware') || errorType === 'device_error') {
            return {
                type: 'device',
                severity: 'high',
                userMessage: 'There seems to be an issue with your microphone. Please check your device settings.',
                recoveryOptions: ['check_device', 'use_text_mode'],
                autoRecovery: false
            };
        }
        
        // Network/connection errors
        if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('fetch')) {
            return {
                type: 'network',
                severity: 'medium',
                userMessage: 'Connection issue detected. Retrying automatically...',
                recoveryOptions: ['retry', 'check_connection'],
                autoRecovery: true,
                recoveryDelay: 3000
            };
        }
        
        // Service unavailable errors
        if (errorMessage.includes('service unavailable') || errorMessage.includes('503')) {
            return {
                type: 'service_unavailable',
                severity: 'medium',
                userMessage: 'Voice services are temporarily unavailable. You can continue with text input.',
                recoveryOptions: ['retry_later', 'use_text_mode'],
                autoRecovery: true,
                recoveryDelay: 30000
            };
        }
        
        // Rate limiting errors
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
            return {
                type: 'rate_limit',
                severity: 'low',
                userMessage: 'Please wait a moment before trying again. High demand detected.',
                recoveryOptions: ['wait_and_retry'],
                autoRecovery: true,
                recoveryDelay: 10000
            };
        }
        
        // Browser compatibility errors
        if (errorMessage.includes('not supported') || errorType === 'not_supported') {
            return {
                type: 'compatibility',
                severity: 'high',
                userMessage: 'Voice recording is not supported in your browser. Please use text input instead.',
                recoveryOptions: ['use_text_mode', 'update_browser'],
                autoRecovery: false
            };
        }
        
        // Default/unknown errors
        return {
            type: 'unknown',
            severity: 'medium',
            userMessage: 'An unexpected error occurred. Please try again or use text input.',
            recoveryOptions: ['retry', 'use_text_mode'],
            autoRecovery: true,
            recoveryDelay: 5000
        };
    },

    /**
     * Show error message with recovery options
     * @param {Object} classification - Error classification
     */
    showErrorWithRecovery(classification) {
        const errorElement = document.getElementById('voiceError');
        const errorContainer = errorElement.parentElement;
        
        // Clear existing content
        errorElement.innerHTML = '';
        
        // Create error message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'error-message';
        messageDiv.textContent = classification.userMessage;
        errorElement.appendChild(messageDiv);
        
        // Create recovery options
        if (classification.recoveryOptions && classification.recoveryOptions.length > 0) {
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'error-recovery-options';
            
            classification.recoveryOptions.forEach(option => {
                const button = document.createElement('button');
                button.className = 'recovery-option-btn';
                button.onclick = () => this.executeRecoveryOption(option, classification);
                
                switch (option) {
                    case 'grant_permission':
                        button.textContent = 'Grant Permission';
                        break;
                    case 'use_text_mode':
                        button.textContent = 'Use Text Mode';
                        break;
                    case 'retry':
                        button.textContent = 'Try Again';
                        break;
                    case 'check_device':
                        button.textContent = 'Check Device';
                        break;
                    case 'check_connection':
                        button.textContent = 'Check Connection';
                        break;
                    case 'retry_later':
                        button.textContent = 'Retry Later';
                        break;
                    case 'wait_and_retry':
                        button.textContent = 'Wait & Retry';
                        break;
                    case 'update_browser':
                        button.textContent = 'Update Browser';
                        break;
                    default:
                        button.textContent = 'Try Again';
                }
                
                optionsDiv.appendChild(button);
            });
            
            errorElement.appendChild(optionsDiv);
        }
        
        // Show error with appropriate styling based on severity
        errorElement.className = `voice-error ${classification.severity}-severity`;
        errorElement.style.display = 'block';
        
        // Auto-hide for low severity errors
        if (classification.severity === 'low') {
            setTimeout(() => {
                this.clearError();
            }, 8000);
        }
    },

    /**
     * Execute recovery option
     * @param {string} option - Recovery option
     * @param {Object} classification - Error classification
     */
    executeRecoveryOption(option, classification) {
        switch (option) {
            case 'grant_permission':
                this.requestMicrophonePermission()
                    .then(() => {
                        this.clearError();
                        this.showSuccess('Microphone access granted! You can now use voice features.');
                    })
                    .catch(error => {
                        this.showError('Unable to access microphone. Please check your browser settings.');
                    });
                break;
                
            case 'use_text_mode':
                VoiceModeManager.setMode('text');
                this.clearError();
                this.showInfo('Switched to text-only mode. You can type your messages below.');
                break;
                
            case 'retry':
                this.clearError();
                setTimeout(() => {
                    this.startRecording();
                }, 1000);
                break;
                
            case 'check_device':
                this.clearError();
                this.showInfo('Please check that your microphone is connected and working properly.');
                break;
                
            case 'check_connection':
                this.clearError();
                this.showInfo('Please check your internet connection and try again.');
                break;
                
            case 'retry_later':
                this.clearError();
                this.showInfo('Voice services will be retried automatically in a few moments.');
                break;
                
            case 'wait_and_retry':
                this.clearError();
                this.showInfo('Waiting for service availability...');
                setTimeout(() => {
                    this.startRecording();
                }, 10000);
                break;
                
            case 'update_browser':
                this.clearError();
                this.showInfo('Please update your browser to use voice features, or continue with text input.');
                break;
                
            default:
                this.clearError();
                this.startRecording();
        }
    },

    /**
     * Attempt automatic recovery
     * @param {Object} classification - Error classification
     */
    attemptRecovery(classification) {
        if (!classification.autoRecovery) return;
        
        switch (classification.type) {
            case 'network':
                this.showInfo('Retrying connection...');
                setTimeout(() => {
                    this.startRecording();
                }, 1000);
                break;
                
            case 'service_unavailable':
                this.checkServiceAvailability()
                    .then(available => {
                        if (available) {
                            this.clearError();
                            this.showSuccess('Voice services are back online!');
                        } else {
                            this.showInfo('Voice services are still unavailable. Please try text mode.');
                        }
                    });
                break;
                
            case 'rate_limit':
                this.showInfo('Retrying after rate limit...');
                setTimeout(() => {
                    this.startRecording();
                }, 2000);
                break;
                
            default:
                this.showInfo('Attempting automatic recovery...');
                setTimeout(() => {
                    this.startRecording();
                }, 3000);
        }
    },

    /**
     * Check if voice services are available
     * @returns {Promise<boolean>} Service availability
     */
    async checkServiceAvailability() {
        try {
            const response = await fetch('/api/speech-to-text/status');
            const data = await response.json();
            return data.status === 'available';
        } catch (error) {
            return false;
        }
    },

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    },

    /**
     * Show info message
     * @param {string} message - Info message
     */
    showInfo(message) {
        this.showMessage(message, 'info');
    },

    /**
     * Show message with type
     * @param {string} message - Message text
     * @param {string} type - Message type (success, info, warning, error)
     */
    showMessage(message, type = 'info') {
        const errorElement = document.getElementById('voiceError');
        errorElement.textContent = message;
        errorElement.className = `voice-error ${type}`;
        errorElement.style.display = 'block';
        
        // Auto-hide success and info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                this.clearError();
            }, 5000);
        }
    }
};

// Voice Mode Management
const VoiceModeManager = {
    currentMode: 'text',
    
    setMode(mode) {
        // Stop any ongoing recording when switching modes
        if (isRecording) {
            VoiceRecorder.stopRecording();
        }
        
        // Stop any ongoing audio playback when switching modes
        AudioPlaybackManager.stop();
        
        this.currentMode = mode;
        currentVoiceMode = mode;
        
        // Configure audio playback manager for voice-to-voice mode
        AudioPlaybackManager.setVoiceToVoiceMode(mode === 'voice-to-voice');
        
        // Update UI buttons
        this.updateModeButtons(mode);
        
        // Update voice controls visibility and behavior
        this.updateVoiceControls(mode);
        
        // Update chat input placeholder based on mode
        this.updateInputPlaceholder(mode);
        
        // Show mode-specific instructions
        this.showModeInstructions(mode);
        
        console.log('Voice mode set to:', mode);
    },
    
    updateModeButtons(activeMode) {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === activeMode) {
                btn.classList.add('active');
            }
        });
    },
    
    updateVoiceControls(mode) {
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceToTextBtn = document.getElementById('voiceToTextBtn');
        const chatInput = document.getElementById('chatInput');
        
        // Reset all voice controls
        voiceBtn.style.display = 'none';
        voiceToTextBtn.style.display = 'none';
        
        switch (mode) {
            case 'text':
                // Text-only mode: no voice controls
                chatInput.disabled = false;
                break;
                
            case 'voice-to-text':
                // Voice input, text output
                if (VoiceRecorder.isSupported()) {
                    voiceBtn.style.display = 'flex';
                    voiceBtn.onclick = () => VoiceRecorder.startRecording();
                    voiceBtn.title = 'Click to record voice message';
                    chatInput.disabled = false;
                } else {
                    this.showVoiceNotSupported();
                }
                break;
                
            case 'voice-to-voice':
                // Voice input, voice output
                if (VoiceRecorder.isSupported()) {
                    voiceBtn.style.display = 'flex';
                    voiceBtn.onclick = () => VoiceRecorder.startRecording();
                    voiceBtn.title = 'Click to start voice conversation';
                    chatInput.disabled = false; // Still allow text input as fallback
                } else {
                    this.showVoiceNotSupported();
                }
                break;
        }
    },
    
    updateInputPlaceholder(mode) {
        const chatInput = document.getElementById('chatInput');
        const lang = currentLanguage;
        
        const placeholders = {
            'text': {
                'en': 'Type your message here...',
                'mr': 'तुमचा संदेश येथे टाइप करा...'
            },
            'voice-to-text': {
                'en': 'Type or click 🎤 to speak...',
                'mr': 'टाइप करा किंवा बोलण्यासाठी 🎤 दाबा...'
            },
            'voice-to-voice': {
                'en': 'Type or click 🎤 for voice conversation...',
                'mr': 'आवाज संभाषणासाठी टाइप करा किंवा 🎤 दाबा...'
            }
        };
        
        chatInput.placeholder = placeholders[mode][lang] || placeholders[mode]['en'];
    },
    
    showModeInstructions(mode) {
        // Clear any existing error messages
        VoiceRecorder.clearError();
        
        const instructions = {
            'text': {
                'en': '',
                'mr': ''
            },
            'voice-to-text': {
                'en': 'Voice-to-Text mode: Speak your message and receive text responses.',
                'mr': 'आवाज-ते-मजकूर मोड: तुमचा संदेश बोला आणि मजकूर प्रतिसाद मिळवा.'
            },
            'voice-to-voice': {
                'en': 'Voice-to-Voice mode: Have a natural conversation with voice responses.',
                'mr': 'आवाज-ते-आवाज मोड: आवाज प्रतिसादांसह नैसर्गिक संभाषण करा.'
            }
        };
        
        const instruction = instructions[mode][currentLanguage];
        if (instruction) {
            this.showModeMessage(instruction, 'info');
        }
    },
    
    showModeMessage(message, type = 'info') {
        // Create or update mode message element
        let modeMessage = document.getElementById('modeMessage');
        if (!modeMessage) {
            modeMessage = document.createElement('div');
            modeMessage.id = 'modeMessage';
            modeMessage.style.cssText = `
                background: rgba(59, 130, 246, 0.1);
                color: #60a5fa;
                padding: 8px 12px;
                border-radius: 8px;
                margin-top: 10px;
                font-size: 12px;
                border: 1px solid rgba(59, 130, 246, 0.2);
                display: none;
            `;
            document.querySelector('.chat-input-container').appendChild(modeMessage);
        }
        
        // Update styling based on type
        if (type === 'error') {
            modeMessage.style.background = 'rgba(239, 68, 68, 0.1)';
            modeMessage.style.color = '#fca5a5';
            modeMessage.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        } else {
            modeMessage.style.background = 'rgba(59, 130, 246, 0.1)';
            modeMessage.style.color = '#60a5fa';
            modeMessage.style.borderColor = 'rgba(59, 130, 246, 0.2)';
        }
        
        modeMessage.textContent = message;
        modeMessage.style.display = 'block';
        
        // Auto-hide after 3 seconds for info messages
        if (type === 'info') {
            setTimeout(() => {
                modeMessage.style.display = 'none';
            }, 3000);
        }
    },
    
    showVoiceNotSupported() {
        const message = currentLanguage === 'mr' 
            ? 'आवाज रेकॉर्डिंग तुमच्या ब्राउझरमध्ये समर्थित नाही.'
            : 'Voice recording is not supported in your browser.';
        this.showModeMessage(message, 'error');
        
        // Fallback to text mode
        this.setMode('text');
    },
    
    getWorkflowForMode(mode) {
        return {
            'text': {
                input: 'text',
                output: 'text',
                autoSend: false
            },
            'voice-to-text': {
                input: 'voice',
                output: 'text',
                autoSend: false
            },
            'voice-to-voice': {
                input: 'voice',
                output: 'voice',
                autoSend: true
            }
        }[mode];
    }
};

// Wrapper function for backward compatibility
function setVoiceMode(mode) {
    VoiceModeManager.setMode(mode);
}

// Voice Recording Controls
function startVoiceRecording() {
    VoiceRecorder.startRecording();
}

function stopVoiceRecording() {
    VoiceRecorder.stopRecording();
}

function startVoiceToText() {
    if (currentVoiceMode === 'voice-to-text' || currentVoiceMode === 'voice-to-voice') {
        VoiceRecorder.startRecording();
    }
}

// Audio Playback Management System
const AudioPlaybackManager = {
    // Audio playback state
    audioContext: null,
    currentAudio: null,
    playbackQueue: [],
    isPlaying: false,
    isPaused: false,
    currentPlaybackId: null,
    
    // Playback controls
    volume: 1.0,
    playbackRate: 1.0,
    
    // Visual indicators
    playbackIndicator: null,
    progressBar: null,
    
    // Voice-to-voice conversation state
    isVoiceToVoiceActive: false,
    autoPlayEnabled: true,
    
    /**
     * Initialize the audio playback system
     */
    async initialize() {
        try {
            // Initialize Web Audio API context (optional for enhanced features)
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Set up audio context resume (required for some browsers)
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            } catch (audioContextError) {
                console.warn('Web Audio API not available, using basic audio playback:', audioContextError);
                this.audioContext = null;
            }
            
            // Get UI elements
            this.playbackIndicator = document.getElementById('playbackIndicator');
            this.progressBar = document.getElementById('audioProgressBar');
            
            console.log('Audio playback system initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio playback system:', error);
            return false;
        }
    },
    
    /**
     * Play text as speech with queue management
     * @param {string} text - Text to convert to speech
     * @param {Object} options - Playback options
     * @returns {Promise<string>} Playback ID
     */
    async playText(text, options = {}) {
        const playbackId = this.generatePlaybackId();
        
        const playbackItem = {
            id: playbackId,
            text: text,
            options: {
                priority: options.priority || 'normal', // 'high', 'normal', 'low'
                autoPlay: options.autoPlay !== false,
                onStart: options.onStart,
                onEnd: options.onEnd,
                onError: options.onError
            },
            status: 'queued',
            audioBlob: null,
            audioUrl: null,
            audioElement: null
        };
        
        // Add to queue based on priority
        this.addToQueue(playbackItem);
        
        // Start processing queue if not already playing
        if (!this.isPlaying) {
            this.processQueue();
        }
        
        return playbackId;
    },
    
    /**
     * Add playback item to queue with priority handling
     * @param {Object} playbackItem - Item to add to queue
     */
    addToQueue(playbackItem) {
        if (playbackItem.options.priority === 'high') {
            // High priority items go to the front (after currently playing item)
            this.playbackQueue.unshift(playbackItem);
        } else {
            // Normal and low priority items go to the end
            this.playbackQueue.push(playbackItem);
        }
        
        this.updateQueueIndicator();
    },
    
    /**
     * Process the playback queue
     */
    async processQueue() {
        if (this.playbackQueue.length === 0) {
            this.isPlaying = false;
            this.hidePlaybackIndicator();
            this.onQueueEmpty();
            return;
        }
        
        this.isPlaying = true;
        const currentItem = this.playbackQueue.shift();
        this.currentPlaybackId = currentItem.id;
        
        try {
            await this.playItem(currentItem);
        } catch (error) {
            console.error('Error playing audio item:', error);
            if (currentItem.options.onError) {
                currentItem.options.onError(error);
            }
        }
        
        // Continue with next item in queue
        setTimeout(() => this.processQueue(), 100);
    },
    
    /**
     * Play a single audio item
     * @param {Object} playbackItem - Item to play
     */
    async playItem(playbackItem) {
        try {
            playbackItem.status = 'loading';
            this.showPlaybackIndicator('Loading audio...');
            
            // Synthesize speech if not already done
            if (!playbackItem.audioBlob) {
                playbackItem.audioBlob = await this.synthesizeSpeech(playbackItem.text);
            }
            
            // Create audio URL and element
            playbackItem.audioUrl = URL.createObjectURL(playbackItem.audioBlob);
            playbackItem.audioElement = new Audio(playbackItem.audioUrl);
            
            // Configure audio element
            this.configureAudioElement(playbackItem.audioElement);
            
            // Set up event handlers
            this.setupAudioEventHandlers(playbackItem);
            
            // Start playback
            playbackItem.status = 'playing';
            this.currentAudio = playbackItem.audioElement;
            
            if (playbackItem.options.onStart) {
                playbackItem.options.onStart(playbackItem.id);
            }
            
            this.showPlaybackIndicator('Playing response...');
            await playbackItem.audioElement.play();
            
            // Wait for playback to complete
            await this.waitForPlaybackComplete(playbackItem.audioElement);
            
            // Cleanup
            this.cleanupPlaybackItem(playbackItem);
            
            if (playbackItem.options.onEnd) {
                playbackItem.options.onEnd(playbackItem.id);
            }
            
        } catch (error) {
            this.cleanupPlaybackItem(playbackItem);
            throw error;
        }
    },
    
    /**
     * Synthesize speech from text
     * @param {string} text - Text to synthesize
     * @returns {Promise<Blob>} Audio blob
     */
    async synthesizeSpeech(text) {
        const response = await fetch('/api/text-to-speech/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text,
                language: aiLanguage, // Include user's preferred language
                options: {
                    speed: this.playbackRate,
                    volume: this.volume
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Text-to-speech service unavailable');
        }
        
        return await response.blob();
    },
    
    /**
     * Configure audio element with playback settings
     * @param {HTMLAudioElement} audioElement - Audio element to configure
     */
    configureAudioElement(audioElement) {
        audioElement.volume = this.volume;
        audioElement.playbackRate = this.playbackRate;
        audioElement.preload = 'auto';
    },
    
    /**
     * Set up event handlers for audio element
     * @param {Object} playbackItem - Playback item
     */
    setupAudioEventHandlers(playbackItem) {
        const audio = playbackItem.audioElement;
        
        audio.onloadstart = () => {
            this.updateProgressBar(0);
        };
        
        audio.onloadedmetadata = () => {
            this.updateProgressBar(0, audio.duration);
        };
        
        audio.ontimeupdate = () => {
            if (audio.duration) {
                const progress = (audio.currentTime / audio.duration) * 100;
                this.updateProgressBar(progress, audio.duration, audio.currentTime);
            }
        };
        
        audio.onended = () => {
            this.updateProgressBar(100);
        };
        
        audio.onerror = (error) => {
            console.error('Audio playback error:', error);
        };
    },
    
    /**
     * Wait for audio playback to complete
     * @param {HTMLAudioElement} audioElement - Audio element
     * @returns {Promise<void>}
     */
    waitForPlaybackComplete(audioElement) {
        return new Promise((resolve, reject) => {
            const onEnded = () => {
                cleanup();
                resolve();
            };
            
            const onError = (error) => {
                cleanup();
                reject(new Error('Audio playback failed'));
            };
            
            const cleanup = () => {
                audioElement.removeEventListener('ended', onEnded);
                audioElement.removeEventListener('error', onError);
            };
            
            audioElement.addEventListener('ended', onEnded);
            audioElement.addEventListener('error', onError);
        });
    },
    
    /**
     * Clean up playback item resources
     * @param {Object} playbackItem - Item to clean up
     */
    cleanupPlaybackItem(playbackItem) {
        if (playbackItem.audioUrl) {
            URL.revokeObjectURL(playbackItem.audioUrl);
        }
        if (playbackItem.audioElement) {
            playbackItem.audioElement.pause();
            playbackItem.audioElement.src = '';
            playbackItem.audioElement = null;
        }
        playbackItem.status = 'completed';
    },
    
    /**
     * Pause current playback
     */
    pause() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPaused = true;
            this.updatePlaybackControls();
        }
    },
    
    /**
     * Resume paused playback
     */
    resume() {
        if (this.currentAudio && this.currentAudio.paused && this.isPaused) {
            this.currentAudio.play();
            this.isPaused = false;
            this.updatePlaybackControls();
        }
    },
    
    /**
     * Stop current playback and clear queue
     */
    stop() {
        // Stop current audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        
        // Clear queue
        this.playbackQueue.forEach(item => this.cleanupPlaybackItem(item));
        this.playbackQueue = [];
        
        // Reset state
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPlaybackId = null;
        this.currentAudio = null;
        
        this.hidePlaybackIndicator();
        this.updateQueueIndicator();
        this.updatePlaybackControls();
    },
    
    /**
     * Skip to next item in queue
     */
    skipToNext() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = this.currentAudio.duration || 0;
            // This will trigger the 'ended' event and move to next item
        }
    },
    
    /**
     * Set playback volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    },
    
    /**
     * Set playback rate/speed
     * @param {number} rate - Playback rate (0.5 to 2.0)
     */
    setPlaybackRate(rate) {
        this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
        if (this.currentAudio) {
            this.currentAudio.playbackRate = this.playbackRate;
        }
    },
    
    /**
     * Show playback indicator with message
     * @param {string} message - Status message
     */
    showPlaybackIndicator(message = 'Playing response...') {
        if (this.playbackIndicator) {
            this.playbackIndicator.style.display = 'flex';
            const messageElement = this.playbackIndicator.querySelector('span');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    },
    
    /**
     * Hide playback indicator
     */
    hidePlaybackIndicator() {
        if (this.playbackIndicator) {
            this.playbackIndicator.style.display = 'none';
        }
        this.updateProgressBar(0);
    },
    
    /**
     * Update progress bar
     * @param {number} progress - Progress percentage (0-100)
     * @param {number} duration - Total duration in seconds
     * @param {number} currentTime - Current time in seconds
     */
    updateProgressBar(progress, duration = 0, currentTime = 0) {
        if (this.progressBar) {
            this.progressBar.style.width = `${progress}%`;
            
            // Update time display if available
            const timeDisplay = document.getElementById('audioTimeDisplay');
            if (timeDisplay && duration > 0) {
                const current = this.formatTime(currentTime);
                const total = this.formatTime(duration);
                timeDisplay.textContent = `${current} / ${total}`;
            }
        }
    },
    
    /**
     * Update queue indicator
     */
    updateQueueIndicator() {
        const queueIndicator = document.getElementById('audioQueueIndicator');
        if (queueIndicator) {
            const queueLength = this.playbackQueue.length;
            if (queueLength > 0) {
                queueIndicator.style.display = 'inline-block';
                queueIndicator.textContent = `${queueLength} in queue`;
            } else {
                queueIndicator.style.display = 'none';
            }
        }
    },
    
    /**
     * Update playback controls UI
     */
    updatePlaybackControls() {
        const pauseBtn = document.getElementById('audioPauseBtn');
        const resumeBtn = document.getElementById('audioResumeBtn');
        const stopBtn = document.getElementById('audioStopBtn');
        
        if (pauseBtn) pauseBtn.style.display = this.isPlaying && !this.isPaused ? 'inline-block' : 'none';
        if (resumeBtn) resumeBtn.style.display = this.isPaused ? 'inline-block' : 'none';
        if (stopBtn) stopBtn.style.display = this.isPlaying ? 'inline-block' : 'none';
    },
    
    /**
     * Handle queue empty event
     */
    onQueueEmpty() {
        // If in voice-to-voice mode, prepare for next voice input
        if (this.isVoiceToVoiceActive && currentVoiceMode === 'voice-to-voice') {
            this.prepareForNextVoiceInput();
        }
    },
    
    /**
     * Prepare for next voice input in voice-to-voice mode
     */
    prepareForNextVoiceInput() {
        // Small delay to allow user to process the response
        setTimeout(() => {
            if (this.autoPlayEnabled && currentVoiceMode === 'voice-to-voice') {
                // Show visual cue that system is ready for next input
                this.showVoiceReadyIndicator();
                
                // Auto-start recording after a brief pause (optional)
                setTimeout(() => {
                    if (this.autoPlayEnabled && !isRecording) {
                        VoiceRecorder.startRecording();
                    }
                }, 1500); // 1.5 second delay
            }
        }, 500);
    },
    
    /**
     * Show indicator that system is ready for voice input
     */
    showVoiceReadyIndicator() {
        const readyIndicator = document.getElementById('voiceReadyIndicator');
        if (readyIndicator) {
            readyIndicator.style.display = 'flex';
            setTimeout(() => {
                readyIndicator.style.display = 'none';
            }, 3000);
        }
    },
    
    /**
     * Enable/disable voice-to-voice mode
     * @param {boolean} enabled - Whether to enable voice-to-voice mode
     */
    setVoiceToVoiceMode(enabled) {
        this.isVoiceToVoiceActive = enabled;
        this.autoPlayEnabled = enabled;
    },
    
    /**
     * Get current playback status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            queueLength: this.playbackQueue.length,
            currentPlaybackId: this.currentPlaybackId,
            volume: this.volume,
            playbackRate: this.playbackRate,
            isVoiceToVoiceActive: this.isVoiceToVoiceActive
        };
    },
    
    /**
     * Generate unique playback ID
     * @returns {string} Unique ID
     */
    generatePlaybackId() {
        return `playback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * Format time in MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    /**
     * Clear all audio resources and reset
     */
    cleanup() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
};

// Enhanced Chat Interface Management
const ChatInterface = {
    messageHistory: [],
    typingIndicatorId: null,
    
    sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Add user message to chat and history
        this.addMessage('user', message);
        chatInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Send to AI backend
        this.sendToAI(message);
    },

    addMessage(sender, message, options = {}) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        // Add timestamp
        const timestamp = new Date();
        messageDiv.dataset.timestamp = timestamp.toISOString();
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Handle different message types
        if (options.isTyping) {
            messageContent.innerHTML = this.createTypingAnimation();
            messageDiv.id = 'typing-indicator';
        } else {
            messageContent.textContent = message;
            
            // Add message to history
            this.messageHistory.push({
                sender,
                message,
                timestamp,
                id: Date.now() + Math.random()
            });
        }
        
        messageDiv.appendChild(messageContent);
        
        // Add message actions for bot messages
        if (sender === 'bot' && !options.isTyping) {
            const actionsDiv = this.createMessageActions(message);
            messageDiv.appendChild(actionsDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom with smooth animation
        this.scrollToBottom();
        
        return messageDiv;
    },

    createTypingAnimation() {
        return `
            <div class="typing-animation">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
    },

    createMessageActions(message) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.innerHTML = `
            <button class="action-btn" onclick="ChatInterface.repeatMessage('${message.replace(/'/g, "\\'")}')">
                🔊 <span data-en="Play" data-mr="वाजवा">Play</span>
            </button>
            <button class="action-btn" onclick="ChatInterface.copyMessage('${message.replace(/'/g, "\\'")}')">
                📋 <span data-en="Copy" data-mr="कॉपी">Copy</span>
            </button>
        `;
        return actionsDiv;
    },

    showTypingIndicator() {
        // Remove existing typing indicator
        this.hideTypingIndicator();
        
        // Add new typing indicator
        const typingMessage = this.addMessage('bot', '', { isTyping: true });
        this.typingIndicatorId = 'typing-indicator';
        
        // Show processing indicator in input area
        const processingIndicator = document.getElementById('processingIndicator');
        processingIndicator.style.display = 'inline-block';
    },

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.typingIndicatorId = null;
        
        // Hide processing indicator
        const processingIndicator = document.getElementById('processingIndicator');
        processingIndicator.style.display = 'none';
    },

    async sendToAI(message) {
        try {
            const response = await fetch('/api/conversational-ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    message,
                    language: aiLanguage, // Include user's preferred language
                    history: this.getRecentHistory(5) // Send last 5 messages for context
                })
            });

            if (!response.ok) {
                throw new Error('AI service unavailable');
            }

            const result = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Check if this is a crisis response
            if (result.isCrisis && result.crisisData && crisisResponseEnabled) {
                // Handle crisis situation
                this.handleCrisisResponse(result);
            } else {
                // Handle normal response
                this.addMessage('bot', result.message || result.response);

                // Handle output based on current voice mode
                const workflow = VoiceModeManager.getWorkflowForMode(currentVoiceMode);
                if (workflow && workflow.output === 'voice') {
                    await this.playTextAsSpeech(result.message || result.response);
                }
            }

        } catch (error) {
            console.error('Error sending message to AI:', error);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            const errorMessage = currentLanguage === 'mr' 
                ? 'मला माफ करा, पण मला आत्ता जोडण्यात अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.'
                : 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.';
            this.addMessage('bot', errorMessage);
        }
    },

    handleCrisisResponse(result) {
        // Add crisis message to chat with special styling
        const messageDiv = this.addMessage('bot', result.message);
        messageDiv.classList.add('crisis-message', `crisis-${result.crisisData.severity}`);
        
        // Trigger crisis response system
        if (typeof CrisisResponseManager !== 'undefined') {
            // Dispatch crisis event for the crisis response manager
            const crisisEvent = new CustomEvent('crisisDetected', {
                detail: result.crisisData
            });
            document.dispatchEvent(crisisEvent);
        }
        
        // Handle voice output for crisis messages (if in voice mode)
        const workflow = VoiceModeManager.getWorkflowForMode(currentVoiceMode);
        if (workflow && workflow.output === 'voice') {
            // For crisis situations, always play the response to ensure user hears it
            this.playTextAsSpeech(result.message);
        }
        
        // Log crisis detection for monitoring
        console.log('[CRISIS DETECTED]', {
            severity: result.crisisData.severity,
            escalationLevel: result.crisisData.escalationLevel,
            timestamp: new Date().toISOString()
        });
    },

    async playTextAsSpeech(text) {
        return AudioPlaybackManager.playText(text);
    },

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    },

    getRecentHistory(count = 5) {
        return this.messageHistory.slice(-count).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.message
        }));
    },

    clearHistory() {
        this.messageHistory = [];
        const chatMessages = document.getElementById('chatMessages');
        
        // Keep only the initial bot message
        const messages = chatMessages.querySelectorAll('.message');
        messages.forEach((msg, index) => {
            if (index > 0) { // Keep first message (welcome message)
                msg.remove();
            }
        });
    },

    exportHistory() {
        const history = this.messageHistory.map(msg => ({
            timestamp: msg.timestamp,
            sender: msg.sender,
            message: msg.message
        }));
        
        const dataStr = JSON.stringify(history, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `mindcare-chat-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    },

    // Message action handlers
    async repeatMessage(message) {
        await AudioPlaybackManager.playText(message, { priority: 'high' });
    },

    copyMessage(message) {
        navigator.clipboard.writeText(message).then(() => {
            // Show brief confirmation
            const confirmation = document.createElement('div');
            confirmation.textContent = currentLanguage === 'mr' ? 'कॉपी केले!' : 'Copied!';
            confirmation.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(16, 185, 129, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                z-index: 1000;
                font-size: 14px;
            `;
            document.body.appendChild(confirmation);
            
            setTimeout(() => {
                confirmation.remove();
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy message:', err);
        });
    }
};

// Wrapper functions for backward compatibility
function sendMessage() {
    ChatInterface.sendMessage();
}

function addMessageToChat(sender, message) {
    ChatInterface.addMessage(sender, message);
}



// Utility functions
function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-area').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Language switching
function switchLanguage(lang) {
    currentLanguage = lang;
    aiLanguage = lang; // Also update AI language preference
    
    // Update language buttons
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`lang${lang.charAt(0).toUpperCase() + lang.slice(1)}`).classList.add('active');
    
    // Update all text elements
    document.querySelectorAll('[data-en]').forEach(element => {
        const text = element.getAttribute(`data-${lang}`);
        if (text) {
            element.textContent = text;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-placeholder-en]').forEach(element => {
        const placeholder = element.getAttribute(`data-placeholder-${lang}`);
        if (placeholder) {
            element.placeholder = placeholder;
        }
    });
    
    // Update option text in selectors
    document.querySelectorAll('option[data-en]').forEach(option => {
        const text = option.getAttribute(`data-${lang}`);
        if (text) {
            option.textContent = text;
        }
    });
    
    // Update voice mode placeholder
    if (typeof VoiceModeManager !== 'undefined') {
        VoiceModeManager.updateInputPlaceholder(currentVoiceMode);
    }
    
    // Add/remove Marathi font class
    if (lang === 'mr') {
        document.body.classList.add('marathi');
    } else {
        document.body.classList.remove('marathi');
    }
    
    // Show language change notification for AI features
    showLanguageChangeNotification(lang);
}

/**
 * Set AI language independently from UI language
 * @param {string} lang - Language code for AI interactions
 */
function setAILanguage(lang) {
    aiLanguage = lang;
    
    // Update the selector to reflect the change
    const selector = document.getElementById('aiLanguageSelect');
    if (selector) {
        selector.value = lang;
    }
    
    // Show notification
    showAILanguageChangeNotification(lang);
}

/**
 * Show notification about AI language change
 * @param {string} lang - New AI language code
 */
function showAILanguageChangeNotification(lang) {
    const messages = {
        'en': 'AI will now respond in English',
        'mr': 'AI आता मराठीत उत्तर देईल'
    };
    
    const notification = document.createElement('div');
    notification.textContent = messages[lang] || messages['en'];
    notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Show notification about language change for AI features
 * @param {string} lang - New language code
 */
function showLanguageChangeNotification(lang) {
    const messages = {
        'en': 'AI responses will now be in English',
        'mr': 'AI प्रतिसाद आता मराठीत असतील'
    };
    
    const notification = document.createElement('div');
    notification.textContent = messages[lang] || messages['en'];
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(139, 92, 246, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Login functionality
function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    
    if (email && password) {
        // Update user info
        document.getElementById('currentUserName').textContent = email.split('@')[0];
        document.getElementById('currentUserEmail').textContent = email;
        
        // Hide login overlay and show main app
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }
}

function logout() {
    // Show login overlay and hide main app
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    
    // Clear form
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    console.log('MindCare app initialized');
    
    // Initialize audio playback system
    const audioInitialized = await AudioPlaybackManager.initialize();
    if (!audioInitialized) {
        console.warn('Audio playback system failed to initialize');
    }
    
    // Check voice recording support
    if (!VoiceRecorder.isSupported()) {
        console.warn('Voice recording not supported in this browser');
    }
    
    // Set initial language
    switchLanguage('en');
    
    // Initialize AI language selector
    const aiLanguageSelect = document.getElementById('aiLanguageSelect');
    if (aiLanguageSelect) {
        aiLanguageSelect.value = aiLanguage;
    }
    
    // Set initial voice mode (after language is set)
    VoiceModeManager.setMode('text');
    
    // Set up audio control event handlers
    setupAudioControlHandlers();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Ctrl/Cmd + M to toggle voice mode
        if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
            event.preventDefault();
            toggleVoiceMode();
        }
        
        // Space bar to start/stop recording (when input is not focused)
        if (event.code === 'Space' && event.target !== document.getElementById('chatInput')) {
            if (currentVoiceMode !== 'text') {
                event.preventDefault();
                if (isRecording) {
                    VoiceRecorder.stopRecording();
                } else {
                    VoiceRecorder.startRecording();
                }
            }
        }
        
        // Escape key to stop audio playback
        if (event.key === 'Escape') {
            AudioPlaybackManager.stop();
        }
        
        // P key to pause/resume audio
        if (event.key === 'p' && event.target !== document.getElementById('chatInput')) {
            event.preventDefault();
            if (AudioPlaybackManager.getStatus().isPaused) {
                AudioPlaybackManager.resume();
            } else {
                AudioPlaybackManager.pause();
            }
        }
    });
});

// Set up audio control event handlers
function setupAudioControlHandlers() {
    // Speed control handler
    const speedSlider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('speedDisplay');
    
    if (speedSlider && speedDisplay) {
        speedSlider.addEventListener('input', function() {
            const speed = this.value / 100;
            AudioPlaybackManager.setPlaybackRate(speed);
            speedDisplay.textContent = `${speed.toFixed(1)}x`;
        });
    }
    
    // Show/hide audio controls based on playback state
    const originalShowPlaybackIndicator = AudioPlaybackManager.showPlaybackIndicator;
    AudioPlaybackManager.showPlaybackIndicator = function(message) {
        originalShowPlaybackIndicator.call(this, message);
        
        // Show audio controls and progress bar when playback starts
        const audioControls = document.getElementById('audioControls');
        const progressContainer = document.getElementById('audioProgressContainer');
        
        if (audioControls) audioControls.style.display = 'flex';
        if (progressContainer) progressContainer.style.display = 'flex';
        
        this.updatePlaybackControls();
    };
    
    const originalHidePlaybackIndicator = AudioPlaybackManager.hidePlaybackIndicator;
    AudioPlaybackManager.hidePlaybackIndicator = function() {
        originalHidePlaybackIndicator.call(this);
        
        // Hide audio controls and progress bar when playback ends
        const audioControls = document.getElementById('audioControls');
        const progressContainer = document.getElementById('audioProgressContainer');
        
        if (audioControls) audioControls.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';
    };
}

// Additional utility functions
function toggleVoiceMode() {
    const modes = ['text', 'voice-to-text', 'voice-to-voice'];
    const currentIndex = modes.indexOf(currentVoiceMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    VoiceModeManager.setMode(modes[nextIndex]);
}

// Cleanup function for page unload
window.addEventListener('beforeunload', function() {
    AudioPlaybackManager.cleanup();
    if (isRecording) {
        VoiceRecorder.stopRecording();
    }
});

function toggleVoiceMode() {
    const modes = ['text', 'voice-to-text', 'voice-to-voice'];
    const currentIndex = modes.indexOf(currentVoiceMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    VoiceModeManager.setMode(modes[nextIndex]);
}