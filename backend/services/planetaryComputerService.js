'use strict';

/**
 * Real NDVI from Microsoft Planetary Computer (Sentinel-2 L2A, free & keyless).
 *
 * Pipeline per farm:
 *   1. STAC search for L2A scenes intersecting the farm bbox, low cloud cover
 *   2. For each usable scene: sign the B04/B08 asset URLs with MPC's SAS token
 *   3. Convert the lat/lng bbox into the scene's UTM pixel window
 *   4. Range-read the tiny window from the COG with geotiff.js
 *   5. Compute mean NDVI: (B08 - B04) / (B08 + B04); fill-value aware
 *   6. Cache the result — Sentinel-2 revisits every ~5 days, so 24h TTL is safe
 *
 * If the pipeline fails at any step, callers get `null` and fall back to mock.
 */

const axios = require('axios');
const proj4 = require('proj4');
const GeoTIFF = require('geotiff');
const { TtlCache } = require('./cache');

const STAC_SEARCH_URL = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const SIGN_URL = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

const ndviCache = new TtlCache({ defaultTtlMs: 24 * 60 * 60 * 1000, maxEntries: 200 });
const signCache = new TtlCache({ defaultTtlMs: 30 * 60 * 1000, maxEntries: 200 });
const SEARCH_TIMEOUT_MS = 20_000;
const COG_TIMEOUT_MS = 30_000;

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

function registerUtmProjection(epsgCode) {
  const code = Number(epsgCode);
  if (!Number.isFinite(code)) throw new Error(`Invalid EPSG code: ${epsgCode}`);
  const isUtmNorth = code >= 32601 && code <= 32660;
  const isUtmSouth = code >= 32701 && code <= 32760;
  if (!isUtmNorth && !isUtmSouth) {
    throw new Error(`Unsupported projection EPSG:${epsgCode} — only UTM zones supported`);
  }
  const key = `EPSG:${code}`;
  if (proj4.defs(key)) return key;
  const zone = isUtmNorth ? code - 32600 : code - 32700;
  const def = `+proj=utm +zone=${zone}${isUtmSouth ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`;
  proj4.defs(key, def);
  return key;
}

function padBbox({ lat, lng }, padDegrees = 0.003) {
  // ~330m padding at the equator; ~290m at Sitapur latitude
  return [lng - padDegrees, lat - padDegrees, lng + padDegrees, lat + padDegrees];
}

/**
 * Map a WGS84 bbox into [xmin, ymin, xmax, ymax] pixel coordinates for a
 * Sentinel-2 L2A image. `transform` is the STAC `proj:transform` array — a
 * six-element affine form: [a, b, c, d, e, f] such that
 *   x_world = a*col + b*row + c
 *   y_world = d*col + e*row + f
 * Sentinel-2 L2A uses an axis-aligned transform (b=d=0; a>0, e<0).
 */
function bboxToPixelWindow(bbox4326, epsg, transform) {
  const [minLng, minLat, maxLng, maxLat] = bbox4326;
  const utmKey = registerUtmProjection(epsg);

  const corners = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
  ];
  const utmPoints = corners.map(([lng, lat]) => proj4('EPSG:4326', utmKey, [lng, lat]));
  const easts = utmPoints.map((p) => p[0]);
  const norths = utmPoints.map((p) => p[1]);
  const minE = Math.min(...easts);
  const maxE = Math.max(...easts);
  const minN = Math.min(...norths);
  const maxN = Math.max(...norths);

  const [a, , c, , e, f] = transform;
  // col = (east - c) / a ;  row = (north - f) / e   (e is negative)
  const col1 = (minE - c) / a;
  const col2 = (maxE - c) / a;
  const row1 = (minN - f) / e;
  const row2 = (maxN - f) / e;

  const xmin = Math.max(0, Math.floor(Math.min(col1, col2)));
  const xmax = Math.max(xmin + 1, Math.ceil(Math.max(col1, col2)));
  const ymin = Math.max(0, Math.floor(Math.min(row1, row2)));
  const ymax = Math.max(ymin + 1, Math.ceil(Math.max(row1, row2)));

  return [xmin, ymin, xmax, ymax];
}

async function searchScenes({ bbox4326, since, until, maxCloud = 30, limit = 10 }) {
  const body = {
    collections: ['sentinel-2-l2a'],
    bbox: bbox4326,
    datetime: `${since}T00:00:00Z/${until}T23:59:59Z`,
    query: { 'eo:cloud_cover': { lt: maxCloud } },
    limit,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
  };
  const { data } = await axios.post(STAC_SEARCH_URL, body, { timeout: SEARCH_TIMEOUT_MS });
  return (data && Array.isArray(data.features)) ? data.features : [];
}

async function signHref(href) {
  const cached = signCache.get(href);
  if (cached) return cached;
  try {
    const { data } = await axios.get(SIGN_URL, {
      params: { href },
      timeout: 10_000,
    });
    const signed = (data && data.href) || href;
    signCache.set(href, signed);
    return signed;
  } catch {
    // Sentinel-2 blobs are public-read; fall back to unsigned URL
    return href;
  }
}

async function readBandMean(assetHref, windowPixels) {
  const signed = await signHref(assetHref);
  const tiff = await GeoTIFF.fromUrl(signed, {
    allowFullFile: false,
    forceXHR: false,
    headers: {},
    cache: false,
    fetchOptions: { signal: AbortSignal.timeout(COG_TIMEOUT_MS) },
  });
  const image = await tiff.getImage(0);
  const width = image.getWidth();
  const height = image.getHeight();
  const clamped = [
    Math.max(0, Math.min(width - 1, windowPixels[0])),
    Math.max(0, Math.min(height - 1, windowPixels[1])),
    Math.max(1, Math.min(width, windowPixels[2])),
    Math.max(1, Math.min(height, windowPixels[3])),
  ];
  if (clamped[2] <= clamped[0] || clamped[3] <= clamped[1]) return null;

  const rasters = await image.readRasters({ window: clamped, interleave: false });
  const band = Array.isArray(rasters) ? rasters[0] : rasters;
  if (!band || !band.length) return null;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (typeof v === 'number' && v > 0) {
      sum += v;
      count++;
    }
  }
  if (count === 0) return null;
  return sum / count;
}

/**
 * Returns an array of { date, ndvi, cloud, sceneId, source: 'sentinel-2' }
 * for each cloud-filtered Sentinel-2 L2A scene intersecting the farm in the
 * requested window. At most `maxScenes` returned; newest first.
 *
 * Safe to call repeatedly for a given farmId — result is cached per farm.
 */
async function fetchNdviSeries({ farmId, coordinates, sinceIso, untilIso, maxCloud = 30, maxScenes = 6 }) {
  const cacheKey = `ndvi:${farmId}:${sinceIso}:${untilIso}`;
  return ndviCache.wrap(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const bbox4326 = padBbox(coordinates);

    let scenes;
    try {
      scenes = await searchScenes({
        bbox4326,
        since: sinceIso,
        until: untilIso,
        maxCloud,
        limit: maxScenes,
      });
    } catch (err) {
      console.warn(`[mpc] STAC search failed for ${farmId}: ${err.message}`);
      return [];
    }

    if (!scenes.length) return [];

    const series = [];
    for (const scene of scenes) {
      try {
        const point = await computeSceneNdvi(scene, bbox4326);
        if (point) series.push(point);
      } catch (err) {
        console.warn(`[mpc] NDVI compute failed for scene ${scene?.id}: ${err.message}`);
      }
    }
    // Newest first, sorted by date
    series.sort((a, b) => (a.date < b.date ? 1 : -1));
    return series;
  });
}

async function computeSceneNdvi(scene, bbox4326) {
  const props = scene.properties || {};
  const epsg = props['proj:epsg'];
  const transform = props['proj:transform'] || scene.assets?.B04?.['proj:transform'];
  if (!epsg || !transform) return null;

  const window = bboxToPixelWindow(bbox4326, epsg, transform);

  const redHref = scene.assets?.B04?.href;
  const nirHref = scene.assets?.B08?.href;
  if (!redHref || !nirHref) return null;

  const [redMean, nirMean] = await Promise.all([
    readBandMean(redHref, window),
    readBandMean(nirHref, window),
  ]);
  if (redMean === null || nirMean === null) return null;

  // Sentinel-2 L2A surface reflectance is scaled ×10000. NDVI is ratio, so
  // scaling cancels out — safe to compute directly.
  const denom = redMean + nirMean;
  if (denom === 0) return null;
  const ndvi = (nirMean - redMean) / denom;

  const date = (props.datetime || '').slice(0, 10);
  return {
    date,
    ndvi: Number(ndvi.toFixed(4)),
    cloud: Number((props['eo:cloud_cover'] ?? 0).toFixed(1)),
    sceneId: scene.id || null,
    source: 'sentinel-2',
  };
}

module.exports = {
  fetchNdviSeries,
  // exported for tests:
  _internal: { bboxToPixelWindow, padBbox, registerUtmProjection },
};
