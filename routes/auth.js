const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { pool } = require('../models/database');
const { generateToken, verifyToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to send verification email
const sendVerificationEmail = async (email, username, verificationToken, req) => {
  const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'StudyHub Team <onboarding@resend.dev>',
      to: [email],
      subject: '✅ Verify Your StudyHub Account - Action Required',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .header { text-align: center; margin-bottom: 40px; }
                .logo { font-size: 2rem; margin-bottom: 10px; }
                .button { 
                    display: inline-block; 
                    background: #4F46E5; 
                    color: white; 
                    padding: 14px 28px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-weight: 600;
                    margin: 20px 0;
                }
                .footer { 
                    margin-top: 40px; 
                    padding-top: 20px; 
                    border-top: 1px solid #e5e7eb; 
                    font-size: 14px; 
                    color: #6b7280; 
                }
                .link { word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📚 StudyHub</div>
                    <h1 style="color: #4F46E5; margin: 0;">Welcome to StudyHub!</h1>
                </div>
                
                <p>Hi ${username},</p>
                <p>Thanks for joining StudyHub - the ultimate platform for collaborative video studying! 🚀</p>
                <p>To get started with creating study rooms and connecting with study partners, please verify your email address:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" class="button">Verify Your Account</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p class="link"><a href="${verificationLink}">${verificationLink}</a></p>
                
                <p><strong>⏰ This verification link expires in 24 hours.</strong></p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">What's Next?</h3>
                    <ul style="color: #6b7280; padding-left: 20px;">
                        <li>🎥 Create or join HD video study rooms</li>
                        <li>📺 Share your screen for collaborative learning</li>
                        <li>💬 Chat in real-time with study partners</li>
                        <li>👥 Build your study network with friends</li>
                    </ul>
                </div>
                
                <p>Need help? Just reply to this email - we're here to support your learning journey!</p>
                
                <p>Best regards,<br><strong>The StudyHub Team</strong></p>
                
                <div class="footer">
                    <p>StudyHub - Connect. Study. Succeed Together.</p>
                    <p>If you didn't create this account, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Resend email error:', error);
      throw new Error('Failed to send verification email');
    }

    console.log('Verification email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Send verification email error:', error);
    throw error;
  }
};

// Register with email verification
router.post('/register', async (req, res) => {
  const { username, email, password, fullName } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  // Enhanced email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  // Password strength validation
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2', 
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = jwt.sign(
      { email, purpose: 'email-verification' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create user (unverified)
    const result = await pool.query(
      'INSERT INTO users (username, email, password, full_name, email_verified, verification_token) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, full_name',
      [username, email, hashedPassword, fullName || username, false, verificationToken]
    );

    const newUser = result.rows[0];

    // Send verification email
    try {
      await sendVerificationEmail(email, username, verificationToken, req);
      
      res.status(201).json({
        message: 'Account created successfully! Please check your email to verify your account.',
        requiresVerification: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.full_name,
          verified: false
        }
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      
      // Delete the user if email failed to send
      await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      
      res.status(500).json({ 
        error: 'Failed to send verification email. Please try again.' 
      });
    }

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc2626;">❌ Invalid Verification Link</h1>
          <p>The verification link is missing or invalid.</p>
          <a href="/" style="color: #4F46E5;">Return to StudyHub</a>
        </body>
      </html>
    `);
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.purpose !== 'email-verification') {
      throw new Error('Invalid token purpose');
    }

    // Find user with this email and verification token
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_token = $2',
      [decoded.email, token]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">❌ User Not Found</h1>
            <p>No account found with this email or the verification link has already been used.</p>
            <a href="/" style="color: #4F46E5;">Return to StudyHub</a>
          </body>
        </html>
      `);
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #059669;">✅ Email Already Verified</h1>
            <p>Your email has already been verified. You can now log in to StudyHub!</p>
            <a href="/dashboard.html" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
          </body>
        </html>
      `);
    }

    // Update user as verified and clear verification token
    await pool.query(
      'UPDATE users SET email_verified = true, verification_token = null WHERE id = $1',
      [user.id]
    );

    // Send success response with redirect
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #059669;">🎉 Email Verified Successfully!</h1>
          <p>Welcome to StudyHub, ${user.username}! Your account is now active.</p>
          <p>You can now:</p>
          <ul style="text-align: left; display: inline-block; margin: 20px 0;">
            <li>🎥 Create and join video study rooms</li>
            <li>📺 Share your screen with study partners</li>
            <li>💬 Chat in real-time during sessions</li>
            <li>👥 Connect with friends for collaborative learning</li>
          </ul>
          <div style="margin-top: 30px;">
            <a href="/" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px;">Log In Now</a>
          </div>
          <script>
            setTimeout(function() {
              window.location.href = '/?verified=true';
            }, 3000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">⏰ Verification Link Expired</h1>
            <p>Your verification link has expired. Please register again to get a new verification email.</p>
            <a href="/" style="color: #4F46E5;">Return to StudyHub</a>
          </body>
        </html>
      `);
    }

    res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc2626;">❌ Invalid Verification Link</h1>
          <p>The verification link is invalid or has been tampered with.</p>
          <a href="/" style="color: #4F46E5;">Return to StudyHub</a>
        </body>
      </html>
    `);
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Find unverified user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND email_verified = false',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No unverified account found with this email address' 
      });
    }

    const user = userResult.rows[0];

    // Generate new verification token
    const verificationToken = jwt.sign(
      { email, purpose: 'email-verification' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update verification token in database
    await pool.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [verificationToken, user.id]
    );

    // Send new verification email
    await sendVerificationEmail(email, user.username, verificationToken, req);

    res.json({ 
      message: 'Verification email sent successfully! Please check your inbox.' 
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Login (only allow verified users)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last active timestamp
    await pool.query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken(user.id);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        verified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, avatar_url, email_verified, created_at FROM users WHERE id = $1', 
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

module.exports = router;
