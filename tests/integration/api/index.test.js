import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../index.js';
import * as db from '../../../utility/db.js';
import * as storage from '../../../utility/storage.js';
import * as data from '../../../utility/data.js';
import { generateToken } from '../../../utility/auth.js';
import fs from 'fs';
import axios from 'axios';
import express from 'express';

const { mockAdd, mockGetJob } = vi.hoisted(() => ({
    mockAdd: vi.fn(),
    mockGetJob: vi.fn(),
}));

vi.mock('bullmq', () => ({
    Queue: class {
        add = mockAdd;
        getJob = mockGetJob;
    }
}));

vi.mock('ioredis', () => ({
    default: class {
        on = vi.fn();
    }
}));

vi.mock('axios');

vi.mock('../../../utility/db.js', () => ({
    initDB: vi.fn(() => Promise.resolve()),
    getUserVideos: vi.fn(),
    deleteUserVideo: vi.fn(),
    findVideoByKey: vi.fn(),
    findUserById: vi.fn(),
    createAnalyticsJob: vi.fn(),
}));

vi.mock('../../../utility/storage.js', () => ({
    uploadToStorage: vi.fn(() => Promise.resolve()),
    deleteFromStorage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../utility/data.js', () => ({
    getSurahDataRange: vi.fn(),
}));

vi.mock('../../../utility/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const validToken = generateToken({ id: 1, username: 'testuser' });

describe('Index.js E2E API Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('/api/surah-verses-text', () => {
        it('should validate missing params', async () => {
            const res = await request(app).get('/api/surah-verses-text');
            expect(res.status).toBe(400);
        });

        it('should return error for invalid surah number', async () => {
            const res = await request(app).get('/api/surah-verses-text?surahNumber=200&startVerse=1&endVerse=5');
            expect(res.status).toBe(400);
        });

        it('should return text successfully', async () => {
            vi.mocked(data.getSurahDataRange).mockResolvedValue({ combinedText: 'verse1\nverse2' });
            const res = await request(app).get('/api/surah-verses-text?surahNumber=1&startVerse=1&endVerse=2');
            expect(res.status).toBe(200);
            expect(res.body.verses).toHaveLength(2);
        });

        it('should handle internal errors gracefully', async () => {
            vi.mocked(data.getSurahDataRange).mockRejectedValue(new Error('API Err'));
            const res = await request(app).get('/api/surah-verses-text?surahNumber=1&startVerse=1&endVerse=2');
            expect(res.status).toBe(500);
        });
    });

    describe('/generate-partial-video & /generate-full-video', () => {
        it('should queue a partial video', async () => {
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            mockAdd.mockResolvedValue({ id: jobId });
            const res = await request(app).post('/generate-partial-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ surahNumber: 1 });
                console.log('Response:', res.status, res.body);
                expect(res.status).toBe(202); //TODO: FIX THIS FAIL AssertionError: expected 500 to be 202
            // expect(res.body.jobId).toBe(jobId);
        });

        it('should handle errors queuing partial video', async () => {
            mockAdd.mockRejectedValue(new Error('Queue err'));
            const res = await request(app).post('/generate-partial-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({});
            expect(res.status).toBe(500);
        });

        it('should queue a full video', async () => {
            mockAdd.mockResolvedValue({ id: 'job2' });
            const res = await request(app).post('/generate-full-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ surahNumber: 1 });
            console.log('Response:', res.status, res.body);
            expect(res.status).toBe(202); //TODO: FIX THIS FAIL AssertionError: expected 500 to be 202
            // expect(res.body.jobId).toBe('job2');
        });

        it('should handle errors queuing full video', async () => {
            mockAdd.mockRejectedValue(new Error('Queue err'));
            const res = await request(app).post('/generate-full-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({});
            expect(res.status).toBe(500);
        });
    });

    describe('Video API routes', () => {
        it('should get user videos array', async () => {
            vi.mocked(db.getUserVideos).mockResolvedValue([{ s3Key: 'v1.mp4' }]);
            const res = await request(app).get('/api/videos').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(200);
            expect(res.body.videos).toContain('v1.mp4');
        });

        it('should handle get user videos array errors', async () => {
            vi.mocked(db.getUserVideos).mockRejectedValue(new Error('Failed get videos'));
            const res = await request(app).get('/api/videos').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(500);
        });

        it('should fail delete for invalid file Key', async () => {
            const res = await request(app).delete('/api/videos/..invalid').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(403);
        });

        it('should refuse delete if video unowned or not found', async () => {
            vi.mocked(db.findVideoByKey).mockResolvedValue(null);
            const res = await request(app).delete('/api/videos/videos/test.mp4').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(403);
        });

        it('should success delete', async () => {
            vi.mocked(db.findVideoByKey).mockResolvedValue({ userId: 1 });
            const res = await request(app).delete('/api/videos/videos/test.mp4').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(200);
            expect(storage.deleteFromStorage).toHaveBeenCalled();
            expect(db.deleteUserVideo).toHaveBeenCalled();
        });

        it('should catch error on delete', async () => {
            vi.mocked(db.findVideoByKey).mockResolvedValue({ userId: 1 });
            vi.mocked(storage.deleteFromStorage).mockRejectedValue(new Error('Storage del err'));
            const res = await request(app).delete('/api/videos/videos/test.mp4').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(500);
        });
    });

    describe('/job-status/:id', () => {
        it('should return job found', async () => {
            mockGetJob.mockResolvedValue({ id: 'job1', getState: async () => 'completed', progress: 100 });
            const res = await request(app).get('/job-status/job1');
            expect(res.status).toBe(200);
            expect(res.body.state).toBe('completed');
        });

        it('should return 404 for missing job', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await request(app).get('/job-status/999');
            expect(res.status).toBe(404);
        });
    });

    const proxyApp = express();
    proxyApp.use((req, res, next) => {
        if (req.url.includes('/upload-image') && req.method === 'POST') {
            req.files = {
                image: {
                    name: req.headers['x-mock-image-name'] || 'test.jpg',
                    mv: (path, cb) => {
                        if (req.headers['x-mock-mv-fail']) return cb(new Error('Upload failed'));
                        cb(null);
                    }
                }
            };
        }
        next();
    });
    proxyApp.use(app);

    describe('Upload endpoints success and validation', () => {
        it('should reject invalid file types for background', async () => {
            const res = await request(app).post('/upload-background')
                .set('Authorization', `Bearer ${validToken}`)
                .attach('backgroundFile', Buffer.from('fake'), 'test.txt'); // txt is invalid
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file type');
        });

        it('should successfully upload valid background', async () => {
            const res = await request(app).post('/upload-background')
                .set('Authorization', `Bearer ${validToken}`)
                .attach('backgroundFile', Buffer.from('fake'), 'test.mp4');
            expect(res.status).toBe(200);
            expect(storage.uploadToStorage).toHaveBeenCalled();
        });

        it('should successfully upload valid audio', async () => {
            const res = await request(app).post('/upload-audio')
                .set('Authorization', `Bearer ${validToken}`)
                .attach('audio', Buffer.from('fake'), 'test.mp3');
            expect(res.status).toBe(200);
            expect(storage.uploadToStorage).toHaveBeenCalled();
        });

        it('should reject invalid file type for audio', async () => {
            const res = await request(app).post('/upload-audio')
                .set('Authorization', `Bearer ${validToken}`)
                .attach('audio', Buffer.from('fake'), 'test.mp4'); // video not allowed for audio
            expect(res.status).toBe(400);
        });

        it('should successfully save image', async () => {
            const res = await request(app).post('/upload-image')
                .attach('image', Buffer.from('fake'), 'test.jpg');
            expect(res.status).toBe(200);
            expect(res.body.imagePath).toBeDefined();
        });
    });

    describe('/Output_Video/:video success path', () => {
        it('should send the local video file', async () => {
            const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            const res = await request(app).get('/Output_Video/test.mp4');
            spy.mockRestore();
        });

        it('should download the local video file', async () => {
            const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            const res = await request(app).get('/Output_Video/test.mp4?download=true');
            spy.mockRestore();
        });
    });

    describe('CORS and EventStreams', () => {
        it('should reject invalid CORS origin', async () => {
            const res = await request(app).get('/api/surah-verses-text').set('Origin', 'http://malicious.com');
            expect(res.status).toBe(403);
            expect(res.body.error).toContain('CORS');
        });
    });

    describe('/videos proxy success paths', () => {
        it('should successfully stream video', async () => {
            process.env.R2_PUBLIC_URL = 'http://test';
            const { Readable } = require('stream');
            const mockStream = new Readable({ read() { this.push('chunk'); this.push(null); } });
            axios.get.mockResolvedValue({
                status: 200,
                headers: { 'content-type': 'video/mp4', 'content-length': '5' },
                data: mockStream
            });
            const res = await request(app).get('/videos/file.mp4').set('Range', 'bytes=0-100');
            expect(res.status).toBe(200);
            expect(res.header['content-type']).toBe('video/mp4');
        });

        it('should force content disposition on download', async () => {
            process.env.R2_PUBLIC_URL = 'http://test';
            const { Readable } = require('stream');
            const mockStream = new Readable({ read() { this.push(null); } });
            axios.get.mockResolvedValue({
                status: 200,
                headers: {},
                data: mockStream
            });
            const res = await request(app).get('/videos/file.mp4?download=true');
            expect(res.status).toBe(200);
            expect(res.header['content-disposition']).toContain('attachment; filename="file.mp4"');
        });
    });
});