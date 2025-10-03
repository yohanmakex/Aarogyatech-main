/**
 * Voice Interaction Client-Side Library
 * Handles voice recording, playback, and interactive animations
 */

class VoiceInteractionManager {
  constructor(options = {}) {
    this.config = {
      apiBaseUrl: options.apiBaseUrl || '/api',
      maxRecordingDuration: options.maxRecordingDuration || 60000, // 60 seconds
      visualizerEnabled: options.visualizerEnabled !== false,
      animationsEnabled: options.animationsEnabled !== false,
      autoPlayResponse: options.autoPlayResponse !== false,
      voiceProfile: options.voiceProfile || 'supportive'
    };

    this.state = {
      isRecording: false,
      isProcessing: false,
      isPlaying: false,
      currentSession: null,
      mediaRecorder: null,
      audioContext: null,
      analyser: null,
      animationFrame: null
    };

    this.elements = {};
    this.callbacks = {
      onRecordingStart: options.onRecordingStart || (() => {}),
      onRecordingStop: options.onRecordingStop || (() => {}),
      onProcessingStart: options.onProcessingStart || (() => {}),
      onProcessingComplete: options.onProcessingComplete || (() => {}),
      onPlaybackStart: options.onPlaybackStart || (() => {}),
      onPlaybackEnd: options.onPlaybackEnd || (() => {}),
      onError: options.onError || console.error,
      onTranscription: options.onTranscription || (() => {}),
      onResponse: options.onResponse || (() => {})
    };
  }

  /**
   * Initialize the voice interaction system
   * @param {string} containerId - ID of the container element
   */
  async init(containerId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with ID '${containerId}' not found`);
      }

      // Create UI elements
      this.createUI(container);

      // Request microphone permission
      await this.requestMicrophonePermission();

      // Initialize audio context
      this.initializeAudioContext();

      // Bind event listeners
      this.bindEvents();

      // Start a conversation session
      await this.startSession();

      console.log('Voice interaction system initialized successfully');
    } catch (error) {
      this.callbacks.onError('Failed to initialize voice interaction:', error);
    }
  }

  /**
   * Create the user interface elements
   * @private
   */
  createUI(container) {
    container.innerHTML = `
      <div class="voice-interaction-container">
        <!-- Voice Controls -->
        <div class="voice-controls">
          <button id="recordButton" class="voice-button record-button">
            <div class="button-content">
              <div class="microphone-icon">🎤</div>
              <span class="button-text">Hold to Talk</span>
            </div>
            <div class="recording-pulse"></div>
          </button>
        </div>

        <!-- Status Display -->
        <div class="status-display">
          <div id="statusText" class="status-text">Ready to listen</div>
          <div id="processingIndicator" class="processing-indicator">
            <div class="spinner"></div>
            <span class="processing-text">Processing...</span>
          </div>
        </div>

        <!-- Audio Visualizer -->
        <div class="visualizer-container">
          <canvas id="audioVisualizer" class="audio-visualizer"></canvas>
          <div class="visualizer-bars">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>

        <!-- Conversation Display -->
        <div class="conversation-display">
          <div id="conversationHistory" class="conversation-history"></div>
          <div id="currentTranscription" class="current-transcription"></div>
        </div>

        <!-- Voice Profile Selector -->
        <div class="voice-profile-selector">
          <label for="voiceProfileSelect">Voice Style:</label>
          <select id="voiceProfileSelect" class="voice-select">
            <option value="supportive">Supportive</option>
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="crisis">Crisis Support</option>
          </select>
        </div>
      </div>
    `;

    // Store references to elements
    this.elements = {
      recordButton: container.querySelector('#recordButton'),
      statusText: container.querySelector('#statusText'),
      processingIndicator: container.querySelector('#processingIndicator'),
      audioVisualizer: container.querySelector('#audioVisualizer'),
      visualizerBars: container.querySelector('.visualizer-bars'),
      conversationHistory: container.querySelector('#conversationHistory'),
      currentTranscription: container.querySelector('#currentTranscription'),
      voiceProfileSelect: container.querySelector('#voiceProfileSelect'),
      container: container.querySelector('.voice-interaction-container')
    };

    // Set initial voice profile
    this.elements.voiceProfileSelect.value = this.config.voiceProfile;

    // Add CSS styles
    this.addStyles();
  }

  /**
   * Add CSS styles for the voice interface
   * @private
   */
  addStyles() {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .voice-interaction-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 30px;
        text-align: center;
        color: white;
        max-width: 500px;
        margin: 0 auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }

      .voice-controls {
        margin-bottom: 30px;
      }

      .voice-button {
        position: relative;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        overflow: hidden;
      }

      .voice-button:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
      }

      .voice-button.recording {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        animation: recordingPulse 2s infinite;
      }

      .voice-button.processing {
        background: linear-gradient(135deg, #3498db, #2980b9);
        cursor: not-allowed;
      }

      .button-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      .microphone-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .button-text {
        font-size: 14px;
        font-weight: 600;
      }

      .recording-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: all 0.3s ease;
      }

      .voice-button.recording .recording-pulse {
        animation: pulse 2s infinite;
      }

      @keyframes recordingPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }

      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
        100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
      }

      .status-display {
        margin-bottom: 30px;
        height: 50px;
        position: relative;
      }

      .status-text {
        font-size: 18px;
        font-weight: 500;
        opacity: 0.9;
      }

      .processing-indicator {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .processing-indicator.active {
        display: flex;
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .visualizer-container {
        margin-bottom: 30px;
        height: 80px;
        position: relative;
      }

      .audio-visualizer {
        width: 100%;
        height: 80px;
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
      }

      .visualizer-bars {
        display: flex;
        justify-content: center;
        align-items: end;
        height: 60px;
        gap: 8px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .bar {
        width: 4px;
        height: 10px;
        background: rgba(255,255,255,0.6);
        border-radius: 2px;
        transition: height 0.1s ease;
      }

      .bar.active {
        animation: barDance 0.5s ease-in-out infinite alternate;
      }

      @keyframes barDance {
        0% { height: 10px; background: rgba(255,255,255,0.6); }
        100% { height: 40px; background: rgba(255,255,255,1); }
      }

      .conversation-display {
        margin-bottom: 20px;
        max-height: 200px;
        overflow-y: auto;
      }

      .conversation-history {
        text-align: left;
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 10px;
        font-size: 14px;
      }

      .conversation-message {
        margin-bottom: 10px;
        padding: 8px 12px;
        border-radius: 8px;
        animation: messageSlideIn 0.5s ease-out;
      }

      .conversation-message.user {
        background: rgba(255,255,255,0.2);
        margin-left: 20px;
      }

      .conversation-message.assistant {
        background: rgba(255,255,255,0.15);
        margin-right: 20px;
      }

      @keyframes messageSlideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .current-transcription {
        background: rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 10px;
        min-height: 20px;
        font-style: italic;
        opacity: 0.8;
      }

      .voice-profile-selector {
        margin-top: 20px;
      }

      .voice-select {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        color: white;
        padding: 8px 12px;
        margin-left: 10px;
      }

      .voice-select option {
        background: #333;
        color: white;
      }

      /* Responsive design */
      @media (max-width: 600px) {
        .voice-interaction-container {
          padding: 20px;
          margin: 10px;
        }

        .voice-button {
          width: 100px;
          height: 100px;
        }

        .microphone-icon {
          font-size: 24px;
        }

        .button-text {
          font-size: 12px;
        }
      }

      /* Animation for successful interaction */
      .success-flash {
        animation: successFlash 0.5s ease-out;
      }

      @keyframes successFlash {
        0% { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        50% { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); }
        100% { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      }

      /* Error state */
      .error-state {
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%) !important;
        animation: errorShake 0.5s ease-out;
      }

      @keyframes errorShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;

    document.head.appendChild(styleSheet);
  }

  /**
   * Request microphone permission
   * @private
   */
  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream after permission
      return true;
    } catch (error) {
      throw new Error('Microphone permission denied or not available');
    }
  }

  /**
   * Initialize audio context for visualization
   * @private
   */
  initializeAudioContext() {
    if (this.config.visualizerEnabled) {
      this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.state.analyser = this.state.audioContext.createAnalyser();
      this.state.analyser.fftSize = 256;
    }
  }

  /**
   * Bind event listeners
   * @private
   */
  bindEvents() {
    // Record button events
    this.elements.recordButton.addEventListener('mousedown', () => this.startRecording());
    this.elements.recordButton.addEventListener('mouseup', () => this.stopRecording());
    this.elements.recordButton.addEventListener('mouseleave', () => this.stopRecording());

    // Touch events for mobile
    this.elements.recordButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startRecording();
    });
    this.elements.recordButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopRecording();
    });

    // Voice profile change
    this.elements.voiceProfileSelect.addEventListener('change', (e) => {
      this.config.voiceProfile = e.target.value;
    });
  }

  /**
   * Start a new conversation session
   * @private
   */
  async startSession() {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/voice-conversation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'en',
          voiceProfile: this.config.voiceProfile
        })
      });

      const data = await response.json();
      if (data.success) {
        this.state.currentSession = data.session.sessionId;
        this.updateStatus('Ready to listen');
      } else {
        throw new Error(data.message || 'Failed to start session');
      }
    } catch (error) {
      this.callbacks.onError('Failed to start session:', error);
      this.updateStatus('Connection error', true);
    }
  }

  /**
   * Start recording audio
   * @private
   */
  async startRecording() {
    if (this.state.isRecording || this.state.isProcessing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.state.mediaRecorder = new MediaRecorder(stream);
      this.state.audioChunks = [];
      this.state.isRecording = true;

      this.state.mediaRecorder.ondataavailable = (event) => {
        this.state.audioChunks.push(event.data);
      };

      this.state.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.state.mediaRecorder.start();

      // Update UI
      this.elements.recordButton.classList.add('recording');
      this.elements.recordButton.querySelector('.button-text').textContent = 'Recording...';
      this.updateStatus('Listening...');

      // Start visualizer
      if (this.config.visualizerEnabled) {
        this.startVisualizer(stream);
      }

      // Start recording animation
      this.startRecordingAnimation();

      // Auto-stop after max duration
      setTimeout(() => {
        if (this.state.isRecording) {
          this.stopRecording();
        }
      }, this.config.maxRecordingDuration);

      this.callbacks.onRecordingStart();
    } catch (error) {
      this.callbacks.onError('Failed to start recording:', error);
      this.showError('Microphone access denied');
    }
  }

  /**
   * Stop recording audio
   * @private
   */
  stopRecording() {
    if (!this.state.isRecording) return;

    this.state.isRecording = false;
    this.state.mediaRecorder.stop();

    // Stop all tracks
    if (this.state.mediaRecorder.stream) {
      this.state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    // Update UI
    this.elements.recordButton.classList.remove('recording');
    this.elements.recordButton.classList.add('processing');
    this.elements.recordButton.querySelector('.button-text').textContent = 'Processing...';
    this.updateStatus('Processing your message...');

    // Stop visualizer
    this.stopVisualizer();
    this.stopRecordingAnimation();
    this.showProcessingIndicator(true);

    this.callbacks.onRecordingStop();
  }

  /**
   * Process the recorded audio
   * @private
   */
  async processRecording() {
    if (!this.state.audioChunks.length) return;

    try {
      this.state.isProcessing = true;
      this.callbacks.onProcessingStart();

      // Create audio blob
      const audioBlob = new Blob(this.state.audioChunks, { type: 'audio/wav' });
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('sessionId', this.state.currentSession);

      // Send to server
      const response = await fetch(`${this.config.apiBaseUrl}/voice-conversation/process`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Update conversation display
        this.addMessageToHistory('user', result.interaction.userInput.text);
        this.addMessageToHistory('assistant', result.interaction.aiResponse.text);

        // Handle transcription
        this.callbacks.onTranscription(result.interaction.userInput.text);

        // Play AI response
        if (this.config.autoPlayResponse) {
          await this.playAudioResponse(result.interaction.aiResponse.audio);
        }

        this.callbacks.onResponse(result.interaction.aiResponse.text);
        this.showSuccessAnimation();
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      this.callbacks.onError('Failed to process recording:', error);
      this.showError('Failed to process your message');
    } finally {
      this.state.isProcessing = false;
      this.resetUI();
      this.callbacks.onProcessingComplete();
    }
  }

  /**
   * Play audio response from the AI
   * @private
   */
  async playAudioResponse(audioData) {
    try {
      this.state.isPlaying = true;
      this.updateStatus('AI is responding...');
      this.callbacks.onPlaybackStart();

      // Convert base64 audio to blob
      const audioBuffer = this.base64ToArrayBuffer(audioData.buffer);
      const audioBlob = new Blob([audioBuffer], { type: audioData.contentType });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element and play
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve) => {
        audio.onended = () => {
          this.state.isPlaying = false;
          this.callbacks.onPlaybackEnd();
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.play();
      });

    } catch (error) {
      this.callbacks.onError('Failed to play audio response:', error);
      this.state.isPlaying = false;
    }
  }

  /**
   * Start audio visualizer
   * @private
   */
  startVisualizer(stream) {
    if (!this.state.audioContext || !this.state.analyser) return;

    const source = this.state.audioContext.createMediaStreamSource(stream);
    source.connect(this.state.analyser);

    const dataArray = new Uint8Array(this.state.analyser.frequencyBinCount);
    
    const draw = () => {
      if (!this.state.isRecording) return;

      this.state.analyser.getByteFrequencyData(dataArray);
      
      // Update bar visualization
      const bars = this.elements.visualizerBars.querySelectorAll('.bar');
      const step = Math.floor(dataArray.length / bars.length);
      
      bars.forEach((bar, index) => {
        const value = dataArray[index * step];
        const height = Math.max(10, (value / 255) * 40);
        bar.style.height = height + 'px';
        
        if (value > 50) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });

      this.state.animationFrame = requestAnimationFrame(draw);
    };

    draw();
  }

  /**
   * Stop audio visualizer
   * @private
   */
  stopVisualizer() {
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
    }

    // Reset bars
    const bars = this.elements.visualizerBars.querySelectorAll('.bar');
    bars.forEach(bar => {
      bar.style.height = '10px';
      bar.classList.remove('active');
    });
  }

  /**
   * Start recording animation
   * @private
   */
  startRecordingAnimation() {
    // Recording animation is handled by CSS classes
  }

  /**
   * Stop recording animation
   * @private
   */
  stopRecordingAnimation() {
    // Animation stopped by removing CSS classes
  }

  /**
   * Show processing indicator
   * @private
   */
  showProcessingIndicator(show) {
    if (show) {
      this.elements.processingIndicator.classList.add('active');
      this.elements.statusText.style.display = 'none';
    } else {
      this.elements.processingIndicator.classList.remove('active');
      this.elements.statusText.style.display = 'block';
    }
  }

  /**
   * Reset UI to initial state
   * @private
   */
  resetUI() {
    this.elements.recordButton.classList.remove('recording', 'processing');
    this.elements.recordButton.querySelector('.button-text').textContent = 'Hold to Talk';
    this.updateStatus('Ready to listen');
    this.showProcessingIndicator(false);
  }

  /**
   * Update status text
   * @private
   */
  updateStatus(text, isError = false) {
    this.elements.statusText.textContent = text;
    if (isError) {
      this.elements.statusText.style.color = '#ff6b6b';
    } else {
      this.elements.statusText.style.color = 'white';
    }
  }

  /**
   * Add message to conversation history
   * @private
   */
  addMessageToHistory(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `conversation-message ${role}`;
    messageDiv.textContent = text;
    
    this.elements.conversationHistory.appendChild(messageDiv);
    this.elements.conversationHistory.scrollTop = this.elements.conversationHistory.scrollHeight;
  }

  /**
   * Show success animation
   * @private
   */
  showSuccessAnimation() {
    this.elements.container.classList.add('success-flash');
    setTimeout(() => {
      this.elements.container.classList.remove('success-flash');
    }, 500);
  }

  /**
   * Show error state
   * @private
   */
  showError(message) {
    this.updateStatus(message, true);
    this.elements.container.classList.add('error-state');
    setTimeout(() => {
      this.elements.container.classList.remove('error-state');
      this.updateStatus('Ready to listen');
    }, 3000);
  }

  /**
   * Convert base64 to array buffer
   * @private
   */
  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Public method to change voice profile
   */
  setVoiceProfile(profile) {
    this.config.voiceProfile = profile;
    this.elements.voiceProfileSelect.value = profile;
  }

  /**
   * Public method to get current session info
   */
  getSessionInfo() {
    return {
      sessionId: this.state.currentSession,
      isRecording: this.state.isRecording,
      isProcessing: this.state.isProcessing,
      isPlaying: this.state.isPlaying
    };
  }

  /**
   * Public method to end current session
   */
  async endSession() {
    if (!this.state.currentSession) return;

    try {
      await fetch(`${this.config.apiBaseUrl}/voice-conversation/${this.state.currentSession}`, {
        method: 'DELETE'
      });
      
      this.state.currentSession = null;
      this.updateStatus('Session ended');
    } catch (error) {
      this.callbacks.onError('Failed to end session:', error);
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceInteractionManager;
} else {
  window.VoiceInteractionManager = VoiceInteractionManager;
}