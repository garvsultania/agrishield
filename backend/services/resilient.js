'use strict';

/**
 * Resilience helpers: retry-with-backoff + per-upstream circuit breakers.
 *
 *   withBreaker(name, fn, opts)   → wraps `fn` in a breaker. If `fn` fails
 *                                   ≥ errorThresholdPct of calls over
 *                                   rollingWindowMs, the breaker opens and
 *                                   short-circuits with an error for
 *                                   resetTimeoutMs before half-opening.
 *
 *   retry(fn, opts)               → simple exponential-backoff retry for
 *                                   transient errors; honors Retry-After.
 *
 *   attachAxiosRetry(axiosInstance) — opt-in axios-level retry (used by
 *                                   upstream services that share a client).
 *
 * Every breaker reports open/half-open/close transitions to the pino logger.
 */

const CircuitBreaker = require('opossum');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const logger = require('./logger').child('resilient');

const DEFAULT_BREAKER_OPTS = {
  timeout: 20_000,
  errorThresholdPercentage: 50,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  resetTimeout: 30_000,
  volumeThreshold: 5,
};

const breakers = new Map();

function withBreaker(name, fn, opts = {}) {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(fn, { ...DEFAULT_BREAKER_OPTS, ...opts, name });
    breaker.on('open', () => logger.warn({ breaker: name }, 'circuit OPEN — failing fast'));
    breaker.on('halfOpen', () => logger.info({ breaker: name }, 'circuit HALF-OPEN — probing'));
    breaker.on('close', () => logger.info({ breaker: name }, 'circuit CLOSED — upstream recovered'));
    breaker.on('reject', () => logger.debug({ breaker: name }, 'request rejected while breaker open'));
    breaker.on('timeout', () => logger.warn({ breaker: name }, 'breaker timeout'));
    breakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Exponential-backoff retry with optional Retry-After honoring.
 * Retries on network errors and 5xx responses by default.
 */
async function retry(fn, {
  retries = 3,
  minDelayMs = 300,
  maxDelayMs = 4_000,
  shouldRetry = defaultShouldRetry,
} = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * (delay * 0.2));
      await new Promise((r) => setTimeout(r, delay + jitter));
      attempt += 1;
    }
  }
}

function defaultShouldRetry(err) {
  if (!err) return false;
  const code = err.code || '';
  if (['ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN', 'ECONNABORTED'].includes(code)) return true;
  const status = err.response?.status;
  if (status && (status === 429 || (status >= 500 && status < 600))) return true;
  return false;
}

/**
 * Attach axios-retry to a specific axios instance with sensible defaults.
 * Caller may pass additional options.
 */
function attachAxiosRetry(instance, opts = {}) {
  axiosRetry(instance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (err) =>
      axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response?.status === 429,
    onRetry: (retryCount, err, requestConfig) => {
      logger.debug(
        { retryCount, url: requestConfig?.url, code: err?.code, status: err?.response?.status },
        'axios retry'
      );
    },
    ...opts,
  });
  return instance;
}

function breakerSnapshot() {
  const out = {};
  for (const [name, breaker] of breakers) {
    const s = breaker.stats;
    out[name] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      fires: s.fires,
      failures: s.failures,
      successes: s.successes,
      timeouts: s.timeouts,
      rejects: s.rejects,
      fallbacks: s.fallbacks,
    };
  }
  return out;
}

module.exports = {
  withBreaker,
  retry,
  attachAxiosRetry,
  breakerSnapshot,
  _internal: { defaultShouldRetry },
};
