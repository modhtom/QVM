import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
    createUser, findUserByUsername, findUserByEmail, findUserById,
    createAuthToken, findAuthToken, deleteAuthTokensForUser, verifyUserEmail, updateUserPassword,
    deleteUser
} from './db.js';
import { generateToken, authenticateToken } from './auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';

const router = Router();
const SALT_ROUNDS = 12;

function validateUsername(username) {
    if (!username || typeof username !== 'string') return 'Username is required';
    if (username.length < 3 || username.length > 30) return 'Username must be 3-30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
    return null;
}

function validateEmail(email) {
    if (!email || typeof email !== 'string') return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Invalid email format';
    return null;
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 128) return 'Password must be less than 128 characters';
    return null;
}

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const usernameError = validateUsername(username);
        if (usernameError) return res.status(400).json({ error: usernameError });

        const emailError = validateEmail(email);
        if (emailError) return res.status(400).json({ error: emailError });

        const passwordError = validatePassword(password);
        if (passwordError) return res.status(400).json({ error: passwordError });

        if (await findUserByUsername(username)) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        if (await findUserByEmail(email)) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await createUser(username, email, passwordHash);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await createAuthToken(user.id, verificationToken, 'verify', expiresAtDate);

        sendVerificationEmail(user.email, verificationToken).catch(err => console.error(err));

        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully. Please check your email to verify your account.',
            token,
            user: { id: user.id, username: user.username, email: user.email, isVerified: 0 }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email, isVerified: user.isVerified || 0 }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    const user = await findUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send('Token is required');

        const dbToken = await findAuthToken(token, 'verify');
        if (!dbToken) {
            return res.status(400).send('Invalid or expired verification token');
        }

        await verifyUserEmail(dbToken.userId);
        await deleteAuthTokensForUser(dbToken.userId, 'verify');

        res.send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تم التحقق - QVM</title>
                <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; background:#f8faf9; color:#1a2e1a; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
                    .card { background:#ffffff; border-radius:24px; padding:50px 40px; max-width:500px; width:100%; text-align:center; box-shadow:0 8px 25px rgba(26,77,58,0.12); border:1px solid #e0e8e5; }
                    .logo { font-size:3rem; font-weight:700; background:linear-gradient(135deg,#1a4d3a,#2d7d5a); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:4px; margin-bottom:8px; }
                    .subtitle { font-family:'Amiri',serif; font-size:1.2rem; color:#d4af37; margin-bottom:30px; }
                    .icon { width:80px; height:80px; background:linear-gradient(135deg,#1a4d3a,#2d7d5a); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 25px; }
                    .icon svg { width:40px; height:40px; fill:#ffffff; }
                    h2 { font-size:1.5rem; font-weight:600; color:#1a4d3a; margin-bottom:15px; }
                    p { font-size:1rem; color:#4a5e4a; line-height:1.6; margin-bottom:25px; }
                    .btn { display:inline-block; padding:16px 40px; background:linear-gradient(135deg,#d4af37,#f4d03f); color:#1a2e1a; text-decoration:none; border-radius:50px; font-weight:600; font-size:1rem; letter-spacing:1px; text-transform:uppercase; box-shadow:0 8px 25px rgba(26,77,58,0.12); transition:all 0.3s; }
                    .btn:hover { transform:translateY(-3px); box-shadow:0 12px 30px rgba(26,77,58,0.2); }
                    .divider { height:2px; background:linear-gradient(135deg,#d4af37,#f4d03f); border-radius:2px; margin:30px 0 20px; }
                    .footer { font-size:12px; color:#4a5e4a; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="logo">QVM</div>
                    <div class="subtitle">صانع فيديو القرآن الكريم</div>
                    <div class="icon">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    </div>
                    <h2>تم التحقق من بريدك الإلكتروني بنجاح!</h2>
                    <p>يمكنك الآن الاستمتاع بجميع ميزات المنصة. أغلق هذه الصفحة وعد إلى التطبيق.</p>
                    <a href="/" class="btn">العودة إلى الرئيسية</a>
                    <div class="divider"></div>
                    <p class="footer">&copy; ${new Date().getFullYear()} QVM. جميع الحقوق محفوظة.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send('Internal server error');
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await findUserByEmail(email);
        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAtDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await deleteAuthTokensForUser(user.id, 'reset');
            await createAuthToken(user.id, resetToken, 'reset', expiresAtDate);

            sendPasswordResetEmail(user.email, resetToken).catch(err => console.error(err));
        }

        res.json({ message: 'If an account with that email exists, we have sent a password reset link.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) return res.status(400).json({ error: passwordError });

        const dbToken = await findAuthToken(token, 'reset');
        if (!dbToken) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await updateUserPassword(dbToken.userId, passwordHash);
        await deleteAuthTokensForUser(dbToken.userId, 'reset');

        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
});
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required to confirm account deletion' });
        }

        const user = await findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        await deleteUser(user.id);
        console.log(`[Auth] User ${user.username} (ID: ${user.id}) deleted their account.`);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

export default router;