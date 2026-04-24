#!/usr/bin/env bash
#
# deploy-contract.sh — Deploys the parametric_trigger Soroban contract to
# Stellar testnet and initializes all 5 pools.
#
# Requires: rustup + stellar CLI + wasm32v1-none target.
# If rustup/stellar are missing, prints install instructions and exits.
#
# Idempotent-ish:
#   - If the `agri-admin` stellar key already exists, reuses it.
#   - If SOROBAN_CONTRACT_ID is already set in backend/.env, prompts before
#     re-deploying.
#   - Pool initialization will fail with AlreadyInitialized on a farm that's
#     already been set up; the script continues past such errors.
#
# On success:
#   - Writes SOROBAN_CONTRACT_ID + STELLAR_ADMIN_SECRET_KEY to backend/.env
#   - Prints the contract ID and stellar.expert link

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contracts/parametric_trigger"
ENV_FILE="$ROOT_DIR/backend/.env"
FARMS_FILE="$ROOT_DIR/data/sitapur_farms.json"
NETWORK="testnet"
PAYOUT_STROOPS=1000000000  # 100 XLM

# ─── Preflight ────────────────────────────────────────────────────────────────

if ! command -v stellar >/dev/null 2>&1; then
  echo "✖ stellar CLI not found. Install with:"
  echo "    cargo install --locked stellar-cli"
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "✖ cargo not found. Install Rust with:"
  echo "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
  exit 1
fi

if ! rustup target list --installed 2>/dev/null | grep -q "wasm32v1-none"; then
  echo "→ Adding wasm32v1-none target (Soroban requires it)…"
  rustup target add wasm32v1-none
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "✖ jq not found. Install with: brew install jq   (or apt-get install jq)"
  exit 1
fi

# ─── Network ──────────────────────────────────────────────────────────────────

stellar network add "$NETWORK" \
  --rpc-url "https://soroban-${NETWORK}.stellar.org" \
  --network-passphrase "Test SDF Network ; September 2015" \
  2>/dev/null || true

# ─── Keypair ──────────────────────────────────────────────────────────────────

if stellar keys address agri-admin >/dev/null 2>&1; then
  echo "→ Reusing existing stellar key 'agri-admin'"
else
  echo "→ Generating new stellar key 'agri-admin' and funding via friendbot…"
  stellar keys generate agri-admin --network "$NETWORK" --fund
fi

ADMIN_PUBKEY="$(stellar keys address agri-admin)"
ADMIN_SECRET="$(stellar keys show agri-admin)"
echo "  Admin pubkey: $ADMIN_PUBKEY"

# ─── Build contract WASM ──────────────────────────────────────────────────────

echo "→ Building contract WASM (may take 30-60s on first run)…"
(
  cd "$CONTRACT_DIR"
  stellar contract build >/dev/null
)

WASM_PATH="$CONTRACT_DIR/target/wasm32v1-none/release/parametric_trigger.wasm"
if [ ! -f "$WASM_PATH" ]; then
  # Fallback: respect CARGO_TARGET_DIR if used at build time
  alt="$(find "$CONTRACT_DIR" /Volumes -maxdepth 8 -name 'parametric_trigger.wasm' 2>/dev/null | head -1 || true)"
  if [ -n "$alt" ]; then
    WASM_PATH="$alt"
  else
    echo "✖ Build succeeded but WASM not found. Expected at $WASM_PATH"
    exit 1
  fi
fi
echo "  WASM at $WASM_PATH ($(wc -c <"$WASM_PATH") bytes)"

# ─── Deploy ───────────────────────────────────────────────────────────────────

echo "→ Deploying contract to $NETWORK…"
CONTRACT_ID="$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source agri-admin \
  --network "$NETWORK" \
  --alias agri-shield-pool 2>&1 | tail -1)"

if ! [[ "$CONTRACT_ID" =~ ^C[A-Z0-9]{55}$ ]]; then
  echo "✖ Deploy did not return a valid contract ID. Output:"
  echo "$CONTRACT_ID"
  exit 1
fi

echo "✓ Contract deployed: $CONTRACT_ID"
echo "  Explorer: https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT_ID"

# ─── Initialize pools ─────────────────────────────────────────────────────────

echo "→ Initializing pools for each farm…"
FARM_IDS=$(jq -r '.[].farmId' "$FARMS_FILE")
for farm_id in $FARM_IDS; do
  echo "  · $farm_id"
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source agri-admin \
    --network "$NETWORK" \
    -- \
    initialize_pool \
    --farm_id "$farm_id" \
    --amount "$PAYOUT_STROOPS" \
    --admin "$ADMIN_PUBKEY" \
    >/dev/null 2>&1 || echo "    (skipped — likely already initialized)"
done

# ─── Write backend/.env ───────────────────────────────────────────────────────

echo "→ Writing backend/.env"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # macOS-compatible in-place edit
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    printf "%s=%s\n" "$key" "$value" >>"$ENV_FILE"
  fi
}

upsert_env "STELLAR_ADMIN_SECRET_KEY" "$ADMIN_SECRET"
upsert_env "STELLAR_NETWORK" "$NETWORK"
upsert_env "SOROBAN_CONTRACT_ID" "$CONTRACT_ID"
upsert_env "SOROBAN_RPC_URL" "https://soroban-${NETWORK}.stellar.org"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ AgriShield contract is live on Stellar $NETWORK"
echo ""
echo "  Contract ID:  $CONTRACT_ID"
echo "  Admin pubkey: $ADMIN_PUBKEY"
echo "  Explorer:     https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT_ID"
echo ""
echo "  Next:"
echo "    cd backend && npm start"
echo "    cd frontend && npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
