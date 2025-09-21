const API_BASE = window.location.origin + '/api';

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authContainer = document.getElementById('authContainer');
const verificationRequired = document.getElementById('verificationRequired');
const verificationSuccess = document.getElementById('verificationSuccess');

// Check for verification success on page load
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        showVerificationSuccess();
    }
    
    // Add smooth page load animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease-in-out';
        document.body.style.opacity = '1';
    }, 100);
});

// Tab switching with smooth animation
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Remove active class from all tabs and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // Add active class to clicked tab
        btn.classList.add('active');
        
        // Show corresponding content with animation
        setTimeout(() => {
            document.getElementById(tab).classList.add('active');
        }, 150);
    });
});

// Enhanced login form handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // Loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showNotification('Welcome back! 🎉', 'success');
            
            // Smooth redirect with fade out
            document.body.style.opacity = '0.5';
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            if (data.requiresVerification) {
                showVerificationRequired(email);
            } else {
                showNotification(data.error, 'error');
            }
        }
    } catch (error) {
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

// Enhanced register form handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // Loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const fullName = document.getElementById('registerFullName').value;
    const password = document.getElementById('registerPassword').value;
    
    // Basic validation
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        resetButton(submitBtn, btnText, btnLoading);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, fullName, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.requiresVerification) {
                showVerificationRequired(email);
                showNotification('Account created! Please check your email to verify.', 'success');
            } else {
                // Fallback if verification is disabled
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                showNotification('Account created successfully! 🚀', 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Registration failed. Please try again.', 'error');
    } finally {
        resetButton(submitBtn, btnText, btnLoading);
    }
});

// Helper function to reset button state
function resetButton(submitBtn, btnText, btnLoading) {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
}

// Show verification required screen
function showVerificationRequired(email) {
    authContainer.style.display = 'none';
    verificationRequired.style.display = 'block';
    document.getElementById('userEmail').textContent = email;
    
    // Store email for resend functionality
    localStorage.setItem('pendingVerificationEmail', email);
    
    // Resend email handler
    document.getElementById('resendBtn').addEventListener('click', async () => {
        const resendBtn = document.getElementById('resendBtn');
        const originalText = resendBtn.textContent;
        
        resendBtn.textContent = 'Sending...';
        resendBtn.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Verification email sent! Check your inbox.', 'success');
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Failed to resend email. Please try again.', 'error');
        } finally {
            resendBtn.textContent = originalText;
            resendBtn.disabled = false;
        }
    });
    
    // Back to login handler
    document.getElementById('backToLogin').addEventListener('click', () => {
        verificationRequired.style.display = 'none';
        authContainer.style.display = 'block';
        localStorage.removeItem('pendingVerificationEmail');
    });
}

// Show verification success screen
function showVerificationSuccess() {
    authContainer.style.display = 'none';
    verificationSuccess.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        verificationSuccess.style.display = 'none';
        authContainer.style.display = 'block';
        
        // Clear URL parameter
        const url = new URL(window.location);
        url.searchParams.delete('verified');
        window.history.replaceState({}, document.title, url);
    }, 5000);
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Redirect if already logged in
if (localStorage.getItem('token')) {
    // Verify token is still valid
    fetch(`${API_BASE}/auth/profile`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (response.ok) {
            window.location.href = 'dashboard.html';
        } else {
            // Token expired, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    })
    .catch(() => {
        // Network error, stay on login page
    });
}

// Check for pending verification on page load
const pendingEmail = localStorage.getItem('pendingVerificationEmail');
if (pendingEmail && !localStorage.getItem('token')) {
    showVerificationRequired(pendingEmail);
}
