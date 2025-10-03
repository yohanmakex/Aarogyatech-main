// Simple MindCare App - Essential functionality only
console.log('Simple MindCare app loading...');

// Global variables
let currentLanguage = 'en';

// Login functionality
function handleLogin(event) {
    console.log('handleLogin called');
    event.preventDefault();
    
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    
    console.log('Email:', email, 'Password length:', password.length);
    
    if (email && password) {
        console.log('Login successful, updating UI');
        
        // Update user info
        document.getElementById('currentUserName').textContent = email.split('@')[0];
        document.getElementById('currentUserEmail').textContent = email;
        
        // Hide login overlay and show main app
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        console.log('UI updated successfully');
    } else {
        console.log('Email or password missing');
        alert('Please enter both email and password');
    }
}

function logout() {
    console.log('Logout called');
    // Show login overlay and hide main app
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    
    // Clear form
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
}

// Language switching
function switchLanguage(lang) {
    console.log('Switching language to:', lang);
    currentLanguage = lang;
    
    // Update language buttons
    document.querySelectorAll('.language-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('lang' + lang.charAt(0).toUpperCase() + lang.slice(1)).classList.add('active');
    
    // Update text content
    document.querySelectorAll('[data-' + lang + ']').forEach(element => {
        element.textContent = element.getAttribute('data-' + lang);
    });
    
    // Update placeholders
    document.querySelectorAll('[data-placeholder-' + lang + ']').forEach(element => {
        element.placeholder = element.getAttribute('data-placeholder-' + lang);
    });
}

// Simple navigation
function showSection(sectionName) {
    console.log('Showing section:', sectionName);
    
    // Hide all sections
    document.querySelectorAll('.content-area').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the corresponding nav button
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(sectionName)) {
            btn.classList.add('active');
        }
    });
}

// Simple chat functionality (placeholder)
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input && input.value.trim()) {
        const message = input.value.trim();
        console.log('Sending message:', message);
        
        // Add user message to chat
        addMessageToChat('user', message);
        
        // Clear input
        input.value = '';
        
        // Simple bot response (placeholder)
        setTimeout(() => {
            const responses = [
                "Thank you for sharing that with me. How are you feeling right now?",
                "I understand. It's completely normal to feel this way sometimes.",
                "That sounds challenging. What would help you feel better in this moment?",
                "I'm here to listen. Can you tell me more about what's on your mind?",
                "It's okay to feel overwhelmed sometimes. Let's take this one step at a time."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            addMessageToChat('bot', randomResponse);
        }, 1000);
    }
}

function addMessageToChat(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Handle Enter key in chat input
function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Simple MindCare app initialized');
    
    // Set initial language
    switchLanguage('en');
    
    // Set up form event listener as backup
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('Login form event listener added');
    }
    
    console.log('App initialization complete');
});

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    console.error('File:', e.filename, 'Line:', e.lineno);
});

console.log('Simple MindCare app loaded successfully');