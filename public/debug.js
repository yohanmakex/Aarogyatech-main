// Debug script to identify login issues
console.log('Debug script loaded');

// Check if all required functions exist
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, running diagnostics...');
    
    // Check for required elements
    const requiredElements = [
        'loginOverlay',
        'mainApp', 
        'userEmail',
        'userPassword',
        'currentUserName',
        'currentUserEmail'
    ];
    
    const missingElements = [];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('Missing elements:', missingElements);
    } else {
        console.log('✅ All required elements found');
    }
    
    // Check for required functions
    const requiredFunctions = [
        'handleLogin',
        'logout',
        'switchLanguage'
    ];
    
    const missingFunctions = [];
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            missingFunctions.push(funcName);
        }
    });
    
    if (missingFunctions.length > 0) {
        console.error('Missing functions:', missingFunctions);
    } else {
        console.log('✅ All required functions found');
    }
    
    // Test login form submission
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        console.log('✅ Login form found');
        
        // Add a test event listener
        loginForm.addEventListener('submit', function(e) {
            console.log('Login form submitted!');
            console.log('Email:', document.getElementById('userEmail').value);
            console.log('Password length:', document.getElementById('userPassword').value.length);
        });
    } else {
        console.error('❌ Login form not found');
    }
    
    // Check for JavaScript errors
    window.addEventListener('error', function(e) {
        console.error('JavaScript Error:', e.error);
        console.error('File:', e.filename, 'Line:', e.lineno);
    });
});

// Simple test login function
function testLogin() {
    console.log('Test login function called');
    
    const email = document.getElementById('userEmail');
    const password = document.getElementById('userPassword');
    
    if (email && password) {
        email.value = 'test@example.com';
        password.value = 'testpassword';
        
        // Trigger the login
        if (typeof handleLogin === 'function') {
            const event = new Event('submit');
            handleLogin(event);
            console.log('Login triggered successfully');
        } else {
            console.error('handleLogin function not found');
        }
    } else {
        console.error('Email or password field not found');
    }
}

// Add test button to page
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Login (Debug)';
        testButton.style.position = 'fixed';
        testButton.style.top = '10px';
        testButton.style.right = '10px';
        testButton.style.zIndex = '9999';
        testButton.style.padding = '10px';
        testButton.style.backgroundColor = '#ff6b6b';
        testButton.style.color = 'white';
        testButton.style.border = 'none';
        testButton.style.borderRadius = '4px';
        testButton.style.cursor = 'pointer';
        testButton.onclick = testLogin;
        
        document.body.appendChild(testButton);
        console.log('Debug test button added');
    }, 1000);
});