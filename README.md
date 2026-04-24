# AgriShield — Parametric Crop Insurance on Stellar

Satellite-driven drought oracle for smallholder farmers in Sitapur, UP, India.
Real Sentinel-2 NDVI + real rainfall → threshold evaluation → signed Soroban
smart-contract payout on Stellar testnet. No claim filing, no adjuster,
settlement in seconds.

![Stellar testnet](https://img.shields.io/badge/Stellar-testnet-A78BFA)
![Contract](https://img.shields.io/badge/Soroban-CBQ3QTCA…FPLD7XLX-84CC16)
![Tests](https://img.shields.io/badge/tests-94%20passing-22C55E)

## Live deployment

- **Contract (Stellar testnet):** [`CBQ3QTCA2552XXBVJCKVRWTRMNHMYAAJC6PR4N5IXIYNVJCQFPLD7XLX`](https://stellar.expert/explorer/testnet/contract/CBQ3QTCA2552XXBVJCKVRWTRMNHMYAAJC6PR4N5IXIYNVJCQFPLD7XLX)
- **Deploy tx:** [`cee44f72…`](https://stellar.expert/explorer/testnet/tx/cee44f726a32c276b988e05e90c5be0a6738cbfa56ecf8d235fde57bed70beaf)
- **WASM hash:** `6763044e9bb0c8445c844258e00f405526e33785b618e7e81e4a595f364efe7f`
- **Pools initialized:** 5 × 100 XLM (one per farm, admin-bound, on-chain
  double-spend protected)
- **Recent real payouts:**
  [`786d3fef…` (SITAPUR_002)](https://stellar.expert/explorer/testnet/tx/786d3fefe9d88c83a3fffb88b3569bba3e51b5256046ff5ef22e5e1ec87c6627)
  · [`c2199647…` (SITAPUR_001)](https://stellar.expert/explorer/testnet/tx/c219964722831cdb9156d8ec00b838156dc594e60f0cdf90548afd7a86be1f35)

## Architecture

```
  Microsoft Planetary Computer        Open-Meteo              Soroban Contract
  (Sentinel-2 L2A, COG range reads)   (daily precipitation)   (parametric_trigger)
       │                                   │                          │
       │  NDVI 0.11 (real, 7/14 d)         │  rainfall_mm (14/14 d)   │  is_paid / get_pool
       │  cloud-filtered <30%              │  keyless, 10-min cache   │  INIT / PAYOUT / PROOF
       ▼                                   ▼                          ▼
  ┌───────────────────────────────────────────────────────────┐  ┌─────────────────────┐
  │                   Express API :3001                       │  │  Stellar testnet    │
  │  observationService · oracleLogic · stellarService        │──│  Horizon + Soroban  │
  │  payoutLog (JSONL) · sorobanReadService · systemHealth    │  │  RPC                │
  │  rate limit (10/min IP on /simulate)                      │  │                     │
  └───────────────────────────────────────────────────────────┘  └─────────────────────┘
       │                                                                 │
       ▼                                                                 ▼
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │                          Next.js 14 app-router dashboard :3002                     │
  │  /overview  /map  /farms  /pools  /payouts  /analytics  /wallet                    │
  │  per-signal provenance chips · merged payout feed · live system health             │
  └────────────────────────────────────────────────────────────────────────────────────┘
```

## What's real vs mock

| Signal | Source | Coverage |
|---|---|---|
| **NDVI** | Microsoft Planetary Computer Sentinel-2 L2A (COG range reads, 10m res) | Real on ~7/14 days per farm; mock fallback when no cloud-free scene within ±2 days |
| **Rainfall** | Open-Meteo daily precipitation_sum (keyless, 10-min cache) | Real 14/14 days per farm |
| **Oracle thresholds** | Deterministic logic in `oracleLogic.js` | Real |
| **Pool state (`is_paid`)** | Live Soroban RPC read — no localStorage trust | Real |
| **Contract events (INIT / PAYOUT / PROOF)** | Live Soroban RPC `getEvents` | Real — ~24h retention |
| **Admin XLM balance** | Live Horizon account lookup | Real |
| **Payout transactions** | Soroban `trigger_payout`, XLM-payment fallback | Real (testnet) |
| **Payout audit log** | Merged across server JSONL + localStorage + on-chain events | Real |
| Soil moisture | Static JSON, dates rebased rolling | Mock |
| Farmer identities + farm polygons | Static JSON | Mock (real parcels would need OSM / partner data) |

## Drought thresholds

```
NDVI ceiling       = 0.35   (NDVI < 0.35 on ALL 14 days)
Rainfall ceiling   = 10mm   (daily rainfall < 10mm on ALL 14 days)
Observation window = 14 days, rolling
Trigger            = both conditions must hold every day (AND)

Confidence:
  HIGH   — both averages exceed threshold by ≥20%  (avg NDVI < 0.28 AND avg rain < 8mm)
  MEDIUM — thresholds met but not by 20%
  LOW    — thresholds not fully met
```

## Quick start

```bash
git clone https://github.com/garvsultania/agrishield.git
cd agrishield
npm run install:all          # installs backend + frontend deps

# Terminal 1 — backend
npm run dev:backend          # Express API on :3001

# Terminal 2 — frontend
npm run dev:frontend         # Dashboard on :3002

open http://localhost:3002
```

Default `backend/.env` values (baked into `lib/env.ts`) point at the live
testnet contract, so you can see the demo end-to-end without deploying
anything. First `/status` call per farm takes ~15s (cold MPC Sentinel-2 read);
cached 24h afterwards.

### Environment variables

```bash
# backend/.env — everything here is optional for a local demo
STELLAR_ADMIN_SECRET_KEY=S...                  # must match the key the pools were bound to
STELLAR_NETWORK=testnet
SOROBAN_CONTRACT_ID=CBQ3QTCA2552XXBVJCKVRWTRMNHMYAAJC6PR4N5IXIYNVJCQFPLD7XLX
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Auth — if set, /simulate requires Authorization: Bearer <token>.
# Unset in dev → simulate is open (server logs a warning on boot).
ADMIN_API_TOKEN=

# CORS — comma-separated allowlist. localhost:3000/3002 are always permitted
# in dev. Set this to your deployed dashboard origin in prod.
CORS_ORIGINS=

PORT=3001
NODE_ENV=development

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOROBAN_CONTRACT_ID=CBQ3QTCA...    # override to point at your own contract
NEXT_PUBLIC_ADMIN_PUBKEY=GDEF3Z6T...
NEXT_PUBLIC_API_TOKEN=                         # must match backend ADMIN_API_TOKEN
```

### Auth, CORS, and shutdown (what hardens `/simulate`)

- **Bearer auth on `/simulate`** — set `ADMIN_API_TOKEN` in `backend/.env` and
  the same value as `NEXT_PUBLIC_API_TOKEN` in `frontend/.env.local`. The
  dashboard will include `Authorization: Bearer <token>` automatically. Leave
  both unset in dev to keep the endpoint open.
- **CORS allowlist** — requests from origins outside `CORS_ORIGINS` (plus
  localhost:3000/3002 in dev) are rejected with `403`.
- **Rate limit** — `/simulate` is capped at 10 req/min per IP; read endpoints
  at 240 req/min per IP.
- **Graceful shutdown** — the server traps `SIGTERM`/`SIGINT`, drains
  in-flight requests for up to 10 s, then exits. Safe for Docker/k8s rolling
  deploys.

These are deploy-time floors, not per-user auth — treat them as layered
defense against casual abuse.

## Deploy your own contract instance

The default `SOROBAN_CONTRACT_ID` is our live testnet deployment. To stand up
your own:

```bash
npm run deploy:contract
```

The script [`scripts/deploy-contract.sh`](scripts/deploy-contract.sh):

1. Checks `rustup`, `stellar` CLI, `jq`, and the `wasm32v1-none` target
2. Creates or reuses a `stellar keys` identity named `agri-admin`
3. Funds it via Stellar friendbot
4. Builds the contract (`stellar contract build`)
5. Deploys to testnet
6. Initializes all 5 pools with 100 XLM each
7. Writes `STELLAR_ADMIN_SECRET_KEY` + `SOROBAN_CONTRACT_ID` back to
   `backend/.env`

Total time ~2 minutes. Cost: $0 (friendbot-funded testnet).

Manual equivalent:

```bash
cd contracts/parametric_trigger
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/parametric_trigger.wasm \
  --source agri-admin --network testnet
```

## API reference

```
GET  /health                          — Process liveness
GET  /api/health/system               — Aggregated probe: Horizon, Soroban RPC, admin balance, contract config
GET  /api/farms                       — List all 5 farms
GET  /api/farm/:farmId/status         — 14-day evaluation + per-day provenance
POST /api/farm/:farmId/simulate       — Fire a Soroban trigger_payout (rate-limited, real tx)
GET  /api/transaction/:txHash         — Horizon lookup for a tx
GET  /api/contract/is-paid            — Ground-truth paid-state for all farms (RPC read)
GET  /api/contract/is-paid/:farmId    — Same, single-farm
GET  /api/contract/events             — Recent INIT/PAYOUT/PROOF events via RPC getEvents
GET  /api/payouts                     — Server-side audit log (cross-device)
```

All responses follow the envelope format:

```json
{ "success": true, "data": { ... }, "error": null }
```

## Frontend

7 routes: **overview · satellite map · farms · pools · payouts · analytics · wallet**

- Deep-linkable farm drawer (`?farm=SITAPUR_002`) with prev/next
- ESRI satellite map with fly-to-on-select + legend
- Per-signal provenance chips — `NDVI · Sentinel-2 · 7/14 d`, `Rain · Open-Meteo · 14/14 d`
- Merged payout feed across localStorage + server log + on-chain events, deduped by tx hash
- System health badge (Horizon + Soroban RPC latency + admin balance)
- Dark / light theme with pastel glass cards
- Command palette (`⌘K`), help glossary (`?`), mobile nav
- Keyboard shortcuts: `g o/m/f/p/y/a/w`, `t`, `?`, `⌘K`

## Deploy

Both services ship Dockerfiles that build standalone images. Single-host
deploy via the included compose file:

```bash
# Bring both services up on :3001 (backend) and :3002 (frontend)
docker compose up --build

# Populate a .env at the repo root first if you want to override:
#   ADMIN_API_TOKEN, CORS_ORIGINS, STELLAR_ADMIN_SECRET_KEY, NEXT_PUBLIC_API_TOKEN, …
```

- [`backend/Dockerfile`](backend/Dockerfile) — `node:20-alpine`, non-root
  user, healthcheck against `/health`, runs `node server.js` directly so
  SIGTERM reaches PID 1 for graceful shutdown.
- [`frontend/Dockerfile`](frontend/Dockerfile) — three-stage build using
  Next.js standalone output. Needs `NEXT_OUTPUT_STANDALONE=true` at build
  time (set in the Dockerfile); local `npm run dev` is unaffected.

The images are portable — any target that runs Docker (Fly.io, Railway,
Render, Kubernetes, plain VMs) will work. GitHub Actions CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs tests and
smoke-builds both images on every PR.

## Tests

```bash
npm test                 # backend + frontend
npm run test:backend     # 38/38 passing
npm run test:frontend    # 64/64 passing
```

CI (GitHub Actions) runs on push to `main` and on every PR:
- **backend**: `npm test` on Node 20
- **frontend**: `tsc --noEmit` + `npm test` on Node 20
- **docker-build**: smoke-builds both images (no push)

## Repo layout

```
├── backend/                       # Express API
│   ├── services/                  # oracle, stellar, openMeteo, planetaryComputer,
│   │                              # sorobanRead, systemHealth, payoutLog, cache
│   ├── routes/                    # satellite, contract, contractState, health
│   ├── middleware/                # rateLimit
│   └── tests/                     # Vitest (ESM)
├── frontend/                      # Next.js 14 app router + TypeScript + Tailwind
│   ├── app/(dashboard)/           # all 7 routes
│   ├── components/ui/             # shadcn-pattern primitives
│   └── lib/                       # api, env, types, horizon, csv, timeago, payouts-store
├── contracts/parametric_trigger/  # Rust Soroban source
├── data/
│   ├── sitapur_farms.json         # 5 farm metadata entries
│   └── historical_ndvi.json       # mock NDVI seed (rebased rolling at read time)
├── scripts/
│   └── deploy-contract.sh         # one-shot testnet deploy + pool init
└── package.json                   # root: deploy:contract, dev:*, install:all, test
```

## Known limitations

See [frontend/DEFERRED.md](frontend/DEFERRED.md) for UI items explicitly not
shipped. Backend deferred items:

- **NDVI gaps (7/14 days mock)** — Sentinel-2 revisits every ~5 days; gap
  days could be filled by temporal interpolation between surrounding real
  values. Today they fall back to mock.
- **Mainnet deploy** — testnet-only. Mainnet stand-up would cost ~510 XLM
  (contract upload + deploy + 5 pools × 100 XLM) plus real farmer onboarding.
- **Auth** — none. `/simulate` is unauthenticated; rate-limited per IP.
- **Real farmer partnerships** — demo keypairs stand in for actual farmer
  wallets.

## License

MIT
