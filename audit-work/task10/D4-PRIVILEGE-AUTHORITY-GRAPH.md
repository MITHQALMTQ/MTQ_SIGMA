# MTQΣ — TASK 10 · D4: FUNCTION-LEVEL PRIVILEGE & AUTHORITY GRAPH

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
Fresh probes 2026-10-22: Monad block 73,167,496 · Arc block 68,475,006. Every cell below is an individual
read-only `eth_call` (or `eth_getStorageAt` where noted) — zero transactions. Raw: `evidence/raw-onchain.jsonl`.

---

## 1. Role matrix — current MTQ tokens (per role × account; TRUE = holds)

| Role | Account | Monad | Arc |
|---|---|---|---|
| DEFAULT_ADMIN | deployer EOA `0x3C39…d8c` | TRUE | TRUE |
| DEFAULT_ADMIN | Genesis Safe `0xE718…A7D0` | TRUE | **false** |
| DEFAULT_ADMIN | Governance `0xE35a…Bd66` | false | false |
| DEFAULT_ADMIN | Mint module | false | false |
| DEFAULT_ADMIN | Reserve module | false | false |
| DEFAULT_ADMIN | Redeem module | false | false |
| MINTER | deployer EOA | TRUE | TRUE |
| MINTER | Genesis Safe | TRUE | **false** |
| MINTER | Governance | false | false |
| MINTER | **Mint module** | **TRUE** (D1 wiring correction) | **TRUE** (D1 wiring correction) |
| MINTER | Reserve module | false | false |
| MINTER | **Redeem module** | **TRUE — ANOMALY** (redeemer can mint) | false |
| PAUSER | deployer EOA | TRUE | TRUE |
| PAUSER | Genesis Safe | TRUE | TRUE |
| PAUSER | Governance | false | false |

`getRoleAdmin(admin|minter|pauser)` = DEFAULT_ADMIN on **every** AC contract (both chains) → **the deployer
EOA can grant/revoke every role on every AC contract unilaterally — and so can anyone holding the exposed
C-045-a key.** `getRoleMemberCount` reverts everywhere (plain AccessControl, not enumerable — census is
probe-based only). Deployer holds DEFAULT_ADMIN on **all 7 AC modules on both chains** (14/14 re-verified);
deployer additionally holds MINTER on Mint module (both chains) and Reserve (Monad only).

**CORRECTION (CORR-1):** Task 9's report claimed "no module holds MINTER_ROLE on either token — architecture
NOT WIRED". Task 9's OWN inventory + raw evidence recorded Mint=TRUE on both chains (e.g. raw.jsonl
21:37:26.762Z: `hasRole(MINTER, 0x197e…)` → `0x…01` on Monad MTQ) and Monad Redeem=TRUE. This session's
re-probe is identical cell-for-cell → **no state change occurred; the Task 9 prose was a report error.**
The mint path IS wired: `caller → Mint.mint(address,uint256) → MTQ.mint(...)`. What remains missing is
**governance**: every gate on that path (module's own MINTER role, token's MINTER role, DEFAULT_ADMIN to
change either) is held by the single deployer EOA — and the Monad Redeem module can mint the token directly,
which no blueprint assigns.

## 2. Function-level privilege map (deployed selector evidence + role probes)

| Sensitive function (deployed surface) | Gated by | Who can call TODAY (evidence) | Mandated (blueprint) |
|---|---|---|---|
| `MTQ.mint(address,uint256)` (both chains) | MINTER_ROLE on MTQ | deployer EOA; Safe (Monad); **Mint module** (both chains); **Redeem module** (Monad) | Mint.sol via Safe-governed process |
| `Mint.mint(address,uint256)` (module) | module's MINTER_ROLE | deployer EOA (sole holder) → then calls MTQ.mint | committee-governed minter |
| `Redeem.redeem(uint256)` (both chains) | module roles | deployer EOA (admin); token-side transferFrom | Redemption flow |
| `MTQ.pause()/unpause()` | PAUSER_ROLE | deployer EOA; Safe (both chains) | emergency committee |
| `grantRole/revokeRole` on every AC contract | role's admin = DEFAULT_ADMIN | deployer EOA (all 7 modules ×2 chains + both tokens) | 4/7 Safe |
| `Mint.setReserve(address)` / `Reserve.removeReserve(bytes32,uint256)` | module ADMIN_ROLE (deployer sole holder) | deployer EOA | committee |
| Safe `execTransaction` | threshold=1, owners=[deployer] | **one signature (deployer EOA / C-045-a holder)** | 4/7 (OD-35) |
| Safe owner/threshold reconfiguration | Safe owner-management | deployer EOA | constituted committee |
| Governor `propose/queue/execute/cancel/relay` (both chains, different builds) | OZ Governor internal auth — **UNESTABLISHABLE without source**; votingDelay=1, quorumNumerator=1 probed | unknown; **treat as a live unassessed authority surface** | timelocked governance |
| Solana `mintTo` (current mint GAGRdrY6) | mintAuthority `DbFjz…QhXb3` (single key, NOT in repo) | that one key | multi-sig (Squads 2-of-3 drafted, unexecuted) |
| Solana mint 2EaK5c mintTo/freeze | mint+freeze authority **= 4saT… (C-045-b EXPOSED)** | **anyone with the exposed key** | decommission plan (K-4) |
| Upgrades | none — **no proxies anywhere** (only SafeProxy slot 0; EIP-1967 slots zero on all 18) | impossible in place; new deployments only | V3 plan pending |
| Burns | `transfer` to `0x…dEaD` (demonstrated) | any holder | Redeem flow |

## 3. Alternate authority paths (beyond the role table)

1. **Exposed-key path (C-045-a):** full estate control without any on-chain change — the key in git history
   is the deployer key itself (D1). No exploit needed: possession = admin.
2. **Redeem-module mint path (Monad):** Redeem.sol holds MINTER_ROLE on the token (anomaly) — a redemption
   contract that can inflate supply. Disposition required (N-02 re-scope).
3. **Governor `relay()/execute()` surface:** both Governors expose relay/execute/ERC-1271; their proposer/
   executor authorization cannot be assessed without source; their timelocks/parameters are unknown. Any
   canonical-address decision must treat the Governor pair as UNASSESSED until sources are published (N-01).
4. **Off-chain simulation layer:** the app's Pilot Command Center simulates mint/redeem; no on-chain caller
   (keeper) exists for any deployed contract (prior audits) — no hidden execution path found in evidence.
5. **Solana freeze path:** current mint has NO freeze authority (verified) ✓; the SUPERSEDED mint's freeze
   authority is the exposed 4saT key — freezing is possible against old-generation holders only.

## 4. Cross-chain permission differences (authoritative list, all fresh evidence)

| Dimension | Monad | Arc |
|---|---|---|
| Safe roles on MTQ | ADMIN+MINTER+PAUSER | PAUSER only |
| Redeem module MINTER on token | TRUE (anomaly) | false |
| Module bytecode | OZ-v4-era selector set (no custom-error selectors) | OZ-v5-era selector set (custom errors) |
| Governance bytecode at same hex | 25,819 B / 50 sels | 13,129 B / 74 sels |
| MTQ implementation | 6,681 B / 25 sels | 3,474 B / 37 sels |
| Supply | 310.949 | 1,000 |
| Deployer nonce | 103 | 92 |

## 5. Intended permission model (per approved specification) vs reality

Mandate: MINTER→Safe-governed Mint.sol; PAUSER→emergency committee; DEFAULT_ADMIN→governance 4/7 Safe;
genesis 1M→Genesis Safe; oracle/reserve configuration→committee. **Reality: every privileged gate — on both
chains, all 15 AC contracts, both Safes, and the Solana mints — resolves to the deployer EOA (or its exposed
key), except the unassessed Governor internals.** The permission model is therefore NOT instantiated as
specified; the wiring exists (Mint↔token) but is governed by a single, compromised-posture key. No
permission change is recommended for execution until K-1/K-2 (purge + rotation) and R-02 (Safe 4/7) are
approved — sequencing per D7.
