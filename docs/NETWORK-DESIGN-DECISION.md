# MTQ Sigma Network — Network Design Decision Record
## NDD-1: Sovereign Devnet Reference Node (in-process, TypeScript)

**Status:** IMPLEMENTED (testnet reference layer) · **Date:** 2026-11-04 · **Owner:** Jozour LLC
**Deciders:** COO/CTO/PM (session mandate — Master Development Directive Part 2/Part 3)
**Scope:** Network infrastructure only. MTQ monetary governance untouched (Part 2 rules 1–4 preserved by construction).

---

## 1. Decision

The MTQ Sigma Network sovereign blockchain is implemented as an **in-process
TypeScript reference node** ("mtq-devnet-1") booting with the Next.js server
(`src/instrumentation.ts` → `src/lib/chain/node.ts`), with:

- **Real cryptography:** ed25519 (RFC 8032) via the audited `@noble/curves`
  — the same library the browser Wallet uses, one code path both sides.
- **Real signed transactions:** canonical byte encoding, per-account nonces,
  fees, deterministic application; failed txs carry honest FAILED receipts
  (EVM-revert semantics — never silently dropped).
- **Real BFT protocol logic:** four validator ENGINES, each with its own key,
  executing a CometBFT-style propose → prevote → precommit round over an
  in-process transport bus (35 ms simulated per-hop latency). Every vote is
  genuinely signed and genuinely verified by every receiving engine; every
  block carries a **+2/3-by-voting-power quorum certificate** (aggregate of
  signed precommits) and merkle/prev-hash/state-root/validators-hash header
  commitments.
- **Real governance with dynamic membership:** network-param proposals
  (strict allowlist), text proposals, and **validator_set_change proposals
  (add/remove/repower)** — the V4 dynamic-membership mechanism executed live
  on-chain after voting period + timelock (smoke-verified: CANDIDATE → ACTIVE
  via governance execution, scripts/chain-smoke.ts).
- **Deterministic, byte-reproducible genesis:** validator + faucet keys are
  derived from a committed PUBLIC seed (Cosmos tutorial-devnet practice);
  `config/chain-genesis.json` is committed and identical on every install.
- **Own store:** `db/chain.db` (SQLite via @libsql/client, raw SQL) —
  deliberately separate from the monetary pilot's Prisma store (layer
  separation, Part 2 rule 1).

## 2. Why not Cosmos SDK + CometBFT now (the honest deviation record)

The Master Development Directive Part 3.1 *prefers* Cosmos SDK + CometBFT +
Cosmos EVM. That remains the **production path**. It was not buildable inside
the current delivery environment for these measured reasons:

1. **No Go toolchain in the sandbox** (Bun/Node-only runtime).
2. **Background-process reaping:** the delivery sandbox terminates
   tool-call-spawned processes at call boundaries (verified: detached
   `setsid` processes die). A multi-node CometBFT network — or even a single
   persistent node as a separate service — cannot stay alive between
   operator actions. An **in-process** node that boots with the web server
   is the only topology that is actually live whenever the platform is.
3. **The directive itself ranks correctness above stack fidelity:** Part 19
   forbids fabricated claims and Part 2 rule 16 forbids unsubstantiated
   readiness claims. A TypeScript reference node honestly labeled beats an
   unbuildable aspirational stack or a faked "Cosmos" wrapper.

**Migration path (Phase 2+):** the tx/block/QC/validator/proposal data
model deliberately mirrors CometBFT concepts 1:1 (header, prev_hash,
txs_root merkle, +2/3 QC, voting power, round-robin proposer with round
rotation). Porting to a CometBFT app with the same store schema, or bridging
this ledger as a canonical genesis input, is mechanical. Gate: production
network launch requires the separately approved Network Economics
Specification (staking rewards, inflation, slashing parameters — NOT
invented here) plus independent audits (Part 10).

## 3. What this node is NOT (binding honesty disclosures)

Rendered verbatim by `/api/chain` → Network section (rpc.ts
`CHAIN_HONEST_STATUS`):

1. **NOT multi-host / multi-process:** the four engines share one process.
   BFT guarantees against compromise of THIS process do not exist (all keys
   co-located). Protocol-logic realism only.
2. **NOT decentralized:** single operator, single machine. No
   decentralization, uptime, or production-readiness claim may be derived.
3. **No economic inventions:** staking records bonding + voting power only.
   No rewards, no inflation, no slashing events (single-process mode) — all
   economics await the owner-approved Network Economics Specification.
4. **MTQΣ is not the gas token** (Part 3.3): fees are paid in **uMTQD**, a
   testnet-only credit with no value. **PMTQ** is a non-canonical pilot
   ledger mirror for transfer demos — canonical MTQΣ supply accounting
   stays in the monetary protocol engine.
5. **Constitutional guard enforced in code:** governance proposals touching
   MTQ monetary registry territory (weights, basket, reserve, haircut,
   oracle, MASE, MARP, supply, …) are REJECTED at submission
   (`violatesMonetaryGuard`). Network governance cannot acquire MTQ
   monetary-governance authority.

## 4. Two real bugs found & fixed during bring-up (kept as engineering record)

Both are single-process failure modes a genuine multi-process network
structurally cannot have — exactly why they are documented:

1. **Shared-state proposal claim:** the first engine to handle a proposal
   "claimed" it in the shared round state, silently suppressing the other
   engines' prevotes (prevote power stuck at 1/N). Fix: per-engine proposal
   dedup key (`EngineState.lastProposalKey`).
2. **Height-level settle deadline:** the round-settle deadline was captured
   once per height, so retry rounds 1+ skipped waiting entirely and every
   round failed. Fix: per-round deadline + proposer rotation by round.
   (Related: the settle-loop safety valve originally keyed on *emitted*
   precommits; it must key on *received* precommit messages — in-flight
   votes would otherwise end the wait before they could be counted.)

## 5. Asset & address conventions

| Item | Choice | Note |
|---|---|---|
| Fee asset | uMTQD (µ-units, integer) | testnet-only credit, no value |
| Mirror asset | uPMTQ | non-canonical pilot ledger mirror |
| Addresses | `mtq1` + hex(sha256(pubkey)[0:20]) | documented simplification vs bech32 |
| Amounts | integer micro-units (< 2^53) | no floats on-chain |
| Nonces | strictly +1 per account | mempool admits ≤ +500 lookahead |
| Fees | min `base_fee_u` (governance param) | charged even on module failure |
| State root | flat sha256 over canonical full state | simplification vs merkle-trie — still a complete, deterministic commitment; `state_root` commits the state as of BEFORE the block (documented) |
| Block cadence | heartbeat 5 s (param) or promptly on ready txs | empty blocks honest |

## 6. Verification evidence

- `scripts/chain-smoke.ts` (committed): heartbeat blocks with 40/40 QC
  (~150 ms rounds) · signed send tx → state · faucet drip via real
  consensus tx · validator registration → CANDIDATE · gov submit → 3 votes
  → PASSED → timelock → **EXECUTED (validator_set_change: CANDIDATE →
  ACTIVE)** · state root advancing. Exit 0.
- HTTP E2E: `/api/chain` family (summary/blocks/block/tx/account/
  validators/mempool/gov) + POST faucet + POST client-signed submit →
  on-chain receipt — all 200 with honest payloads (a PMTQ send with zero
  balance returns a FAILED receipt, exactly as designed).
- Dev server boots the chain via instrumentation (`[chain] MTQΣ devnet
  node up` in dev.log); chain survives HMR via the globalThis guard.

## 7. Deployment inventory (this layer)

| Item | Value |
|---|---|
| Chain ID | `mtq-devnet-1` |
| Genesis | `config/chain-genesis.json` (committed, deterministic) |
| Validators | 4 × 10 power (deterministic public devnet keys) |
| Quorum | > 2/3 by power (3 of 4 engines) |
| Store | `db/chain.db` (gitignored, per-install state) |
| APIs | `/api/chain`, `/api/chain/{blocks,block,tx,account,validators,mempool,gov,submit,faucet}` |
| UI | Network NOC · Explorer · Wallet · Staking & Governance sections |
| Production authorization | **FALSE** — unchanged; the 11 MTQ validation gates bind (Part 15 Phase 8) |
