# MTQΣ Chain Devkit — Sovereign Devnet Integrator Reference

**Chain ID:** `mtq-devnet-1` · **Status:** REFERENCE DEVNET (testnet-only) · **Date:** 2026-11-05
**Scope:** Everything an external integrator needs to read state and submit signed transactions
to the MTQ Sigma Network sovereign devnet through the public HTTP API.

**Authority:** the running code is the single source of truth — `src/lib/chain/shared.ts`
(canonical tx bytes, param allowlist, monetary guard), `src/lib/chain/state.ts` (apply rules),
`src/lib/chain/rpc.ts` (route payloads). This doc is the dated human-readable baseline.
**Runnable reference:** `scripts/chain-devkit-example.ts` (golden loop over public HTTP only).

---

## 1. Honest scope (read first)

- **REFERENCE DEVNET · NOT DECENTRALIZED · NOT PRODUCTION-AUTHORIZED.** Four validator
  ENGINES with real ed25519 keys run the full signed BFT voting protocol inside one process
  (the web server). Blocks carry genuine +2/3-by-power quorum certificates; there are NO
  Byzantine fault tolerance guarantees against compromise of that process.
- **MTQΣ is NOT the gas token.** Fees are paid in **uMTQD**, a testnet-only credit with no
  value. **PMTQ** is a NON-CANONICAL pilot ledger mirror — canonical MTQΣ supply accounting
  stays in the monetary protocol engine.
- **No economic inventions.** Staking records bonding + voting power only — no rewards, no
  inflation, no slashing. Unbonding is a pure time-lock. All economics await the
  owner-approved Network Economics Specification.
- **Constitutional guard:** governance proposals touching MTQ monetary-registry territory
  are rejected at submission (`violatesMonetaryGuard`). Full disclosure: `GET /api/chain`
  → `honest` payload (rendered verbatim in the Network NOC section).

## 2. Identity & canonical bytes

| Item | Rule |
|---|---|
| Key scheme | ed25519 (RFC 8032) — sign with `@noble/curves` (the node verifies with the same library) |
| Address | `mtq1` + hex( `sha256(pubkey)[0:20]` ) — 44 chars (documented simplification vs bech32) |
| Canonical tx bytes | `JSON.stringify({ type, from, nonce, fee, payload })` — FIXED key order, **payload keys sorted**, no whitespace; the signature covers EXACTLY these UTF-8 bytes |
| Nonce | per-account strictly +1 (mempool admits ≤ +500 lookahead; consensus re-validates) |
| Fee | integer uMTQD ≥ `base_fee_u` param — charged even when the module rejects the tx |
| Amounts | integer micro-units (1e-6), no floats on-chain |

## 3. Public routes (all under the app origin; rate-limited per client IP)

| Route | Purpose |
|---|---|
| `GET /api/chain` | Summary: height, latest block + QC, validators, params, telemetry, uptime, honest payload |
| `GET /api/chain/blocks?page=&pageSize=` | Paginated blocks (pageSize 5–50, default 15) |
| `GET /api/chain/block?id=` | Block detail by height or `blk_…` hash (header, QC signers, tx receipts) |
| `GET /api/chain/tx?hash=` · `?from=` · `?recent=` | Tx receipts by hash / sender / recent feed — FAILED txs keep honest revert-style receipts |
| `GET /api/chain/account?a=` | Balances (`fee_u`, `pmtq_u`), nonce, bonded stakes, **unbonding queue + release countdowns**, validator role, recent txs |
| `GET /api/chain/validators` | Validator set + power + status + proposes-next |
| `GET /api/chain/mempool` | Advisory admission view |
| `GET /api/chain/gov` | Proposals + votes + params + gov events |
| `GET /api/chain/oracle` | On-chain oracle consensus view — published multi-family price records (status/value/family medians/spread), observation provenance, thresholds, verbatim honest disclosure (Task-43) |
| `POST /api/chain/submit` | Client-signed tx body `{ type, from, nonce, fee, payload, sig, pub_key }` — the server NEVER sees private keys |
| `POST /api/chain/faucet` | `{ address }` → 10,000 MTQD + 10 PMTQ (one drip per address, enforced on-chain) |

## 4. Transaction payloads (per type)

| Type | Payload fields | Notes |
|---|---|---|
| `send` | `to` (mtq1…), `asset` ("FEE" or "PMTQ"), `amount` (µ) | PMTQ moves are ledger-mirror transfers only |
| `validator_register` | `moniker` (3–40), `commission_bp` (0–2000), `self_stake` (≥ 10,000 µ), `pub_key` (must equal signer pubkey) | Registers as CANDIDATE — joins ACTIVE only via governance (V4 dynamic membership) |
| `delegate` | `validator` (address), `amount` (µ) | Bonded immediately; power recomputes end-of-block (0.1 MTQD = 1 power) |
| `undelegate` | `validator`, `amount` (µ) | Power drops NOW; funds enter the **unbonding queue** (`unbonding_s` param) and auto-release — no claim tx |
| `gov_submit` | `proposal_type` (text · network_param · validator_set_change), `title` (4–120), `description` (≤2000), `payload`, `deposit` (≥ 100,000 µ) | network_param keys allowlisted; monetary-registry territory rejected at submission |
| `gov_vote` | `proposal_id`, `option` ("YES" · "NO" · "ABSTAIN") | Power = floor(bonded/100,000) + ACTIVE-validator self power |
| `oracle_observe` | `symbol` (e.g. "XAU/USD"), `family` (3–24 chars `[a-z0-9-]`), `value_u` (integer µ) | ACTIVE-validator signers only; one per (observer, family, symbol) per block; aggregated end-of-block — see §5b |

## 5. Unbonding lifecycle (Task-41)

1. `undelegate` validates bonded amount → reduces stake rows / validator `delegated`
   (voting power drops at once).
2. Funds (or self-stake) enter the `unbondings` queue with `release_ms = now + unbonding_s·1000`.
   `unbonding_s = 0` (governance-set) releases immediately.
3. End-of-block processing credits every mature entry to the delegator's `fee_u` and emits a
   `staking.unbond_released` event — **no claim transaction is needed**.
4. `GET /api/chain/account?a=…` exposes `unbondings[]` with `release_in_ms` countdowns.

## 5b. Oracle consensus lifecycle (Task-43, §17.10 reference)

1. ACTIVE validators submit signed `oracle_observe` txs (per symbol + independent-family label).
2. End-of-block aggregation: latest observation per (observer, family, symbol) within the last
   6 blocks → **per-family median** → **cross-family median-of-medians**.
3. Publication gates (all fail-closed): ≥ 2 distinct independent families AND cross-family
   spread ≤ 200 bp AND freshness ≤ 6 blocks. Single-family or divergent data can NEVER move
   the on-chain price — the record is marked `STALE` / `DEGRADED_SPREAD` and the last published
   value is RETAINED (never zeroed).
4. Aggregation thresholds are CODE CONSTANTS (not network-governance params — oracle territory
   is constitutionally monetary-track; changes ship as code upgrades).
5. The reference devnet has NO automatic market feeds: values are operator-submitted test
   values arriving only as genuine signed validator transactions — the on-panel disclosure
   is verbatim. Production §17.10 = Chainlink/Pyth/Chronicle EVM adapters (Gate-C-gated).

## 6. Governance lifecycle

`VOTING` (voting_period_s) → quorum check (turnout > ⅓ of ACTIVE power) + strict majority of
turnout → `PASSED` → timelock (timelock_s) → `EXECUTED` (or `REJECTED` / `FAILED_EXECUTION`,
both honest). `validator_set_change` executes add (CANDIDATE→ACTIVE) / remove (→RETIRED) /
repower — the V4 dynamic-membership mechanism, demonstrated live by `scripts/chain-smoke.ts`.

## 7. Network parameters (governance-controllable allowlist)

`base_fee_u` · `max_block_txs` · `voting_period_s` · `timelock_s` · `heartbeat_ms` ·
`unbonding_s`. Defaults: 1000 µ · 200 · 60 s · 15 s · 5000 ms · 30 s. Anything resembling
MTQ monetary registry parameters is constitutionally out of bounds for network governance.

## 8. Minimal signing example

See the Developers section of the app for a formatted TypeScript + curl walkthrough, or
run the committed golden loop:

```bash
bun scripts/chain-devkit-example.ts   # keygen → faucet → send → delegate → undelegate → auto-release
```

Both use the exact canonical path the node verifies (`src/lib/chain/shared.ts`).
