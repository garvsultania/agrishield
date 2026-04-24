'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const satelliteRoutes = require('./routes/satellite');
const contractRoutes = require('./routes/contract');
const contractStateRoutes = require('./routes/contractState');
const healthRoutes = require('./routes/health');
const { readLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In dev (default), allow localhost on common ports so the Next dashboard on
// 3002 + any quick experiments on 3000 work. In prod, require an explicit
// comma-separated allowlist via CORS_ORIGINS.

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
];

function parseOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const configuredOrigins = parseOriginList(process.env.CORS_ORIGINS);
const allowList =
  configuredOrigins.length > 0
    ? configuredOrigins
    : NODE_ENV === 'production'
    ? [] // prod with no config = locked down
    : DEV_DEFAULT_ORIGINS;

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / curl / health checks with no Origin header
    if (!origin) return callback(null, true);
    if (allowList.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors(corsOptions));
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', readLimiter, satelliteRoutes);
app.use('/api', contractRoutes);
app.use('/api', readLimiter, contractStateRoutes);
app.use('/api', readLimiter, healthRoutes);

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'agri-shield-backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    error: null,
  });
});

app.get('/api/farms', (_req, res) => {
  const path = require('path');
  const fs = require('fs');
  const farmsPath = path.join(__dirname, '../data/sitapur_farms.json');
  try {
    const farms = JSON.parse(fs.readFileSync(farmsPath, 'utf8'));
    res.json({ success: true, data: farms, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, error: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err && err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, data: null, error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, data: null, error: err.message || 'Internal server error' });
});

// ─── Optional MongoDB ─────────────────────────────────────────────────────────

if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('[server] MongoDB connected'))
    .catch((err) => console.warn('[server] MongoDB connection failed:', err.message));
} else if (NODE_ENV !== 'test') {
  console.warn('[server] MONGODB_URI not set — running without a DB (farm data loaded from JSON files).');
}

// ─── Boot summary + graceful shutdown ─────────────────────────────────────────

function bootSummary() {
  console.log(`[server] AgriShield backend running on http://localhost:${PORT}  (env=${NODE_ENV})`);
  console.log(`[server] Health: http://localhost:${PORT}/health`);
  console.log(`[server] API base: http://localhost:${PORT}/api`);

  if (allowList.length === 0) {
    console.warn('[server] CORS: no origins allowed — set CORS_ORIGINS to admit your frontend.');
  } else {
    console.log(`[server] CORS allowlist: ${allowList.join(', ')}`);
  }

  if (!process.env.ADMIN_API_TOKEN) {
    console.warn('[server] AUTH: ADMIN_API_TOKEN is not set — /simulate is unauthenticated. OK in dev, DO NOT ship to prod.');
  } else {
    console.log('[server] AUTH: ADMIN_API_TOKEN configured — /simulate requires Bearer auth.');
  }

  if (!process.env.STELLAR_ADMIN_SECRET_KEY) {
    console.log('[server] STELLAR: no admin key set — will friendbot-fund a fresh testnet keypair on first payout.');
  }
}

let server;
if (require.main === module || NODE_ENV !== 'test') {
  server = app.listen(PORT, bootSummary);
  wireShutdown(server);
}

function wireShutdown(srv) {
  let shuttingDown = false;

  const graceful = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received — draining connections…`);

    const shutdownTimeout = setTimeout(() => {
      console.error('[server] Forced exit after 10s drain timeout');
      process.exit(1);
    }, 10_000);
    shutdownTimeout.unref();

    srv.close((err) => {
      if (err) {
        console.error('[server] Error closing HTTP server:', err);
        process.exit(1);
      }
      const mongoose = (() => {
        try { return require('mongoose'); } catch { return null; }
      })();
      Promise.resolve(mongoose && mongoose.connection && mongoose.connection.readyState
        ? mongoose.connection.close()
        : undefined)
        .catch((e) => console.warn('[server] mongoose close warning:', e?.message))
        .finally(() => {
          console.log('[server] Clean shutdown complete.');
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => graceful('SIGTERM'));
  process.on('SIGINT', () => graceful('SIGINT'));
}

module.exports = app;
