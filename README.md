# AgriShield — Parametric Crop Insurance on Stellar

AgriShield is a parametric crop insurance platform for smallholder farmers in Sitapur, UP, India. It monitors real-time satellite vegetation data (NDVI) and rainfall from Sentinel-2, automatically evaluates drought conditions through an on-chain oracle, and triggers instant XLM payouts to farmers' Stellar wallets via a Soroban smart contract — with no claim filing, no adjuster, and settlement in seconds.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AgriShield System                            │
└─────────────────────────────────────────────────────────────────────┘

  Sentinel-2 API          Oracle Logic          Soroban Contract
  (satellite NDVI)  ───►  (evaluateDrought)  ──► (trigger_payout)
       │                        │                      │
       │  NDVI < 0.35           │  proof_hash          │  emit PAYOUT
       │  Rainfall < 10mm       │  + confidence        │  event
       │                        │                      │
       ▼                        ▼                      ▼
  ┌─────────┐            ┌──────────────┐      ┌──────────────────┐
  │  Mock   │            │ Express API  │      │  Stellar Testnet │
  │  Data   │◄───────────│  :3001       │─────►│  (XLM Payment)   │
  │  (JSON) │            │              │      │                  │
  └─────────┘            └──────────────┘      └──────────────────┘
                                │                      │
                                ▼                      ▼
                         ┌──────────────┐      ┌──────────────────┐
                         │  Next.js UI  │      │   UPI / SMS      │
                         │  :3000       │      │  Notification    │
                         │  (Farm Map)  │      │  (Future)        │
                         └──────────────┘      └──────────────────┘
```

## What is Real vs Mocked

| Component | Status | Notes |
|-----------|--------|-------|
| Farm polygons (Sitapur, UP) | Real | Actual GPS coordinates near 27.57°N, 80.68°E |
| Historical NDVI data | Mock | 14-day synthetic dataset; farms 001/002 have drought conditions |
| Rainfall data | Mock | Simulated; real source would be ERA5 or IMD |
| Sentinel-2 API | Optional | Set `SENTINEL_HUB_API_KEY` to use real satellite data |
| Oracle logic | Real | Actual NDVI/rainfall threshold evaluation |
| Stellar XLM payment | Real (testnet) | Actual on-chain transactions on Stellar testnet |
| Soroban contract | Real code | Compiled + deployed separately; falls back to XLM payment |
| UPI/SMS notification | Placeholder | Architecture shown; not implemented in MVP |

## Drought Thresholds

```
NDVI Threshold    = 0.35   (Normalized Difference Vegetation Index)
Rainfall Threshold = 10mm  (daily rainfall)

Trigger condition: NDVI < 0.35 AND rainfall < 10mm for ALL 14 consecutive days

Confidence levels:
  HIGH   → both averages exceed threshold by >20% (avg NDVI < 0.28, avg rain < 8mm)
  MEDIUM → thresholds met but not exceeded by 20%
  LOW    → conditions not fully met
```

NDVI measures vegetation health from satellite imagery (-1 to +1):
- 0.6–0.9 = dense healthy vegetation
- 0.35–0.6 = moderate/sparse vegetation
- < 0.35 = stressed/dying crops or bare soil (drought indicator)

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone and install dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — all vars are optional for demo

# Frontend
cp frontend/.env.local.example frontend/.env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:3001
```

### 3. Run the backend

```bash
cd backend
npm start
# Server starts on http://localhost:3001
```

### 4. Run the frontend

```bash
cd frontend
npm run dev
# Dashboard available at http://localhost:3000
```

### 5. (Optional) Configure Stellar

The backend auto-generates and funds a Stellar testnet keypair via Friendbot if no key is set.
To use a specific key:

```bash
# In backend/.env
STELLAR_ADMIN_SECRET_KEY=S...  # Your testnet secret key
```

## Testnet Contract

**Testnet Contract ID: TBD — deploy with `npm run deploy:contract`**

To deploy the Soroban contract manually:
```bash
# Requires Rust + soroban-cli installed
cd contracts/parametric_trigger
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/parametric_trigger.wasm \
  --network testnet --source <YOUR_KEYPAIR>
```

## Demo Flow (9-Step Judge Flow)

1. **Open dashboard** at http://localhost:3000 — map loads with 5 Sitapur farms
2. **Observe farm colors** — SITAPUR_001 and SITAPUR_002 show red (drought); others show green (healthy)
3. **Click SITAPUR_001** on the map to select it
4. **Read status badge** — "DROUGHT DETECTED — NDVI 0.210, Rainfall 0.0mm" with HIGH confidence
5. **Inspect proof of loss** — 14-day window shown, avg NDVI 0.254, avg rainfall 0.8mm
6. **Click "Simulate Climate Event & Trigger Payout"** button
7. **Watch loading state** — oracle evaluates conditions, Stellar transaction submitted
8. **Success state shows** — transaction hash + clickable stellar.expert link
9. **Verify on-chain** — click the explorer link to see the XLM payment on Stellar testnet

## API Reference

```
GET  /health                          — Backend health check
GET  /api/farms                       — List all 5 farms
GET  /api/farm/:farmId/status         — Get farm drought status (14-day evaluation)
POST /api/farm/:farmId/simulate       — Simulate drought + trigger payout
GET  /api/transaction/:txHash         — Check Stellar transaction status
```

All responses follow the envelope format:
```json
{ "success": true, "data": { ... }, "error": null }
```
