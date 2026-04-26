'use strict';

const axios = require('axios');
const { TtlCache } = require('./cache');
const { withBreaker, attachAxiosRetry } = require('./resilient');
const log = require('./logger').child('open-meteo');

const cache = new TtlCache({ defaultTtlMs: 10 * 60 * 1000 }); // 10 min
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const client = attachAxiosRetry(axios.create({ timeout: 8000 }), { retries: 3 });

async function fetchRainfallRaw({ lat, lng }) {
  const { data } = await client.get(FORECAST_URL, {
    params: {
      latitude: lat,
      longitude: lng,
      past_days: 14,
      forecast_days: 0,
      daily: 'precipitation_sum',
      timezone: 'auto',
    },
  });

  const dates = data?.daily?.time || [];
  const precip = data?.daily?.precipitation_sum || [];
  const out = [];
  for (let i = 0; i < dates.length && i < precip.length; i++) {
    const v = Number(precip[i]);
    out.push({
      date: dates[i],
      rainfall_mm: Number.isFinite(v) ? Number(v.toFixed(2)) : 0,
    });
  }
  return out.slice(-14);
}

const breaker = withBreaker('open-meteo', fetchRainfallRaw, { timeout: 12_000 });

/**
 * Real 14-day rainfall (Open-Meteo, keyless). Caller gets the cached result
 * for 10 minutes; retries + a circuit breaker shield against transient
 * failures upstream.
 */
async function fetchRainfall14d({ lat, lng }) {
  const key = `rain:${lat.toFixed(3)},${lng.toFixed(3)}`;
  return cache.wrap(key, 10 * 60 * 1000, async () => {
    try {
      return await breaker.fire({ lat, lng });
    } catch (err) {
      log.warn({ err: err?.message, lat, lng }, 'rainfall fetch failed');
      throw err;
    }
  });
}

module.exports = { fetchRainfall14d };
