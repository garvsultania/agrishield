'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Guards the simulate endpoint — each IP can fire a real Stellar testnet tx
 * at most once every 6s and no more than 10 times per minute. Prevents a
 * hostile or buggy client from draining the admin wallet or spamming the
 * contract.
 */
const simulateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many simulate requests — try again in a minute.',
  },
});

/**
 * Loose limiter for read endpoints. Protects upstream quotas (Open-Meteo,
 * Soroban RPC) without blocking legitimate dashboard polling.
 */
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240, // ~4 req/s/IP sustained
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many requests — slow down.',
  },
});

module.exports = { simulateLimiter, readLimiter };
