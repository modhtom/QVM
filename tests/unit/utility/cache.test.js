import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => {
  return {
    mockRedis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      connect: vi.fn(),
      on: vi.fn(),
      status: 'ready',
    }
  };
});

vi.mock('ioredis', () => {
  return {
    default: function() {
        this.status = 'ready';
        this.get = mockRedis.get;
        this.set = mockRedis.set;
        this.del = mockRedis.del;
        this.connect = mockRedis.connect;
        this.on = mockRedis.on;
    }
  };
});

import { cache } from '../../../utility/cache.js';

describe('cache.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get data from redis and parse it', async () => {
    const testData = { foo: 'bar' };
    mockRedis.get.mockResolvedValue(JSON.stringify(testData));

    const result = await cache.get('test-key');
    expect(result).toEqual(testData);
    expect(mockRedis.get).toHaveBeenCalledWith('test-key');
  });

  it('should return null if data is not found', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await cache.get('missing-key');
    expect(result).toBeNull();
  });

  it('should set data in redis as JSON string', async () => {
    const testData = { baz: 'qux' };
    await cache.set('test-key', testData, 3600);
    expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData), 'EX', 3600);
  });

  it('should delete data from redis', async () => {
    await cache.del('test-key');
    expect(mockRedis.del).toHaveBeenCalledWith('test-key');
  });
});