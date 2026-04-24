'use strict';

const axios = require('axios');
const { TtlCache } = require('./cache');

const cache = new TtlCache({ defaultTtlMs: 10 * 60 * 1000 }); // 10 min
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches real daily precipitation for a point, covering the last 14 days.
 * Uses Open-Meteo's forecast endpoint with past_days — keyless and covers
 * recent days better than the archive endpoint (which has a ~5 day lag).
 *
 * Returns an array of { date: 'YYYY-MM-DD', rainfall_mm: number } ordered
 * ascending. Falls back to an empty array on network failure — the caller
 * is responsible for error handling.
 */
async function fetchRainfall14d({ lat, lng }) {
  const key = `rain:${lat.toFixed(3)},${lng.toFixed(3)}`;
  return cache.wrap(key, 10 * 60 * 1000, async () => {
    const { data } = await axios.get(FORECAST_URL, {
      timeout: 8000,
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
    // Trim to the most recent 14 points (Open-Meteo may include today)
    return out.slice(-14);
  });
}

module.exports = { fetchRainfall14d };
