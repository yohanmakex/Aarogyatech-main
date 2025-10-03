// Crisis Response Management System
const CrisisResponseManager = {
    // Crisis UI elements
    crisisModal: null,
    crisisOverlay: null,
    emergencyBanner: null,
    
    // Crisis state
    currentCrisisLevel: 0,
    isEmergencyMode: false,
    crisisResources: [],
    
    /**
     * Initialize crisis response system
     */
    initialize() {
        this.createCrisisModal();
        this.createEmergencyBanner();
        this.setupEventListeners();
        console.log('Crisis Response Manager initialized');
    },
    
    /**
     * Handle crisis detection from AI response
     * @param {Object} crisisData - Crisis information from AI service
     */
    handleCrisisDetection(crisisData) {
        console.log('Crisis detected:', crisisData);
        
        this.currentCrisisLevel = crisisData.escalationLevel || 0;
        this.crisisResources = crisisData.resources || [];
        
        // Show appropriate crisis response based on severity
        switch (crisisData.severity) {
            case 'immediate':
                this.showEmergencyResponse(crisisData);
                break;
            case 'high':
                this.showHighRiskResponse(crisisData);
                break;
            case 'moderate':
                this.showModerateRiskResponse(crisisData);
                break;
            case 'selfHarm':
                this.showSelfHarmResponse(crisisData);
                break;
            default:
                this.showGeneralSupportResponse(crisisData);
        }
        
        // Execute escalation workflow if provided
        if (crisisData.workflow) {
            this.executeEscalationWorkflow(crisisData.workflow);
        }
    },
    
    /**
     * Show emergency crisis response (immediate danger)
     * @param {Object} crisisData - Crisis data
     */
    showEmergencyResponse(crisisData) {
        this.isEmergencyMode = true;
        
        // Show emergency banner
        this.showEmergencyBanner();
        
        // Show crisis modal with emergency resources
        this.showCrisisModal({
            title: 'Emergency Support Needed',
            severity: 'emergency',
            message: 'I\'m very concerned about your safety. Please reach out for immediate help.',
            resources: this.getEmergencyResources(),
            actions: [
                {
                    text: 'Call 911 Now',
                    action: () => this.initiateEmergencyCall('911'),
                    priority: 'critical'
                },
                {
                    text: 'Call Crisis Line (988)',
                    action: () => this.initiateEmergencyCall('988'),
                    priority: 'high'
                },
                {
                    text: 'Text Crisis Support',
                    action: () => this.initiateTextCrisis(),
                    priority: 'high'
                }
            ]
        });
        
        // Auto-focus on emergency actions
        setTimeout(() => {
            const emergencyBtn = document.querySelector('.crisis-action-critical');
            if (emergencyBtn) emergencyBtn.focus();
        }, 100);
    },
    
    /**
     * Show high risk crisis response
     * @param {Object} crisisData - Crisis data
     */
    showHighRiskResponse(crisisData) {
        this.showCrisisModal({
            title: 'Crisis Support Available',
            severity: 'high',
            message: 'I\'m concerned about what you\'re sharing. You don\'t have to face this alone.',
            resources: this.getCrisisResources(),
            actions: [
                {
                    text: 'Call Crisis Line (988)',
                    action: () => this.initiateEmergencyCall('988'),
                    priority: 'high'
                },
                {
                    text: 'Text Crisis Support',
                    action: () => this.initiateTextCrisis(),
                    priority: 'high'
                },
                {
                    text: 'View All Resources',
                    action: () => this.showAllResources(),
                    priority: 'medium'
                }
            ]
        });
    },
    
    /**
     * Show moderate risk response
     * @param {Object} crisisData - Crisis data
     */
    showModerateRiskResponse(crisisData) {
        this.showCrisisModal({
            title: 'Support Resources',
            severity: 'moderate',
            message: 'It sounds like you\'re going through a difficult time. Here are some resources that might help.',
            resources: this.getSupportResources(),
            actions: [
                {
                    text: 'Call Support Line',
                    action: () => this.initiateCall('1-800-662-4357'),
                    priority: 'medium'
                },
                {
                    text: 'View Coping Strategies',
                    action: () => this.showCopingStrategies(),
                    priority: 'medium'
                },
                {
                    text: 'Continue Conversation',
                    action: () => this.closeCrisisModal(),
                    priority: 'low'
                }
            ]
        });
    },
    
    /**
     * Show self-harm specific response
     * @param {Object} crisisData - Crisis data
     */
    showSelfHarmResponse(crisisData) {
        this.showCrisisModal({
            title: 'Self-Harm Support',
            severity: 'high',
            message: 'I\'m concerned about the self-harm you\'ve mentioned. Your safety matters, and there are people who want to help.',
            resources: this.getCrisisResources(),
            actions: [
                {
                    text: 'Call Crisis Line (988)',
                    action: () => this.initiateEmergencyCall('988'),
                    priority: 'high'
                },
                {
                    text: 'Text Crisis Support',
                    action: () => this.initiateTextCrisis(),
                    priority: 'high'
                },
                {
                    text: 'Healthy Alternatives',
                    action: () => this.showHealthyAlternatives(),
                    priority: 'medium'
                }
            ]
        });
    },
    
    /**
     * Create crisis modal HTML structure
     */
    createCrisisModal() {
        const modalHTML = `
            <div id="crisisModal" class="crisis-modal" style="display: none;">
                <div class="crisis-overlay"></div>
                <div class="crisis-content">
                    <div class="crisis-header">
                        <h2 id="crisisTitle">Crisis Support</h2>
                        <button class="crisis-close" onclick="CrisisResponseManager.closeCrisisModal()">&times;</button>
                    </div>
                    <div class="crisis-body">
                        <div id="crisisMessage" class="crisis-message"></div>
                        <div id="crisisResources" class="crisis-resources"></div>
                        <div id="crisisActions" class="crisis-actions"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.crisisModal = document.getElementById('crisisModal');
        this.crisisOverlay = this.crisisModal.querySelector('.crisis-overlay');
        
        // Prevent modal from closing on overlay click for emergency situations
        this.crisisOverlay.addEventListener('click', (e) => {
            if (!this.isEmergencyMode) {
                this.closeCrisisModal();
            }
        });
    },
    
    /**
     * Create emergency banner
     */
    createEmergencyBanner() {
        const bannerHTML = `
            <div id="emergencyBanner" class="emergency-banner-crisis" style="display: none;">
                <div class="emergency-content">
                    <span class="emergency-icon">🚨</span>
                    <span class="emergency-text">Emergency Support Available 24/7</span>
                    <div class="emergency-actions">
                        <button class="emergency-btn" onclick="CrisisResponseManager.initiateEmergencyCall('911')">
                            Call 911
                        </button>
                        <button class="emergency-btn" onclick="CrisisResponseManager.initiateEmergencyCall('988')">
                            Crisis Line 988
                        </button>
                        <button class="emergency-btn-text" onclick="CrisisResponseManager.initiateTextCrisis()">
                            Text HOME to 741741
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after existing emergency banner
        const existingBanner = document.querySelector('.emergency-banner');
        if (existingBanner) {
            existingBanner.insertAdjacentHTML('afterend', bannerHTML);
        } else {
            document.body.insertAdjacentHTML('afterbegin', bannerHTML);
        }
        
        this.emergencyBanner = document.getElementById('emergencyBanner');
    },
    
    /**
     * Show crisis modal with specific configuration
     * @param {Object} config - Modal configuration
     */
    showCrisisModal(config) {
        const modal = this.crisisModal;
        const title = document.getElementById('crisisTitle');
        const message = document.getElementById('crisisMessage');
        const resources = document.getElementById('crisisResources');
        const actions = document.getElementById('crisisActions');
        
        // Set title and message
        title.textContent = config.title;
        message.textContent = config.message;
        
        // Set severity class for styling
        modal.className = `crisis-modal crisis-${config.severity}`;
        
        // Populate resources
        if (config.resources && config.resources.length > 0) {
            resources.innerHTML = this.renderResources(config.resources);
        } else {
            resources.innerHTML = '';
        }
        
        // Populate actions
        if (config.actions && config.actions.length > 0) {
            actions.innerHTML = this.renderActions(config.actions);
        } else {
            actions.innerHTML = '';
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Focus management
        setTimeout(() => {
            const firstAction = modal.querySelector('.crisis-action-button');
            if (firstAction) firstAction.focus();
        }, 100);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * Close crisis modal
     */
    closeCrisisModal() {
        if (this.crisisModal) {
            this.crisisModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        // Reset emergency mode if not in immediate danger
        if (this.currentCrisisLevel < 3) {
            this.isEmergencyMode = false;
            this.hideEmergencyBanner();
        }
    },
    
    /**
     * Show emergency banner
     */
    showEmergencyBanner() {
        if (this.emergencyBanner) {
            this.emergencyBanner.style.display = 'block';
        }
    },
    
    /**
     * Hide emergency banner
     */
    hideEmergencyBanner() {
        if (this.emergencyBanner) {
            this.emergencyBanner.style.display = 'none';
        }
    },
    
    /**
     * Render resources HTML
     * @param {Array} resources - Crisis resources
     * @returns {string} HTML string
     */
    renderResources(resources) {
        return `
            <div class="resources-list">
                <h3>Available Support:</h3>
                ${resources.map(resource => `
                    <div class="resource-item">
                        <div class="resource-name">${resource.name}</div>
                        <div class="resource-contact">
                            ${resource.phoneNumber ? `<span class="resource-phone">${resource.phoneNumber}</span>` : ''}
                            ${resource.website ? `<a href="${resource.website}" target="_blank" class="resource-link">Website</a>` : ''}
                        </div>
                        <div class="resource-availability">${resource.availability}</div>
                        ${resource.description ? `<div class="resource-description">${resource.description}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * Render action buttons HTML
     * @param {Array} actions - Action configurations
     * @returns {string} HTML string
     */
    renderActions(actions) {
        return actions.map(action => `
            <button class="crisis-action-button crisis-action-${action.priority}" 
                    onclick="(${action.action.toString()})()">
                ${action.text}
            </button>
        `).join('');
    },
    
    /**
     * Initiate emergency phone call
     * @param {string} number - Phone number to call
     */
    initiateEmergencyCall(number) {
        // Create call link
        const callLink = `tel:${number}`;
        
        // Show confirmation dialog
        const confirmed = confirm(`This will attempt to call ${number}. Continue?`);
        
        if (confirmed) {
            // Try to initiate call
            window.location.href = callLink;
            
            // Also show backup options
            setTimeout(() => {
                alert(`If the call didn't connect automatically, please dial ${number} directly.`);
            }, 2000);
        }
    },
    
    /**
     * Initiate regular phone call
     * @param {string} number - Phone number to call
     */
    initiateCall(number) {
        window.location.href = `tel:${number}`;
    },
    
    /**
     * Initiate text crisis support
     */
    initiateTextCrisis() {
        // Try to open SMS app
        const smsLink = 'sms:741741?body=HOME';
        window.location.href = smsLink;
        
        // Show backup instructions
        setTimeout(() => {
            alert('If SMS didn\'t open automatically, text HOME to 741741 for crisis support.');
        }, 1000);
    },
    
    /**
     * Execute escalation workflow
     * @param {Object} workflow - Escalation workflow
     */
    executeEscalationWorkflow(workflow) {
        console.log('Executing escalation workflow:', workflow);
        
        workflow.steps.forEach((step, index) => {
            setTimeout(() => {
                this.executeWorkflowStep(step);
            }, index * 1000); // Stagger execution
        });
    },
    
    /**
     * Execute individual workflow step
     * @param {Object} step - Workflow step
     */
    executeWorkflowStep(step) {
        console.log('Executing workflow step:', step);
        
        switch (step.action) {
            case 'display_emergency_resources':
                this.showEmergencyBanner();
                break;
            case 'display_crisis_resources':
                // Resources already shown in modal
                break;
            case 'log_crisis_event':
                // Already logged by backend
                break;
            case 'offer_emergency_contact':
                this.offerEmergencyContact();
                break;
            case 'follow_up_check':
                this.scheduleFollowUp();
                break;
            case 'offer_coping_strategies':
                this.showCopingStrategies();
                break;
            case 'offer_alternatives':
                this.showHealthyAlternatives();
                break;
        }
    },
    
    /**
     * Offer to help contact emergency services
     */
    offerEmergencyContact() {
        const offer = confirm('Would you like me to help you contact emergency services right now?');
        if (offer) {
            this.initiateEmergencyCall('911');
        }
    },
    
    /**
     * Schedule follow-up check
     */
    scheduleFollowUp() {
        // In a real implementation, this would schedule a follow-up
        console.log('Follow-up check scheduled');
        
        // Show user notification
        setTimeout(() => {
            if (confirm('How are you feeling now? Would you like to continue our conversation?')) {
                // Continue conversation
                this.closeCrisisModal();
            }
        }, 15 * 60 * 1000); // 15 minutes
    },
    
    /**
     * Show coping strategies
     */
    showCopingStrategies() {
        const strategies = [
            '🫁 **Deep Breathing**: Take slow, deep breaths. Inhale for 4 counts, hold for 4, exhale for 6.',
            '🌟 **5-4-3-2-1 Grounding**: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
            '🚶 **Movement**: Take a short walk, do gentle stretches, or try progressive muscle relaxation.',
            '💭 **Mindfulness**: Focus on the present moment. Notice your thoughts without judgment.',
            '📞 **Reach Out**: Contact a trusted friend, family member, or counselor.',
            '📝 **Journaling**: Write down your thoughts and feelings to help process them.',
            '🎵 **Soothing Activities**: Listen to calming music, take a warm bath, or practice a hobby you enjoy.'
        ];
        
        this.showCrisisModal({
            title: 'Coping Strategies',
            severity: 'moderate',
            message: 'Here are some techniques that might help you feel better right now:',
            resources: [],
            actions: [
                {
                    text: 'Try Breathing Exercise',
                    action: () => this.startBreathingExercise(),
                    priority: 'medium'
                },
                {
                    text: 'View More Resources',
                    action: () => this.showAllResources(),
                    priority: 'medium'
                },
                {
                    text: 'Continue Conversation',
                    action: () => this.closeCrisisModal(),
                    priority: 'low'
                }
            ]
        });
        
        // Add strategies to message
        const messageEl = document.getElementById('crisisMessage');
        messageEl.innerHTML = `
            <p>Here are some techniques that might help you feel better right now:</p>
            <ul class="coping-strategies">
                ${strategies.map(strategy => `<li>${strategy}</li>`).join('')}
            </ul>
        `;
    },
    
    /**
     * Show healthy alternatives to self-harm
     */
    showHealthyAlternatives() {
        const alternatives = [
            '🧊 **Ice Cubes**: Hold ice cubes in your hands or place them where you want to harm',
            '✏️ **Draw on Skin**: Use a red marker to draw where you want to cut',
            '💪 **Physical Exercise**: Do jumping jacks, push-ups, or go for a run',
            '🎵 **Loud Music**: Listen to music that matches your emotions',
            '😱 **Scream**: Into a pillow or somewhere private',
            '📞 **Call Someone**: Reach out to a trusted person or crisis line',
            '🛁 **Hot/Cold Shower**: The temperature change can provide relief',
            '📝 **Write**: Journal about your feelings or write a letter you won\'t send'
        ];
        
        this.showCrisisModal({
            title: 'Healthy Alternatives',
            severity: 'high',
            message: 'Instead of self-harm, try one of these alternatives:',
            resources: this.getCrisisResources(),
            actions: [
                {
                    text: 'Call Crisis Line (988)',
                    action: () => this.initiateEmergencyCall('988'),
                    priority: 'high'
                },
                {
                    text: 'Text Crisis Support',
                    action: () => this.initiateTextCrisis(),
                    priority: 'high'
                },
                {
                    text: 'Continue Conversation',
                    action: () => this.closeCrisisModal(),
                    priority: 'medium'
                }
            ]
        });
        
        // Add alternatives to message
        const messageEl = document.getElementById('crisisMessage');
        messageEl.innerHTML = `
            <p>Instead of self-harm, try one of these alternatives:</p>
            <ul class="healthy-alternatives">
                ${alternatives.map(alt => `<li>${alt}</li>`).join('')}
            </ul>
        `;
    },
    
    /**
     * Start guided breathing exercise
     */
    startBreathingExercise() {
        this.showCrisisModal({
            title: 'Breathing Exercise',
            severity: 'moderate',
            message: 'Let\'s do a simple breathing exercise together. Follow the instructions below:',
            resources: [],
            actions: [
                {
                    text: 'Start Exercise',
                    action: () => this.runBreathingExercise(),
                    priority: 'medium'
                },
                {
                    text: 'Back to Strategies',
                    action: () => this.showCopingStrategies(),
                    priority: 'low'
                }
            ]
        });
    },
    
    /**
     * Run interactive breathing exercise
     */
    runBreathingExercise() {
        const messageEl = document.getElementById('crisisMessage');
        const actionsEl = document.getElementById('crisisActions');
        
        let phase = 'inhale';
        let count = 4;
        let cycle = 0;
        const maxCycles = 5;
        
        const updateDisplay = () => {
            const instructions = {
                inhale: 'Breathe in slowly...',
                hold: 'Hold your breath...',
                exhale: 'Breathe out slowly...'
            };
            
            messageEl.innerHTML = `
                <div class="breathing-exercise">
                    <div class="breathing-circle ${phase}"></div>
                    <div class="breathing-instruction">${instructions[phase]}</div>
                    <div class="breathing-count">${count}</div>
                    <div class="breathing-progress">Cycle ${cycle + 1} of ${maxCycles}</div>
                </div>
            `;
        };
        
        const runCycle = () => {
            updateDisplay();
            
            const timer = setInterval(() => {
                count--;
                updateDisplay();
                
                if (count === 0) {
                    clearInterval(timer);
                    
                    if (phase === 'inhale') {
                        phase = 'hold';
                        count = 4;
                        setTimeout(runCycle, 500);
                    } else if (phase === 'hold') {
                        phase = 'exhale';
                        count = 6;
                        setTimeout(runCycle, 500);
                    } else {
                        cycle++;
                        if (cycle < maxCycles) {
                            phase = 'inhale';
                            count = 4;
                            setTimeout(runCycle, 1000);
                        } else {
                            // Exercise complete
                            messageEl.innerHTML = `
                                <div class="breathing-complete">
                                    <h3>Great job! 🌟</h3>
                                    <p>You've completed the breathing exercise. How are you feeling now?</p>
                                </div>
                            `;
                            
                            actionsEl.innerHTML = `
                                <button class="crisis-action-button crisis-action-medium" 
                                        onclick="CrisisResponseManager.showCopingStrategies()">
                                    Try Another Strategy
                                </button>
                                <button class="crisis-action-button crisis-action-low" 
                                        onclick="CrisisResponseManager.closeCrisisModal()">
                                    Continue Conversation
                                </button>
                            `;
                        }
                    }
                }
            }, 1000);
        };
        
        // Hide actions during exercise
        actionsEl.innerHTML = `
            <button class="crisis-action-button crisis-action-low" 
                    onclick="CrisisResponseManager.showCopingStrategies()">
                Stop Exercise
            </button>
        `;
        
        runCycle();
    },
    
    /**
     * Show all available resources
     */
    showAllResources() {
        // This would show a comprehensive list of resources
        // For now, redirect to resources section
        showSection('resources');
        this.closeCrisisModal();
    },
    
    /**
     * Get emergency resources
     * @returns {Array} Emergency resources
     */
    getEmergencyResources() {
        return [
            {
                name: 'Emergency Services',
                phoneNumber: '911',
                availability: '24/7',
                description: 'For immediate life-threatening emergencies'
            },
            {
                name: 'National Suicide Prevention Lifeline',
                phoneNumber: '988',
                website: 'https://suicidepreventionlifeline.org',
                availability: '24/7',
                description: 'Free and confidential emotional support'
            },
            {
                name: 'Crisis Text Line',
                phoneNumber: 'Text HOME to 741741',
                website: 'https://www.crisistextline.org',
                availability: '24/7',
                description: 'Free crisis support via text message'
            }
        ];
    },
    
    /**
     * Get crisis resources
     * @returns {Array} Crisis resources
     */
    getCrisisResources() {
        return this.crisisResources.length > 0 ? this.crisisResources : [
            {
                name: 'National Suicide Prevention Lifeline',
                phoneNumber: '988',
                website: 'https://suicidepreventionlifeline.org',
                availability: '24/7',
                description: 'Free and confidential emotional support'
            },
            {
                name: 'Crisis Text Line',
                phoneNumber: 'Text HOME to 741741',
                website: 'https://www.crisistextline.org',
                availability: '24/7',
                description: 'Free crisis support via text message'
            },
            {
                name: 'SAMHSA National Helpline',
                phoneNumber: '1-800-662-4357',
                website: 'https://www.samhsa.gov/find-help/national-helpline',
                availability: '24/7',
                description: 'Treatment referral and information service'
            }
        ];
    },
    
    /**
     * Get support resources
     * @returns {Array} Support resources
     */
    getSupportResources() {
        return [
            {
                name: 'SAMHSA National Helpline',
                phoneNumber: '1-800-662-4357',
                website: 'https://www.samhsa.gov/find-help/national-helpline',
                availability: '24/7',
                description: 'Treatment referral and information service'
            },
            {
                name: 'National Alliance on Mental Illness (NAMI)',
                phoneNumber: '1-800-950-6264',
                website: 'https://www.nami.org',
                availability: 'Mon-Fri 10am-10pm ET',
                description: 'Support and education for mental health'
            }
        ];
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for escape key to close modal (except in emergency mode)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.isEmergencyMode) {
                this.closeCrisisModal();
            }
        });
        
        // Listen for crisis events from chat
        document.addEventListener('crisisDetected', (e) => {
            this.handleCrisisDetection(e.detail);
        });
    }
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        CrisisResponseManager.initialize();
    });
} else {
    CrisisResponseManager.initialize();
}