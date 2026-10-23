# MANDATE-COMPLIANCE.md — MTQΣ Consolidated Compliance Report

| Field | Value |
|---|---|
| Implements | MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006 (v5.0) + EXT-1 (v5.1) + EXT-2 (v5.2) + EXT-3 (v5.3) |
| Status | **TESTNET-ONLY. Production NOT authorized.** No statement in this report claims production readiness (v5.0 §11.5 wording prohibitions apply) |
| Machine register | `src/lib/mtq/mandate-register.ts` (OD-1…OD-38, C-001…C-040, T-01…T-88) — consumed by `/api/mandate` and the Pilot Command Center Validation section |
| Label discipline | implemented / unit-tested / shadow-observed / not-demonstrated / OPEN / pending-approval — statuses are NOT interchangeable (v5.0 Part 10.2) |
| Companion documents | ROLE_ROTATION.md (v5.0 §5.2, Ext-3 A.5), UPGRADEABILITY.md (Ext-1 E.3, OD-16), SECURITY.md (Ext-3 A.8, OD-38) |

---

## 1. Authorization status (verbatim, v5.0 §11.2)

- Testnet development and testing: authorized.
- Existing deployment correctness: requires verification.
- P0 correction closure: not demonstrated until source and test evidence are supplied.
- Objective function and threshold policy: require Committee approval.
- Shadow-mode acceptance: not established.
- Live reserve pilot: not authorized.
- Production reserve trading: not authorized.
- Production Solana or multichain expansion: not authorized.

## 2. Implementation map (mandate item → code location)

Line numbers refer to the current `src/lib/mtq/*.ts` sources. Every status below carries
its honest label from the register.

| Mandate item | Source | Code location | Status |
|---|---|---|---|
| Listing C-1 — signed deviation arithmetic | v5.0 §4.1 | `mandate.ts` `signedImprovement()` (L145), `isEligibleForNormalMode()` (L159) | implemented + unit-tested (C1_TEST_VECTORS) |
| Listing C-2 — exact decimal conversion | v5.0 §4.2 | `mandate.ts` `to18Exact()` (L189) / `from18Exact()` (L203) | implemented + unit-tested (dust/precision-loss rejection) |
| Listing C-3 — gas cost conversion | v5.0 §4.3 | `mandate.ts` `gasCostEstimate()` (L237) | implemented + unit-tested ($13.50 / $45.00 vectors, GAS_VECTORS) |
| Listing C-4 — net-benefit gate | v5.0 §4.4 | `mandate.ts` `netBenefitIsEligible()` (L307) + `NET_BENEFIT_VECTORS` (L325) | implemented + unit-tested (implemented per the formula; see D-1) |
| Listing C-5 — corrected 21-step pipeline | v5.0 §4.5 | `mandate.ts` `runMarpPipeline()` (L1115) | implemented (reference layer; live execution not-demonstrated) |
| Listing C-6 — role rotation procedure | v5.0 §4.6 + §5.2 | `ROLE_ROTATION.md` + `scripts/audit-fix-roles.ts`, `scripts/transfer-ownership.ts` | document published; live rehearsal + final assignments NOT demonstrated (T-35, T-87 not-demonstrated) |
| Five clocks §3.2 | v5.0 §3.2 | `mandate.ts` `buildFiveClocks()` (L479) | implemented (C-009 resolution) |
| Three prices §3.3 | v5.0 §3.3 | `mandate.ts` `TypedPrice` (L552); used in pipeline inputs (L1018-L1021) | implemented |
| J(s) objective §3.5 | v5.0 §3.5 | `mandate.ts` `jsObjective()` (L379) | implemented as **candidate** (`JS_OBJECTIVE_VERSION candidate-v1`, uniform κ placeholder, reserve-risk term = registered zero placeholder); **OD-1 OPEN, OD-5 OPEN**; economic eligibility DISABLED until Committee approval |
| Protected net-benefit gate §3.6 | v5.0 §3.6 | `mandate.ts` `protectionMargin()` (L440) + `netBenefitIsEligible()` (L307) | implemented; **OD-2 OPEN** ($10 vs 1% threshold — both computed, never combined); **OD-4 IMPLEMENTED-PENDING-APPROVAL** (conservative fallback, hard 5% cap, NOT calibrated) |
| Gas fallback §3.7 | v5.0 §3.7 | `mandate.ts` `gasCostWithFallback()` (L255) | implemented |
| Ext-1 A.4 — minimum notional / dust | Ext-1 A.4 | `mandate.ts` `minNotionalCheck()` (L575) | implemented; OD-14 IMPLEMENTED-PENDING-APPROVAL ($100 min + 0.1%-of-NAV escalation) |
| Ext-1 A.5 — minAmountOut semantics | Ext-1 A.5 | `mandate.ts` `computeMinOut()` (L601) | implemented (output-token decimals, floored once; C-020) |
| Ext-1 B.1 — oracle health triggers | Ext-1 B.1 | `mandate.ts` `checkOracleHealth()` (L664) | implemented; OD-19 IMPLEMENTED-PENDING-APPROVAL (WARNING/DEGRADED/HALTED table verbatim) |
| Ext-1 C.1 — decision digest + replay | Ext-1 C.1 | `mandate.ts` `tradeDecisionDigest()` (L864), `DecisionReplayRegistry` (L888) | implemented + unit-tested (T-40, T-59) |
| Ext-1 C.2 — keeper authorization | Ext-1 C.2 | `mandate.ts` `authorizedSigners()` (L938) | implemented + unit-tested (T-51 failover) |
| Ext-1 D.2 — invariants INV-1..12 | Ext-1 D.2 | `mandate.ts` `checkInvariants()` (L736) | implemented (C-022; T-22 INV-12 quote-age boundary implemented) |
| Ext-1 D.3 — market-hours adjustment | Ext-1 D.3 | `mandate.ts` `marketHoursAdjustment()` (L790) | implemented; OD-18 IMPLEMENTED-PENDING-APPROVAL (London window, x2 protection, x0.5 size, blackout reject) |
| Ext-2 G — MEV protection / commit-reveal | Ext-2 G | `mandate.ts` `CommitRevealRegistry` (L954) | implemented + unit-tested (T-71); OD-24 IMPLEMENTED-PENDING-APPROVAL (DIRECT / PRIVATE_MEMPOOL / COMMIT_REVEAL) |
| Ext-3 A.1 — MASE 8-term objective + ensemble | Ext-3 A.1 | `mase.ts` `evaluateMaseObjective()` (L477) + `maseEnsembleAdaptive()` (L685) | implemented (8-term objective; softmax alpha, e^(-eta*Score) weighting; 7-model ensemble); OD-31 IMPLEMENTED-PENDING-APPROVAL; kept strictly separate from §3.5 J(s) (C-036) |
| Ext-3 A.2 — mint/redeem per Blueprint Ch.19 | Ext-3 A.2 | `engine.ts` `applyMint()` (L1418) / `applyRedeem()` (L1613) | implemented (OD-32): X_net/P_MTQ mint with 0.10% state fee; Y x NAV redeem with 0.15%→1.00% state fees; tau_user 0.5% slippage guard; minimum 1 MTQ; full-basket default; atomic revert |
| Ext-3 A.3 — genesis seven-step event | Ext-3 A.3 | `genesis.ts` `executeGenesisSequence()` (L102) + `verifyIndexBase()` (L76, **supersedes verifyGFBBase** — all seven base fixings checked) **+ ON-CHAIN `verifyIndexBase()` public view in `contracts/MTQSigmaV3.sol`** (recomputes Σ Q_i == INDEX_BASE_DENOMINATOR = 1.0000 from the immutable seven constants + seven-fixing positivity, CHF 1.13 + GOLD 2,500 included; never reads mutable state; compiled solcjs 0.8.36 zero errors, runtime 40,500 B) | implemented as reference (OD-33) + compiled into the V3 contract source; on-chain genesis of deployed contracts NOT performed via this module and the live contracts predate the new view — on-chain redeployment + re-verification pending |
| Ext-3 A.4 — oracle feed configuration | Ext-3 A.4 | `oracle.ts` + `blueprint.ts` `ORACLE_VALIDATION.STALENESS_MS` (L190: 60s major FX/gold, 120s minor FX/VIX/DXY), 3-source consensus, 2.5% deviation | implemented (OD-34); on-chain adapters compiled, real feed addresses NOT yet deployed — mock-oracle strategy accepted for Gate 2 shadow |
| Ext-3 A.5 — role-rotation verification | Ext-3 A.5 | `ROLE_ROTATION.md` (Safe on-chain reads: getThreshold/getOwners/getModulesPaginated/getGuard on BOTH chains) | OD-35 **VERIFICATION-PENDING**; reported 4/7 ≠ verified; conflicting reported Safe addresses recorded in repo (see ROLE_ROTATION.md §8) |
| Ext-3 A.6 — repository + deployment record | Ext-3 A.6 | local repo, commit `fb6bb6c`, `contracts/deployments/*.json` | OD-36 SATISFIED-BY-DOCUMENT; remote hosting/CI still absent |
| Ext-3 A.7 — MTQ token standard | Ext-3 A.7 | `contracts/MTQSigmaV3.sol` (OD-37) | implemented: ERC-20 + EIP-2612 Permit + ERC20Votes; no transfer restrictions; no fixed cap; **not upgradeable** (Option A) |
| Ext-3 A.8 — vulnerability disclosure policy | Ext-3 A.8 | `SECURITY.md` | OD-38 SATISFIED-BY-DOCUMENT (PUBLISHED); domain mailbox + PGP fingerprint + bounty approval still TODO |

## 3. Document discrepancy register (findings against the mandate documents)

| ID | Finding | Resolution |
|---|---|---|
| D-1 | v5.0 T-11 table rows 1-2 print net benefit **0.04** where the §3.6 formula gives 0.12 − 0.05 − 0.02 = **0.05**; rows 3-4 match the formula. | The **formula is authoritative** (v5.0 §0.2 level 4). Eligibility outcomes are identical either way (0.05 > 0.01 → Yes; 0.05 > 0.05 false → No). Implemented per the formula in `mandate.ts` `NET_BENEFIT_VECTORS` (T-11a/b expectedNet = 0.05). |
| D-2 | Ext-3 A.4 states "120s for minor FX, VIX, DXY" while the blueprint §17.3.1/§9.2 uses 60s for VIX/DXY in some drafts. | Code uses `VIX_DXY: 120_000` (`ORACLE_VALIDATION.STALENESS_MS` in `blueprint.ts`), matching Ext-3 — the later, governing document. Recorded; no code change pending Committee review of the blueprint drafts. |
| D-3 | The RTF-to-text conversion of the mandate (`audit-work/MTQ_SIGMA-unrtf.txt`) renders the Part 5.4 cross-chain verification table empty. | Cross-chain verification (bytecode/code hash, deployment tx/nonce or CREATE2 evidence, build info, constructor args, proxy info, roles — per chain independently) remains a **first-sprint task**; matching addresses are not evidence of matching behavior. |

## 4. Rollup summary (from `mandate-register.ts`)

### 4.1 Open decisions — 38 total

| Status | Count | IDs |
|---|---|---|
| OPEN | 7 | OD-1 (J(s) definition), OD-2 (threshold policy), OD-3 (Committee constitution), OD-5 (reserve-risk term), OD-11 (commercial evidence), OD-29 (supply cap), OD-30 (frontend/wallet security) |
| IMPLEMENTED-PENDING-APPROVAL | 8 | OD-4, OD-12, OD-13, OD-14, OD-18, OD-19, OD-24, OD-31 |
| implemented | 15 | OD-6, OD-7, OD-8, OD-17, OD-20, OD-21, OD-22, OD-25, OD-26, OD-27, OD-28, OD-32, OD-33, OD-34, OD-37 |
| deferred-G5 | 2 | OD-15, OD-23 |
| deferred-G7 | 2 | OD-9, OD-10 |
| SATISFIED-BY-DOCUMENT | 3 | OD-16 (UPGRADEABILITY.md), OD-36 (deployment record), OD-38 (SECURITY.md) |
| VERIFICATION-PENDING | 1 | OD-35 (Safe configuration on-chain reads) |

### 4.2 Conflicts — 40 total (C-001…C-040)

All 40 conflicts are mapped to a code resolution in the register (40/40 carry a `codeRef`),
including: C-002 (benefit dimensionality → J(s) + common numeraire), C-007 ($10 vs 1% → OD-2),
C-010 (single EOA privileges → Safe rotation, ROLE_ROTATION.md), C-011 (identical addresses
across chains → per-chain verification, this document), C-016 (testnet status ≠ corrected
deployment status → address + code hash + correction version tracking), C-036 (v5.0 J(s) ≠
Blueprint MASE objective → module split `mandate.ts` vs `mase.ts`), C-040 (Safe configuration
assumed → OD-35 on-chain reads).

### 4.3 Tests — 88 total (T-01…T-88)

| Status | Count | Notes |
|---|---|---|
| implemented + unit-tested | 37 | asserted by `runMandateSelfTests()` / canonical suite |
| implemented | 47 | code exists at the mapped location; live-chain evidence not yet produced |
| shadow-observed | 1 | T-75 (combined system shadow, reference layer) |
| not-demonstrated | 2 | T-80 (full-stack integration / full gate run), T-87 (Safe configuration check — OD-35) |
| satisfied-by-document | 1 | T-57 (upgradeability path → UPGRADEABILITY.md) |

37 + 47 + 1 + 2 + 1 = 88.

## 5. Next actions, in order (v5.0 §11.3, adapted)

Steps 1-6 are **substantially done in the reference layer** (`src/lib/mtq/`); steps 7-12
remain. "Substantially done in the reference layer" means the corrected logic exists,
is unit-tested where labeled, and is exposed via `/api/mandate` — it does NOT mean the
deployed contracts are corrected or verified (C-016).

| # | Required action (v5.0 §11.3) | State |
|---|---|---|
| 1 | Inspect and source-map the repository and deployed contracts; produce the deployment register (Part 1.5) for Monad, Arc, Solana | Substantially done in reference layer: `contracts.ts` registry + `contracts/deployments/*.json`; on-chain verification of each recorded address is step 7 |
| 2 | Reproduce the four P0 findings against the actual source; cite files, functions, lines | Substantially done in reference layer: audit-work source map; P0-FIX-1 (chain-linked index), P0-FIX-2 (NAV redemption) registered |
| 3 | Integrate Listings C-1 through C-6 into a corrected branch; do not modify deployed contracts until corrected versions pass tests | Substantially done in reference layer: `mandate.ts` + this document set; deployed contracts untouched |
| 4 | Resolve units, objective function, risk term, threshold dependencies (OD-1..OD-5, OD-12) before enabling economic eligibility | Candidate implementations exist and are DISABLED (§2); resolution itself is Committee work — OD-1/OD-2/OD-3/OD-5 remain OPEN by design (v5.0 §11.6: expose, do not guess) |
| 5 | Deploy corrected versions to testnets with new deployment records; preserve old addresses | Reference layer ready; V3 source compiled (`MTQSigmaV2-PENDING.json`, 23,220 bytes viaIR) — deployment NOT yet performed; this step is REMAINING on-chain work |
| 6 | Run the automated test matrix (T-01..T-40) and publish actual results | Substantially done in reference layer: `runMandateSelfTests()` + `/api/mandate` publish register-labeled results; full-gate run remains not-demonstrated (T-80) |
| 7 | Verify each chain's runtime code, configuration, role assignments, deployment history | **REMAINING** — first-sprint task (v5.0 §11.1; §5.4; D-3) |
| 8 | Rehearse and document role rotation on testnet (Part 5.2) | **REMAINING** — procedure published (ROLE_ROTATION.md); live rehearsal not demonstrated (T-35, T-87) |
| 9 | Run shadow mode and collect reproducible evidence | **REMAINING** — T-75 shadow-observed in reference layer only; Gate 2/4 shadow acceptance not established |
| 10 | Submit evidence and unresolved decisions for Gate 1..4 review | **REMAINING** — Committee not constituted (OD-3 OPEN) |
| 11 | Limited live pilot only after Gate 5 criteria and written authorization | **REMAINING** — not authorized (§1) |
| 12 | Production only through Gate 6; expansion as a separate Gate 7 release | **REMAINING** — not authorized (§1) |

---

Approved public-status wording remains exactly v5.0 §11.4; the §11.5 prohibitions
("live", "production-ready", "validated", "audited", "objective approved") apply to every
document in this repository, including this one.
