module.exports = {
  apps: [
    {
      name: 'wagtw-api',
      cwd: '/home/ubuntu/wagtw',
      script: 'apps/api/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4010,
        API_PORT: 4010,
        WORKER_PORT: 4011,
        WORKER_URL: 'http://localhost:4011',
        DATABASE_URL: 'postgresql://wagtw:wagtw_secret@localhost:5432/wagtw?schema=public',
        JWT_SECRET: 'wagtw-secret-key-1234567890',
        CORS_ORIGIN: 'http://localhost:5174,http://localhost:5173,http://127.0.0.1:5174,http://127.0.0.1:5173'
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'wagtw-worker',
      cwd: '/home/ubuntu/wagtw',
      script: 'apps/worker/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4011,
        WORKER_PORT: 4011,
        DATABASE_URL: 'postgresql://wagtw:wagtw_secret@localhost:5432/wagtw?schema=public',
        GEMINI_MODEL: 'gemini-1.5-flash'
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'wagtw-admin',
      cwd: '/home/ubuntu/wagtw/apps/admin',
      script: 'npx',
      args: 'vite preview --port 5174 --host 0.0.0.0',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
