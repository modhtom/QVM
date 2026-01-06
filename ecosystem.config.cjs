module.exports = {
    apps: [{
        name: 'qvm-server',
        script: './index.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: {NODE_ENV: 'production'}
    },
    {
        name: 'qvm-worker',
        script: './worker.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: {NODE_ENV: 'production'}
    }],
};