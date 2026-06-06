const apps = [];
const redisHost = process.env.REDIS_HOST;
const redisUrl = process.env.REDIS_URL;
const hasExternalRedis = redisUrl || (redisHost && redisHost !== 'localhost' && redisHost !== '127.0.0.1');

if (!hasExternalRedis) {
    apps.push({
        name: 'redis-server',
        script: 'redis-server',
        interpreter: 'none',
        args: '--port 6379',
        watch: false
    });
}

apps.push(
    {
        name: 'qvm-server',
        script: './index.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: { NODE_ENV: 'production' }
    },
    {
        name: 'qvm-worker',
        script: './worker.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: { NODE_ENV: 'production' }
    }
);

module.exports = {
    apps
};