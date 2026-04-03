import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as background from '../../../utility/background.js';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import youtubedl from 'youtube-dl-exec';
import axios from 'axios';
import * as storage from '../../../utility/storage.js';
import * as dbData from '../../../utility/data.js';

vi.mock('fs');
vi.mock('fluent-ffmpeg');
vi.mock('youtube-dl-exec', () => ({
    default: vi.fn(() => Promise.resolve())
}));
vi.mock('axios');
vi.mock('../../../utility/storage.js');
vi.mock('../../../utility/data.js');

describe('background.js', () => {
    const createMockFfmpeg = () => ({
        input: vi.fn().mockReturnThis(),
        inputOptions: vi.fn().mockReturnThis(),
        videoFilters: vi.fn().mockReturnThis(),
        noAudio: vi.fn().mockReturnThis(),
        videoCodec: vi.fn().mockReturnThis(),
        outputOptions: vi.fn().mockReturnThis(),
        duration: vi.fn().mockReturnThis(),
        complexFilter: vi.fn().mockReturnThis(),
        on: vi.fn().mockImplementation(function (event, cb) {
            if (event === 'end') setTimeout(cb, 1);
            return this;
        }),
        save: vi.fn().mockReturnThis()
    });

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        process.env.UNSPLASH_ACCESS_KEY = 'test_key';

        vi.mocked(ffmpeg).mockImplementation(createMockFfmpeg);

        const mockStream = {
            on: vi.fn().mockImplementation(function (event, cb) {
                if (event === 'finish' || event === 'end') setTimeout(cb, 1);
                return this;
            }),
            pipe: vi.fn().mockReturnThis()
        };

        vi.mocked(axios).mockResolvedValue({ data: mockStream });
        vi.mocked(axios.get).mockResolvedValue({ data: { results: [] } });
        vi.mocked(fs.createWriteStream).mockReturnValue(mockStream);
        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should handle uploads/ prefix', async () => {
        vi.mocked(storage.downloadFromStorage).mockResolvedValue(true);
        const result = await background.getBackgroundPath(true, 'uploads/test.mp4', 5, 'landscape', {});
        expect(result).toContain('processed_');
    });

    it('should handle direct image URL', async () => {
        const result = await background.getBackgroundPath(true, 'http://test.com/bg.jpg', 5, 'landscape', {});
        expect(result).toContain('processed_image_');
    });

    it('should handle local video path', async () => {
        const result = await background.getBackgroundPath(true, 'my_video.mp4', 5, 'landscape', {});
        expect(result).toContain('processed_');
    });

    it('should handle AI generating keywords and searching Unsplash', async () => {
        vi.mocked(dbData.getSurahDataRange).mockResolvedValue({ combinedTranslation: 'Paradise and gardens' });
        vi.mocked(axios.get).mockResolvedValueOnce({
            data: { results: [{ id: '123', urls: { regular: 'img.jpg' } }] }
        });
        const result = await background.getBackgroundPath(false, null, 5, 'landscape', { surahNumber: 1 });
        expect(result).toContain('ai_slideshow_');
    });

    it('should handle YouTube URL', async () => {
        vi.mocked(youtubedl).mockResolvedValue(true);
        const result = await background.getBackgroundPath(true, 'https://youtube.com/watch?v=abc', 5, 'landscape', {});
        expect(result).toContain('processed_');
    });

    it('should use fallback video when search fails', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Unsplash down'));
        const result = await background.getBackgroundPath(false, null, 5, 'landscape', { surahNumber: 1 });
        expect(result).toContain('processed_');
    });
});