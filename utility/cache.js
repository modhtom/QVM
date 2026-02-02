import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    maxRetriesPerRequest: 3,
    lazyConnect: true
});

redis.on('error', (err) => {
    console.warn('Redis Cache Error (Processing continues without cache):', err.message);
});

export const cache = {
    async get(key) {
        try {
            if (redis.status !== 'ready' && redis.status !== 'connect') await redis.connect();
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },
    async set(key, value, ttlSeconds = 86400) { // Default 24 hours
        try {
            if (redis.status !== 'ready' && redis.status !== 'connect') await redis.connect();
            await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (e) {}
    },
    async del(key) {
        try {
            await redis.del(key);
        } catch(e) {}
    }
};