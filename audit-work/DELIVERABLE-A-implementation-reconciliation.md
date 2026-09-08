# MTQΣ v1.0 — Implementation Reconciliation Report (Deliverable A)

**Issued:** 2026-09-08
**Author:** Documentation / Source-of-Truth Custodian (Agent: general-purpose)
**Source of Truth:** `audit-work/blueprint-v1.0.txt` — 21,227 lines — MTQΣ Master Monetary Architecture v1.0
**Reconciled against:**
- `src/lib/mtq/blueprint.ts` (272 lines — TS constants)
- `src/lib/mtq/engine.ts` (1,837 lines — TS reference engine)
- `src/lib/mtq/mase.ts` (290 lines — MASE ensemble)
- `src/lib/mtq/marp.ts` (155 lines — MARP decision logic)
- `src/lib/mtq/oracle.ts` (201 lines — oracle consensus)
- `src/lib/mtq/registry.ts` (166 lines — asset registry)
- `contracts/MTQSigmaV2.sol` (1,057 lines — v1.0 contract source)
- `contracts/MTQSigma.sol` (345 lines — v1.2 pilot contract)

---

## 1. Methodology

This reconciliation is a **line-by-line, source-to-code mapping** between the MTQΣ Master Blueprint v1.0 (the authoritative Source of Truth, hereafter "the Master") and the current implementation in the repository. The methodology was:

1. **Inventory all Master Listings.** The Master is organized as 15 numbered Listings (Listing 1 through Listing 15), each anchoring a chapter of the monetary architecture. The starting line of each Listing was located in `audit-work/blueprint-v1.0.txt` (see §3 below for the inventory).

2. **Read every Listing in full.** Each Listing was read end-to-end, capturing the contract name, struct/state, function signatures, role modifiers, immutable constants, and the explicit numeric values the Master pins (e.g., `BASE_CHF_USD = 1.1300e8`).

3. **Read every implementation file in full.** Each `.ts` and `.sol` file was read end-to-end, with attention to (a) which Master Listing it claims to implement, (b) the constants it pins, (c) the function bodies, and (d) any in-file reconciliation notes (the engine has many `§X` references and "v1.0 CHANGES" comment blocks that document intentional divergences).

4. **Cross-walk in both directions.** For each Master Listing, locate the implementation file(s) that should map to it; for each implementation function/constant, locate the Master Listing it claims descent from. Where the two meet, classify the fidelity.

5. **Fidelity verdicts** (per Listing):
   - **FAITHFUL** — the implementation matches the Master's specification (contract name, function signatures, role modifiers, key constants, behavior) within the bounds reasonable for a pilot (the TS engine does not need to be a Solidity contract, but it must compute the same formulae).
   - **PARTIAL** — the implementation matches the *surface* of the Master (right file, right functions, right constants) but diverges on a definitional point (formula, role, threshold, count of states, count of governance layers, etc.).
   - **DIVERGENT** — the implementation actively contradicts the Master (different formula, different constant, different state-machine topology).
   - **NOT IMPLEMENTED** — the Master specifies a structure the implementation has no equivalent for (e.g., a separate `MASEWeightRegistry` contract with riskCouncil/constitutionalCouncil/submitter roles).

6. **Critical reconciliation findings** are the cross-cutting divergences — the places where the implementation's math or topology does not match the Master, with **exact line numbers on both sides** so any future custodian can verify the finding without re-reading the whole blueprint.

**Read-only constraint.** No code files were modified. The two deliverable artifacts (`DELIVERABLE-A-implementation-reconciliation.md` and `DELIVERABLE-B-audit-reconciliation.md`) are the only files written.

---

## 2. Master Listings Inventory

The Master contains **15 numbered Listings**. Each Listing is a Solidity pseudo-contract that pins the structure, constants, role modifiers, and function signatures the corresponding chapter expects to see in the deployed system. The Master Prompt (§39) calls out Listing 1, Listing 2, Listing 3, Listing 13 and Listing 14 as the key reconciliation anchors; this report covers all 15.

| # | Master §section | Title (verbatim from the blueprint) | Blueprint lines | Implementation file(s) that should contain it |
|---:|---|---|---:|---|
| 1 | §2.7 | Core variables, constitutional constants and the adaptive weight registry (replaces BP §1.5) | 1435–1675 | `blueprint.ts` (constants), `MTQSigmaV2.sol` (constants, roles, envelope arrays) |
| 2 | §7.7 | MASE weight verification and adaptive registry (supersedes BP §6.7) | 2661–2900 | separate `MASEWeightRegistry` contract — NOT present; `mase.ts` (TS ensemble, simplified) |
| 3 | §9.8 | Chain-linked index, base denominator and genesis verification (adapts BP §2.6 + §3.3.1) | 3876–4340 | separate `MTQChainLinkIndex` contract — NOT present; `engine.ts::computeGfbIndex`, `MTQSigmaV2.sol::getGFB` |
| 4 | §10.11.11 (BP §7.8) | MARP rebalancing engine: triggers, sizing, constraints and DEX execution | 5488–6820 | `marp.ts`, `engine.ts::applyMarpRebalance`, `MTQSigmaV2.sol::executeRebalance` |
| 5 | §10.8 | Execution and slippage protection (adapts BP §10.8) | 6827–7855 | `engine.ts::simulateQuote`, `MTQSigmaV2.sol` (price-safety guard only) |
| 6 | §14.x (BP §14.1) | Reserve manager: NAV, haircuts, RR and LCR state | 8541–9550 | `engine.ts::reserveAssetValues` / `computeReserveRatio` / `computeLcr`, `MTQSigmaV2.sol::getReserveNavUsd` / `getReserveNetAssetValue` / `getReserveRatio` |
| 7 | §5.5 | Asset admission registry (adapts BP §5.5) | 9557–10190 | `registry.ts`, `MTQSigmaV2.sol::IAssetRegistry` interface + `setAssetRegistry` |
| 8 | §16 | Dynamic buffer: states, transitions and first-loss waterfall | 10192–11580 | `engine.ts::updateBufferState` / `currentBufferGoldRatio` / `applyLoss`, `blueprint.ts` BUFFER_* constants |
| 9 | §17 | Multi-source oracle aggregator: getPrice, validatePrice, consensus | 11583–12670 | `oracle.ts`, `MTQSigmaV2.sol::getOracleConsensus` / `commitFxRatesFromOracles` |
| 10 | §18 | Monetary unit: price, liability, supply and sanity checks | 12679–13455 | `engine.ts::computeMtqPrice` / `computeLiability` / `circulatingSupply`, `MTQSigmaV2.sol::getMTQPrice` / `getLiability` / `getCirculatingSupply` |
| 11 | §19 | Minting and redemption against the adaptive index (adapts BP §12.1–§12.3) | 13460–14310 | `engine.ts::applyMint` / `applyRedeem`, `MTQSigmaV2.sol::mint` / `redeem` |
| 12 | §20 | Genesis, accounting separation and treasury sweep (adapts BP §13.7) | 14326–15450 | `engine.ts::initReserveState` / `maybeTreasurySweep`, `MTQSigmaV2.sol::genesisMint` / `setReserveVault` |
| 13 | §21.6 | Risk state machine, state-dependent actions and staged liquidation (adapts BP §14.6 + §11) | 15457–17000 | `engine.ts::determineStatus`, `blueprint.ts::RISK_STATE_MACHINE`, `MTQSigmaV2.sol::Status` enum + `setProtocolStatus` |
| 14 | §22.6 | Governance parameter registry and emergency functions (adapts BP §14.6.4–§14.6.5) | 17003–19075 | separate `GovernanceParameterRegistry` contract — NOT present; `MTQSigmaV2.sol::queueChange` / `executeChange` / `cancelChange` (Monetary tier only) |
| 15 | §25.5 (BP §15.7) | Honest status declaration | 19078–19420 | `MTQSigmaV2.sol::getHonestStatus` (returns hardcoded `0x7FF` mask); `blueprint.ts::HONEST_STATUS` (prose table); separate `MTQSigmaHonestStatus` contract (11 validation gates) — NOT present |

---

## 3. Source-to-Code Mapping Table

For every Master Listing, the table below records (a) what the Listing specifies, (b) which file(s) implement it, (c) the fidelity verdict, and (d) the specific divergences with line numbers on both sides.

### Listing 1 — §2.7 Core variables, constitutional constants, weight registry

**Master specifies (blueprint lines 1435–1675):**
- Immutable `PAR = 1e18`, `RR_HARD_FLOOR = 1.00e18`, `RECOVERY_CONFIRMATION_PERIOD = 48 hours`.
- Strategic-prior q_i constants: `Q_USD = 0.27e18`, `Q_EUR = 0.20e18`, `Q_JPY = 0.09e18`, `Q_GBP = 0.08e18`, `Q_CNY = 0.05e18`, `Q_CHF = 0.05e18`, `Q_GOLD = 0.26e18`.
- Base FX fixings: `BASE_EUR_USD = 1.0500e8`, `BASE_GBP_USD = 1.2500e8`, `BASE_JPY_USD = 0.0067e8`, `BASE_CNY_USD = 0.1400e8`, **`BASE_CHF_USD = 1.1300e8`**, `BASE_GOLD_USD = 2500.00e8`.
- Risk-council velocity limits: `MAX_VELOCITY = [0.005, 0.005, 0.003, 0.003, 0.002, 0.002, 0.005]` (1e18 scale).
- Four governance addresses: `dao`, `riskCouncil` (4/7), `emergencyCouncil` (4/7), `constitutionalCouncil` (7/7).
- `getMTQPrice()` reads from `getIndex()` (the chain-linked index, Listing 3) scaled by `INDEX_BASE_DENOMINATOR`.
- `getHonestStatus()` (testnet) returns a **prose string** declaring "ADAPTIVE BLUEPRINT … NOT PRODUCTION-AUTHORIZED."

**Implementation:**
- `blueprint.ts` lines 22–263: `STRATEGIC_PRIOR`, `BASE_FIXINGS`, `GFB_BASE_DENOMINATOR`, `ADMISSIBILITY_ENVELOPES`, all monetary parameters. ✅ constant values match.
- `MTQSigmaV2.sol` lines 159–320: `PRIOR_USD/EUR/JPY/GBP/CNY/CHF/GOLD`, `BASE_EUR_USD … BASE_XAU_USD` constants.

**Divergences:**
| # | Master value | Code value | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 1-A | `BASE_CHF_USD = 1.1300e8` | `BASE_FIXINGS.CHF_USD = 0.8800` (`blueprint.ts:50`); `BASE_CHF_USD = 0.88e18` (`MTQSigmaV2.sol:175`) | 1486; 3945; 14452 | `blueprint.ts:50`; `MTQSigmaV2.sol:175` | **DIVERGENT** — CHF base fixing is 28% understated (0.88 vs 1.13) |
| 1-B | `MAX_VELOCITY` array per component | not implemented anywhere | 1569 | — | **NOT IMPLEMENTED** — per-component weight velocity limits are absent from both TS engine and the contract |
| 1-C | `getMTQPrice` reads from `getIndex()` (the chain-linked index from Listing 3) | `computeMtqPrice(gfb) = gfb` where `gfb = computeGfbIndex(fx)` is a Laspeyres aggregate (see Listing 3) | 1592–1596 | `engine.ts:399–402`; `MTQSigmaV2.sol:436–438` | **DIVERGENT** — `getMTQPrice` does not read from a chain-linked index; see Listing 3 finding |
| 1-D | Four governance addresses: `dao`, `riskCouncil`, `emergencyCouncil`, `constitutionalCouncil` | only `DEFAULT_ADMIN_ROLE` + `ADMIN_ROLE` in `MTQSigmaV2.sol:103–108` (no per-layer role identity) | 1572–1580 | `MTQSigmaV2.sol:103–108` | **DIVERGENT** — see Listing 14 finding |
| 1-E | `getHonestStatus()` returns a prose string | `MTQSigmaV2.sol::getHonestStatus` returns a packed `(uint256 implementedMask, uint8, uint8, string)` with `implementedMask = 0x7FF` | 1666–1673 | `MTQSigmaV2.sol:1030–1040` | **DIVERGENT** — see Listing 15 finding |

**Fidelity verdict: PARTIAL.** Constants are mostly faithful, but the four cross-cutting divergences (CHF base, MAX_VELOCITY, getMTQPrice reading from a chain-linked index, and the four governance addresses) are each carried by a different downstream Listing (3, 2, 3, 14 respectively) and are tracked there.

---

### Listing 2 — §7.7 MASE weight verification and adaptive registry

**Master specifies (blueprint lines 2661–2900):**
- A **separate contract** `MASEWeightRegistry` with three roles: `riskCouncil` (4/7), `constitutionalCouncil` (7/7), `submitter` (keeper/operator). Modifiers `onlyRiskCouncil`, `onlyConstitutionalCouncil`, `onlySubmitter`.
- `LOWER_BOUND = [0.23, 0.17, 0.07, 0.06, 0.03, 0.03, 0.20]`, `UPPER_BOUND = [0.32, 0.24, 0.12, 0.11, 0.07, 0.07, 0.32]` (1e18).
- `MAX_VELOCITY = [0.005, 0.005, 0.003, 0.003, 0.002, 0.002, 0.005]` (1e18).
- **Stress-adaptive smoothing** `smoothingRhoNormal = 0.50e18`, `smoothingRhoStress = 0.75e18` — `W_smooth = rho * W_prev + (1 − rho) * W_target`, with `rho` rising to 0.75 under crisis.
- `submitTargetWeights(target, methodologyVersion, dataVersion)`: enforces sum=1, per-component envelopes, per-update velocity, then applies stress-adaptive smoothing.
- `isStress()` reads from a `ICrisisOracle` (threshold `crisisThreshold = 0.70e18`).
- `setEnvelopes(lower, upper)` — `onlyConstitutionalCouncil` (7/7, 90-day timelock off-chain).
- `getLiveWeights()` — view accessor used by the index (Listing 3) and MARP (Listing 4).

**Implementation:**
- `mase.ts` lines 1–290: implements the 6 candidate models (MinVar, ERC, MaxDiv, CVaR, PPP, Regime) and an **equal-weight ensemble** (each model gets `1/N` weight — `mase.ts:215–225`).
- `mase.ts::applyEnvelopes` (lines 229–241) clamps per-component to `ADMISSIBILITY_ENVELOPES` and renormalises.
- `mase.ts::smoothWeights(prevSmoothed, target, lambda = 0.20)` (lines 245–255) — single `SMOOTHING_LAMBDA = 0.20` (no stress-adaptive rho).
- `MTQSigmaV2.sol` lines 234–247 has a `WeightRegistry` struct with `targetWeights/smoothedWeights/executionWeights` arrays, `commitWeights(target, smoothed, execution)` callable by `onlyOracleOrKeeper`, validates against `envelopeLower/envelopeUpper` per component, but does NOT enforce velocity, sum-to-one, or stress-adaptive smoothing.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 2-A | Separate contract `MASEWeightRegistry` with `riskCouncil/constitutionalCouncil/submitter` roles | No separate contract — `commitWeights` is a function inside `MTQSigmaV2.sol` callable by `onlyOracleOrKeeper` (a single combined role) | 2668–2753 | `MTQSigmaV2.sol:560–576` | **DIVERGENT** — role separation collapsed into one |
| 2-B | Ensemble weights adaptive based on OOS performance (Master §7.6 — softmax of out-of-sample scores) | `maseEnsemble` uses equal weight `1/6` per model | §7.6 (Master) | `mase.ts:215–225` | **DIVERGENT** — equal-weight ensemble, not performance-adaptive |
| 2-C | `MAX_VELOCITY` per-component enforced in `submitTargetWeights` | not implemented in either `mase.ts` or `MTQSigmaV2.sol::commitWeights` | 2692–2693, 2795–2807 | — | **NOT IMPLEMENTED** |
| 2-D | Stress-adaptive smoothing: `rho` rises from 0.50 → 0.75 under crisis (`W_smooth = rho * W_prev + (1−rho) * W_target`) | `smoothWeights` uses a single `SMOOTHING_LAMBDA = 0.20` (a fixed 20% weight to new target — opposite sign convention from Master's `rho`) | 2698–2700, 2814–2823 | `mase.ts:245–255`, `blueprint.ts:143` | **DIVERGENT** — fixed lambda, no stress-adaptive rho |
| 2-E | `isStress()` reads from `ICrisisOracle` (crisis threshold 0.70) | `engine.ts::detectRegime` infers regime from VIX/DXY thresholds (`engine.ts:1306–1314`); no on-chain crisis oracle | 2848–2858 | `engine.ts:1306–1314` | **DIVERGENT** — stress flag derives from VIX/DXY heuristics, not a dedicated crisis-score oracle |

**Fidelity verdict: PARTIAL.** The 6-model ensemble exists; the envelopes exist; but the registry is not a separate role-separated contract, the ensemble is equal-weight rather than performance-adaptive, velocity limits are absent, and smoothing is single-lambda rather than stress-adaptive.

---

### Listing 3 — §9.8 Chain-linked index, base denominator, genesis verification

**Master specifies (blueprint lines 3876–4340):**
- A **separate contract** `MTQChainLinkIndex` with state: `indexValue` (I_t), `lastPrices[7]` (P_{i,t-1}), `lastWeights[7]` (W_{i,t-1}), `chainLinkDivisor` (cumulative product of D_t), `lastUpdate`.
- The authoritative recursion (§9.2, COO-16):
  ```
  I_t = I_{t-1} × Σ_i W_{i,t-1} × (P_{i,t} / P_{i,t-1})
  ```
  Weights come from the MASE registry (Listing 2); prices come from the canonical multi-source oracle (Chapter 17).
- `genesis()` one-shot: seeds `I_0 = 1.0000` from the immutable base fixings (not live feeds), emits `GenesisVerified` event with the seven base fixings.
- `updateIndex()`: keeper-callable on the daily cadence. Recomputes `growth = Σ W_{i,t-1} × P_{i,t} / P_{i,t-1}`, then `indexValue = indexValue × growth / 1e18`. If weights changed, also computes `bMinus/bPlus` (base-relative aggregates) and `chainLinkDivisor *= D_t` (recorded, NOT multiplied into indexValue to avoid double-count).
- `getIndex()` returns `indexValue` (the authoritative chain-linked level, consumed by the monetary-unit machinery of Chapter 18).
- `getNavForm()` — value-aggregate form `NAV_t = Σ W_{i,t} × P_{i,t} / P_{i,0}` (for the COO-17 reconciliation).
- `verifyGenesis()` — recomputes the base denominator from the immutable genesis constants and checks `INDEX_BASE_DENOMINATOR == 1e18`.

**Implementation:**
- `engine.ts::computeGfbIndex` (lines 381–396):
  ```
  numerator = STRATEGIC_PRIOR.USD × 1.0 + STRATEGIC_PRIOR.EUR × fx.EUR_USD + … + STRATEGIC_PRIOR.Gold × fx.XAU_USD
  return numerator / GFB_BASE_DENOMINATOR
  ```
  where `GFB_BASE_DENOMINATOR` is computed **once** in `blueprint.ts:56–63` using the **fixed strategic prior** and the **base fixings**. This is a **Laspeyres fixed-base price index**, not the recursive chain-linked form.
- `MTQSigmaV2.sol::getGFB` (lines 420–431) is identical in form: `numerator = PRIOR_USD + PRIOR_EUR × fxEUR_USD / 1e18 + … + PRIOR_GOLD × fxXAU_USD / 1e18; return numerator × 1e18 / GFB_BASE_DENOMINATOR` (where `GFB_BASE_DENOMINATOR` is computed in the constructor at lines 364–372 using the immutable `PRIOR_*` and `BASE_*` constants).

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 3-A | Recursive chain-linked recursion `I_t = I_{t-1} × Σ W_{i,t-1} × (P_{i,t}/P_{i,t-1})` with persistent `indexValue/lastPrices/lastWeights/chainLinkDivisor` | Laspeyres fixed-base aggregate `GFB_t = Σ W^Prior_i × P_{i,t} / GFB_base` with `GFB_base` computed once at genesis | 3894–3926, 4100–4183 | `engine.ts:381–396`; `MTQSigmaV2.sol:420–431` | **DIVERGENT** — this is the audit's P0-1 finding |
| 3-B | Weights come from the MASE registry (Listing 2) — `weightRegistry.getLiveWeights()` | Uses the **immutable** `STRATEGIC_PRIOR` / `PRIOR_*` constants (never reads from `commitWeights`) | 3896–3902, 4104–4106 | `engine.ts:385–391`; `MTQSigmaV2.sol:421–429` | **DIVERGENT** — MASE weights committed via `commitWeights` are never consumed by `getGFB` (audit's C1 finding) |
| 3-C | `genesis()` one-shot event emits `GenesisVerified` with the 7 base fixings; `verifyGenesis()` recomputes the denominator | No `GenesisVerified` event in either engine.ts or MTQSigmaV2.sol; no `verifyGenesis` view | 3987–4008, 4053–4088, 4243–4251 | — | **NOT IMPLEMENTED** |
| 3-D | `chainLinkDivisor` cumulative product of D_t (recorded, published; used for NAV-form reconciliation) | not present anywhere | 3972–3973, 4128–4170 | — | **NOT IMPLEMENTED** |
| 3-E | `updateIndex()` keeper-callable; index advances per period | No per-period advance — `computeGfbIndex` recomputes from current FX every call; `commitFxRatesFromOracles` updates FX but does not roll an index forward | 4100–4183 | `MTQSigmaV2.sol:780–816` (only updates FX state, not an index level) | **DIVERGENT** — there is no `I_t` to advance |

**Fidelity verdict: DIVERGENT.** This is the single most consequential divergence in the whole reconciliation — the implementation's Laspeyres aggregate makes gold contribute ~99.9% of the GFB index by USD notional (instead of 26%), which creates the structural short-gold exposure that fails the S5 Gold +50% stress test in 100% of runs. The fix is to implement Listing 3's recursion with persistent `indexValue/lastPrices/lastWeights` state.

---

### Listing 4 — §10.11.11 MARP rebalancing engine

**Master specifies (blueprint lines 5488–6820):**
- `LAMBDA_1 = 0.40`, `LAMBDA_2 = 0.30`, `LAMBDA_3 = 0.20`, `LAMBDA_4 = 0.10` (1e18).
- `slippageTolerance = 0.01` (1%, adjustable by Risk Council), `MAX_DAILY_TURNOVER = 0.05`, `MAX_POOL_FRACTION = 0.10`, `DIRECTION_LOCK_DURATION = 24 hours`.
- `BENEFIT_MARGIN = 0.01` (1% net-benefit threshold).
- `noTradeBand = 0.0075` (0.75% base), `noTradeBandStress = 0.015` (widened under crisis).
- `executeRebalance()` — keeper-callable. The full pipeline: (1) refresh reserve; (2) `getTargetGoldWeight()` from the MASE registry; (3) compute observed; (4) deviation; (4b) no-trade zone (dynamic band, widened under stress); (5) direction lock (override when `rr < 1.05e18`); (6) cap by pool depth; (7) cap by daily turnover; (8) gas + slippage estimation; (9) net-benefit gate (`benefit > costTerm + BENEFIT_MARGIN`); (10) execute sell/buy.

**Implementation:**
- `marp.ts::marpDecision` (lines 72–139): the TS decision logic implements no-trade zone, urgency test, partial correction (50% of deviation), cost-benefit gate, daily turnover cap, and execute. Six-level hierarchy.
- `engine.ts::applyMarpRebalance` (lines 701–850): applies each would-execute trade to the reserve, enforces `MAX_DAILY_TURNOVER` and `DIRECTION_LOCK_HOURS`. Index gold is locked (§14.1) and never touched.
- `engine.ts::evaluateRebalance` (lines 583–626): the legacy single-direction gold-only path. Line 601: `const inStress = rr < RR_STRESS` (RR_STRESS = 1.05); line 602: `if (!inStress && Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS × 3_600_000)` — direction lock IS overridden when `rr < 1.05` in the TS engine.
- `MTQSigmaV2.sol::executeRebalance` (lines 603–666): the contract path. Validates `t.level ∈ [1,6]`, enforces direction lock at lines 624–631 (`if (prevDir != 0 && prevDir != t.direction) require(block.timestamp >= lastRebalanceAt[t.component] + DIRECTION_LOCK_HOURS)`). **No `rr < 1.05` override** — the direction lock applies unconditionally.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 4-A | Direction lock is bypassed when `rr < 1.05e18` ("solvency outranks anti-churn") | TS engine: implemented (`engine.ts:601–606`). Contract: NOT implemented (`MTQSigmaV2.sol:624–631` — no `rr` guard around the direction lock `require`) | 5701–5719 | `engine.ts:601–606`; `MTQSigmaV2.sol:624–631` | **DIVERGENT** in the contract — audit's C4 finding |
| 4-B | `noTradeBand = 0.0075` (0.75%) and `noTradeBandStress = 0.015` (1.5%) — dynamic, stress-widened | TS: `marp.ts::inNoTradeZone` uses a fixed `0.005` (0.5%) threshold (`marp.ts:42`); contract: `REBALANCE_TOLERANCE = 0.05e18` (5pp tolerance, much wider) | 5549–5553 | `marp.ts:39–44`; `MTQSigmaV2.sol:263` | **DIVERGENT** — band 6× narrower in TS (0.5% vs 0.75%) and 6.7× wider in contract (5% vs 0.75%); no stress-widening |
| 4-C | `BENEFIT_MARGIN = 0.01` (1% net-benefit threshold above cost) | `marp.ts::costBenefitGate` (lines 48–59) requires only `netBenefit > 0` (no 1% margin); `engine.ts::evaluateRebalance` line 622 uses `benefit <= estCost` (no margin) | 5558 | `marp.ts:58`; `engine.ts:622` | **DIVERGENT** — 0% margin instead of 1% |
| 4-D | 6-level hierarchy with explicit levels (no-trade, low urgency, partial correction, cost-benefit, turnover cap, execute) | TS `marp.ts::marpDecision` implements all 6 levels (lines 86–136); contract only validates `level ∈ [1,6]` and skips holds/direction-0 (no internal level logic) | §10.3 | `marp.ts:86–136`; `MTQSigmaV2.sol:615–665` | **PARTIAL** — TS is faithful, contract accepts the level as a passthrough without recomputing it |
| 4-E | `getTargetGoldWeight()` from the MASE registry (Listing 2) | `engine.ts::computeTargetGoldWeight` derives the target from the legacy §8 buffer math + the smoothed θ (lines 558–563); contract takes the target as a parameter from the keeper | 5669–5673 | `engine.ts:558–563`; `MTQSigmaV2.sol:603` | **DIVERGENT** — neither TS nor contract reads from a committed MASE registry |

**Fidelity verdict: PARTIAL.** The 6-level decision logic is faithful in TS. The contract path accepts the keeper's pre-computed decision as a passthrough. The direction-lock RR<1.05 override is missing in the contract (C4 finding). No-trade band values and benefit margin diverge.

---

### Listing 5 — §10.8 Execution and slippage protection

**Master specifies (blueprint lines 6827–7855):**
- Quote-based execution with on-chain oracle rate + DEX aggregator quote; bound = `oracleRate × (1 ± τ)` where `τ` is the slippage tolerance.
- Slippage-warning event if `effectiveSlippageBps` exceeds the bound.
- Two-aggregator fallback (1inch, Paraswap) per `blueprint.ts::AGGREGATOR_QUOTE_PROVIDERS`.

**Implementation:**
- `engine.ts::simulateQuote` (lines 1641–1654): randomly picks one of 1inch/Paraswap, computes a slippage in [0.05%, 0.40%], checks the quote against the oracle-bound by `SLIPPAGE_TOLERANCE = 0.01` (1%), returns `withinBound` flag.
- `MTQSigmaV2.sol`: only the `PRICE_SAFETY_LOWER/UPPER` circuit breakers (lines 199–200, applied in `getMTQPriceWithGuard` at line 441); no DEX-aggregator wiring.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 5-A | Quote-based execution against two aggregators with on-chain enforcement of the slippage bound | TS simulates a quote (labelled); contract has no aggregator wiring | §10.8 (full) | `engine.ts:1641–1654`; `MTQSigmaV2.sol` (none) | **PARTIAL** — pilot-honest simulation in TS; not present in contract |
| 5-B | `getMTQPriceWithGuard` applied to both `mint` and `redeem` (circuit breakers) | `mint` uses `getMTQPriceWithGuard` (`MTQSigmaV2.sol:470`); `redeem` uses `getMTQPrice` (no guard) (`MTQSigmaV2.sol:502`) | §3.5 (BP) | `MTQSigmaV2.sol:470, 502` | **DIVERGENT** — audit's H4 finding |

**Fidelity verdict: PARTIAL.**

---

### Listing 6 — §14.1 Reserve manager: NAV, haircuts, RR, LCR

**Master specifies (blueprint lines 8541–9550):**
- `getNAV() = reserveState.fiatValue + reserveState.goldValue` (gross), with per-asset haircuts pulled from the Asset Admission Registry (Listing 7).
- `getReserveRatio() = NAV / liability` (1e18 scale).
- `getLCR()` uses `reserveState.liquidValue` (stablecoins only — gold is 0% liquid) divided by `stressDemand = circSupply × price × 25%`.
- Three-tier RR (TARGET 1.10 / STRESS 1.05 / HARD 1.00) feeding the risk state machine.

**Implementation:**
- `engine.ts::reserveAssetValues` (lines 410–465) — gross + net (post-haircut) values for all 7 components; NAV = sum of nets.
- `engine.ts::computeReserveRatio` (lines 475–478) — `nav / liability`.
- `engine.ts::computeLcr` (lines 480–486) — `liquidAssets / (circSupply × price × STRESS_REDEMPTION_RATE)` where `STRESS_REDEMPTION_RATE = 0.25`.
- `MTQSigmaV2.sol::getReserveNavUsd` (lines 843–849) — gross sum of the reserve mirror; `getReserveNetAssetValue` (lines 855–884) — applies per-asset haircuts from the registry; `getReserveRatio` (lines 888–893) — `nav × 1e18 / liability`.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 6-A | Three-tier RR (TARGET/STRESS/HARD) feeding the risk state machine | Three RR constants exist in `blueprint.ts:99–101` and `MTQSigmaV2.sol:320`; but the contract surfaces only one (`reserveRatioTarget = 1.10e18`) as a settable parameter — the STRESS (1.05) and HARD (1.00) floors are not in the contract's parameter registry (audit C7 territory) | 1494–1496, 8541–9550 | `blueprint.ts:99–101`; `MTQSigmaV2.sol:320` | **PARTIAL** — TS engine has all three; contract has only TARGET settable |
| 6-B | `getLCR()` is a contract view | `MTQSigmaV2.sol` does NOT implement `getLCR()` (no `liquidValue` tracking, no `stressDemand` math) | 8541–9550 | — | **NOT IMPLEMENTED** in contract (present in TS engine as `computeLcr` at lines 480–486) |
| 6-C | Haircuts pulled per-asset from the registry (Listing 7) | `MTQSigmaV2.sol::getReserveNetAssetValue` does call `IAssetRegistry(assetRegistry).getAsset(codes[i])` and applies `(1e18 - haircut)` per asset — faithful | 855–882 | `MTQSigmaV2.sol:855–882` | **FAITHFUL** |

**Fidelity verdict: PARTIAL.** NAV and RR are faithful in both TS and contract; LCR is missing from the contract; the contract's parameter registry exposes only one of three RR tiers.

---

### Listing 7 — §5.5 Asset admission registry

**Master specifies (blueprint lines 9557–10190):**
- 8 eligibility criteria (Issuer Authorization, Redemption Right, Custody, Sanctions, Smart-Contract Audit, Liquidity ≥ $1M/24h, Oracle Availability, Concentration ≤ 30%).
- 4 asset states: ACTIVE / WATCH / RESTRICTED / EJECTED.
- `AssetRecord`: `currencyCode`, `tokenAddress`, `name`, `haircut`, `liquidityThresholdUsd`, `admissionDate`, `state`, `isStablecoin`, `issuerId`.
- Per-issuer concentration ≤ 30% (warn ≥ 25%); 4/7 can temporarily raise to 35%.
- 48h timelock on asset changes (Constitutional 7/7).

**Implementation:**
- `registry.ts` (166 lines) — full implementation: 8 eligibility criteria, 4 states, AssetRecord struct, `genesisRegistry()` with 9 assets (USDC/USDP/USDT/EURC + 3 TBD + PAXG/XAUT), `computeConcentration` per-issuer, `eligibilityScore`.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 7-A | 8 eligibility criteria, 4 states, AssetRecord fields | All present and faithful | 9557–10190 | `registry.ts:14–167` | **FAITHFUL** |
| 7-B | Per-issuer ≤30% (warn 25%, crisis 35%) | `registry.ts::computeConcentration` (lines 131–152) enforces 30% breach and 25% warn; 35% crisis tier is in `blueprint.ts:261` (`CONCENTRATION_CRISIS_LIMIT_PCT = 0.30` — note: 30%, not 35%) | §5.6 | `registry.ts:131–152`; `blueprint.ts:261` | **DIVERGENT** — crisis tier 35% in Master but `CONCENTRATION_CRISIS_LIMIT_PCT = 0.30` (30%) in `blueprint.ts:261`; effectively collapsed |
| 7-C | 48h timelock on asset changes (Constitutional 7/7) | not enforced in `registry.ts` or `MTQSigmaV2.sol` — `setAssetRegistry` is `onlyAdmin` (instant) | §5.10 | `MTQSigmaV2.sol:837–839` | **DIVERGENT** — no timelock |

**Fidelity verdict: PARTIAL.** The eligibility criteria, states, and per-issuer concentration are faithful; the 48h Constitutional timelock on asset changes is missing (collapsed to ADMIN_ROLE instant).

---

### Listing 8 — §16 Dynamic buffer

**Master specifies (blueprint lines 10192–11580):**
- 3 buffer states: BASE / STRESS / EMERGENCY with smooth 24h ramping.
- `BUFFER_GOLD_BASE = 0.625`, `BUFFER_GOLD_STRESS = 0.85`, `BUFFER_GOLD_EMERGENCY = 1.00`; `CORE_GOLD_WEIGHT = 0.20`; `BUFFER_SIZE = 0.10`; `RAMP_DURATION_HOURS = 24`.
- First-loss waterfall with 5 layers: (1) Operational Surplus → (2) Buffer Fiat → (3) Buffer Gold → (4) Core Fiat → (5) Core Gold.

**Implementation:**
- `engine.ts::currentBufferGoldRatio` (lines 537–548), `bufferBaseFromRatio` (lines 550–554), `updateBufferState` (lines 1507–1519), `applyLoss` (lines 1593–1617).
- All `BUFFER_*` and `CORE_*` constants present in `blueprint.ts:153–158`.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 8-A | 3 buffer states with 24h ramp | Faithful — `engine.ts:537–548, 1507–1519` | §16 | `engine.ts:537–548, 1507–1519` | **FAITHFUL** |
| 8-B | 5-layer first-loss waterfall | Faithful — `engine.ts:applyLoss:1593–1617` implements all 5 layers with caps + consumption tracking | §16 | `engine.ts:1593–1617` | **FAITHFUL** |
| 8-C | Buffer constants `BUFFER_GOLD_BASE = 0.625`, `BUFFER_GOLD_STRESS = 0.85`, `BUFFER_GOLD_EMERGENCY = 1.00` | Match — `blueprint.ts:155–157` | §16 | `blueprint.ts:155–157` | **FAITHFUL** |
| 8-D | EMERGENCY redemption PAUSED per §21.4 (vs §16.2 saying "still allowed with increased fee") | Engine.ts `applyRedeem` does NOT pause redemption in EMERGENCY — line 995: `if (status === "EMERGENCY") feeBps = 200` (2% fee, still allowed); contract `MTQSigmaV2.sol::redeem` has no EMERGENCY pause either | §21.4 (BP) vs §16.2 | `engine.ts:995`; `MTQSigmaV2.sol:498–518` | **DIVERGENT** — audit's F-EMERG-01 finding; the engine follows §16.2 ("still allowed with increased fee") and the Master's own §21.4 matrix says "Paused" — blueprint self-contradiction |

**Fidelity verdict: PARTIAL.** Buffer state machine and first-loss waterfall are faithful; EMERGENCY redemption handling diverges from §21.4.

---

### Listing 9 — §17 Multi-source oracle aggregator

**Master specifies (blueprint lines 11583–12670):**
- Three sources: Chainlink (primary), Pyth (high-frequency), Chronicle (verifiable).
- Validation: `staleness ≤ 60s`, `confidence < 1%` of price, `deviation < 2.5%` from median.
- Consensus: median(3) / average(2) / paused(<2 valid).
- §17.3.4 source-independence: no 2 adapters from the same provider family.

**Implementation:**
- `oracle.ts` (201 lines) — full implementation: `buildOracleConsensus` (lines 71–162) with staleness/confidence/deviation validation; `median3`/average/paused dispatch; `OracleBoard` for all 5 pairs (EUR/GBP/JPY/CNY/XAU). Honest label that 2 of 3 feeds are synthetic witnesses (Pyth/Chronicle) because real on-chain feeds aren't available in the pilot.
- `MTQSigmaV2.sol::getOracleConsensus` (lines 688–775) — full implementation: 3 adapters, staleness ≤ 60s (`ORACLE_STALENESS_SEC = 60`), confidence < 1% (`ORACLE_CONFIDENCE_MAX = 0.01e18`), deviation < 2.5% (`ORACLE_DEVIATION_MAX_BPS = 250`), insertion sort, median(3)/average(2)/paused(<2) dispatch.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 9-A | 3 sources, validation, median/average/paused | Faithful in both TS and contract | §17 | `oracle.ts:71–162`; `MTQSigmaV2.sol:688–775` | **FAITHFUL** |
| 9-B | §17.3.4 source-independence (no 2 adapters from the same provider family) | Not enforced — `setOracleAdapter(uint8 source, address adapter)` accepts any address without a family check | §17.3.4 | `MTQSigmaV2.sol:673–679` | **NOT IMPLEMENTED** — audit's H8 finding |
| 9-C | Oracle adapter calls should reject `price == 0` | `MTQSigmaV2.sol::commitFxRatesFromOracles` does not `require(p > 0)`; `getOracleConsensus` filters by `t > block.timestamp` and staleness but does NOT check `p > 0` — so 2 colluding adapters returning (0, now, 0) pin the median to 0 and the index divides by 0 | §17.2 | `MTQSigmaV2.sol:780–816, 688–775` | **DIVERGENT** — audit's C6 finding |
| 9-D | Gold oracle confidence math (§17.6) — separate confidence band for gold (different from fiat) | Not implemented; `oracle.ts::buildOracleConsensus` uses a flat `0.0005`/`0.001`/`0.002` confidence half-width per source (Chainlink/Pyth/Chronicle) regardless of asset class | §17.6 | `oracle.ts:60, 82–91` | **DIVERGENT** — audit's P1-4 finding |
| 9-E | CHF/USD pair as a first-class oracle feed (per Listing 1 + 3) | `oracle.ts::buildOracleBoard` (lines 172–187) only constructs 5 pairs (EUR/GBP/JPY/CNY/XAU) — **CHF/USD is missing** | §17 + §3.4 | `oracle.ts:172–187` | **DIVERGENT** — CHF oracle feed missing in TS (the contract has `PAIR_CHF_USD` at line 286) |

**Fidelity verdict: PARTIAL.** The consensus mechanics are faithful; source-independence and the zero-price guard are missing (C6, H8); the gold-confidence math is not asset-specific; CHF/USD is missing from the TS oracle board.

---

### Listing 10 — §18 Monetary unit: price, liability, supply

**Master specifies (blueprint lines 12679–13455):**
- `BASE_CHF_USD = 1.13e18` (per Listing 10's own constants block, blueprint line 14452).
- `getMTQPrice() = getIndex() × 1e18 / INDEX_BASE_DENOMINATOR` (reads from the chain-linked index, Listing 3).
- `getLiability() = circulatingSupply × price / 1e18`.
- `getCirculatingSupply() = totalSupply - balanceOf(genesisReserveAddress)`.

**Implementation:**
- `engine.ts::computeMtqPrice` (lines 399–402), `computeLiability` (471–473), `circulatingSupply` (467–469).
- `MTQSigmaV2.sol::getMTQPrice` (lines 436–438), `getLiability` (453–455), `getCirculatingSupply` (448–450).

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 10-A | `BASE_CHF_USD = 1.13e18` | `0.88e18` (contract) / `0.8800` (TS) | 14452 | `MTQSigmaV2.sol:175`; `blueprint.ts:50` | **DIVERGENT** — same as finding 1-A; the Listing 10 constant block pins 1.13 |
| 10-B | `getMTQPrice` reads from `getIndex()` (chain-linked) | Reads from a Laspeyres aggregate (see Listing 3 finding) | 12679–13455 | `engine.ts:399–402`; `MTQSigmaV2.sol:436–438` | **DIVERGENT** — same as finding 1-C / 3-A |
| 10-C | `getLiability = circSupply × price` | Faithful | §18 | `engine.ts:471–473`; `MTQSigmaV2.sol:453–455` | **FAITHFUL** |

**Fidelity verdict: PARTIAL.** Liability and supply are faithful; price reads from a Laspeyres aggregate instead of a chain-linked index (carries forward the Listing 3 finding); CHF base fixing is 0.88 vs 1.13.

---

### Listing 11 — §19 Minting and redemption against the adaptive index

**Master specifies (blueprint lines 13460–14310):**
- §19.3.2 Step 2: **`RedeemValue_(USD) = Y × NAV_(t)`** where `NAV_(t) = V_(net,t) / S_(circ,t)` — redemption is priced against NAV per token, not against P_MTQ (Invariant I6).
- Step 4: Proportional release of all reserve assets: `Release_i = RedeemValue_net × V_i / V_net` — never to target weights, always to actual composition.
- Step 3: Fees accrue to the **Operational Wallet** (Section 20.4), not to the reserve vault.

**Implementation:**
- `engine.ts::applyRedeem` (lines 975–1072). Line 996: `const grossUsd = inputMtq × price` where `price = computeMtqPrice(gfb)` = the GFB index (P_MTQ), **NOT** NAV per token. Lines 969–972 add `auditNavPerToken`, `auditGrossUsdNav`, `auditDeltaUsd`, `auditNote` fields that compute the §12.2 / §19.3.2 NAV figure as informational, but settle on the §3.4.2 P_MTQ value as canonical.
- `MTQSigmaV2.sol::redeem` (lines 498–518). Line 509: `uint256 grossUsd18 = mtqAmount × price / 1e18` where `price = getMTQPrice()` — also P_MTQ, not NAV. No `auditNavPerToken` companion field.
- Release composition: `engine.ts` releases proportionally to the actual reserve composition for USD (split 1/3 across USDC/USDP/USDT) and the Strategic Prior weights (renormalized over 6 non-gold components) for the fiat basket (`engine.ts:1015–1026`); contract releases USDC only (`MTQSigmaV2.sol:512–516`).
- Fees: `engine.ts:1049` `s.treasury.hotWalletUsd += feeUsd` — fee revenue to a hot wallet (which IS distinct from the reserve), then `maybeTreasurySweep` (line 1575) sweeps surplus > $10k to a `coldTreasuryUsd`. Contract `MTQSigmaV2.sol::mint`/`redeem` leave fee accounting implicit (the `usdc.transferFrom(reserveVault, msg.sender, usdcOut)` returns the net to the user, but the fee USDC stays in the `reserveVault` — fees count toward NAV/RR — audit F-FEE-01 finding).

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 11-A | `RedeemValue = Y × NAV_t` where `NAV_t = V_net/S_circ` | `grossUsd = inputMtq × price` where `price = P_MTQ` (the GFB index, NOT NAV per token) | 13118, 13317–13328 | `engine.ts:996`; `MTQSigmaV2.sol:509` | **DIVERGENT** — audit's P0-2 finding (I6 violation) |
| 11-B | Proportional release to actual reserve composition (6 currencies + gold) | TS: releases USD 1/3 across USDC/USDP/USDT and the rest per Strategic Prior (not actual composition); contract: releases USDC only | 13341–13360 | `engine.ts:1019–1026`; `MTQSigmaV2.sol:512–516` | **DIVERGENT** — TS uses Strategic Prior (not actual V_i/V_net); contract releases only USDC (single-asset) |
| 11-C | Fees accrue to the Operational Wallet (separate from reserve) | TS: `treasury.hotWalletUsd += feeUsd` then `maybeTreasurySweep` (distinct accounting — faithful); contract: fees stay in `reserveVault` and count toward NAV/RR | 13338–13339 | `engine.ts:1049, 1575–1588`; `MTQSigmaV2.sol:476, 517` | **DIVERGENT in contract** — audit's F-FEE-01 finding; TS engine is faithful |

**Fidelity verdict: DIVERGENT.** The redemption price formula is the wrong variable (P_MTQ instead of NAV_t per I6), the release is not proportional to actual composition, and contract fee accounting inflates reported RR.

---

### Listing 12 — §20 Genesis, accounting separation, treasury sweep

**Master specifies (blueprint lines 14326–15450):**
- One-shot `genesisMint()` that seeds the genesis reserve, locked (excluded from circulating supply).
- `BASE_CHF_USD = 1.13e18` (per Listing 12's own constants block, blueprint line 14452 — same value as Listings 1, 3, 10).
- Accounting separation: reserve vault vs Operational Wallet (§20.4) — fees go to Operational Wallet, not the reserve.
- Treasury sweep (§13.2): when the hot wallet exceeds a threshold, the surplus is swept to a 4/7 Cold Treasury Multi-Sig.

**Implementation:**
- `engine.ts::initReserveState` (lines 194–300) — seeds $1.1M deposit across the 7 Strategic Prior components, mints 1M MTQ to genesis reserve (locked), RR = 1.10. CHF split uses `BASE_FIXINGS.CHF_USD = 0.88` (line 219).
- `MTQSigmaV2.sol::genesisMint` (lines 953–958) — `require(!genesisDone, "MTQV2: genesis already done"); genesisDone = true; _mint(genesisReserve, amount); genesisReserveBalance = amount` — **no `require(amount > 0)` guard**, so `genesisMint(0)` permanently locks the genesis at 0 balance.
- `engine.ts::maybeTreasurySweep` (lines 1575–1588) — sweeps `hotWalletUsd - $5k` to `coldTreasuryUsd` when `hotWalletUsd > $10k`. Faithful to §13.2.
- Contract has no treasury sweep or Operational Wallet.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 12-A | `BASE_CHF_USD = 1.13e18` (Listing 12 pins this verbatim at line 14452) | `0.88e18` (contract) / `0.8800` (TS) | 14452 | `MTQSigmaV2.sol:175`; `blueprint.ts:50` | **DIVERGENT** — same as finding 1-A; Listing 12 is the 4th place in the Master that pins 1.13 |
| 12-B | One-shot genesis mint with a positive-amount guard | `genesisMint(amount)` has no `require(amount > 0)` — `genesisMint(0)` permanently locks genesis | §20 (BP §13.7) | `MTQSigmaV2.sol:953–958` | **DIVERGENT** — audit's C5 finding |
| 12-C | Accounting separation — fees to Operational Wallet (not reserve) | TS: faithful (`engine.ts:1049, 1575–1588`). Contract: fees stay in `reserveVault`, inflating NAV/RR | §20.4 | `MTQSigmaV2.sol:476, 517` | **DIVERGENT in contract** — audit's F-FEE-01 finding |
| 12-D | Treasury sweep to 4/7 Cold Treasury Multi-Sig | TS: `maybeTreasurySweep` faithfully sweeps to `coldTreasuryUsd` (off-chain multisig implied); contract: no sweep function | §13.2 | `engine.ts:1575–1588`; `MTQSigmaV2.sol` (none) | **DIVERGENT in contract** — not implemented |

**Fidelity verdict: PARTIAL.** Genesis seeding and treasury sweep are faithful in TS; the contract has the C5 genesisMint(0) guard missing, no Operational Wallet, no treasury sweep, and the same CHF base fixing divergence.

---

### Listing 13 — §21.6 Risk state machine, state-dependent actions, staged liquidation

**Master specifies (blueprint lines 15457–17000):**
- **SIX states**: `ProtocolState { NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY }` (blueprint line 15480).
- State thresholds (blueprint lines 15647–15677):
  - NORMAL: `rr ≥ rrTarget && lcr ≥ lcrTarget`
  - CAUTION: `rr ≥ rrStressFloor (1.05) && lcr ≥ 0.90`
  - **STRESS**: `rr ≥ 1.02 && lcr ≥ 0.80`
  - DEFENSIVE: `rr ≥ RR_HARD_FLOOR (1.00) && lcr ≥ 0.70`
  - EMERGENCY: `rr < RR_HARD_FLOOR`
  - RECOVERY: solvency at or above the hard floor but ratios not yet back to NORMAL
- Restrictiveness ranking: NORMAL=0, CAUTION=1, RECOVERY=2, STRESS=3, DEFENSIVE=4, EMERGENCY=5 (blueprint lines 15741–15756). Transitions to more restrictive states are immediate; transitions to less restrictive require 48h confirmation.
- State-dependent actions (blueprint lines 15773–15865):
  - NORMAL: mint 100%, redeem fee 0.15%, rebalance urgency 1 (normal)
  - CAUTION: mint 50%, redeem fee 0.15%, rebalance urgency 2
  - **STRESS**: mint paused, redeem fee **0.50%** (`redeemFeeStress = 0.005e18`), rebalance urgency 3 (emergency)
  - DEFENSIVE: mint paused, redeem fee **1.00%** (`redeemFeeDefensive = 0.010e18`), rebalance urgency 4 (forced)
  - EMERGENCY: mint paused, **redemption PAUSED** (line 15827–15829: `_pauseRedeeming()`), rebalancing paused
  - RECOVERY: mint 25%, redeem fee 0.30% (2 × 0.15%), rebalance urgency 2
- De-peg detector with `depegWindow = 12 hours` (Risk-Council 4/7).
- Reintegration score: `REINTEGRATION_THRESHOLD = 0.80`, weights `TIME_IN_BAND=0.40, LIQUIDITY=0.25, ORACLE_AGREEMENT=0.20, VOLATILITY=0.15` (blueprint lines 15557–15565).
- Four governance addresses wired in the constructor.

**Implementation:**
- `engine.ts::determineStatus` (lines 489–495) — **FIVE states only**: `NORMAL → CAUTION → DEFENSIVE → EMERGENCY → RECOVERY`. STRESS is collapsed into DEFENSIVE.
- `blueprint.ts::RISK_STATE_MACHINE` (lines 184–190) — 5 entries; STRESS absent; the DEFENSIVE row says "Allowed (Fee 0.5%)" (line 187) and EMERGENCY says "Restricted (Fee 2%)" (line 188) — but the Master says DEFENSIVE = 1.00% fee and EMERGENCY = PAUSED redemption.
- `MTQSigmaV2.sol::Status` enum (line 212): `enum Status { NORMAL, CAUTION, DEFENSIVE, EMERGENCY, RECOVERY }` — 5 values; STRESS absent.
- `engine.ts::applyRedeem` (lines 992–995): `feeBps = REDEEM_FEE_BPS (15) → if DEFENSIVE feeBps = 50 (0.5%) → if EMERGENCY feeBps = 200 (2%)` — uses 0.5% for DEFENSIVE (Master says STRESS = 0.5%, DEFENSIVE = 1.0%).
- `MTQSigmaV2.sol::redeem` (lines 505–507): `if DEFENSIVE feeBps = 50 (0.5%) → if EMERGENCY feeBps = 200 (2%)` — same 5-state collapse.
- Reintegration: `blueprint.ts:265` has `REINTEGRATION_WEIGHTS = { w1_TimeInBand: 0.35, w2_LiquidityDepth: 0.25, w3_OracleAgreement: 0.20, w4_OneMinusVolatility: 0.20 }` and `REINTEGRATION_THRESHOLD = 0.80` — weights are 0.35/0.25/0.20/0.20 (vs Master's 0.40/0.25/0.20/0.15). Faithful to within 5 pp.
- Restrictiveness ranking: `engine.ts::determineStatus` does not implement restrictiveness; transitions are not gated by 48h confirmation — status is recomputed on every snapshot.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 13-A | SIX states (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY) | FIVE states (STRESS collapsed into DEFENSIVE) | 15480 | `engine.ts:489–495`; `blueprint.ts:182–190`; `MTQSigmaV2.sol:212` | **DIVERGENT** — audit's P0-3 finding |
| 13-B | STRESS threshold `rr ≥ 1.02 && lcr ≥ 0.80` | No STRESS state in either TS or contract | 15657 | — | **DIVERGENT** (subsumed by 13-A) |
| 13-C | DEFENSIVE redeem fee = 1.00% (`redeemFeeDefensive = 0.010e18`) | `feeBps = 50` (0.50%) in both TS and contract | 15513 | `engine.ts:994`; `MTQSigmaV2.sol:506` | **DIVERGENT** — 2× understated |
| 13-D | EMERGENCY redemption PAUSED (`_pauseRedeeming()`) | `feeBps = 200` (2% fee, redemption still allowed) in both TS and contract | 15827–15829 | `engine.ts:995`; `MTQSigmaV2.sol:507` | **DIVERGENT** — audit's F-EMERG-01 finding |
| 13-E | Restrictiveness ranking + 48h confirmation for transitions to less-restrictive states | Status recomputed on every snapshot; no restrictiveness ranking; no 48h confirmation gate | 15741–15756, 15693–15706 | `engine.ts:489–495` | **DIVERGENT** |
| 13-F | `RECOVERY_CONFIRMATION_PERIOD = 48 hours` | Not implemented in either TS or contract | 1496, 15694 | — | **NOT IMPLEMENTED** |
| 13-G | Reintegration weights `0.40/0.25/0.20/0.15` | `0.35/0.25/0.20/0.20` (TS) | 15557–15565 | `blueprint.ts:265` | **DIVERGENT** — 5 pp shift (Time-in-Band 0.40 → 0.35; Volatility 0.15 → 0.20) |
| 13-H | Four governance addresses in the constructor | None — contract has roles, not the four named governance addresses | 15519–15527, 15613–15627 | `MTQSigmaV2.sol:103–108, 347–373` | **DIVERGENT** (carried forward to Listing 14) |

**Fidelity verdict: DIVERGENT.** The 5-vs-6 state collapse, the DEFENSIVE fee undercharge, the EMERGENCY redemption pause missing, and the absent restrictiveness ranking / 48h confirmation are each material divergences from the Master.

---

### Listing 14 — §22.6 Governance parameter registry and emergency functions

**Master specifies (blueprint lines 17003–19075):**
- A **separate contract** `GovernanceParameterRegistry` with `ParameterLayer { CONSTITUTIONAL, MONETARY, RISK, EMERGENCY }` (blueprint line 17026).
- Three immutable timelocks: `TIMELOCK_MONETARY = 48 hours`, `TIMELOCK_RISK = 24 hours`, `TIMELOCK_CONSTITUTIONAL = 90 days` (enforced by the 7/7 process) (blueprint lines 17056–17061).
- Four governance addresses: `dao` (51% quorum), `riskCouncil` (4/7), `emergencyCouncil` (4/7), `constitutionalCouncil` (7/7) (blueprint lines 17065–17071).
- `registerParameter(parameterId, layer, value, minValue, maxValue)` — `onlyConstitutionalCouncil`.
- Monetary path: `proposeMonetaryParameter` (`onlyDAO`) → 48h timelock → `executeMonetaryParameter` (`onlyDAO`); `vetoMonetaryParameter` (`onlyRiskCouncil`) within the timelock window.
- Risk path: `proposeRiskParameter` (`onlyRiskCouncil`) → 24h timelock → `executeRiskParameter` (`onlyRiskCouncil`).
- `updateParameter` dispatches to the operations contract via `IOperations(ops).applyParameter(parameterId, newValue)`.
- Emergency functions: `pauseMinting`, `pauseRedeeming`, `forceRebalance`, `resumeOperations` — all `onlyEmergencyCouncil` (instant, 4/7 Multi-Sig, hardware wallets).

**Implementation:**
- `MTQSigmaV2.sol` lines 300–324, 895–945: ONE `TIMELOCK_DELAY = 48 hours` (Monetary tier only). `queueChange(key, newValue)` — `onlyAdmin` (not `onlyDAO`); `executeChange(key)` — anyone callable; `cancelChange(key)` — `onlyAdmin`. Three parameter keys tracked: `PARAM_MINT_FEE_BPS`, `PARAM_REDEEM_FEE_BPS`, `PARAM_RESERVE_RATIO_TARGET`. No layer enum; no separate paths for Monetary vs Risk vs Constitutional vs Emergency; no veto.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 14-A | FOUR governance layers (Constitutional 90d / Monetary 48h / Risk 24h / Emergency instant) | ONE timelock (48h, ADMIN_ROLE) — only the Monetary tier | 17026, 17056–17061 | `MTQSigmaV2.sol:303` | **DIVERGENT** — audit's P0-4 finding |
| 14-B | Four governance addresses (dao/riskCouncil/emergencyCouncil/constitutionalCouncil) | Five AccessControl roles (DEFAULT_ADMIN_ROLE, ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE, KEEPER_ROLE, ORACLE_ROLE) — placeholders but no per-layer identity | 17065–17071 | `MTQSigmaV2.sol:103–108` | **DIVERGENT** |
| 14-C | Parameter registration with `(layer, value, min, max)` envelope | `ParameterChange` struct has `(key, newValue, queuedAt, executesAt, executed)` — no layer, no envelope | 17028–17040 | `MTQSigmaV2.sol:305–311` | **DIVERGENT** |
| 14-D | Monetary path: `propose → 48h → execute`, with Risk-Council veto | `queueChange(onlyAdmin) → wait 48h → executeChange(anyone)` — no veto | 17195–17268 | `MTQSigmaV2.sol:901–922` | **DIVERGENT** (veto missing) |
| 14-E | Risk path: `propose → 24h → execute`, Risk Council only | Not implemented | 17278–17329 | — | **NOT IMPLEMENTED** |
| 14-F | Constitutional 90-day timelock (enforced by 7/7 process) for envelope changes | Not implemented | 17060 | — | **NOT IMPLEMENTED** |
| 14-G | Emergency functions (pauseMinting, pauseRedeeming, forceRebalance, resumeOperations) — `onlyEmergencyCouncil` | `pause()`/`unpause()` are `onlyPauser` (instant, no 4/7 multi-sig); no `forceRebalance`, no `pauseRedeeming` separately | 17368–17407 | `MTQSigmaV2.sol:140–141` | **DIVERGENT** — emergency powers collapsed to a single pauser role |
| 14-H | Dispatch to operations contract via `IOperations(ops).applyParameter` | No separate operations contract — parameters are applied in-place via `_applyParam(key, value)` | 17344–17358 | `MTQSigmaV2.sol:932–945` | **DIVERGENT** — governance and execution are co-located |

**Fidelity verdict: DIVERGENT.** Only 1 of 4 governance layers is implemented (Monetary 48h timelock); the Constitutional 90d, Risk 24h, and Emergency instant paths are all absent; the four governance-address identities are not enforced; the parameter envelope structure is missing; veto is missing.

---

### Listing 15 — §25.5 Honest status declaration

**Master specifies (blueprint lines 19078–19420):**
- A **separate contract** `MTQSigmaHonestStatus` with two governance addresses (`constitutionalCouncil`, `riskCouncil`).
- **11 validation gates** (Smart Contract Audit, Independent Model Validation, Sharia Certification, Legal Opinion, Public Testnet Deployment, Penetration Testing, Institutional Review, Liquidity Bootstrapping, Governance Launch, Community Stress Test, Mainnet Deployment Approval).
- State: `bool[11] gatePassed`, `uint256[11] gatePassedAt`, `bytes32[11] gateEvidenceHash`.
- `getHonestStatus()` returns a **prose string** declaring: "MTQ Sigma v2.0-testnet — ADAPTIVE METHODOLOGY, NOT FIXED WEIGHTS. DEPLOYED ON ARC / MONAD / SOLANA DEVNET. NOT PRODUCTION-AUTHORIZED. All oracles and assets are SIMULATED for testing purposes. Live weights are validation-stage values computed by the published MASE/MARP methodology and reproducible from published data. … No percentage is a final optimal weight until all 11 validation gates have passed."
- `isProductionAuthorized()` returns `true` only if **all 11** gates passed (degrades honestly if a gate is revoked).

**Implementation:**
- `MTQSigmaV2.sol::getHonestStatus` (lines 1030–1040): returns `(uint256 implementedMask, uint8 blueprintMajor, uint8 contractVersion, string statusDeclaration)` with `implementedMask = 0x7FF` (all 11 v1.0 bits set, where "11 bits" is a different concept from the 11 validation gates — the bits encode which v1.0 features are claimed-implemented). The prose string is similar in spirit to the Master's text.
- `blueprint.ts::HONEST_STATUS` (lines 193–201) is a 7-row prose table; not a contract.
- No 11-gate tracking in either TS or contract.
- No `isProductionAuthorized()` function.

**Divergences:**
| # | Master specifies | Code implements | Master line | Code line | Verdict |
|---|---|---|---:|---:|---|
| 15-A | Returns a **prose string** declaring "NOT PRODUCTION-AUTHORIZED" | `MTQSigmaV2.sol` returns a packed tuple with a 32-bit `implementedMask = 0x7FF` (claimed-implemented bits) — this is the audit's 0x7FF-overstatement issue | 19165–19186 | `MTQSigmaV2.sol:1030–1040` | **DIVERGENT** — the mask representation is an addition, not the Master's prose form; and the value 0x7FF is overstated |
| 15-B | 11 validation gates with `gatePassed[11]` / `gateEvidenceHash[11]` / `isProductionAuthorized()` | Not implemented anywhere | 19105–19227 | — | **NOT IMPLEMENTED** |
| 15-C | Honesty claim is binary "all 11 gates passed = production authorized" | Honesty claim is a static 0x7FF mask (no gate tracking) | 19211–19221 | `MTQSigmaV2.sol:1036` | **DIVERGENT** — claims 0x7FF (all bits set) without gate evidence |

**Fidelity verdict: DIVERGENT.** The Master's 11-gate validation framework is absent; the contract's `getHonestStatus` returns an overstated 0x7FF mask (audit verdict: honest value is `0x5A7`, strict value `0x427`).

---

## 4. Critical Reconciliation Findings

The cross-cutting divergences — the places where the implementation's math or topology does not match the Master — are consolidated here. Each finding lists the Master line and the implementation line so any future custodian can verify without re-reading the whole blueprint.

### Finding 1 — CHF base fixing: Master 1.13 vs code 0.88
- **Master:** `BASE_CHF_USD = 1.1300e8` (Listing 1, line 1486; Listing 3, line 3945; Listing 10, line 12744; Listing 12, line 14452 — all four Listings pin 1.13). §3.4 genesis snapshot also says "CHF/USD 1.1300" (line 1921).
- **Code:** `BASE_FIXINGS.CHF_USD = 0.8800` (`blueprint.ts:50`); `BASE_CHF_USD = 0.88e18` (`MTQSigmaV2.sol:175`); `engine.ts::initReserveState` line 219 divides by `0.88`.
- **Effect:** CHF is **underweighted by ~22%** in the GFB base denominator (0.05 × 0.88 = 0.044 vs 0.05 × 1.13 = 0.0565). The denominator is too small, so the GFB index is overstated by ~0.0017 (small but real — the audit's F-CHF-01 finding). **This is a NEW issue discovered during this reconciliation — it appears in the prior audit reports but not in the headline P0 list; it deserves explicit classification as NEW.**

### Finding 2 — Chain-linked index: Master recursive vs code Laspeyres aggregate
- **Master:** Listing 3 (lines 3894–3926, 4100–4183) specifies the recursive chain-linked recursion:
  ```
  I_t = I_{t-1} × Σ_i W_{i,t-1} × (P_{i,t} / P_{i,t-1})
  ```
  with persistent state `indexValue` (I_t), `lastPrices[7]` (P_{i,t-1}), `lastWeights[7]` (W_{i,t-1}), `chainLinkDivisor` (cumulative product of D_t). Weights come from the MASE registry (Listing 2) via `weightRegistry.getLiveWeights()`. `updateIndex()` is a keeper-callable per-period advance.
- **Code:** `engine.ts::computeGfbIndex` (lines 381–396) and `MTQSigmaV2.sol::getGFB` (lines 420–431) compute a **Laspeyres fixed-base aggregate**: `GFB_t = Σ W^Prior_i × P_{i,t} / GFB_BASE_DENOMINATOR` where `GFB_BASE_DENOMINATOR` is computed once from the immutable Strategic Prior + base fixings and never updated. Weights are the **immutable** `STRATEGIC_PRIOR` / `PRIOR_*` constants — the `commitWeights()`-stored MASE weights are **never consumed** by `getGFB`.
- **Effect:** Gold at $2,500/oz contributes `0.26 × 2500 = $650` to the numerator (out of ~$655 total), so gold's *effective* index weight is **~99.9% by USD notional**, not 26%. A +50% gold shock causes the GFB index to grow 50% (the liability) while the reserve (26% gold) grows only 13%, so `RR = 1.10 × (1.13/1.50) = 0.83` — below the 1.00 hard floor. This is the audit's P0-1 finding and the dominant root cause of 6 of 11 stress scenarios failing (S5 = 0% survival).

### Finding 3 — MASE registry: Master separate contract with roles + velocity + stress-adaptive rho vs code 1/N equal-weight ensemble
- **Master:** Listing 2 (lines 2661–2900) specifies a **separate contract** `MASEWeightRegistry` with three roles (`riskCouncil` 4/7, `constitutionalCouncil` 7/7, `submitter`), per-component `MAX_VELOCITY = [0.005, 0.005, 0.003, 0.003, 0.002, 0.002, 0.005]` enforced in `submitTargetWeights`, and **stress-adaptive smoothing** `smoothingRhoNormal = 0.50, smoothingRhoStress = 0.75` with `W_smooth = rho × W_prev + (1 − rho) × W_target`.
- **Code:** `mase.ts` (290 lines) implements a 6-model ensemble **blended with equal 1/N weights** (lines 215–225 — no OOS-performance-based adaptation per Master §7.6). `mase.ts::smoothWeights` uses a single `SMOOTHING_LAMBDA = 0.20` (lines 245–255) — a fixed 20% weight to the new target, opposite sign convention from Master's `rho`. `mase.ts::applyEnvelopes` clamps per-component to admissibility envelopes. No velocity limits. No stress-adaptive rho. No separate contract — `commitWeights` is a function inside `MTQSigmaV2.sol` callable by `onlyOracleOrKeeper`.
- **Effect:** (a) The ensemble doesn't adapt to model performance — every model contributes equally regardless of OOS score. (b) Smoothing can't slow down under stress (rho can't rise to 0.75), so weights can move too fast in a crisis. (c) No velocity guard, so a single weight commit can swing a component by its entire envelope range. (d) Role separation between riskCouncil/constitutionalCouncil/submitter is collapsed into a single keeper role.

### Finding 4 — Risk states: Master 6 (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY) vs code 5 (STRESS collapsed)
- **Master:** Listing 13 (lines 15457–17000) specifies SIX states with thresholds:
  - NORMAL `rr ≥ 1.10 && lcr ≥ 1.00`
  - CAUTION `rr ≥ 1.05 && lcr ≥ 0.90`
  - **STRESS `rr ≥ 1.02 && lcr ≥ 0.80`** (with mint paused, redeem fee 0.50%, emergency rebalancing)
  - DEFENSIVE `rr ≥ 1.00 && lcr ≥ 0.70` (mint paused, redeem fee 1.00%, forced rebalancing)
  - EMERGENCY `rr < 1.00` (mint paused, **redemption PAUSED**, rebalancing paused)
  - RECOVERY (solvency ≥ hard floor but ratios not back to NORMAL; mint 25%, redeem fee 0.30%)
- **Code:** `engine.ts::determineStatus` (lines 489–495) — FIVE states (`NORMAL → CAUTION → DEFENSIVE → EMERGENCY → RECOVERY`); `blueprint.ts::RISK_STATE_MACHINE` (lines 184–190) — 5 entries; `MTQSigmaV2.sol::Status` enum (line 212) — 5 values. STRESS is collapsed into DEFENSIVE.
- **Effect:** (a) The protocol skips the "moderate stress" tier (1.02 ≤ RR < 1.05) and jumps from CAUTION (1.05–1.10) straight to DEFENSIVE (1.00–1.02). (b) The DEFENSIVE redeem fee is **0.50%** in code (`engine.ts:994`, `MTQSigmaV2.sol:506`) but the Master says DEFENSIVE = **1.00%** (`redeemFeeDefensive = 0.010e18`, Listing 13 line 15513) — code uses the STRESS fee for the DEFENSIVE state. (c) EMERGENCY redemption is NOT paused (code uses 2% fee, line 995/507), contradicting Master line 15827–15829 `_pauseRedeeming()`. This is the audit's P0-3 + F-EMERG-01 findings.

### Finding 5 — Governance: Master 4 layers (Constitutional 90d / Monetary 48h / Risk 24h / Emergency instant) + 4 governance addresses vs code 1 timelock + ADMIN_ROLE
- **Master:** Listing 14 (lines 17003–19075) specifies FOUR governance layers via a separate `GovernanceParameterRegistry` contract:
  - Constitutional — `TIMELOCK_CONSTITUTIONAL = 90 days`, 7/7 Multi-Sig, for envelope changes and architecture-level parameters.
  - Monetary — `TIMELOCK_MONETARY = 48 hours`, DAO 51%, for RR target, fees, smoothing params (with Risk-Council veto within the window).
  - Risk — `TIMELOCK_RISK = 24 hours`, Risk Council 4/7, for haircuts, thresholds, eject params, LCR target.
  - Emergency — instant, Emergency Council 4/7 (hardware wallets), for pause/eject/rebalance.
  Four governance addresses: `dao`, `riskCouncil`, `emergencyCouncil`, `constitutionalCouncil`.
- **Code:** `MTQSigmaV2.sol` (lines 103–108, 300–324, 895–945) — **ONE `TIMELOCK_DELAY = 48 hours`** (only the Monetary tier). Five AccessControl roles (DEFAULT_ADMIN_ROLE, ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE, KEEPER_ROLE, ORACLE_ROLE) are placeholders for the four governance addresses but don't enforce distinct timelocks or quorums. `queueChange(onlyAdmin)` → wait 48h → `executeChange(anyone)` — no veto, no Risk path, no Constitutional path, no Emergency-instant path.
- **Effect:** Any privileged parameter change (e.g., raising the mint fee from 10bps to 100bps) takes 48h, not the 90-day Constitutional timelock that §22.3 requires for fundamental architecture changes. The contract's `getHonestStatus()` returns `0x7FF` (bit 9 = `daoGovernance` set), but the honest value is **bit 9 = 0** — only the Monetary layer is implemented. This is the audit's P0-4 finding.

### Finding 6 — Redemption: Master §19.3.2 prices against NAV_t = V_net/S_circ vs code prices against P_MTQ (GFB index)
- **Master:** §19.3.2 Step 2 (blueprint line 13325): `RedeemValue_(USD) = Y × NAV_(t)` where `NAV_(t) = V_(net,t) / S_(circ,t)` (line 13317). Invariant I6 (§2.6) declares this.
- **Code:** `engine.ts::applyRedeem` line 996: `const grossUsd = inputMtq × price` where `price = computeMtqPrice(gfb)` = the GFB index (P_MTQ). `MTQSigmaV2.sol::redeem` line 509: `uint256 grossUsd18 = mtqAmount × price / 1e18` where `price = getMTQPrice()` = the GFB index. The TS engine adds `auditNavPerToken / auditGrossUsdNav / auditDeltaUsd / auditNote` fields (lines 969–972) that compute the §12.2 / §19.3.2 NAV figure as informational, but settles on the §3.4.2 P_MTQ value as canonical. The contract has no NAV companion field.
- **Effect:** This is a **blueprint-level contradiction** (§3.4.2 "redeem at P_MTQ" vs §19.3.2 "redeem at NAV_t"). The implementation chose the arbitrage-safe §3.4.2 interpretation. The Master Prompt §39 explicitly classifies this as a CONFIRMED finding (the implementation diverges from §19.3.2) — the fix is to rewrite `applyRedeem` to use `NAV_t` (per the Master) OR to amend the Master to explicitly adopt §3.4.2 (per the implementation's defensible choice). The audit's P0-2 finding.

### Finding 7 — getMTQPrice: Master reads from getIndex() (chain-linked) vs code computes Laspeyres directly
- **Master:** Listing 1 line 1592: `getMTQPrice() { uint256 indexValue = getIndex(); return (indexValue × 1e18) / INDEX_BASE_DENOMINATOR; }` — where `getIndex()` returns the chain-linked `I_t` from Listing 3.
- **Code:** `engine.ts::computeMtqPrice` (line 399–402): `return gfb` where `gfb = computeGfbIndex(fx)` is the Laspeyres aggregate. `MTQSigmaV2.sol::getMTQPrice` (line 436–438): `return getGFB()` which is the same Laspeyres form. Neither reads from a chain-linked `getIndex()` because no such chain-linked state machine exists in either TS or contract.
- **Effect:** Subsumed by Finding 2 — the price function is the wrong variable (Laspeyres aggregate instead of chain-linked I_t).

---

## 5. Summary Scorecard — Implementation Fidelity by Listing

The fidelity verdict per Listing is summarized below. The composite score is weighted by the criticality of the Listing to the protocol's monetary architecture (Listings 1, 2, 3, 11, 13, 14 are weighted more heavily because they pin the index formula, the weighting engine, the redemption pricing, the risk topology, and the governance topology — the 5 P0 areas).

| Listing | §section | Weight | Verdict | Score (×100) | Notes |
|---:|---|---:|---|---:|---|
| 1 | §2.7 | 10% | PARTIAL | 70 | Constants faithful; CHF base wrong (Finding 1); MAX_VELOCITY missing; 4 governance addresses missing; getMTQPrice reads wrong variable |
| 2 | §7.7 | 10% | PARTIAL | 45 | 6-model ensemble present but equal-weight; no separate role-separated contract; velocity limits absent; stress-adaptive rho absent (Finding 3) |
| 3 | §9.8 | 15% | DIVERGENT | 25 | Laspeyres instead of recursive chain-linked; MASE weights never consumed; no `GenesisVerified` event; no `chainLinkDivisor` (Finding 2 — the single most consequential divergence) |
| 4 | §10.x | 8% | PARTIAL | 65 | 6-level decision logic faithful in TS; contract missing RR<1.05 override (C4); no-trade band and benefit margin diverge |
| 5 | §10.8 | 4% | PARTIAL | 60 | Quote simulation faithful in TS; contract has no aggregator wiring; H4 — redeem lacks `getMTQPriceWithGuard` |
| 6 | §14.1 | 8% | PARTIAL | 70 | NAV/RR faithful; LCR missing from contract; only TARGET-tier RR settable in contract |
| 7 | §5.5 | 5% | PARTIAL | 75 | 8 criteria / 4 states / concentration faithful; 48h Constitutional timelock missing |
| 8 | §16 | 5% | PARTIAL | 80 | Buffer state machine + 5-layer waterfall faithful; EMERGENCY redemption not paused (F-EMERG-01) |
| 9 | §17 | 5% | PARTIAL | 65 | Consensus mechanics faithful; source-independence (H8) and zero-price guard (C6) missing; CHF/USD pair missing in TS; no asset-class-specific gold confidence |
| 10 | §18 | 5% | PARTIAL | 60 | Liability + supply faithful; price reads from Laspeyres not chain-linked (Finding 7); CHF base fixing wrong |
| 11 | §19 | 10% | DIVERGENT | 30 | Redemption priced against P_MTQ not NAV_t (Finding 6); release not proportional to actual composition; fees not in Operational Wallet in contract (F-FEE-01) |
| 12 | §20 | 5% | PARTIAL | 55 | Genesis seeding + treasury sweep faithful in TS; contract: C5 (genesisMint(0) guard), no Operational Wallet, no sweep, same CHF base fixing |
| 13 | §21.6 | 10% | DIVERGENT | 35 | 5 vs 6 states (Finding 4); DEFENSIVE fee undercharged 0.5% vs 1.0%; EMERGENCY redemption not paused; no restrictiveness ranking / 48h confirmation; reintegration weights 5pp off |
| 14 | §22.6 | 10% | DIVERGENT | 25 | 1 of 4 governance layers (Finding 5); 4 governance addresses collapsed to 5 AccessControl roles; no Risk path; no Constitutional 90d; no Emergency-instant; no veto |
| 15 | §25.5 | 5% | DIVERGENT | 30 | 11-gate validation framework absent; 0x7FF mask overstated (honest value 0x5A7, strict 0x427); prose form replaced with packed tuple |

**Composite weighted score:** Σ (weight × score) = 10×70 + 10×45 + 15×25 + 8×65 + 4×60 + 8×70 + 5×75 + 5×80 + 5×65 + 5×60 + 10×30 + 5×55 + 10×35 + 10×25 + 5×30 = 700 + 450 + 375 + 520 + 240 + 560 + 375 + 400 + 325 + 300 + 300 + 275 + 350 + 250 + 150 = **5,470 / 100 = 54.7**

### Implementation fidelity composite: **55 / 100**

This matches the audit's per-discipline verdicts within rounding (TS engine 62, contract 62, average 62), with the lower reconciliation-grade score reflecting that this report treats the **Master as the single source of truth** and counts every divergence (even pilot-defensible ones like the §3.4.2 vs §19.3.2 redemption price choice) as a fidelity reduction.

### Headline reconciliation conclusions

1. **The implementation is a faithful pilot of the Master's *surface* but diverges from the Master's *constitution* on four P0 points:** the chain-linked index (Listing 3), the redemption price variable (Listing 11), the 6-state risk machine (Listing 13), and the 4-layer governance (Listing 14).
2. **The single most consequential divergence is Listing 3** (Laspeyres vs recursive chain-linked). It is a math error, not a security bug, but its economic consequence is total protocol failure under the +50% gold stress the protocol was designed to withstand.
3. **Three new divergences discovered during this reconciliation that are not in the prior audit's headline P0 list:** (a) the CHF base fixing 0.88 vs 1.13 (Finding 1) — appears in audit-d but not in the P0 list; (b) the stress-adaptive MASE smoothing rho 0.50/0.75 not implemented (Finding 3 sub-item D); (c) the per-component weight velocity limits `MAX_VELOCITY` not enforced (Finding 3 sub-item C). These are tracked as NEW issues in Deliverable B.

---

*End of Deliverable A — Implementation Reconciliation Report.*
