# MTQΣ — TASK 11 · D8: POST-REMEDIATION VERIFICATION (exact tests; run before any "contained" claim)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Purpose: after the owner executes the approved D5 register, these are the **exact,
reproducible tests** that demonstrate (1) key removal, (2) correct destination authority,
(3) custody reconciliation, and (4) safe operating posture. Executed by the **Independent
Reviewer** (not the migration executor) with fresh RPC anchors, hashed transport, and
failure classification (a failed query = UNVERIFIED, never a negative). **All tests must
be green before any "contained / rotated / revoked" language is used anywhere.**

Re-runnable tooling already in place (read-only): `verify-evm.ts`, `verify-solana.ts`,
`forensics-census-task11.ts`, `hash-anchors.ts`, `probe-safe-singleton.ts` — same
conventions as the fresh baseline recorded in this package.

---

## 1. Repository / source-history tests (key removal from surfaces this machine controls)

| # | Test | Command (reproducible) | Pass criterion |
|---|---|---|---|
| R-1 | Worktree census | `bun audit-work/task11/forensics-census-task11.ts` | worktree EVM hits = 0, SOL hits = 0 (vs baseline 2 + 6); redaction notice present in worklog; no new hex64/hex128 classified as key material |
| R-2 | Git history scan | `git log --all -S'<fingerprint-independent check>'` per rewritten history; per-commit `git grep -F -f -` (stdin) for both literals | 0 commits contain either literal; commit count reconciled with the rewrite log |
| R-3 | Fresh-clone scan | clone the rewritten repo (or the remote if one exists post-CKPT-1) to a clean directory; re-run census script against it | 0 hits in clone |
| R-4 | Credential-rotation evidence (if CKPT-1=Y) | owner-provided rotation log | every named credential (TURSO×2, FRED, DISCORD, KEEPER, platform PATs) marked rotated with dates |
| R-5 | No-new-secrets guard | rerun census in --paranoid mode: scan for ANY new 64/128-hex literals vs the Task 10/11 classified baseline | only allow-listed public constants (OZ role hashes) present |

## 2. EVM authority-migration tests (per chain — Monad and Arc; run cell-by-cell)

| # | Test | Method | Pass criterion (post-state) |
|---|---|---|---|
| E-1 | Exposed deployer EOA stripped | `hasRole(admin/minter/pauser, 0x3C39…d8c)` on MTQ + `hasRole(ADMIN, 0x3C39…d8c)` on all 7 modules — 15 cells ×2 chains | **FALSE in all 30 cells** (baseline: TRUE in 15+15 minus Arc-token nuances) |
| E-2 | Deployer activity freeze | `eth_getTransactionCount(0x3C39…d8c)` vs pre-migration recorded nonce | equals the migration's own final count; **no further increments** across a reviewer-chosen observation window |
| E-3 | Old Genesis Safes inert | `hasRole(×3, 0xE718…A7D0)` on both MTQs; `nonce()`, `getOwners()`, native+token balances | roles all FALSE (baseline: Monad ×3 TRUE, Arc PAUSER TRUE); nonce per execution log; balances per CKPT-7 decision |
| E-4 | **Safe-B destination verified** | dossier: `getThreshold()==4` · `getOwners()==⟨the 7 declared⟩` · `VERSION()=="1.4.1"` · singleton slot == `0x29fcB43b…C762` with runtime keccak == `0xb1f926978a0f44a2…9894f81ff` (mainnet-anchored) · modules empty (or declared) · guard/fallback slots per policy · `nonce()` == expected post-quorum-proof count | every cell matches the CKPT-4 declared values EXACTLY |
| E-5 | Safe-B holds the authority | `hasRole(admin/minter/pauser, ⟨SAFE-B⟩)` on both MTQs; `hasRole(ADMIN, ⟨SAFE-B⟩)` on all modules; `hasRole(MINTER, ⟨SAFE-B⟩)` on Mint modules (± Reserve per ECON-DEC-2) | TRUE in exactly the approved grant set — **no extra roles anywhere** |
| E-6 | Redeem anomaly closed | `hasRole(MINTER, 0x9632…35a4)` on Monad MTQ | FALSE (baseline TRUE-dormant) |
| E-7 | Wired mint path still governed | `hasRole(MINTER, Mint-module)` on both MTQs; probe `Mint.mint` view surface | exactly per approved model (module keeps token-MINTER; module-MINTER per grant set) |
| E-8 | No proxies appeared | EIP-1967 impl/admin/beacon slots on all 18 contracts | all zero (no upgrade paths introduced) |
| E-9 | Code identity unchanged | `hash-anchors.ts` re-run | every runtime keccak identical to `identity-anchors-task11.json` EXCEPT any contract the owner deliberately redeployed (documented list) |
| E-10 | Supply/holder reconciliation | totalSupply + balanceOf census (deployer, Safes, modules, DEAD, self) | supplies == pre-migration values (rotation must NOT change supply); holder deltas exactly match the CKPT-7 evacuation decisions; arithmetic closes to the wei |
| E-11 | Allowances | 36-cell allowance census re-run | no unexplained allowances; evacuation-created approvals (if any) zeroed after use |
| E-12 | Governor untouched-but-acknowledged | re-probe governor params; confirm NO interaction occurred | params unchanged; residual-risk line in the report (unassessed until N-01) |
| E-13 | RH chain disposition | re-probe RH balances/natives | matches CKPT-7 decision (evacuated or accepted-in-place, documented) |
| E-14 | Native balances | `eth_getBalance` deployer/Safe-B per chain | deployer natives per decision; Safe-B funded for ops; no native left at exposed key beyond declared dust |
| E-15 **[C11.1-02 — added by Task 11.1]** | Module-side custom `ADMIN_ROLE` membership (`0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775`) — gates `setReserve/setAlgorithm` on both Redeem modules (never probed by Tasks 9–11) | `hasRole(custom ADMIN_ROLE, x)` census / enumerable-set read if the build permits enumeration | membership enumerated or attested by the migration report — **no unknown holders of a role that can re-point the Redeem modules' stored references** (re-pointing cannot create a mint path — C11.1-02 — but must be bookkept) |
| E-16 **[C11.1-02 — added by Task 11.1]** | Redeem-side custom role membership (`0xf65a18a7fc1e205f382482ab099efa145b9dcdeb4e6b508f0e02d9660f027fdc`) — gates `redeem(uint256)` on both Redeem modules (never probed) | same method as E-15 | membership enumerated or attested; if the migration revokes/normalizes module roles per the grant set, post-state matches the approved set exactly |
| E-17 **[C11.1-02 — added by Task 11.1]** | Code identity unchanged by the migration | re-run `redeem-module-forensics.ts` (read-only) | every anchor, call-site enumeration, and dispatch table reproduces byte-exactly vs `evidence/redeem-module-forensics-task111.json` — rotation must not have side-effects on code identity |

## 3. Solana tests

| # | Test | Method | Pass criterion |
|---|---|---|---|
| S-1 | Exposed wallet drained | `getBalance(4saT)` | ≈ 0 (fee dust only); **no new signatures** for 4saT beyond the recorded settlement txs; signature count frozen at baseline+executed set |
| S-2 | Superseded mint authority dead | `getAccountInfo(2EaK5cQt…, jsonParsed)` | `mintAuthority == null` AND `freezeAuthority == null` (per S-5/S-7) — or multisig address per CKPT-8, exactly as recorded |
| S-3 | Current mint authority per decision | `getAccountInfo(GAGRdrY6…, jsonParsed)` | equals the SOL-DEC-1 choice (⟨SQUADS-MSIG⟩ / null / unchanged-with-acceptance); decimals unchanged unless S-4 executed (then new mint, this one annotated) |
| S-4 | Supply unchanged by settlement | `getTokenSupply` both mints | settlement must NOT change supplies (authority changes move no tokens) |
| S-5 | ATA/delegate audit | `getTokenAccountsByOwner` both wallets | 4saT ATA remains but is authority-dead + balance-per-decision; no delegates/close-authorities appeared (baseline: none) |
| S-6 | Squads dossier (if S-1/S-6 route) | owner-verified program ID + `getAccountInfo` multisig layout | members/threshold exactly as provisioned; ≥1 executed tx evidenced; program ID matches the owner's documentation source (this package asserts NONE) |

## 4. Custody reconciliation (the closure statement, only after all above)

1. Re-run the supply/holder census on all four chains: balances-to-supply must close to
   the wei / to the raw unit.
2. Map every live balance to a **named custody destination** (Safe-B chain-matched,
   multisig, or owner-accepted residual) — no "unknown" rows allowed in the closure report.
3. Confirm no custody claim depends on the exposed keys anywhere (probe-backed, not
   asserted): the E-1/E-3/E-6 cells are the proof.
4. Reconcile against the mandate: rotation does NOT close C-043/C-046/C-047 (genesis
   custody) — those remain open items under DEC-5 and must not be claimed closed by the
   rotation report.

## 5. Operating-posture tests (the system must not have drifted into activity)

| # | Test | Pass criterion |
|---|---|---|
| O-1 | Keeper still inert; economic eligibility still disabled; shadow-mode banners intact (app surfaces unchanged by the migration — D5 §5 rule 5 forbids bundling) |
| O-2 | `dev.log` clean of errors introduced by any migration tooling run in the repo (none should have been) |
| O-3 | Release gates unchanged until CKPT-10 processes run (D9 remains the gate authority) |
| O-4 | No transaction in any execution log was signed inside this repo/sandbox/AI environment (attestation + tooling audit) |

## 6. Reporting discipline

The Independent Reviewer's report must state, per the Task 11 completion rule: what was
verified, what could not be verified (with method), what failed-and-was-retried, the
observation window used for E-2/S-1 freeze checks, and the explicit verdict per test.
Until every test passes: the keys are **not** contained, the estate is **not** rotated,
and D9's overall status remains **NOT ACCEPTED**.
