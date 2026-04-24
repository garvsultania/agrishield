#
# Backend — Express API with Soroban RPC + MPC integrations.
# Multi-stage to keep the final image slim. Runs as non-root.
#

FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

# Copy production node_modules from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Source
COPY backend/ ./backend/
# Data dir is needed because observationService reads historical_ndvi.json
# and sitapur_farms.json via ../../data. Keep the layout the backend expects.
COPY data/ ./data/

# Non-root user
RUN addgroup -S agri && adduser -S agri -G agri \
 && mkdir -p /app/data \
 && chown -R agri:agri /app
USER agri

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Graceful shutdown requires PID-1 to receive SIGTERM — running node directly
# via npm start would trap it, so invoke node directly.
WORKDIR /app/backend
CMD ["node", "server.js"]
