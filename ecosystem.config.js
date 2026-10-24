module.exports = {
  apps: [
    {
      name: 'discord-24-7-voice-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
