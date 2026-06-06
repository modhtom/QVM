import { describe, it, expect, vi } from 'vitest';

const mockRateLimit = vi.fn(() => (req, res, next) => next());
vi.mock('express-rate-limit', () => ({
    default: mockRateLimit
}));

describe('Rate Limiters Initialization', () => {
    it('should initialize auth rate limiter with correct parameters', async () => {
        await import('../../../index.js');
        
        const authLimiterCall = mockRateLimit.mock.calls.find(call => {
            const options = call[0];
            return options && options.windowMs === 15 * 60 * 1000 && options.message && options.message.error && options.message.error.includes('Too many authentication attempts');
        });
        
        expect(authLimiterCall).toBeDefined();
        const options = authLimiterCall[0];
        expect(options.max).toBe(1000);
        expect(options.standardHeaders).toBe(true);
        expect(options.legacyHeaders).toBe(false);
    });
});
