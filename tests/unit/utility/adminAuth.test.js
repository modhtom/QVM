import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateAdmin } from '../../../utility/adminAuth.js';
import { logger } from '../../../utility/logger.js';

vi.mock('../../../utility/logger.js', () => ({
    logger: {
        warn: vi.fn(),
    }
}));

describe('adminAuth.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_USERNAME = 'admin';
        process.env.ADMIN_PASSWORD = 'password123';
    });

    it('should return 401 if no authorization header is present', () => {
        const req = { headers: {}, ip: '127.0.0.1' };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        authenticateAdmin(req, res, next);
        expect(logger.warn).toHaveBeenCalledWith('Unauthorized admin access attempt from 127.0.0.1');
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Admin credentials required' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if invalid authorization scheme is used', () => {
        const req = { headers: { authorization: 'Bearer some_token' }, ip: '127.0.0.1' };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        authenticateAdmin(req, res, next);
        expect(logger.warn).toHaveBeenCalledWith('Invalid admin credentials used from 127.0.0.1');
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if wrong basic auth credentials are provided', () => {
        const wrongCreds = Buffer.from('admin:wrongpass').toString('base64');
        const req = { headers: { authorization: `Basic ${wrongCreds}` }, ip: '127.0.0.1' };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        authenticateAdmin(req, res, next);
        expect(logger.warn).toHaveBeenCalledWith('Invalid admin credentials used from 127.0.0.1');
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if valid basic auth credentials are provided', () => {
        const correctCreds = Buffer.from('admin:password123').toString('base64');
        const req = { headers: { authorization: `Basic ${correctCreds}` }, ip: '127.0.0.1' };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        const next = vi.fn();

        authenticateAdmin(req, res, next);
        expect(req.isAdmin).toBe(true);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});