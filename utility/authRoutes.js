import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createUser, findUserByUsername, findUserByEmail, findUserById } from './db.js';
import { generateToken, authenticateToken } from './auth.js';

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

        if (findUserByUsername(username)) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        if (findUserByEmail(email)) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = createUser(username, email, passwordHash);
        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id: user.id, username: user.username, email: user.email }
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

        const user = findUserByUsername(username);
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
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

router.get('/me', authenticateToken, (req, res) => {
    const user = findUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

export default router;