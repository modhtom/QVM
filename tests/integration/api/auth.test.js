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

        it('should catch validation errors from missing email and password', async () => {
            const res1 = await request(app).post('/api/auth/register').send({ username: 'valid_user' });
            expect(res1.status).toBe(400);
            
            const res2 = await request(app).post('/api/auth/register').send({ username: 'valid_user', email: 'test@test.com' });
            expect(res2.status).toBe(400);
        });
        
        it('should return 409 if username taken', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1 });
            const res = await request(app).post('/api/auth/register').send({username: 'user123', email: 't@t.com', password: 'password123'});
            expect(res.status).toBe(409);
        });
        it('should return 409 if email taken', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue(null);
            vi.mocked(db.findUserByEmail).mockResolvedValue({ id: 1 });
            const res = await request(app).post('/api/auth/register').send({username: 'user123', email: 't@t.com', password: 'password123'});
            expect(res.status).toBe(409);
        });
        
        it('should return 500 on db error during registration', async () => {
            vi.mocked(db.findUserByUsername).mockRejectedValue(new Error('DB error'));
            const res = await request(app).post('/api/auth/register').send({username: 'user123', email: 't@t.com', password: 'password123'});
            expect(res.status).toBe(500);
        });
    });

    describe('Login Branch Coverage', () => {
        it('should return 400 if missing username or password', async () => {
            const res1 = await request(app).post('/api/auth/login').send({ username: 'user' });
            expect(res1.status).toBe(400);
            const res2 = await request(app).post('/api/auth/login').send({ password: 'p' });
            expect(res2.status).toBe(400);
        });

        it('should cover login success and failures', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            const res = await request(app).post('/api/auth/login').send({ username: 'u', password: 'p' });
            expect(res.status).toBe(200);

            vi.mocked(db.findUserByUsername).mockResolvedValue(null);
            const res2 = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'p' });
            expect(res2.status).toBe(401);
        });

        it('should handle wrong password with 401', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
            const res = await request(app).post('/api/auth/login').send({ username: 'u', password: 'wrong' });
            expect(res.status).toBe(401);
        });

        it('should return 500 on db error during login', async () => {
            vi.mocked(db.findUserByUsername).mockRejectedValue(new Error('Login DB Error'));
            const res = await request(app).post('/api/auth/login').send({ username: 'user', password: 'p' });
            expect(res.status).toBe(500);
        });
    });

    describe('/me logic', () => {
        it('should return 404 if user not found via auth token', async () => {
            const token = generateToken({ id: 1, username: 'test' });
            vi.mocked(db.findUserById).mockResolvedValue(null);
            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });

        it('should return 200 with user data if found', async () => {
            const token = generateToken({ id: 1, username: 'test' });
            vi.mocked(db.findUserById).mockResolvedValue({ id: 1, username: 'test' });
            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('test');
        });
    });

    describe('Verification & Reset Branch Coverage', () => {
        it('should return 400 for verify-email without token', async () => {
            const res = await request(app).get('/api/auth/verify-email');
            expect(res.status).toBe(400);
        });

        it('should return 400 for verify-email with invalid token', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue(null);
            const res = await request(app).get('/api/auth/verify-email?token=abc');
            expect(res.status).toBe(400);
        });

        it('should cover email verification success', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue({ userId: 1 });
            const res = await request(app).get('/api/auth/verify-email?token=abc');
            expect(res.status).toBe(200);
        });

        it('should return 500 on verification error', async () => {
            vi.mocked(db.findAuthToken).mockRejectedValue(new Error('Db error'));
            const res = await request(app).get('/api/auth/verify-email?token=abc');
            expect(res.status).toBe(500);
        });

        it('should return 400 for forgot-password missing email', async () => {
            const res = await request(app).post('/api/auth/forgot-password').send({});
            expect(res.status).toBe(400);
        });

        it('should process forgot-password successfully', async () => {
            vi.mocked(db.findUserByEmail).mockResolvedValue({ id: 1, email: 't@t.com' });
            const res = await request(app).post('/api/auth/forgot-password').send({email: 't@t.com'});
            expect(res.status).toBe(200);
        });

        it('should return 500 on forgot-password error', async () => {
            vi.mocked(db.findUserByEmail).mockRejectedValue(new Error('db err'));
            const res = await request(app).post('/api/auth/forgot-password').send({email: 't@t.com'});
            expect(res.status).toBe(500);
        });

        it('should return 400 for reset-password missing fields', async () => {
            const res1 = await request(app).post('/api/auth/reset-password').send({ token: 'abc' });
            expect(res1.status).toBe(400);
        });

        it('should return 400 for reset-password with invalid token', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue(null);
            const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc', newPassword: 'password123' });
            expect(res.status).toBe(400);
        });

        it('should cover password reset success', async () => {
            vi.mocked(db.findAuthToken).mockResolvedValue({ userId: 1 });
            const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc', newPassword: 'password123' });
            expect(res.status).toBe(200);
        });

        it('should return 500 on reset-password error', async () => {
            vi.mocked(db.findAuthToken).mockRejectedValue(new Error('db err'));
            const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc', newPassword: 'password123' });
            expect(res.status).toBe(500);
        });
    });

    describe('Account Deletion Branch Coverage', () => {
        const token = generateToken({ id: 1, username: 'test' });
        
        it('should return 400 if password missing', async () => {
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({});
            expect(res.status).toBe(400);
        });

        it('should return 404 if user not found via token info', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue(null);
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'p' });
            expect(res.status).toBe(404);
        });

        it('should return 401 if wrong password', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, username: 'test', passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'wrong' });
            expect(res.status).toBe(401);
        });

        it('should cover account deletion success', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, username: 'test', passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'p' });
            expect(res.status).toBe(200);
        });

        it('should return 500 on db error', async () => {
            vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1, username: 'test', passwordHash: 'h' });
            vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            vi.mocked(db.deleteUser).mockRejectedValue(new Error('delete err'));
            const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send({ password: 'p' });
            expect(res.status).toBe(500);
        });
    });
});