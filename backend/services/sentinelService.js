'use strict';

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Load local historical data as fallback
const historicalDataPath = path.join(__dirname, '../../data/historical_ndvi.json');

function loadHistoricalData() {
  const raw = fs.readFileSync(historicalDataPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Fetches satellite observation data for a farm.
 * Tries SENTINEL_HUB_API_KEY env var first; falls back to /data/historical_ndvi.json.
 *
 * @param {string} farmId - The farm identifier
 * @param {{ lat: number, lng: number }} coordinates - Farm center coordinates
 * @returns {Promise<Array<{farmId, coordinates, ndvi, rainfall_mm, observation_date, source}>>}
 *   Array of 14 daily observation objects
 */
async function getFarmObservations(farmId, coordinates) {
  const apiKey = process.env.SENTINEL_HUB_API_KEY;

  if (apiKey) {
    try {
      return await fetchFromSentinelHub(farmId, coordinates, apiKey);
    } catch (err) {
      console.warn(`[sentinelService] Sentinel Hub API failed (${err.message}), falling back to mock data`);
    }
  }

  return fetchFromLocalData(farmId, coordinates);
}

/**
 * Fetch real data from Sentinel Hub Statistical API.
 * NOTE: Requires a valid SENTINEL_HUB_API_KEY and a configured instance.
 */
async function fetchFromSentinelHub(farmId, coordinates, apiKey) {
  // Sentinel Hub Statistical API endpoint
  const url = 'https://services.sentinel-hub.com/api/v1/statistics';

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 14);

  const isoStart = startDate.toISOString().slice(0, 10);
  const isoEnd = endDate.toISOString().slice(0, 10);

  const bbox = [
    coordinates.lng - 0.01,
    coordinates.lat - 0.01,
    coordinates.lng + 0.01,
    coordinates.lat + 0.01
  ];

  const requestBody = {
    input: {
      bounds: {
        bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' }
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: { mosaickingOrder: 'mostRecent' }
        }
      ]
    },
    aggregation: {
      timeRange: { from: `${isoStart}T00:00:00Z`, to: `${isoEnd}T23:59:59Z` },
      aggregationInterval: { of: 'P1D' },
      evalscript: `
        //VERSION=3
        function setup() {
          return {
            input: [{ bands: ["B04", "B08", "dataMask"] }],
            output: [
              { id: "ndvi", bands: 1, sampleType: "FLOAT32" }
            ]
          };
        }
        function evaluatePixel(samples) {
          let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04 + 1e-10);
          return { ndvi: [ndvi * samples.dataMask] };
        }
      `
    }
  };

  const response = await axios.post(url, requestBody, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  });

  const intervals = response.data.data || [];

  return intervals.map((interval) => {
    const ndvi = interval.outputs?.ndvi?.bands?.B0?.stats?.mean ?? 0.5;
    return {
      farmId,
      coordinates,
      ndvi: parseFloat(ndvi.toFixed(4)),
      rainfall_mm: null, // Sentinel-2 does not provide rainfall; would need separate source
      observation_date: interval.interval?.from?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      source: 'sentinel-2'
    };
  });
}

/**
 * Fetch mock data from local historical_ndvi.json file.
 * source is always "mock" when using this path.
 */
function fetchFromLocalData(farmId, coordinates) {
  const historicalData = loadHistoricalData();
  const farmRecord = historicalData.find((f) => f.farmId === farmId);

  if (!farmRecord) {
    throw new Error(`No historical data found for farmId: ${farmId}`);
  }

  return farmRecord.observations.map((obs) => ({
    farmId,
    coordinates,
    ndvi: obs.ndvi,
    rainfall_mm: obs.rainfall_mm,
    observation_date: obs.date,
    source: 'mock'
  }));
}

module.exports = { getFarmObservations };
