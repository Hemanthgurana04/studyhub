const API_BASE = window.location.origin + '/api';

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tab) {
                content.classList.add('active');
            }
        });
    });
});

// Login form handler with verification check
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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
            
            showNotification('Login successful!', 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            if (data.verificationRequired) {
                showNotification(data.error, 'error');
                showResendVerificationOption(email);
            } else {
                showNotification(data.error, 'error');
            }
        }
    } catch (error) {
        showNotification('Login failed. Please try again.', 'error');
    }
});

// Register form handler with verification
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const fullName = document.getElementById('registerFullName').value;
    const password = document.getElementById('registerPassword').value;
    
    // Basic validation
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
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
            showNotification('Registration successful! Please check your email to verify your account.', 'success');
            registerForm.reset();
            
            // Show verification message
            showVerificationMessage(email);
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Registration failed. Please try again.', 'error');
    }
});

// Show verification message
function showVerificationMessage(email) {
    const container = document.querySelector('.auth-container');
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h2 style="color: #667eea;">📧 Check Your Email!</h2>
            <p>We've sent a verification link to:</p>
            <p style="font-weight: bold; color: #667eea;">${email}</p>
            <p>Click the link in the email to activate your account.</p>
            <p style="font-size: 0.9rem; color: #6c757d;">
                Didn't receive the email? Check your spam folder or 
                <button id="resendBtn" style="color: #667eea; background: none; border: none; text-decoration: underline; cursor: pointer;">
                    click here to resend
                </button>
            </p>
        </div>
    `;
    
    document.getElementById('resendBtn').addEventListener('click', () => resendVerification(email));
}

// Show resend verification option
function showResendVerificationOption(email) {
    setTimeout(() => {
        const notification = document.getElementById('notification');
        notification.innerHTML = `
            <div style="margin-top: 10px;">
                <button id="resendVerification" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
                    Resend Verification Email
                </button>
            </div>
        `;
        
        document.getElementById('resendVerification').addEventListener('click', () => resendVerification(email));
    }, 2000);
}

// Resend verification email
async function resendVerification(email) {
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
            showNotification('Verification email sent! Please check your inbox.', 'success');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to resend verification email.', 'error');
    }
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Check if user is already logged in
if (localStorage.getItem('token')) {
    window.location.href = 'dashboard.html';
}

// Handle verification from URL (if user clicks email link)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
    // User clicked email verification link
    window.location.href = `/api/auth/verify-email?token=${token}`;
}
