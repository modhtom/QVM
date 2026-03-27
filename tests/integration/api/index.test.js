import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

const { mockQueue, mockAdd, mockGetJob } = vi.hoisted(() => {
  const add = vi.fn(() => Promise.resolve({ id: 'job-123' }));
  const getJob = vi.fn();
  return {
    mockAdd: add,
    mockGetJob: getJob,
    mockQueue: vi.fn(() => ({
      add,
      getJob,
    })),
  };
});

vi.mock('bullmq', () => ({Queue: mockQueue,}));
vi.mock('ioredis', () => ({
  default: function() {
    this.on = vi.fn();
    this.status = 'ready';
  },
}));
vi.mock('./utility/db.js', () => ({
  initDB: vi.fn(() => Promise.resolve()),
  getUserVideos: vi.fn(() => Promise.resolve(['video1.mp4'])),
  deleteUserVideo: vi.fn(() => Promise.resolve(true)),
  findVideoByKey: vi.fn(() => Promise.resolve({ userId: 1 })),
}));
vi.mock('./utility/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 1, username: 'testuser' };
    next();
  }),
}));
vi.mock('./utility/logger.js', () => ({logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },}));

const app = express();
app.use(bodyParser.json());

app.post("/generate-full-video", (req, res) => {
    mockAdd('process-video', { type: 'full', videoData: req.body, userId: 1 })
        .then(job => res.status(202).json({ message: "Queued", jobId: job.id }));
});
app.post("/generate-partial-video", (req, res) => {
    mockAdd('process-video', { type: 'partial', videoData: req.body, userId: 1 })
        .then(job => res.status(202).json({ message: "Queued", jobId: job.id }));
});
app.get('/job-status/:id', async (req, res) => {
    const job = await mockGetJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ id: job.id, state: await job.getState(), progress: job.progress });
});

describe('Index API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should queue a full video generation job', async () => {
    const response = await request(app)
      .post('/generate-full-video')
      .send({ surahNumber: 1 });

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBe('job-123');
    expect(mockAdd).toHaveBeenCalledWith('process-video', expect.objectContaining({ type: 'full' }));
  });

  it('should queue a partial video generation job', async () => {
    const response = await request(app)
      .post('/generate-partial-video')
      .send({ surahNumber: 1, startVerse: 1, endVerse: 7 });

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBe('job-123');
    expect(mockAdd).toHaveBeenCalledWith('process-video', expect.objectContaining({ type: 'partial' }));
  });

  it('should return job status if job exists', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-123',
      getState: vi.fn().mockResolvedValue('active'),
      progress: 50,
    });

    const response = await request(app).get('/job-status/job-123');
    expect(response.status).toBe(200);
    expect(response.body.state).toBe('active');
    expect(response.body.progress).toBe(50);
  });

  it('should return 404 for nonexistent job', async () => {
    mockGetJob.mockResolvedValue(null);
    const response = await request(app).get('/job-status/nonexistent');
    expect(response.status).toBe(404);
  });
});