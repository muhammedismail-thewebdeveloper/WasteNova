# ♻ WasteNova

> Rewarding sustainable waste collection with Stellar-powered digital assets.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#getting-started)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)
[![Network](https://img.shields.io/badge/network-Stellar%20Testnet-purple)](https://developers.stellar.org)

---

## What is WasteNova?

WasteNova is a **decentralized recycling incentive platform** that uses the Stellar blockchain to reward citizens for responsible waste disposal. The goal is simple: make recycling financially worthwhile for everyone, while creating a transparent, tamper-proof record of environmental impact.

### The Problem

Recycling rates remain low globally because there is no immediate, tangible reward for individuals who take the effort to sort and submit their waste. Municipal programs are opaque, slow, and often inaccessible. There is no on-chain accountability for whether waste was actually processed.

### How WasteNova Solves It

1. **A citizen** submits a waste pickup claim — specifying what they collected, how much it weighed, and optionally attaching an IPFS photo hash as proof.
2. **An assigned recycler** (a verified waste processor) reviews the claim on-chain and approves or rejects it based on the evidence.
3. **On approval**, the Soroban smart contract automatically mints **WNV tokens** (10 WNV per kg) directly to the citizen's Stellar wallet — no middlemen, no delays.
4. **The citizen** can redeem their WNV tokens for USDC at any time by burning them through the contract, which emits a verifiable on-chain event that triggers an off-chain USDC settlement process.
5. Every kilogram recycled is permanently recorded on-chain, contributing to a **public environmental leaderboard** tracking global and per-user CO₂ savings.

Admins have a moderation layer to override decisions if disputes arise, ensuring the system stays fair without sacrificing decentralization.

---

## Features

| Feature | Description |
|---|---|
| **Waste Pickup Claims** | Submit claims with waste type, weight (kg), and optional IPFS photo hash as proof |
| **Recycler Approval System** | Claims are reviewed on-chain by the assigned recycler who can approve or reject |
| **WNV Token Rewards** | Soroban-native token minted automatically on approval — 10 WNV per kg (7 decimals) |
| **USDC Payouts** | Burn WNV tokens to emit an on-chain redemption event for off-chain USDC settlement |
| **Admin Moderation** | Admins can force-approve or force-reject any claim for dispute resolution |
| **Environmental Leaderboard** | Live tracking of kg recycled and estimated CO₂ saved per user and globally |
| **Role-based UI** | Single app switches between user, recycler, and admin views via wallet role selector |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  SubmitClaim │ RecyclerDashboard │ AdminPanel │ Wallet   │
│                   Leaderboard                            │
└────────────────────────┬────────────────────────────────┘
                         │  @stellar/stellar-sdk v13
                         │  @stellar/freighter-api
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Stellar Soroban RPC (Testnet/Mainnet)         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           WasteNova Soroban Smart Contract (Rust)        │
│                                                          │
│  Claims Storage (persistent)                             │
│  WNV Token Balances (persistent)                         │
│  Per-user kg Impact (persistent)                         │
│  Global kg Total (instance)                              │
│  Admin Address (instance)                                │
└─────────────────────────────────────────────────────────┘
```

The smart contract is the single source of truth. The frontend never holds state beyond what it reads from the chain. All mutations (submit, approve, redeem) are signed transactions sent through Freighter.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust · [Soroban SDK 21](https://developers.stellar.org/docs/smart-contracts) |
| Frontend | React 19 · TypeScript · Vite 6 |
| Styling | TailwindCSS 3 |
| Blockchain | Stellar Testnet / Mainnet |
| Wallet | [Freighter](https://www.freighter.app/) via `@stellar/freighter-api` v6 |
| Stellar SDK | `@stellar/stellar-sdk` v13 |

---

## Project Structure

```
WasteNova/
├── Cargo.toml                  # Rust workspace
├── contract/
│   ├── Cargo.toml              # Soroban SDK dependency + release profile
│   └── src/lib.rs              # All contract logic (claims, tokens, leaderboard)
└── frontend/
    ├── .env.example            # Environment variable template
    ├── tailwind.config.js
    ├── vite.config.ts
    └── src/
        ├── main.tsx            # App entry point
        ├── App.tsx             # Root component + sidebar navigation
        ├── lib/
        │   └── stellar.ts      # Contract invocation, xdr helpers, wallet utils
        ├── context/
        │   └── WalletContext.tsx  # Freighter wallet state + role management
        ├── components/
        │   └── Navbar.tsx      # Top bar with connect/disconnect + role switcher
        └── pages/
            ├── SubmitClaim.tsx       # Waste pickup claim form
            ├── RecyclerDashboard.tsx # Claim review queue for recyclers
            ├── AdminPanel.tsx        # Force approve/reject by claim ID
            ├── Leaderboard.tsx       # Global + personal environmental stats
            └── Wallet.tsx            # WNV balance + USDC redemption
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) + `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/smart-contracts/getting-started/setup)
- [Freighter wallet](https://www.freighter.app/) browser extension (funded on testnet via [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test))

### 1. Install Rust toolchain

```bash
rustup target add wasm32-unknown-unknown
cargo install stellar-cli --locked
```

### 2. Build & deploy the contract

```bash
cargo build \
  --manifest-path contract/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/wastenova_contract.wasm \
  --network testnet \
  --source <YOUR_SECRET_KEY>
```

Copy the output contract ID, then initialize it:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <YOUR_SECRET_KEY> \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

### 3. Configure the frontend

```bash
cd frontend
cp .env.example .env
# Edit .env and set VITE_CONTRACT_ID to your deployed contract ID
```

### 4. Run the frontend

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), connect Freighter, and start submitting claims.

---

## Smart Contract Reference

All state-changing functions require the calling address to authorize the transaction via Freighter.

| Function | Auth | Description |
|---|---|---|
| `initialize(admin)` | — | One-time setup, sets admin address |
| `submit_claim(submitter, recycler, kg, waste_type, photo_hash)` | submitter | Creates a pending claim, returns claim ID |
| `review_claim(recycler, claim_id, approve)` | recycler | Approves or rejects the assigned claim |
| `admin_moderate(claim_id, approve)` | admin | Force-approves or force-rejects any claim |
| `balance(addr)` | — | Returns WNV token balance (7 decimals) |
| `redeem(from, amount)` | from | Burns WNV and emits event for USDC settlement |
| `total_kg_impact(addr)` | — | Total kg recycled by an address |
| `global_kg()` | — | Total kg recycled across all users |
| `get_claim(id)` | — | Returns full claim struct |
| `claim_count()` | — | Total number of claims ever submitted |

**Reward formula:** `reward_tokens = kg × 10_000_000` (10 WNV per kg at 7 decimal places)

**Claim lifecycle:** `Pending → Approved / Rejected` (admin can override at any stage)

---

## Contributors Guide

Thank you for considering a contribution to WasteNova! This section covers everything you need to know.

### Ways to Contribute

- **Bug fixes** — anything broken, from UI glitches to contract logic errors
- **New features** — IPFS photo upload integration, batch claims, multi-recycler support, governance voting
- **Tests** — contract unit tests (`cargo test`), frontend component tests
- **Documentation** — improving clarity, adding examples, translating
- **Design** — UI/UX improvements, accessibility, mobile responsiveness

### Development Setup

Follow the [Getting Started](#getting-started) steps above, then:

```bash
# Run frontend in dev mode with hot reload
cd frontend && npm run dev

# Type-check without building
npm run tsc --noEmit

# Full production build (must pass before opening a PR)
npm run build
```

For contract development, use `soroban-sdk`'s test utilities:

```bash
# Run all contract unit tests
cargo test --manifest-path contract/Cargo.toml
```

### Workflow

#### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/WasteNova.git
cd WasteNova
git remote add upstream https://github.com/muhammedismail-thewebdeveloper/WasteNova.git
```

#### 2. Sync with upstream before starting work

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

#### 3. Create a feature branch

```bash
git checkout -b feat/your-feature-name
```

Branch naming:
| Prefix | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation only |
| `test/` | Tests only |
| `refactor/` | Code restructuring without behaviour change |

#### 4. Make your changes

**Contract (`contract/src/lib.rs`):**
- Run `cargo fmt` before committing
- Add a test in the same file for any new function
- Do not change storage key names or data types for existing fields — this breaks deployed contract state

**Frontend (`frontend/src/`):**
- No `any` types. Use `unknown` with type guards instead
- Functional components only, no class components
- Keep components under ~150 lines. Extract logic to hooks or `lib/` utilities
- All on-chain reads use `rpc.Server.simulateTransaction`. Mutations go through `invokeContract` in `lib/stellar.ts`

#### 5. Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add batch claim submission
fix: correct i128 parsing for large balances
docs: update contract reference table
test: add recycler approval unit test
chore: upgrade stellar-sdk to v13.2
```

Rules:
- One logical change per commit
- Present tense, lowercase, no period at end
- Reference issue numbers when applicable: `fix: handle empty photo hash (#12)`

#### 6. Before opening a PR

```bash
# Frontend must build with zero TypeScript errors
cd frontend && npm run build

# Contract tests must pass
cargo test --manifest-path contract/Cargo.toml

# No secrets, .env files, or build artifacts in the diff
git diff --name-only HEAD~1
```

#### 7. Open a Pull Request

- Target the `main` branch
- Use a clear title following the commit convention (e.g. `feat: add IPFS photo upload`)
- In the description, include:
  - **What changed** and why
  - **How to test** it locally
  - Screenshots or transaction hashes if relevant
  - Any breaking changes or migration notes

### Reporting Issues

Open a [GitHub Issue](https://github.com/muhammedismail-thewebdeveloper/WasteNova/issues) with:

1. Clear title describing the problem
2. Steps to reproduce
3. Expected vs actual behaviour
4. Environment (browser, OS, Node version, network — testnet/mainnet)
5. Relevant contract ID or transaction hash if applicable

### Good First Issues

Look for issues tagged `good first issue` in the GitHub tracker. These are scoped, well-defined tasks that don't require deep knowledge of the whole codebase.

---

## License

MIT
