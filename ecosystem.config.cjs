module.exports = {
    apps: [{
        name: 'redis-server',
        script: 'redis-server',
        interpreter: 'none',
        args: '--port 6379',
        watch: false
    },
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
    }],
};