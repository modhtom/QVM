import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import fs from 'fs';

const { mockS3Send, mockUploadDoneReal } = vi.hoisted(() => ({
    mockS3Send: vi.fn(),
    mockUploadDoneReal: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {
        constructor() { }
        send = mockS3Send;
    },
    DeleteObjectCommand: class { constructor(p) { this.p = p; } },
    GetObjectCommand: class { constructor(p) { this.p = p; } },
}));
vi.mock('@aws-sdk/lib-storage', () => ({
    Upload: class {
        constructor() { }
        done = mockUploadDoneReal;
        on = vi.fn().mockImplementation(function (event, cb) {
            if (event === 'httpUploadProgress') setTimeout(() => cb({ loaded: 50, total: 100 }), 0);
            if (event === 'error') this.errorCb = cb;
            return this;
        });
    }
}));
vi.mock('stream/promises', () => ({
    pipeline: vi.fn(() => Promise.resolve()),
}));

import * as storage from '../../../utility/storage.js';

describe('storage.js Full Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();

        vi.spyOn(fs, 'createReadStream').mockImplementation(() => new Readable({ read() { this.push(null); } }));
        vi.spyOn(fs, 'createWriteStream').mockImplementation(() => ({
            on: vi.fn((event, cb) => { if (event === 'finish') setTimeout(cb, 0); return this; }),
            once: vi.fn().mockReturnThis(),
            emit: vi.fn().mockReturnThis(),
            write: vi.fn().mockReturnThis(),
            end: vi.fn().mockReturnThis()
        }));
    });

    it('should successfully upload a file', async () => {
        mockUploadDoneReal.mockResolvedValue({ Location: 'cloud/url' });
        const result = await storage.uploadToStorage('tmp/test.mp4', 'videos/test.mp4');
        expect(result).toBe('videos/test.mp4');
    });

    it('should handle upload failure', async () => {
        mockUploadDoneReal.mockRejectedValue(new Error('Upload Task Failed'));
        await expect(storage.uploadToStorage('tmp/test.mp4', 'videos/test.mp4')).rejects.toThrow('Upload Task Failed');
    });

    it('should successfully download a file', async () => {
        const mockBody = new Readable({ read() { this.push(null); } });
        mockS3Send.mockResolvedValue({ Body: mockBody });
        const result = await storage.downloadFromStorage('v.mp4', 't.mp4');
        expect(result).toBe('t.mp4');
    });

    it('should handle download failure', async () => {
        mockS3Send.mockRejectedValue(new Error('S3 Download Fail'));
        await expect(storage.downloadFromStorage('v.mp4', 't.mp4')).rejects.toThrow('S3 Download Fail');
    });

    it('should successfully delete a file', async () => {
        mockS3Send.mockResolvedValue({});
        await storage.deleteFromStorage('v.mp4');
        expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle delete failure silently', async () => {
        mockS3Send.mockRejectedValue(new Error('S3 Delete Fail'));
        await expect(storage.deleteFromStorage('v.mp4')).resolves.toBeUndefined();
    });

    it('should cover getPublicUrl', () => {
        const url = storage.getPublicUrl('key');
        expect(url).toContain('key');
    });
});