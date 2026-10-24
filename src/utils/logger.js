/**
 * Structured logger utility with timestamps and tags.
 */

const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

const formatMessage = (level, tag, message, ...optionalParams) => {
  const ts = `\x1b[90m[${getTimestamp()}]\x1b[0m`;
  let badge = `[${level.toUpperCase()}]`;

  switch (level.toLowerCase()) {
    case 'info':
      badge = `\x1b[32m[INFO]\x1b[0m`;
      break;
    case 'warn':
      badge = `\x1b[33m[WARN]\x1b[0m`;
      break;
    case 'error':
      badge = `\x1b[31m[ERROR]\x1b[0m`;
      break;
    case 'voice':
      badge = `\x1b[35m[VOICE]\x1b[0m`;
      break;
    case 'debug':
      badge = `\x1b[36m[DEBUG]\x1b[0m`;
      break;
  }

  const prefix = `${ts} ${badge} [${tag}]`;
  if (optionalParams.length > 0) {
    console.log(prefix, message, ...optionalParams);
  } else {
    console.log(prefix, message);
  }
};

const logger = {
  info: (tag, message, ...params) => formatMessage('info', tag, message, ...params),
  warn: (tag, message, ...params) => formatMessage('warn', tag, message, ...params),
  error: (tag, message, ...params) => formatMessage('error', tag, message, ...params),
  voice: (tag, message, ...params) => formatMessage('voice', tag, message, ...params),
  debug: (tag, message, ...params) => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
      formatMessage('debug', tag, message, ...params);
    }
  }
};

module.exports = logger;
