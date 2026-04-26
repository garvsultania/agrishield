'use strict';

/**
 * Scheduled jobs:
 *
 *   pre-warm        — nightly at 02:00 UTC, touches every farm's /status
 *                     path server-side so the upstream MPC + Open-Meteo
 *                     caches are fresh before users arrive. Eliminates the
 *                     first-user 15s cold wait.
 *
 *   event-archive   — every 15 min, pulls the latest contract events via
 *                     Soroban RPC and appends unseen ones to a JSONL
 *                     archive on disk. Soroban RPC only retains events for
 *                     ~24h; this gives us an indefinite on-disk history.
 *
 * Both disabled when DISABLE_SCHEDULER=1 (tests, CI, ad-hoc runs).
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cron = require('node-cron');
const log = require('./logger').scoped('scheduler');
const { getFarmObservations } = require('./observationService');
const { getRecentEvents } = require('./sorobanReadService');
const farmsDataPath = path.join(__dirname, '../../data/sitapur_farms.json');
const EVENTS_ARCHIVE_PATH = path.join(__dirname, '../../data/contract-events.log.jsonl');

function loadFarms() {
  return JSON.parse(fs.readFileSync(farmsDataPath, 'utf8'));
}

async function prewarmFarms() {
  const farms = loadFarms();
  const started = Date.now();
  let ok = 0;
  let fail = 0;
  for (const farm of farms) {
    try {
      await getFarmObservations(farm.farmId, farm.coordinates);
      ok += 1;
    } catch (err) {
      fail += 1;
      log.warn({ farmId: farm.farmId, err: err?.message }, 'pre-warm miss');
    }
  }
  log.info({ ok, fail, durationMs: Date.now() - started }, 'pre-warm complete');
}

async function archiveEvents() {
  let events;
  try {
    events = await getRecentEvents({ limit: 500 });
  } catch (err) {
    log.warn({ err: err?.message }, 'event archive fetch failed');
    return;
  }
  if (!events || events.length === 0) return;

  // Load seen event ids from the last few lines of the archive
  const seen = new Set();
  try {
    const raw = await fsp.readFile(EVENTS_ARCHIVE_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e && e.id) seen.add(e.id);
      } catch {
        /* tolerate mid-line corruption */
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') log.warn({ err: err.message }, 'archive read failed');
  }

  const fresh = events.filter((e) => e.id && !seen.has(e.id));
  if (fresh.length === 0) {
    log.debug({ total: events.length }, 'event archive: no new events');
    return;
  }

  const lines = fresh
    .map((e) => JSON.stringify({ ...e, archivedAt: new Date().toISOString() }))
    .join('\n') + '\n';
  await fsp.appendFile(EVENTS_ARCHIVE_PATH, lines);
  log.info({ appended: fresh.length, total: events.length }, 'event archive appended');
}

function start() {
  if (process.env.DISABLE_SCHEDULER === '1' || process.env.NODE_ENV === 'test') {
    log.debug('scheduler disabled');
    return { stop() {} };
  }

  const jobs = [
    cron.schedule('0 2 * * *', () => {
      prewarmFarms().catch((err) => log.error({ err: err?.message }, 'pre-warm crashed'));
    }, { timezone: 'UTC' }),
    cron.schedule('*/15 * * * *', () => {
      archiveEvents().catch((err) => log.error({ err: err?.message }, 'event-archive crashed'));
    }),
  ];

  // Fire the event archiver once on boot so we always have a recent snapshot
  // without waiting 15 minutes.
  setTimeout(() => {
    archiveEvents().catch((err) => log.error({ err: err?.message }, 'initial event-archive crashed'));
  }, 15_000).unref();

  log.info('scheduler started (pre-warm 02:00 UTC, event-archive every 15 min)');
  return { stop: () => jobs.forEach((j) => j.stop()) };
}

module.exports = { start, _internal: { prewarmFarms, archiveEvents, EVENTS_ARCHIVE_PATH } };
