import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

describe('PM2 Ecosystem Config', () => {
    const configPath = '../../../ecosystem.config.cjs';
    let originalRedisHost;
    let originalRedisUrl;

    beforeEach(() => {
        originalRedisHost = process.env.REDIS_HOST;
        originalRedisUrl = process.env.REDIS_URL;
        try {
            const resolvedPath = require.resolve(configPath);
            delete require.cache[resolvedPath];
        } catch (e) {}
    });

    afterEach(() => {
        if (originalRedisHost !== undefined) {
            process.env.REDIS_HOST = originalRedisHost;
        } else {
            delete process.env.REDIS_HOST;
        }
        
        if (originalRedisUrl !== undefined) {
            process.env.REDIS_URL = originalRedisUrl;
        } else {
            delete process.env.REDIS_URL;
        }
    });

    it('should include redis-server if no external Redis env is set', () => {
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_URL;
        
        const config = require(configPath);
        const hasRedis = config.apps.some(app => app.name === 'redis-server');
        expect(hasRedis).toBe(true);
    });

    it('should skip redis-server if REDIS_HOST is set to an external container', () => {
        process.env.REDIS_HOST = 'redis';
        delete process.env.REDIS_URL;
        
        const config = require(configPath);
        const hasRedis = config.apps.some(app => app.name === 'redis-server');
        expect(hasRedis).toBe(false);
    });

    it('should include redis-server if REDIS_HOST is localhost', () => {
        process.env.REDIS_HOST = 'localhost';
        delete process.env.REDIS_URL;
        
        const config = require(configPath);
        const hasRedis = config.apps.some(app => app.name === 'redis-server');
        expect(hasRedis).toBe(true);
    });

    it('should skip redis-server if REDIS_URL is configured', () => {
        delete process.env.REDIS_HOST;
        process.env.REDIS_URL = 'redis://external:6379';
        
        const config = require(configPath);
        const hasRedis = config.apps.some(app => app.name === 'redis-server');
        expect(hasRedis).toBe(false);
    });
});
