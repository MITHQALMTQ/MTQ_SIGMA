# Phase 0 — Contract & Governance Assessment

## 1. Contract estate table (roles → authority)

| Contract | Authority model | Mint/burn guards | Emergency powers | Upgrade | Deployed |
|---|---|---|---|---|---|
| MTQSigma.sol (v1.2) | `onlyOwner` (deployer EOA) | user mint under state machine + owner-set FX; genesisMint one-shot owner; NAV-based redeem | setMintPaused / setProtocolStatus (owner, no timelock) | none (immutable; UPGRADEABILITY.md Option A) | **YES — Monad 10143 `0x5D95…fd4a`, Arc 5042002 `0x826b…63c1`, Robinhood `0xA3B8…4EF0`** |
| MtqEcosystem.sol (9) | every constructor grants ALL roles to msg.sender (mock-class) | MTQToken.mint onlyRole(MINTER)=deployer | pauser roles | none | YES (both chains); "Safe" entries verified NOT Safes (0/7 interface reads) |
| MTQSigmaV2.sol | AccessControl + 4 councils + Listing-14 parameter registry w/ 4 timelocks | throttle+oracle gate; NAV redeem; caps | councils (with DEFAULT_ADMIN bypass) | none (migration) | NO — PENDING (Arc), blocked on fresh funded deployer key |
| MTQSigmaV3.sol | 7 roles incl. KEEPER + MONETARY_CONTROL + councils (DEFAULT_ADMIN bypass each) | BM-01..16 sequential workflow; executeMint onlyKeeper; $500K/tx; DMCE; daily caps; oracle-healthy gates | emergency council (design) | none | NO — prototype; size conflict on record (40,411B vs 24,314B records) |
| MTQSigmaV4.sol | flattened roles + MTQ_GOVERNANCE + MTQ_EMERGENCY (2-of-3 off-chain property) | registry-only ("not a token"); N_max two-step timelock | emergency role | clean-slate | NO — reference only |
| adapters/* | feed roles only | n/a | n/a | n/a | NO (compiled artifacts) |

## 2. Governance reality (constitutional requirement vs enforcement)

| Governance object | Constitutional claim | Enforcement reality |
|---|---|---|
| 4 councils (7/7 · 51% · 4/7 · 4/7 with 90d/48h/24h/instant) | blueprint.ts:392-418 | TS metadata only; live contracts have ZERO councils; undeployed V2/V3 embed DEFAULT_ADMIN bypass + councils-at-address(0) constructor grants → **deployer is all councils** [F-0-P1-03] |
| Parameter registry (~30 params with envelopes) | blueprint.ts:425-469 | enforced nowhere at runtime; v1.2 owner changes FX/status/pause/vault unilaterally |
| Genesis Safe as constitutional anchor | mandated 4/7 | live Safe is **1/1, sole owner = deployer EOA, nonce 0, no modules/guard** (verified on-chain 2026-10-19; OD-35 VERIFIED-FAILED) |
| Devnet governance | network-mechanics democracy | RUNNING (real signed proposals/votes; turnout>1/3 majority — weaker than blueprint's >2/3; **monetary territory constitutionally firewalled** (21-pattern guard) — genuine, code-verified) |
| Emergency powers | narrowly scoped council action | today: unlimited single-key setProtocolStatus/setMintPaused (v1.2) — the §10 violation pattern (pause authority is also full monetary authority via same key) |

## 3. Prior contract-audit posture (DELIVERABLE-H, 2026-09-08)

AUDIT-B: 30 findings → 26 fixed in V3 source, 4 accepted/documented (L1, L3, L6, I3), 0 unfixed — **BUT the document itself states Part 2 was written against the V3 SPEC before source was committed and "should be re-verified line-by-line when committed"**; no independent audit firm engaged (Gate 1 open). Status: remediation CLAIMED with TS-level test evidence; independent verification NOT PRESENT. (§0.4 discipline applied: an audit report does not establish remediation.)

## 4. Invariant mapping readiness (§12 pre-work)

Monetary invariants identified in code (engine.ts §3.5 price band; §11.5.2/§11.7 turnover truncation; §13.4.3 LCR pause; §17.7 oracle gates; §19.4.1 slippage; §21.3 minting throttle; finality L1..L7; three-book/PBC anti-commingling designs; issuance INV-A payment-never-mints). These are the Phase-4 invariant-register seeds: each must gain (a) all privileged paths that can affect it, (b) bypass-possibility analysis, (c) negative adversarial tests, (d) runtime monitoring hooks. Today: (a) is documented in this baseline (single key / unauth POST), (b)-(d) NOT PRESENT.

## 5. Verdict

The on-chain layer is **live, simple, and single-keyed**; the constitutional layer is **undeployed and inverted-by-construction** (bypass modifiers, address(0) councils). The genuine bright spot is the devnet's monetary-guard firewall (network governance structurally cannot touch monetary parameters) plus immutable contracts (no upgrade authority to steal). The constitutional promise currently rests on the honesty of one compromised-class key — i.e., on F-0-P0-01's remediation.
