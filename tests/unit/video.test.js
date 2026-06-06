import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFfmpegInstance, mockFfmpeg } = vi.hoisted(() => {
    const mockInstance = {
        input: vi.fn().mockReturnThis(),
        inputOptions: vi.fn().mockReturnThis(),
        audioCodec: vi.fn().mockReturnThis(),
        videoCodec: vi.fn().mockReturnThis(),
        outputOptions: vi.fn().mockReturnThis(),
        videoFilter: vi.fn().mockReturnThis(),
        output: vi.fn().mockReturnThis(),
        duration: vi.fn().mockReturnThis(),
        on: vi.fn().mockImplementation(function (event, cb) {
            return this;
        }),
        run: vi.fn(),
        kill: vi.fn()
    };
    const mockFn = vi.fn(() => mockInstance);
    mockFn.getAvailableCodecs = vi.fn((cb) => cb(null, { libx264: {} }));
    return { mockFfmpegInstance: mockInstance, mockFfmpeg: mockFn };
});

vi.mock('fluent-ffmpeg', () => ({
    default: mockFfmpeg
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 100 })),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn()
    }
}));

import { runFFmpegRender } from '../../video.js';

describe('runFFmpegRender Watchdog Timeout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should kill the ffmpeg process and reject the promise if timeout is exceeded', async () => {
        const promise = runFFmpegRender({
            backgroundPath: 'bg.mp4',
            audioPath: 'audio.mp3',
            outputPath: 'output.mp4',
            subtitleFilter: 'subtitles=sub.ass',
            audioLen: 10,
            startTimeOffset: 0,
            progressCallback: vi.fn(),
            ffmpegTimeoutMs: 50
        });

        await expect(promise).rejects.toThrow('FFmpeg render process timed out after 50ms');
        expect(mockFfmpegInstance.kill).toHaveBeenCalledWith('SIGKILL');
    });
});
