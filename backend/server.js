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
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: true, // allow any localhost port during dev
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', readLimiter, satelliteRoutes);
app.use('/api', contractRoutes);
app.use('/api', readLimiter, contractStateRoutes);
app.use('/api', readLimiter, healthRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'agri-shield-backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    },
    error: null
  });
});

// Farms list endpoint
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error'
  });
});

// ─── MongoDB (optional) ───────────────────────────────────────────────────────

if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('[server] MongoDB connected'))
    .catch((err) => console.warn('[server] MongoDB connection failed:', err.message));
} else {
  console.warn('[server] WARNING: MONGODB_URI not set — running without database. Farm data loaded from JSON files.');
}

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] AgriShield backend running on http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
  console.log(`[server] API base: http://localhost:${PORT}/api`);

  if (!process.env.STELLAR_ADMIN_SECRET_KEY) {
    console.log('[server] NOTE: STELLAR_ADMIN_SECRET_KEY not set — will auto-generate testnet keypair on first payout');
  }
});

module.exports = app;
