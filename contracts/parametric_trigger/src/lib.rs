#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short, Address, Env, Symbol,
    panic_with_error,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

/// Storage key for pool configuration per farm
#[contracttype]
pub enum DataKey {
    Pool(Symbol),   // Pool { admin, amount, funded }
    Paid(Symbol),   // bool — double-spend guard per farm
    Admin,          // global admin address
}

// ─── Data Structures ──────────────────────────────────────────────────────────

/// Pool configuration stored on-chain for each farm
#[contracttype]
#[derive(Clone)]
pub struct PoolConfig {
    pub farm_id: Symbol,
    pub amount: i128,
    pub admin: Address,
    pub initialized: bool,
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Copy, Clone)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadyPaid = 3,
    NotAdmin = 4,
    InvalidAmount = 5,
}

impl From<Error> for soroban_sdk::Error {
    fn from(e: Error) -> soroban_sdk::Error {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct ParametricTrigger;

#[contractimpl]
impl ParametricTrigger {
    /// Initialize an insurance pool for a specific farm.
    ///
    /// Arguments:
    ///   farm_id   - Unique identifier for the farm (e.g., Symbol::new("SITAPUR_001"))
    ///   amount    - Payout amount in stroops (1 XLM = 10_000_000 stroops)
    ///   admin     - Address authorized to trigger payouts (oracle backend)
    ///
    /// Errors:
    ///   AlreadyInitialized - if this farm pool already exists
    ///   InvalidAmount      - if amount is zero or negative
    pub fn initialize_pool(
        env: Env,
        farm_id: Symbol,
        amount: i128,
        admin: Address,
    ) {
        // Require admin authentication for pool initialization
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // Prevent re-initialization
        let key = DataKey::Pool(farm_id.clone());
        if env.storage().persistent().has(&key) {
            let existing: PoolConfig = env.storage().persistent().get(&key).unwrap();
            if existing.initialized {
                panic_with_error!(&env, Error::AlreadyInitialized);
            }
        }

        let pool = PoolConfig {
            farm_id: farm_id.clone(),
            amount,
            admin: admin.clone(),
            initialized: true,
        };

        // TODO (production): set state_expiration_ledger for TTL management
        // env.storage().persistent().set_ttl(&key, min_ledgers, max_ledgers);
        env.storage().persistent().set(&key, &pool);

        // Emit initialization event
        env.events().publish(
            (symbol_short!("INIT"), farm_id),
            (amount, admin),
        );
    }

    /// Trigger a parametric insurance payout for a drought event.
    ///
    /// This function is admin-only and protected against double-spend.
    /// The oracle backend calls this when drought conditions are confirmed
    /// (NDVI < 0.35 AND rainfall < 10mm for all 14 days).
    ///
    /// Arguments:
    ///   farm_id    - Farm identifier matching the pool
    ///   recipient  - Farmer's Stellar address to receive payout
    ///   proof_hash - SHA-256 hash of the off-chain proof-of-loss document
    ///
    /// Errors:
    ///   NotInitialized - if no pool exists for this farm
    ///   NotAdmin       - if caller is not the pool admin
    ///   AlreadyPaid    - double-spend guard: payout already issued for this farm
    ///
    /// Emits:
    ///   Event: (PAYOUT, farm_id) → recipient
    pub fn trigger_payout(
        env: Env,
        farm_id: Symbol,
        recipient: Address,
        proof_hash: Symbol,
    ) {
        // Load pool configuration — must exist
        let pool_key = DataKey::Pool(farm_id.clone());
        if !env.storage().persistent().has(&pool_key) {
            panic_with_error!(&env, Error::NotInitialized);
        }
        let pool: PoolConfig = env.storage().persistent().get(&pool_key).unwrap();

        // Require pool admin authentication — only oracle backend can trigger
        pool.admin.require_auth();

        // ── Double-spend guard ────────────────────────────────────────────────
        // Check if payout has already been issued for this farm.
        // Once set, this flag can never be unset, preventing duplicate payouts.
        let paid_key = DataKey::Paid(farm_id.clone());
        if env.storage().persistent().has(&paid_key) {
            let already_paid: bool = env.storage().persistent().get(&paid_key).unwrap_or(false);
            if already_paid {
                panic_with_error!(&env, Error::AlreadyPaid);
            }
        }

        // Mark as paid BEFORE emitting event (checks-effects-interactions pattern)
        // TODO (production): set appropriate TTL for paid flag to avoid storage bloat
        env.storage().persistent().set(&paid_key, &true);

        // ── Emit payout event ─────────────────────────────────────────────────
        // This event is the on-chain proof that the oracle triggered a payout.
        // Off-chain systems listen for this event to execute the actual fund transfer.
        env.events().publish(
            (symbol_short!("PAYOUT"), farm_id.clone()),
            recipient.clone(),
        );

        // Also emit proof hash for auditability
        env.events().publish(
            (symbol_short!("PROOF"), farm_id),
            (proof_hash, pool.amount, recipient),
        );
    }

    /// Check if a payout has already been issued for a farm.
    /// Returns true if payout was triggered, false otherwise.
    pub fn is_paid(env: Env, farm_id: Symbol) -> bool {
        let paid_key = DataKey::Paid(farm_id);
        if env.storage().persistent().has(&paid_key) {
            env.storage().persistent().get(&paid_key).unwrap_or(false)
        } else {
            false
        }
    }

    /// Retrieve pool configuration for a given farm.
    /// Returns the PoolConfig struct or panics if not initialized.
    pub fn get_pool(env: Env, farm_id: Symbol) -> PoolConfig {
        let key = DataKey::Pool(farm_id);
        if !env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::NotInitialized);
        }
        env.storage().persistent().get(&key).unwrap()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Symbol};

    #[test]
    fn test_initialize_and_trigger_payout() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ParametricTrigger);
        let client = ParametricTriggerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM001");
        let proof = Symbol::new(&env, "PROOF_ABC");

        // Initialize pool
        client.initialize_pool(&farm_id, &1_000_000_000i128, &admin);

        // Verify pool is created
        let pool = client.get_pool(&farm_id);
        assert_eq!(pool.amount, 1_000_000_000i128);
        assert!(!client.is_paid(&farm_id));

        // Trigger payout
        client.trigger_payout(&farm_id, &recipient, &proof);
        assert!(client.is_paid(&farm_id));
    }

    #[test]
    #[should_panic]
    fn test_double_spend_prevention() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ParametricTrigger);
        let client = ParametricTriggerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM002");
        let proof = Symbol::new(&env, "PROOF_XYZ");

        client.initialize_pool(&farm_id, &500_000_000i128, &admin);
        client.trigger_payout(&farm_id, &recipient, &proof);

        // This second call must panic with AlreadyPaid error
        client.trigger_payout(&farm_id, &recipient, &proof);
    }
}
