# AGRI-SHIELD UP — Handoff Document

**Last updated:** 2026-04-23
**Session context:** Building MVP parametric insurance oracle on Stellar testnet

---

## TL;DR

- ✅ **Backend + Frontend running end-to-end** with real Stellar testnet transactions
- ✅ **First test tx live on testnet:** `8f5f08dfdab5aef85c22c031abb6c05e3b44dfaa722942a4fea5b7010f3dee77` → [stellar.expert](https://stellar.expert/explorer/testnet/tx/8f5f08dfdab5aef85c22c031abb6c05e3b44dfaa722942a4fea5b7010f3dee77)
- ⚠️ **Blocked:** Disk full (272MB free). Cannot install Rust → cannot deploy Soroban contract yet.
- ⏸️ **Pending:** Contract deploy, frontend rework with shadcn + satellite map

---

## Current System State

### What Works (Real, Not Mocked)

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API (`localhost:3001`) | ✅ Running | Express, CORS open for dev |
| Frontend dashboard (`localhost:3002`) | ✅ Running | Next.js 14 pages router |
| Landing page (`localhost:5173`) | ✅ Running | Vite + React (separate repo: `/Users/garv/Downloads/agri-shield/`) |
| Drought oracle logic | ✅ Real | NDVI < 0.35 AND rainfall < 10mm for all 14 days |
| Stellar admin keypair | ✅ Auto-generated | Funded via friendbot on first run |
| Farm wallets (5 real keypairs, funded) | ✅ Real | See "Farm Wallets" below |
| Stellar testnet transactions | ✅ Real XLM payments | Visible on stellar.expert |

### What's Mocked

- Satellite NDVI data (loaded from `/data/historical_ndvi.json`, labeled `source: "mock"`)
- UPI payout (currently 1 XLM testnet payment, not real INR)

### What's Missing

- ❌ Soroban smart contract **not deployed** (Rust toolchain install blocked by disk space)
- ❌ Frontend not yet reworked with shadcn/ui + satellite tiles

---

## Project Structure

```
/Users/garv/Downloads/agri-shield-up/
├── backend/           Node.js + Express API on :3001
│   ├── server.js
│   ├── routes/
│   │   ├── satellite.js      GET /api/farm/:id/status
│   │   └── contract.js       POST /api/farm/:id/simulate, GET /api/transaction/:hash
│   └── services/
│       ├── sentinelService.js     Loads NDVI (mock or Sentinel Hub)
│       ├── oracleLogic.js         Drought evaluation engine
│       └── stellarService.js      Stellar SDK wrapper (auto-funds via friendbot)
├── frontend/          Next.js 14 dashboard on :3002
│   ├── pages/index.js
│   └── components/
│       ├── FarmMap.jsx            Leaflet map (CartoCDN dark tiles — TO BE REPLACED with satellite)
│       ├── StatusBadge.jsx
│       └── TriggerButton.jsx
├── contracts/parametric_trigger/  Rust Soroban contract (NOT YET DEPLOYED)
│   ├── src/lib.rs
│   └── Cargo.toml
├── data/
│   ├── sitapur_farms.json         5 farms with REAL funded testnet wallets
│   └── historical_ndvi.json       70 observations (14 days × 5 farms)
└── README.md
```

---

## Farm Wallets (Testnet — All Funded)

| Farm ID | Farmer | Public Key | Funded |
|---------|--------|------------|--------|
| SITAPUR_001 | Ramesh Kumar | `GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3` | ✅ |
| SITAPUR_002 | Sunita Devi | `GDEFEH3ZEWQXIVHTYIXOAUCFLFGABG6SB5IZBRUAWOWT7MHL7ZHKWYIP` | ✅ |
| SITAPUR_003 | Vijay Singh | `GBPOLRGMTQZLXGCKARVIHIEGMRJDNGUOEMTVSRWUFDII56ATGVEWOOKE` | ✅ |
| SITAPUR_004 | Meera Yadav | `GCB3PZCSUQXUAOGIB4XJYISCD7G47BNSTIITCX23XKT5YCUS5JA3H23G` | ✅ |
| SITAPUR_005 | Anil Tiwari | `GDQ5RBX6BTP3OHWPITGHUQPBX4NEOZNJ4T2NUUFUCUOBJFUX3WEF3SNJ` | ✅ |

**Secret keys for farm wallets** — held locally only, never committed.

Generate fresh testnet keypairs + fund via friendbot for a new demo. The oracle
flow only signs with the admin key (see `backend/.env`), so farm secret keys
are optional for the dashboard to work end-to-end.

```bash
# Example for one farm — repeat per wallet you want to seed:
stellar keys generate demo-farm-001 --network testnet --fund
stellar keys show demo-farm-001
```

⚠️ If you did commit wallet secrets from an earlier session, rotate them:
generate new keypairs, friendbot-fund, replace `walletAddress` values in
[data/sitapur_farms.json](data/sitapur_farms.json), and re-run pool
initialization against the contract.

---

## How to Run (Fresh Start)

```bash
# Backend (port 3001)
cd /Users/garv/Downloads/agri-shield-up/backend
npm install   # only first time
node server.js &

# Frontend (port 3002)
cd /Users/garv/Downloads/agri-shield-up/frontend
npm install   # only first time
npm run dev -- --port 3002 &

# Landing page (port 5173) — separate project
cd /Users/garv/Downloads/agri-shield
npm run dev &
```

Dashboard: http://localhost:3002
Landing "View Dashboard" button → http://localhost:3002

---

## What Was Done This Session

### ✅ Phase 1 — Data Foundation
- Created 5 real Sitapur farm polygons with GPS coords near 27.5706°N, 80.6822°E
- 14 days × 5 farms = 70 NDVI+rainfall observations
- SITAPUR_001 and _002 seeded with drought conditions (NDVI 0.18–0.32, rainfall 0–5mm)
- Farms _003–_005 healthy (NDVI 0.50–0.67, rainfall 20–45mm)

### ✅ Phase 2 — Oracle Logic
- `evaluateDrought()` with exact thresholds: NDVI < 0.35 AND rainfall < 10mm over ALL 14 days
- Confidence scoring: high if both exceeded by >20%
- Returns `proof_of_loss` structured data packet

### ✅ Phase 3 — Backend API (Express)
- `GET /api/farm/:id/status` — returns farm status + evaluation
- `POST /api/farm/:id/simulate` — fires oracle logic + Stellar tx
- `GET /api/transaction/:hash` — polls Horizon for tx status
- `GET /api/farms` — lists all farms

### ✅ Phase 4 — Stellar Integration
- `stellarService.js` auto-generates admin keypair if `STELLAR_ADMIN_SECRET_KEY` not set
- Auto-funds via friendbot on first run
- Currently submits 1 XLM payment with memo `AGRI-{farmId}` (real testnet tx)
- Has Soroban invocation code ready — just needs `SOROBAN_CONTRACT_ID` env var

### ✅ Phase 5 — Frontend Dashboard
- Next.js 14 (pages router) on port 3002
- FarmMap with Leaflet (CartoCDN dark tiles — **to be replaced with satellite**)
- StatusBadge showing drought/healthy + NDVI + rainfall + source label
- TriggerButton with idle/loading/success/error states, shows tx hash + stellar.expert link

### ✅ Bug Fixes
- Replaced placeholder wallet addresses (`GDEMO...`) with 5 real funded testnet keypairs
- Fixed CORS — was `localhost:3000` only, now accepts any origin in dev
- "Error" state on farms 2–5 was caused by CORS blocking + stale page. Resolved.

### ✅ Landing Page Integration
- "View Dashboard" button on `/Users/garv/Downloads/agri-shield/` points to `localhost:3002`

---

## Pending Work (Priority Order)

### 1. 🚨 Free Disk Space (BLOCKER)

Only 272MB free. Rust toolchain needs ~2GB. Without this, Soroban deploy is blocked.

```bash
df -h /
du -sh ~/Downloads/* | sort -h | tail -10
# Top space hogs in ~/Downloads:
#   2.1G  compliancetrack/
#   835M  tcore/
#   548M  new/
#   325M  Web3/
```

Suggested: move large folders to external drive or clear `~/Library/Caches/*`, Xcode DerivedData, old simulators.

### 2. 🦀 Deploy Soroban Contract

Contract already written at `contracts/parametric_trigger/src/lib.rs`. To deploy:

```bash
# Install Rust (needs ~2GB disk)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Build contract
cd /Users/garv/Downloads/agri-shield-up/contracts/parametric_trigger
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar keys generate admin --network testnet --fund
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/parametric_trigger.wasm \
  --source admin \
  --network testnet
# → outputs a contract ID like CABCDE...

# Initialize pool for a farm
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- \
  initialize_pool \
  --farm_id SITAPUR_001 \
  --amount 1000000000 \
  --admin <ADMIN_PUBKEY>

# Set env var
echo "SOROBAN_CONTRACT_ID=<CONTRACT_ID>" >> /Users/garv/Downloads/agri-shield-up/backend/.env

# Restart backend — stellarService will now invoke contract instead of XLM payment
```

`stellarService.js` already has the contract-invocation code path — when `SOROBAN_CONTRACT_ID` env var is present, it uses Soroban RPC instead of plain payment.

### 3. 🎨 Frontend Rework (shadcn + satellite map)

User requirements:
- **shadcn/ui** component library
- **Dark + light mode** toggle
- **Satellite imagery** on map (not childish tiles)
- Glassmorphism aesthetic from reference images
- Structured to not break on scaling/testing

**Satellite map tile options (all free):**
- ESRI World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- Mapbox satellite (requires API key, generous free tier)
- Stadia Satellite (requires API key, free for dev)

Quickest swap — just replace tile URL in `FarmMap.jsx`:
```jsx
// Before: dark CartoCDN
// After: ESRI satellite imagery (no API key needed)
<TileLayer
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  attribution='Tiles &copy; Esri'
/>
```

**For full rework, recommend:**
1. Migrate frontend to Next.js 14 app router + TypeScript
2. Run `npx shadcn-ui@latest init`
3. Install: Card, Badge, Button, Tabs, Dialog, Toast, Switch (for theme toggle)
4. Add `next-themes` for dark/light
5. Use Mapbox GL JS OR keep Leaflet with ESRI satellite tiles
6. Reference design cues: glass cards, soft gradients, accent color for key metrics (lime green like the Salesforce reference image)

### 4. Other Polish

- Move `STELLAR_ADMIN_SECRET_KEY` to `.env` (currently auto-generated each restart → new funded account each time)
- Add `.env` to `.gitignore`
- Commit `.env.example` without values
- Commit frequently per spec: one commit per phase
- Update README with Contract ID + tx hash after deploy

---

## Git Status

Repo target: `https://github.com/garvsultania/agrishield.git`

Current state: **nothing committed** yet. Before pushing:
1. Ensure `.env` not tracked
2. `cd /Users/garv/Downloads/agri-shield-up && git init`
3. `git remote add origin https://github.com/garvsultania/agrishield.git`
4. Commit phases incrementally per spec §12

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `backend/services/stellarService.js` | Stellar SDK, auto-funding, Soroban invocation logic |
| `backend/services/oracleLogic.js` | Drought rule engine, threshold constants |
| `contracts/parametric_trigger/src/lib.rs` | Soroban contract (not deployed yet) |
| `data/sitapur_farms.json` | 5 farms with real funded testnet wallets |
| `data/historical_ndvi.json` | 70 observations seed data |
| `frontend/pages/index.js` | Dashboard entry |
| `frontend/components/FarmMap.jsx` | Leaflet map — tile URL needs satellite swap |

---

## Known Issues

1. **`.env` not yet configured** — backend generates new admin keypair each restart. Copy the secret from first boot log into `.env`:
   ```
   [stellarService] To reuse this keypair, set STELLAR_ADMIN_SECRET_KEY=S...
   ```
2. **No `.env` files exist** — only `.env.example` templates. Copy + fill.
3. **Frontend "error" state** was CORS. Fixed. May still show if page loaded before backend was ready — always hard refresh.
4. **MongoDB optional** — server runs without it, warns on boot.
5. **Soroban state expiration** — contract will need a maintenance bot in prod. TODO comment in `lib.rs`.

---

## Demo Script (What to Show)

1. Open `localhost:5173` → landing page with video bg
2. Click "View Dashboard" → opens `localhost:3002`
3. See map of Sitapur with 5 farm polygons, 2 red (drought) 3 green (healthy)
4. Click SITAPUR_001 (Ramesh Kumar, drought)
5. See NDVI 0.21, rainfall 3.1mm, 14-day evaluation
6. Click "Simulate Climate Event & Trigger Payout"
7. 3-second loading
8. Returns tx hash + stellar.expert link
9. Open link → see real Stellar testnet transaction

That demonstrates: satellite data → oracle logic → Stellar blockchain → payout. The one-line pitch for judges.
