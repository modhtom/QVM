import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxios, mockCache, mockFFmpeg } = vi.hoisted(() => ({
    mockAxios: { get: vi.fn(), post: vi.fn() },
    mockCache: { get: vi.fn(), set: vi.fn() },
    mockFFmpeg: {
        inputFormat: vi.fn().mockReturnThis(),
        audioCodec: vi.fn().mockReturnThis(),
        save: vi.fn().mockReturnThis(),
        on: vi.fn((event, cb) => {
            if (event === 'end') setTimeout(cb, 0);
            return mockFFmpeg;
        }),
    }
}));

vi.mock('axios', () => ({ default: mockAxios }));
vi.mock('../../../utility/cache.js', () => ({ cache: mockCache }));
vi.mock('music-metadata', () => ({
    parseBuffer: vi.fn(() => Promise.resolve({ format: { duration: 2.5 } })),
}));
vi.mock('fluent-ffmpeg', () => ({
    default: vi.fn(() => mockFFmpeg)
}));

import * as data from '../../../utility/data.js';

describe('data.js Incremental Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be defined', () => {
        expect(data.fetchFullSurahData).toBeDefined();
    });

    it('should use mocked cache', async () => {
        mockCache.get.mockResolvedValue({ name: 'test' });
        const res = await data.fetchFullSurahData(1, 'ar');
        expect(res.name).toBe('test');
    });

    it('should fetch a range of ayahs including bismillah for Surah 2', async () => {
        mockCache.get.mockResolvedValue(null);
        mockAxios.get.mockImplementation((url) => {
            if (url.includes('/surah/2/')) return Promise.resolve({ data: { data: { ayahs: [{ text: 'Alif Lam Mim' }] } } });
            if (url.includes('/surah/1/')) return Promise.resolve({ data: { data: { ayahs: [{ text: 'Bismillah' }] } } });
            if (url.includes('/ayah/')) return Promise.resolve({ data: { data: { audio: 'http://cdn.mp3' } } });
            return Promise.resolve({ data: { data: 'audio-buffer' } });
        });

        const result = await data.getSurahDataRange(2, 1, 1, 'ar.alafasy', 'quran-simple');
        expect(result.combinedText).toContain('Bismillah');
        expect(result.combinedText).toContain('Alif Lam Mim');
        expect(result.durationPerAyah.length).toBe(2);
    });

    it('should process audio and text via partAudioAndText', async () => {
        mockCache.get.mockResolvedValue({ ayahs: [{ text: 'Test' }] });
        mockAxios.get.mockResolvedValue({ data: { data: { ayahs: [{ text: 'Test' }] } } });

        const result = await data.partAudioAndText(1, 1, 1, 'ar.alafasy', 'quran-simple');
        expect(result).toBe(1);
    });
});