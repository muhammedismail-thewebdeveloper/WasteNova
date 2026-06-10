#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────
const ADMIN: Symbol = symbol_short!("ADMIN");
const CLAIM_SEQ: Symbol = symbol_short!("CLAIMSEQ");
const TOTAL_KG: Symbol = symbol_short!("TOTALKG");

// ─── Data Types ──────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Rejected,
    Paid,
}

#[contracttype]
#[derive(Clone)]
pub struct Claim {
    pub id: u64,
    pub submitter: Address,
    pub kg_waste: u32,
    pub waste_type: String,
    pub photo_hash: String,
    pub status: ClaimStatus,
    pub reward_tokens: i128,
    pub recycler: Address,
}

#[contracttype]
pub enum DataKey {
    Claim(u64),
    Balance(Address),
    TotalImpact(Address),
    Allowance(Address, Address),
}

// ─── Contract ────────────────────────────────────────────────────────────────
#[contract]
pub struct WasteNovaContract;

#[contractimpl]
impl WasteNovaContract {
    /// Initialize contract with admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&CLAIM_SEQ, &0u64);
        env.storage().instance().set(&TOTAL_KG, &0u32);
    }

    // ─── Claims ──────────────────────────────────────────────────────────────
    /// Submit a waste pickup claim
    pub fn submit_claim(
        env: Env,
        submitter: Address,
        recycler: Address,
        kg_waste: u32,
        waste_type: String,
        photo_hash: String,
    ) -> u64 {
        submitter.require_auth();
        assert!(kg_waste > 0, "kg must be > 0");

        let seq: u64 = env.storage().instance().get(&CLAIM_SEQ).unwrap_or(0);
        let id = seq + 1;
        let reward = Self::calc_reward(kg_waste);

        let claim = Claim {
            id,
            submitter,
            kg_waste,
            waste_type,
            photo_hash,
            status: ClaimStatus::Pending,
            reward_tokens: reward,
            recycler,
        };

        env.storage().persistent().set(&DataKey::Claim(id), &claim);
        env.storage().instance().set(&CLAIM_SEQ, &id);
        id
    }

    /// Recycler approves or rejects a claim
    pub fn review_claim(env: Env, recycler: Address, claim_id: u64, approve: bool) {
        recycler.require_auth();

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found");

        assert!(claim.recycler == recycler, "not assigned recycler");
        assert!(matches!(claim.status, ClaimStatus::Pending), "not pending");

        if approve {
            claim.status = ClaimStatus::Approved;
            // Mint reward tokens to submitter
            let bal_key = DataKey::Balance(claim.submitter.clone());
            let cur: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
            env.storage().persistent().set(&bal_key, &(cur + claim.reward_tokens));

            // Track total kg per user
            let impact_key = DataKey::TotalImpact(claim.submitter.clone());
            let cur_kg: u32 = env.storage().persistent().get(&impact_key).unwrap_or(0);
            env.storage().persistent().set(&impact_key, &(cur_kg + claim.kg_waste));

            // Global total
            let total: u32 = env.storage().instance().get(&TOTAL_KG).unwrap_or(0);
            env.storage().instance().set(&TOTAL_KG, &(total + claim.kg_waste));
        } else {
            claim.status = ClaimStatus::Rejected;
        }

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
    }

    /// Admin overrides claim status (moderation)
    pub fn admin_moderate(env: Env, claim_id: u64, approve: bool) {
        let admin: Address = env.storage().instance().get(&ADMIN).expect("no admin");
        admin.require_auth();

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found");

        if approve {
            claim.status = ClaimStatus::Approved;
            let bal_key = DataKey::Balance(claim.submitter.clone());
            let cur: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
            env.storage().persistent().set(&bal_key, &(cur + claim.reward_tokens));

            let impact_key = DataKey::TotalImpact(claim.submitter.clone());
            let cur_kg: u32 = env.storage().persistent().get(&impact_key).unwrap_or(0);
            env.storage().persistent().set(&impact_key, &(cur_kg + claim.kg_waste));

            let total: u32 = env.storage().instance().get(&TOTAL_KG).unwrap_or(0);
            env.storage().instance().set(&TOTAL_KG, &(total + claim.kg_waste));
        } else {
            claim.status = ClaimStatus::Rejected;
        }

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
    }

    // ─── Token (WNV) ─────────────────────────────────────────────────────────
    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr))
            .unwrap_or(0)
    }

    /// Burn WNV tokens to request USDC payout (off-chain settlement trigger)
    pub fn redeem(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be > 0");

        let bal_key = DataKey::Balance(from.clone());
        let cur: i128 = env.storage().persistent().get(&bal_key).unwrap_or(0);
        assert!(cur >= amount, "insufficient balance");

        env.storage().persistent().set(&bal_key, &(cur - amount));
        // Emit event for off-chain USDC payout processor
        env.events().publish(
            (symbol_short!("redeem"),),
            (from, amount),
        );
    }

    // ─── Leaderboard helpers ─────────────────────────────────────────────────
    pub fn total_kg_impact(env: Env, addr: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalImpact(addr))
            .unwrap_or(0)
    }

    pub fn global_kg(env: Env) -> u32 {
        env.storage().instance().get(&TOTAL_KG).unwrap_or(0)
    }

    pub fn get_claim(env: Env, claim_id: u64) -> Claim {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found")
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage().instance().get(&CLAIM_SEQ).unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN).expect("no admin")
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    fn calc_reward(kg: u32) -> i128 {
        // 10 WNV tokens per kg
        (kg as i128) * 10_000_000 // 7 decimals
    }
}
