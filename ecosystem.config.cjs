const path = require('path')

const cwd = path.join(__dirname)
const standaloneServer = './.next/standalone/server.js'
const commonEnv = {
  NODE_ENV: 'production',
  HOSTNAME: '127.0.0.1',
  // 抬高 libuv 线程池 (默认 4): 编码占槽时给同池的 fs / dns.lookup 留余量
  UV_THREADPOOL_SIZE: '8'
}

module.exports = {
  apps: [
    {
      name: 'kun-touchgal-next',
      port: 3000,
      cwd,
      instances: 16,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      script: standaloneServer,
      // https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
      env: {
        ...commonEnv,
        PORT: 3000,
        KUN_ENABLE_CRON: 'false'
      }
    },
    {
      name: 'kun-touchgal-next-cron',
      port: 3001,
      cwd,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      script: standaloneServer,
      env: {
        ...commonEnv,
        PORT: 3001,
        KUN_ENABLE_CRON: 'true'
      }
    }
  ]
}
