import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
    status: 'ready',
  }
}));

vi.mock('ioredis', () => ({
  default: function() { return mockRedis; }
}));

import { cache } from '../../../utility/cache.js';

describe('cache.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should set and get from cache', async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify({ a: 1 }));
        await cache.set('k', { a: 1 });
        const val = await cache.get('k');
        expect(val).toEqual({ a: 1 });
    });

    it('should handle get errors gracefully', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis Down'));
        const val = await cache.get('k');
        expect(val).toBeNull();
    });

    it('should handle set errors gracefully', async () => {
        mockRedis.set.mockRejectedValue(new Error('Redis Down'));
        await cache.set('k', 'v');
        // Should not throw
    });

    it('should delete from cache', async () => {
        await cache.del('k');
        expect(mockRedis.del).toHaveBeenCalledWith('k');
    });
});