import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../index.js';
import * as db from '../../../utility/db.js';
import { generateToken } from '../../../utility/auth.js';
import bcrypt from 'bcrypt';

vi.mock('../../../utility/db.js', () => ({
    initDB: vi.fn(() => Promise.resolve()),
    createUser: vi.fn(),
    findUserByUsername: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createAuthToken: vi.fn(),
    findAuthToken: vi.fn(),
    deleteAuthTokensForUser: vi.fn(),
    verifyUserEmail: vi.fn(),
    updateUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    getUserVideos: vi.fn(() => Promise.resolve([])),
    deleteUserVideo: vi.fn(() => Promise.resolve()),
    findVideoByKey: vi.fn(),
}));

vi.mock('../../../utility/email.js', () => ({
    sendVerificationEmail: vi.fn(() => Promise.resolve()),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

describe('authRoutes.js Real App Stack Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Registration Branch Coverage', () => {
        it('should cover registration logic with success', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue(null);
            vi.mocked(db.findUserByEmail).mockResolvedValue(null);
            vi.mocked(db.createUser).mockResolvedValue({ id: 1, username: 'test_coverage', email: 'test@c.com' });

            const res = await request(app).post('/api/auth/register').send({
                username: 'test_coverage', email: 'test@c.com', password: 'password123'
            });
            expect(res.status).toBe(201);
        });

        it('should cover registration validation failures', async () => {
            const res = await request(app).post('/api/auth/register').send({ username: 'a' });
            expect(res.status).toBe(400);
        });
    });

    describe('Login Branch Coverage', () => {
        it('should cover login success and failures', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            const res = await request(app).post('/api/auth/login').send({ username: 'u', password: 'p' });
            expect(res.status).toBe(200);

            vi.mocked(db.findUserByUsername).mockResolvedValue(null);
            const res2 = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'p' });
            expect(res2.status).toBe(401);
        });
    });

    describe('Verification & Reset Branch Coverage', () => {
        it('should cover email verification success', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue({ userId: 1 });
            const res = await request(app).get('/api/auth/verify-email?token=abc');
            expect(res.status).toBe(200);
        });

        it('should cover password reset success', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue({ userId: 1 });
            const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc', newPassword: 'password123' });
            expect(res.status).toBe(200);
        });
    });

    describe('Account Deletion Branch Coverage', () => {
        it('should cover account deletion success', async () => {
            const token = generateToken({ id: 1, username: 'test' });
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, username: 'test', passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'p' });
            expect(res.status).toBe(200);
        });
    });
});