import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import authRoutes from '../../../utility/authRoutes.js';

vi.mock('../../../utility/db.js', () => ({
  createUser: vi.fn(),
  findUserByUsername: vi.fn(),
  findUserByEmail: vi.fn(),
  createAuthToken: vi.fn(),
}));

vi.mock('../../../utility/email.js', () => ({
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../utility/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import * as db from '../../../utility/db.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);

describe('Auth API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      vi.mocked(db.findUserByUsername).mockResolvedValue(null);
      vi.mocked(db.findUserByEmail).mockResolvedValue(null);
      vi.mocked(db.createUser).mockResolvedValue({ id: 1, username: 'testuser', email: 'test@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Account created successfully');
      expect(response.body.token).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should return 409 if username exists', async () => {
      vi.mocked(db.findUserByUsername).mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Username already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash('password123', 10);
      
      vi.mocked(db.findUserByUsername).mockResolvedValue({
        id: 1,
        username: 'testuser',
        passwordHash: hashedPassword,
        isVerified: 1
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('should return 401 for incorrect password', async () => {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash('password123', 10);
      
      vi.mocked(db.findUserByUsername).mockResolvedValue({
        id: 1,
        username: 'testuser',
        passwordHash: hashedPassword
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid username or password');
    });
  });
});