#
# Frontend — Next.js 14 app router, built as a standalone server.
# Three stages: deps → builder → runtime. Runs as non-root.
#

FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend/ ./frontend/
# The dashboard reads ../data/* at import time (farms-data.ts, historical-data.ts)
COPY data/ ./data/

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd frontend && NEXT_OUTPUT_STANDALONE=true npx next build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S agri && adduser -S agri -G agri
USER agri

# Next standalone mode produces a self-contained server bundle + minimal deps
COPY --from=builder --chown=agri:agri /app/frontend/.next/standalone ./
COPY --from=builder --chown=agri:agri /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=agri:agri /app/frontend/public ./frontend/public

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3002/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "frontend/server.js"]
