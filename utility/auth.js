import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
}

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { id: decoded.id, username: decoded.username };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            const decoded = jwt.decode(token);
            if (decoded && decoded.id && decoded.username) {
                const newToken = jwt.sign(
                    { id: decoded.id, username: decoded.username },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
                res.setHeader('X-New-Token', newToken);

                req.user = { id: decoded.id, username: decoded.username };
                return next();
            }
        }
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}