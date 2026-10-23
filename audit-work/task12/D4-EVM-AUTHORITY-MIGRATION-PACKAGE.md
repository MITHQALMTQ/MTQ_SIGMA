# MTQΣ — TASK 12 · D4: EVM AUTHORITY-MIGRATION PACKAGE (UNSIGNED — EXECUTION-BLOCKED)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Every step below is PROPOSED — NOT SIGNED — NOT BROADCAST — NOT EXECUTED.**
No EVM transaction of any kind was made during Task 12. This package supersedes
nothing in Task 11 D3/D5 — it carries them forward with FRESH evidence anchors
and adds the Task-12-verified preconditions. Execution requires the D8
approvals; the exposed key, if ever used, is loaded ONLY in an owner-controlled
session, never in this repository or any AI environment.

---

## 0. Fresh evidence base (read-only, hashed; Task 12 probe)

| Chain | Anchor | Source |
|---|---|---|
| Monad testnet 10143 | **block 73,243,944** | `audit-work/task12/evidence/fresh-anchors-task12.json` (eth_call/eth_getBalance, public addresses only) |
| Arc testnet 5042002 | **block 68,520,264** | same |
| Robinhood Chain 46630 | **block 140,748,341** (RPC alive; deployer txCount 60, native 0.00982 ETH) | same |

**Stability finding:** every probed cell is IDENTICAL to the Task 11 evidence
(role matrices, Safe dossiers, supplies, balances). No attacker action was
observed between the audits. All statements below are "verified at the
recorded block, for the queried addresses and methods" — no broader claim.

Role hashes (public OZ constants): DEFAULT_ADMIN `0x0000…0000` · MINTER
`0x9f2df0fe…956a6` · PAUSER `0x65d7a28e…862a`.

---

## 1. Authority inventory — everything that must change (per-chain, current → destination)

### 1.1 Monad testnet 10143 (fresh @ 73,243,944)

| Surface | Current holder(s) — fresh | Proposed destination |
|---|---|---|
| MTQ `0x9e6E…53aD` — ADMIN | deployer EOA · Genesis Safe `0xE718…A7D0` (both true) | **Safe-B(Monad)** (new 4-of-7) |
| MTQ — MINTER | deployer · Genesis Safe · **Mint module** · **Redeem module** (dormant grant, Task 11.1 call-graph finding) | Safe-B + governed Mint module only; **Redeem-module grant REVOKE (T-3.1)** |
| MTQ — PAUSER | deployer · Genesis Safe | Safe-B + owner emergency policy |
| MTQ supply / custody | 310.949 total; deployer holds 309.948999999999999997; Safe holds 0; paused=false | evacuation decision T-3.8 |
| 6 modules (Mint `0x197e…0809`, Redeem `0x9632…35a4`, Reserve `0x1bbC…6177`, Algorithm `0x8839…0CB2`, Oracle `0xDfcA…B713`, Takaful `0x3eC2…02f19`) — module DEFAULT_ADMIN | **deployer (all 6 true, fresh)** | Safe-B(Monad) |
| Mint module MINTER (the wired mint path) | deployer (module-side role, unchanged) + token-side MINTER | Safe-B; module-MINTER policy = owner decision (OPS-DEC-1) |
| Reserve module MINTER (Monad only) | deployer | grant-to-Safe-B only if Reserve is intended to mint (ECON-DEC-2) |
| Genesis Safe `0xE718…A7D0` | **1/1, sole owner = deployer, nonce 0, v1.4.1** (fresh) | strip all token roles (T-3.2); decommission-or-provenance (owner) |
| Governance `0xE35a…Bd66` (25,819 B, 50 sels) | **proposer/executor authority UNESTABLISHABLE without source (N-01)** | **NO INTERACTION — not even renouncing** (unknown behavior could brick or trigger); publish source → audit first |
| Deployer native | 0.224343224122819642 MON | evacuation per T-3.8 |

### 1.2 Arc testnet 5042002 (fresh @ 68,520,264)

Same structure; differences: Genesis Safe holds **PAUSER ONLY** (asymmetry —
normalize per owner decision); Redeem module holds NO token roles (record
correction PI-11.1-d retained); deployer holds 998.999999999999999997 MTQ +
19.026597151851474173 native; supply 1,000; Governance same hex, different
build (13,129 B / 74 sels) — same N-01 no-interaction rule.

### 1.3 Robinhood Chain 46630 (provenance tier — disposition, not rotation)

| Surface | Fresh | Proposed |
|---|---|---|
| MTQToken `0xAF5B…C5A5` (gen-B twin) | deployer ≈ sole holder (Task 11 figures, unchanged family) | include in T-3.8 evacuation decision; canonical disposition per D6 |
| "MTQSigma" `0xA3B8…44EF0` (gen-A twin, Ownable) | owner = deployer; self-custody genesis | **transferOwnership(⟨dest⟩)** or accept-provenance per D6 |
| "Safe" `0xa3CE…5691` | 3,321 B, REVERTS on Safe ABI calls — NOT a Safe (re-proven Task 10/11) | annotate; never treat as custody |
| Deployer EOA | txCount 60, native 0.0098211602 ETH | evacuate if owner wants; no roles to migrate |

### 1.4 Generations (both chains — facts that survive rotation)

gen-A family (Monad `0x5D95…`, Arc gen-C `0x5C72…`, RH `0xA3B8…`, Arc genA
`0x826b…`): **Ownable, owner = deployer**, self-custodied 1,000,000 genesis
each, `genesisMint` owner-gated — **the EOA key rotation does NOT remove these
`owner()` powers; each gen-A token needs its own transferOwnership or an
explicit accept-provenance decision (D6/T-3.8)**. gen-B family (Monad
`0x0Ac2…` / Arc `0x2420…` / RH `0xAF5B…`): AccessControl, deployer ≈ sole
holder.

## 2. Destination governance — "Safe-B" per chain (4-of-7; NO invented identities)

- New Safe (SafeProxyFactory `createProxyWithNonce`, singleton `0x29fcB43b…C762`
  = canonical SafeL2 v1.4.1, byte-identical Monad=Arc=Ethereum mainnet per Task
  11 identity anchors), threshold **4 of 7** owners `⟨OWNER-1…7⟩`.
- **The 7 signer addresses DO NOT EXIST YET and are not invented here.** They
  are generated in a human-controlled ceremony OUTSIDE this repository/sandbox/
  any AI environment (hardware/air-gapped; material never transits the repo —
  the hardened `scripts/generate-new-evm-key.mjs` pattern applies owner-side).
  Independence (7 distinct custodians), custody documentation, and recovery
  arrangements per Task 11 D3 §3; quorum-loss (3 simultaneous) freeze risk is
  documented and owner-accepted BEFORE T-1.2.
- **Hard gate T-1.4 (before ANY estate change):** on-chain dossier check
  (`getOwners()==⟨OWNER-1..7⟩`, `getThreshold()==4`, `nonce()==0`,
  `VERSION()=="1.4.1"`, singleton slot == canonical keccak anchor, modules
  empty, guard/fallback per policy) + one 4-signature low-risk `execTransaction`
  (e.g. `VERSION()` view call) — proving the quorum works end-to-end while the
  deployer still holds admin.
- The current 1/1 Safes are NOT acceptable destinations (sole owner = the
  compromised EOA) and are NOT reused as Safe-B.

## 3. Unsigned transaction sequence (chain-by-chain; calldata in reviewable form)

Convention: `grantRole(bytes32 role, address account)` /
`revokeRole(bytes32 role, address account)` @ target; exact byte-encoding
produced owner-side at execution time and re-verified against these arguments
before signing. Verify-after-every-step (postcondition probes listed) — a
failed probe HALTS the sequence.

### Phase 1 — destination provisioning (no estate change; zero blast radius)

| ID | Action | Signer | Postcondition |
|---|---|---|---|
| T-1.1 | Provision 7 signers `⟨OWNER-1..7⟩` (human ceremony; private register; independence + custody + recovery docs) | n/a | 7 addresses recorded owner-side |
| T-1.2 | Deploy Safe-B(Monad): `createProxyWithNonce(0x29fcB43b…C762, salt)` @ `⟨FACTORY⟩` then `setup([⟨OWNER-1..7⟩], 4, 0, 0x, ⟨FALLBACK-POLICY⟩, 0, 0, 0)` | ⟨NEW-ROTATION-EOA⟩ (owner-side, funded) | dossier checks pass |
| T-1.3 | Deploy Safe-B(Arc) — same | ⟨NEW-ROTATION-EOA⟩ | dossier checks pass |
| T-1.4 | **QUORUM PROOF (hard gate)** — 4-sig no-op execTransaction on each Safe-B | 4 of ⟨OWNER-1..7⟩ | nonce increments; event proves 4-sig execution; only then Phase 2 opens |
| T-1.5 | (OPTIONAL, owner decision) pause-window policy for the handover | disclosed tradeoff | both tokens paused for the window; Safe-B unpauses after T-3.6/7 |

### Phase 2 — grants (grant-before-revoke; the UNAVOIDABLE handover window, §4)

All by the EXPOSED KEY in an owner-controlled session; precondition T-1.4
passed; each postcondition probe-verified before the next row.

| ID | Calls (reviewable form) | Chain |
|---|---|---|
| T-2.1 | @ Monad MTQ: `grantRole(ADMIN, ⟨SAFE-B_M⟩)` · `grantRole(MINTER, ⟨SAFE-B_M⟩)` · `grantRole(PAUSER, ⟨SAFE-B_M⟩)` (3 tx) | Monad |
| T-2.2 | @ each of the 6 Monad modules: `grantRole(ADMIN, ⟨SAFE-B_M⟩)` (6 tx) | Monad |
| T-2.3 | @ Monad Mint module: `grantRole(MINTER, ⟨SAFE-B_M⟩)` | Monad |
| T-2.4 | **CONDITIONAL (ECON-DEC-2):** @ Monad Reserve module: `grantRole(MINTER, ⟨SAFE-B_M⟩)` — only if Reserve is intended to mint | Monad |
| T-2.5 | @ Arc MTQ: ×3 grantRole(ADMIN/MINTER/PAUSER, ⟨SAFE-B_A⟩) (3 tx) | Arc |
| T-2.6 | @ each of the 6 Arc modules: `grantRole(ADMIN, ⟨SAFE-B_A⟩)` (6 tx) | Arc |
| T-2.7 | @ Arc Mint module: `grantRole(MINTER, ⟨SAFE-B_A⟩)` | Arc |

**Invariant after Phase 2:** every surface has ≥2 admins (exposed key +
Safe-B). A failure between steps leaves the estate admin-REDUNDANT (safe),
never admin-less.

### Phase 3 — revocations + evacuation (executed by Safe-B 4-of-7; the actual de-exposure)

| ID | Calls | Chain | Depends |
|---|---|---|---|
| T-3.1 | @ Monad MTQ: `revokeRole(MINTER, 0x9632…35a4)` — **the dormant Redeem-module grant (hygiene; call-graph finding retained open at the grant-origin question)** | Monad | T-2.1 |
| T-3.2 | @ Monad MTQ: `revokeRole(ADMIN, 0xE718…A7D0)` + `revokeRole(MINTER, …)` + `revokeRole(PAUSER, …)` — strip the old 1/1 Safe | Monad | T-2.1 |
| T-3.3 | @ Arc MTQ: `revokeRole(PAUSER, 0xE718…A7D0)` | Arc | T-2.5 |
| T-3.4 | @ 6 Monad modules: `revokeRole(ADMIN, 0x3C39…d8c)` | Monad | T-2.2 verified |
| T-3.5 | @ 6 Arc modules: `revokeRole(ADMIN, 0x3C39…d8c)` | Arc | T-2.6 verified |
| **T-3.6** | **LAST ON MONAD:** @ Monad MTQ: `revokeRole(ADMIN, 0x3C39…d8c)` + `revokeRole(MINTER, …)` + `revokeRole(PAUSER, …)` — **the de-exposure moment; irreversible by design** | Monad | T-3.1–3.4 all verified |
| **T-3.7** | **LAST ON ARC:** same ×3 @ Arc MTQ | Arc | T-3.5 |
| T-3.8 | **Evacuation (owner decision on destinations):** Monad 309.948999999999999997 MTQ + 0.2243 MON · Arc 998.999…997 MTQ + 19.0266 native · RH gen-B holdings + 0.00982 native · gen-A family: `transferOwnership(⟨dest⟩)` or accept-provenance | all 3 | T-3.6/7 + destination probe-verification before EACH transfer |

Failure modes: grant/role reverts → no state change, retry (estate stays
admin-redundant); wrong evacuation destination → **irreversible** (destination
probe-verified first); pause forgotten → Safe-B holds PAUSER post-grant and
can unpause. Costs: testnet gas only (requires small native balances on the
signing EOAs — faucet-funded).

## 4. The unavoidable handover window (risk disclosed, no mitigation exists)

Only the current admin (the compromised key) can create its successor. Between
T-1.2/T-1.3 (Safe-B deployed) and T-3.6/T-3.7 (deployer stripped), **the
compromised key remains fully privileged and could race the migration.**
Owner's options (imperfect): (a) tight batch execution of Phase 2→3 per chain;
(b) pause-window T-1.5 (blocks transfers; also blocks the pilot; needs the
exposed key); (c) accept the window — testnet-only, financially negligible,
substantive risk = "unknown attacker becomes admin", recoverable only by
repeating migration from a fresh clean key (which is why T-1.4 verification
precedes everything). **No sequence is risk-free; do not represent any as such.**

## 5. Remaining pathways that BYPASS this control (explicitly NOT closed by this package)

1. **Governor pair** (same hex, two builds) — proposer/executor auth
   UNESTABLISHABLE without source; no interaction planned. Residual risk until
   N-01 (source publication + audit).
2. **Module-side custom roles** — Redeem module custom `ADMIN_ROLE
   (0xa4980720…1775)` and redeem-role `(0xf65a18a7…7fdc)` memberships remain
   UNPROBED (Task 11.1 D8 cells E-15/E-16) — close via the independent
   verification plan (D9) before/with execution.
3. **gen-A Ownable tokens** — `owner()` = deployer persists past EOA-role
   revocation; closed only by per-token transferOwnership / accept-provenance
   (T-3.8).
4. **Deployer-held balances** — value reachable by the exposed key until
   evacuation executes.
5. **The exposed key itself** — remains able to SIGN; revocation removes its
   AUTHORITY, not its ability. Any address it still controls post-migration
   (none, if T-3.8 completes) is the residual.
6. **New-owner compromise** — Safe-B security rests on the signer ceremony
   quality (§2), not on this document.

## 6. What prevents full specificity today (honest blocker list)

| Missing input | Blocks | Owner action |
|---|---|---|
| `⟨OWNER-1…7⟩` addresses | T-1.2/T-1.3 exact setup args | signer ceremony (CKPT-3/4) |
| `⟨FACTORY⟩` address choice + `⟨FALLBACK-POLICY⟩` | exact T-1.2/T-1.3 calldata | owner + security lead select the official SafeProxyFactory deployment per chain and the fallback-handler policy |
| ECON-DEC-2 (Reserve minting intent) | T-2.4 inclusion/exclusion | economic authority |
| Evacuation destinations | T-3.8 exact transfers | owner decision per row |
| N-01 Governor sources | §5.1 residual closure | owner publishes sources |
| OPS-DEC-1 (operational mint key policy) | module-MINTER end-state | owner/committee |

## 7. Approval checkpoints (D8 extracts — full list there)

CKPT-3/4 signer provisioning plan → CKPT-5/6 Safe-B dossier + grant-set
approval → CKPT-7 revoke-set + evacuation destinations → independent
verification (D9) BEFORE any "contained/rotated/revoked" language. **Every
execution stage requires its explicit human approval; a general instruction to
"continue" authorizes none of them.**

**No EVM transaction may be signed, broadcast, or executed under Task 12.
Release status: NOT ACCEPTED.**
