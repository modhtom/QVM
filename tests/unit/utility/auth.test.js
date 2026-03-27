import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, authenticateToken } from '../../../utility/auth.js';

describe('auth.js', () => {
  const mockUser = { id: 1, username: 'testuser' };
  const secret = process.env.JWT_SECRET || 'test_secret';

  it('should generate a valid JWT token', () => {
    const token = generateToken(mockUser);
    expect(token).toBeDefined();
    const decoded = jwt.verify(token, secret);
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.username).toBe(mockUser.username);
  });

  it('should authenticate a valid token', () => {
    const token = generateToken(mockUser);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 if no token is provided', () => {
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});