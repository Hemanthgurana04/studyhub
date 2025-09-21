const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email, username, verificationToken) => {
  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify Your StudyHub Account</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .btn:hover { background: #5a6fd8; }
            .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📚 Welcome to StudyHub!</h1>
                <p>Thanks for joining our study community</p>
            </div>
            <div class="content">
                <h2>Hi ${username}! 👋</h2>
                <p>Welcome to StudyHub - the ultimate platform for collaborative studying! We're excited to have you join our community of learners.</p>
                
                <p><strong>To get started, please verify your email address:</strong></p>
                
                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="btn">✅ Verify My Email</a>
                </div>
                
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
                
                <p><strong>What you can do after verification:</strong></p>
                <ul>
                    <li>🎥 Join HD video study rooms</li>
                    <li>👥 Connect with study partners worldwide</li>
                    <li>📺 Share your screen while studying</li>
                    <li>💬 Chat in real-time during study sessions</li>
                    <li>🏠 Create private study rooms for your friends</li>
                </ul>
                
                <p><strong>⏰ This verification link expires in 24 hours.</strong></p>
                
                <p>If you didn't create this account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>Happy studying! 📖<br>
                The StudyHub Team</p>
                <p><small>This email was sent to ${email}</small></p>
            </div>
        </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'StudyHub <noreply@resend.dev>', // Use your domain when verified
      to: email,
      subject: '📚 Verify Your StudyHub Account - Start Studying Together!',
      html: emailHtml
    });
    
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, username) => {
  const welcomeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome to StudyHub!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Account Verified Successfully!</h1>
            </div>
            <div class="content">
                <h2>Welcome aboard, ${username}! 🚀</h2>
                <p>Your email has been verified and your StudyHub account is now active!</p>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_URL}" class="btn">🏠 Go to StudyHub</a>
                </div>
                
                <h3>🌟 Getting Started Tips:</h3>
                <ol>
                    <li><strong>Explore Public Rooms</strong> - Join ongoing study sessions</li>
                    <li><strong>Create Your First Room</strong> - Start your own study group</li>
                    <li><strong>Add Study Partners</strong> - Send friend requests to connect</li>
                    <li><strong>Enable Notifications</strong> - Stay updated on room activities</li>
                </ol>
                
                <p>Need help? Check out our platform features and start studying with students from around the world!</p>
                
                <p>Happy studying! 📚✨</p>
            </div>
        </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'StudyHub <noreply@resend.dev>',
      to: email,
      subject: '🎉 Welcome to StudyHub - You\'re All Set!',
      html: welcomeHtml
    });
    
    console.log(`Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail
};
