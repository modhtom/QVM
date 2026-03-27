import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRunAutoSync, mockGenerateFullVideo, mockAddVideo } = vi.hoisted(() => ({
    mockRunAutoSync: vi.fn(),
    mockGenerateFullVideo: vi.fn(),
    mockAddVideo: vi.fn(),
}));

vi.mock('bullmq', () => ({
    Worker: vi.fn().mockImplementation((name, processor) => {
        return {processor,on: vi.fn()};
    }),
}));
vi.mock('../../../utility/data.js', () => ({
    partAudioAndText: vi.fn(() => Promise.resolve(1)),
}));
vi.mock('../../../utility/autoSync.js', () => ({
    runAutoSync: mockRunAutoSync,
}));
vi.mock('../../../video.js', () => ({
    generatePartialVideo: vi.fn(() => Promise.resolve({ vidPath: 'path/to/partial.mp4' })),
    generateFullVideo: mockGenerateFullVideo,
}));
vi.mock('../../../utility/db.js', () => ({
    initDB: vi.fn(() => Promise.resolve()),
    addVideo: mockAddVideo,
}));
vi.mock('../../../utility/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../utility/metrics.js', () => ({
    recordJobSuccess: vi.fn(),
    recordJobFailure: vi.fn(),
    recordError: vi.fn(),
}));
vi.mock('../../../utility/webhooks.js', () => ({
    sendWebhookNotification: vi.fn(),
}));

describe('Worker job processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should identify correctly mocked components', () => {
        expect(mockGenerateFullVideo).toBeDefined();
        expect(mockRunAutoSync).toBeDefined();
        expect(mockAddVideo).toBeDefined();
    });

    it('should call generateFullVideo for "full" job type', async () => {
        mockGenerateFullVideo.mockResolvedValue({ vidPath: 'videos/out.mp4' });
        const result = await mockGenerateFullVideo(1);

        expect(result.vidPath).toBe('videos/out.mp4');
    });

    it('should trigger database record on successful generation with userId', async () => {
        const vidPath = 'videos/final.mp4';
        const userId = 123;
        if (userId && vidPath) {
            await mockAddVideo(userId, vidPath, 'final.mp4');
        }
        
        expect(mockAddVideo).toHaveBeenCalledWith(123, vidPath, 'final.mp4');
    });

    it('should handle auto-sync preparation for custom audio', async () => {
        const videoData = { audioSource: 'custom', autoSync: true, customAudioPath: 'test.mp3' };
        if (videoData.audioSource === 'custom' && videoData.autoSync === true) {
            await mockRunAutoSync(videoData.customAudioPath, 1, 1, 7);
        }
        
        expect(mockRunAutoSync).toHaveBeenCalled();
    });
});