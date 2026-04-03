import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

import { authenticateToken, generateToken } from '../../../utility/auth.js';

describe('auth.js unit tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            setHeader: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    it('should authenticate a valid token', () => {
        const token = generateToken({ id: 1, username: 'test' });
        req.headers['authorization'] = `Bearer ${token}`;

        authenticateToken(req, res, next);

        expect(req.user).toBeDefined();
        expect(req.user.username).toBe('test');
        expect(next).toHaveBeenCalled();
    });

    it('should return 401 if no token is provided', () => {
        authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should auto-refresh an expired token', () => {
        const expiredToken = jwt.sign(
            { id: 1, username: 'test', iat: Math.floor(Date.now() / 1000) - 10000 },
            JWT_SECRET,
            { expiresIn: '0s' }
        );
        req.headers['authorization'] = `Bearer ${expiredToken}`;

        authenticateToken(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('X-New-Token', expect.any(String));
        expect(req.user.username).toBe('test');
        expect(next).toHaveBeenCalled();
    });

    it('should return 401 for invalid tokens', () => {
        req.headers['authorization'] = 'Bearer invalid-token';
        authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });
});