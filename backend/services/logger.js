'use strict';

const pino = require('pino');

/**
 * Central pino logger. JSON output in production (machine-readable for any
 * hosted log sink); pretty output in development when pino-pretty is on the
 * path. Level comes from LOG_LEVEL env var (default: info).
 */

const LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const prettyTransport = (() => {
  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
    };
  } catch {
    return null;
  }
})();

const options = {
  level: LEVEL,
  base: { service: 'agrishield-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'headers.authorization',
      '*.STELLAR_ADMIN_SECRET_KEY',
      '*.ADMIN_API_TOKEN',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
};

const logger =
  process.env.NODE_ENV !== 'production' && prettyTransport
    ? pino({ ...options, transport: prettyTransport })
    : pino(options);

/**
 * Per-module child logger factory. Use like:
 *   const log = require('./services/logger').scoped('mpc');
 *   log.info({ farmId }, 'STAC search fired');
 *
 * Named `scoped` (not `child`) so we don't shadow pino's own `.child()`
 * method on the logger instance. pino-http calls `.child(...)` internally —
 * shadowing it causes infinite recursion on first request.
 */
function scoped(scope, bindings = {}) {
  return logger.child({ scope, ...bindings });
}

module.exports = logger;
module.exports.scoped = scoped;
// Back-compat: some callers use `.child('name')`. Route through `scoped` when
// the first arg is a string (the scope-name shorthand); otherwise delegate
// to pino's native child method so pino-http still works.
const nativeChild = logger.child.bind(logger);
module.exports.child = function compatChild(arg, ...rest) {
  if (typeof arg === 'string') return scoped(arg, rest[0] || {});
  return nativeChild(arg, ...rest);
};
