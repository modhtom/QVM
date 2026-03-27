import { vi } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    status: 'ready',
  }
}));

vi.mock('ioredis', () => {
  console.log('[Setup] Mocking ioredis');
  return {
    default: function() {
      console.log('[Setup] IORedis constructor called');
      return mockRedis;
    }
  };
});

vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});