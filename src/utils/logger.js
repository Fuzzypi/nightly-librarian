const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const level = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function ts() {
  return new Date().toISOString();
}

const logger = {
  info(source, msg, data) {
    if (level >= LOG_LEVELS.info)
      console.log(`[${ts()}] INFO  [${source}] ${msg}`, data ?? '');
  },
  warn(source, msg, data) {
    if (level >= LOG_LEVELS.warn)
      console.warn(`[${ts()}] WARN  [${source}] ${msg}`, data ?? '');
  },
  error(source, msg, data) {
    if (level >= LOG_LEVELS.error)
      console.error(`[${ts()}] ERROR [${source}] ${msg}`, data ?? '');
  },
  debug(source, msg, data) {
    if (level >= LOG_LEVELS.debug)
      console.log(`[${ts()}] DEBUG [${source}] ${msg}`, data ?? '');
  },
};

module.exports = logger;
