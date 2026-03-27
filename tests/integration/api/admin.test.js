import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

const { mockGetMetricsSummary } = vi.hoisted(() => ({
  mockGetMetricsSummary: vi.fn(() => ({
    uptime: 100,
    totalRequests: 50,
    averageProcessingTime: 1200,
    successRate: 0.95
  })),
}));

vi.mock('../../../utility/metrics.js', () => ({getMetricsSummary: mockGetMetricsSummary,}));
vi.mock('../../../utility/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../../utility/adminAuth.js', () => ({
  authenticateAdmin: (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === 'Basic ' + Buffer.from('admin:password').toString('base64')) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  },
}));

import adminRoutes from '../../../utility/adminRoutes.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/admin', adminRoutes);

describe('Admin API Integration', () => {
  const validAuth = 'Basic ' + Buffer.from('admin:password').toString('base64');
  const invalidAuth = 'Basic ' + Buffer.from('wrong:wrong').toString('base64');

  it('should return metrics summary with valid credentials', async () => {
    const response = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', validAuth);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptime', 100);
    expect(response.body).toHaveProperty('successRate', 0.95);
  });

  it('should return 401 with invalid credentials', async () => {
    const response = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', invalidAuth);

    expect(response.status).toBe(401);
  });

  it('should return 401 without credentials', async () => {
    const response = await request(app)
      .get('/api/admin/metrics');

    expect(response.status).toBe(401);
  });

  it('should return recent logs', async () => {
    const response = await request(app)
      .get('/api/admin/logs?lines=10')
      .set('Authorization', validAuth);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('logs');
    expect(Array.isArray(response.body.logs)).toBe(true);
  });
});