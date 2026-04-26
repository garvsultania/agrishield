'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const satelliteRoutes = require('./routes/satellite');
const contractRoutes = require('./routes/contract');
const contractStateRoutes = require('./routes/contractState');
const healthRoutes = require('./routes/health');
const historyRoutes = require('./routes/history');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi');
const { readLimiter } = require('./middleware/rateLimit');
const logger = require('./services/logger');
const pinoHttp = require('pino-http');

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

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', readLimiter, satelliteRoutes);
app.use('/api', contractRoutes);
app.use('/api', readLimiter, contractStateRoutes);
app.use('/api', readLimiter, healthRoutes);
app.use('/api', readLimiter, historyRoutes);

// API documentation (Swagger UI)
app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'AgriShield API',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

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
app.use((err, req, res, _next) => {
  if (err && err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, data: null, error: err.message });
  }
  (req.log || logger).error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, data: null, error: err.message || 'Internal server error' });
});

// ─── Optional MongoDB ─────────────────────────────────────────────────────────

if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => logger.info('MongoDB connected'))
    .catch((err) => logger.warn({ err: err.message }, 'MongoDB connection failed'));
} else if (NODE_ENV !== 'test') {
  logger.info('MONGODB_URI not set — farm data loaded from JSON files');
}

// ─── Boot summary + graceful shutdown ─────────────────────────────────────────

function bootSummary() {
  logger.info({ port: PORT, env: NODE_ENV }, `AgriShield backend listening on http://localhost:${PORT}`);

  if (allowList.length === 0) {
    logger.warn('CORS: no origins allowed — set CORS_ORIGINS to admit your frontend');
  } else {
    logger.info({ origins: allowList }, 'CORS allowlist');
  }

  if (!process.env.ADMIN_API_TOKEN) {
    logger.warn('AUTH: ADMIN_API_TOKEN is not set — /simulate is unauthenticated. OK in dev, DO NOT ship to prod.');
  } else {
    logger.info('AUTH: ADMIN_API_TOKEN configured — /simulate requires Bearer auth');
  }

  if (!process.env.STELLAR_ADMIN_SECRET_KEY) {
    logger.info('STELLAR: no admin key set — will friendbot-fund a fresh testnet keypair on first payout');
  }
}

let server;
let schedulerHandle = { stop() {} };
if (require.main === module || NODE_ENV !== 'test') {
  server = app.listen(PORT, bootSummary);
  schedulerHandle = require('./services/scheduler').start();
  wireShutdown(server);
}

function wireShutdown(srv) {
  let shuttingDown = false;

  const graceful = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Draining connections for graceful shutdown');

    const shutdownTimeout = setTimeout(() => {
      logger.error('Forced exit after 10s drain timeout');
      process.exit(1);
    }, 10_000);
    shutdownTimeout.unref();

    try { schedulerHandle.stop(); } catch (e) { logger.warn({ err: e?.message }, 'scheduler stop warning'); }

    srv.close((err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
        process.exit(1);
      }
      const mongoose = (() => {
        try { return require('mongoose'); } catch { return null; }
      })();
      Promise.resolve(mongoose && mongoose.connection && mongoose.connection.readyState
        ? mongoose.connection.close()
        : undefined)
        .catch((e) => logger.warn({ err: e?.message }, 'mongoose close warning'))
        .finally(() => {
          logger.info('Clean shutdown complete');
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => graceful('SIGTERM'));
  process.on('SIGINT', () => graceful('SIGINT'));
}

module.exports = app;
