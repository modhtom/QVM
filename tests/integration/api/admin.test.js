import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import fsPromises from 'fs/promises';

const { mockGetMetricsSummary } = vi.hoisted(() => ({ mockGetMetricsSummary: vi.fn() }));

vi.mock('../../../utility/metrics.js', () => ({
  getMetricsSummary: mockGetMetricsSummary,
}));
vi.mock('../../../utility/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../utility/adminAuth.js', () => ({
  authenticateAdmin: (req, res, next) => next(),
}));

import adminRoutes from '../../../utility/adminRoutes.js';

const app = express();
app.use(bodyParser.json());
app.use('/api/admin', adminRoutes);

describe('Admin API Integration Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return metrics summary', async () => {
    mockGetMetricsSummary.mockReturnValue({ uptime: 100 });
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(200);
    expect(res.body.uptime).toBe(100);
  });

  it('should handle metrics retrieval error', async () => {
    mockGetMetricsSummary.mockImplementation(() => { throw new Error('Metrics fail'); });
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(500);
  });

  it('should return logs if available', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mockFileHandle = {
      stat: vi.fn().mockResolvedValue({ size: 25 }),
      read: vi.fn().mockImplementation((buf, offset, length, pos) => {
        const text = '{"message":"log content"}\n';
        buf.write(text);
        return { bytesRead: text.length };
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(fsPromises, 'open').mockResolvedValue(mockFileHandle);

    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([{ message: 'log content' }]);
  });

  it('should handle missing log file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
  });

  it('should handle log read error', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fsPromises, 'open').mockRejectedValue(new Error('Read fail'));
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(500);
  });
});