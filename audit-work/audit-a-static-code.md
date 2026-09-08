# MTQΣ v1.0 Master Blueprint — Static Code Audit (AUDIT-A)

**Task ID:** AUDIT-A
**Agent:** general-purpose
**Scope:** Line-by-line static audit of the TypeScript reference engine against the *MTQΣ Master Monetary Architecture v1.0* (blueprint-v1.0.txt, 21,227 lines).
**Files audited (READ ONLY — no code modified):**
- `src/lib/mtq/blueprint.ts` (272 lines)
- `src/lib/mtq/engine.ts` (1,836 lines — task brief said 1,446; actual file is larger)
- `src/lib/mtq/mase.ts` (290 lines)
- `src/lib/mtq/marp.ts` (155 lines)
- `src/lib/mtq/oracle.ts` (201 lines)
- `src/lib/mtq/registry.ts` (166 lines)
- `src/lib/mtq/fx.ts` (154 lines)
- `src/lib/mtq/pilot-state.ts` (382 lines)
- (`brand.ts` skipped per task brief — not monetary.)

**Status markers used below:** ✅ MATCH · ⚠️ DIVERGENCE · ❌ MISSING · ℹ️ INFORMATIONAL.

---

## Executive Summary

The TypeScript reference engine is a **competent pilot of the v1.2 architecture with a partial v1.0 overlay**, not a faithful implementation of the v1.0 Master Blueprint. Constants, governance, admissibility envelopes, the four-state weight distinction, oracle quorum/pause logic, three-floor RR, the dynamic buffer, and the geopolitical eject ladder are faithfully reproduced. However, the engine fails on **one constitutional invariant (I6 — redemption priced against P_MTQ instead of NAV_t)**, **collapses §21.2's six risk states into five (missing S3 STRESS)**, **does not implement the recursive chain-linked index of §9.2** (it uses a static weighted aggregate), **does not implement §17.6 gold oracle confidence mathematics**, **uses 1/N equal ensemble weights instead of §7.6 adaptive softmax**, and **does not compute the §7.4 composite MASE objective** (no Strategic-Prior / Diversification / Turnover penalties — the ensemble is a flat average of six model outputs). The MARP execution path (currently feature-flagged off) additionally implements the §11.5.3 direction lock **backwards** and lacks the RR<1.05 override. The §13.3 gold index/reserve separation is an accounting split only — the same MASE gold target drives the reserve rebalance, exactly what §13.3 forbids. The pilot is honest about its limitations (VIX/DXY simulated, oracle feeds synthetic witnesses, no production authorization) and the gap between "pilot approximation" and "v1.0 production target" is documented in code comments, but several divergences are silent (the redemption price bug and the MARP direction-lock inversion are the most consequential). **Final score: 62/100 — strong pilot, not a faithful v1.0 implementation, with one P0 finding on a constitutional invariant.**

---

## Findings Table

| Blueprint § | Spec requirement | Implementation status | Severity |
|---|---|---|---|
| §2.6 I1 | PAR = 1.00 immutable | ✅ `blueprint.ts:98 PAR = 1.00` | — |
| §2.6 I2 | RR_t ≥ 1.00 at all times | ✅ `blueprint.ts:101 RR_HARD = 1.00`; engine clamps status to EMERGENCY when RR<1.00 | — |
| §2.6 I3 (REVISED) | Fixed methodology, not fixed weights | ✅ `blueprint.ts:107-110`; STRATEGIC_PRIOR + MASE + envelopes | — |
| §2.6 I4 | V_net uses asset-specific haircuts | ✅ `blueprint.ts:118-121 HAIRCUTS`; `engine.ts:427-436` applies per-asset | — |
| §2.6 I5 | Minting priced against P_MTQ | ✅ `engine.ts:880 applyMint`: `minted = netUsd / price` where `price = computeMtqPrice(gfb)` | — |
| **§2.6 I6** | **Redemption priced against NAV_t = V_net/S_circ** | **❌ `engine.ts:933 applyRedeem`: `grossUsd = inputMtq * price` (P_MTQ/GFB index), not `Y × NAV_t`. Engine's `REDEMPTION_POLICY` claims this is a "§3.4.2 vs §12.2 reconciliation" but §3.4.2 contains no redemption-pricing doctrine. Blueprint §19.1, §19.3.2 Step 2, and §25.4 Honest Status Table all unambiguously require `RedeemValue = Y × NAV_t`.** | **P0** |
| §2.6 I7 | Layered governance hierarchy | ✅ `blueprint.ts:174-179 GOVERNANCE_HIERARCHY` (4 layers) — but invariant itself missing from CONSTITUTIONAL_INVARIANTS list (see §2.6 list below) | P2 |
| §2.6 I8 | No single actor can change monetary policy | ❌ Not enumerated in `blueprint.ts:106-115 CONSTITUTIONAL_INVARIANTS` (only I1–I6, I10, I11 listed) | P2 |
| §2.6 I9 | Oracle quorum (timestamp + confidence + deviation) | ❌ Not enumerated in CONSTITUTIONAL_INVARIANTS; §17.3.4 source independence NOT honored — all 3 feeds derive from same reference price | P2 |
| §2.6 I10 | Honest status publication | ✅ `blueprint.ts:113, 192-213 HONEST_STATUS + UNSUPPORTED_CLAIMS` | — |
| §2.6 I11 | Daily calc ≠ daily trading | ⚠️ `engine.ts evaluateRebalance` enforces "trade only on justified trigger" via cost-benefit gate ✓; but engine runs every 4s (pilot-state tick) not daily — see §10.1 | P2 |
| §2.6 I12 | Gold index/reserve allocation separate | ⚠️ `engine.ts:140-176, 195-230 commitIndexGold` provides accounting split (indexPaxg/indexXaut vs reservePaxg/reserveXaut); but the MASE gold target IS used as the reserve gold rebalance target via `marpDecision(observed, smoothed, …)` in `buildMaseSnapshot` — engines NOT independent. Also missing from CONSTITUTIONAL_INVARIANTS list. | P1 |
| §2.3 | Four-state weight distinction (W^Prior / W^Target / W^Smooth / W^Execution) | ✅ `blueprint.ts:87-95 WEIGHT_STATE_DESCRIPTIONS`; `engine.ts MetricsSnapshot.weightStates` exposes all four (prior, target, smoothed, execution) | — |
| §3.2 | Strategic Prior USD 27 / EUR 20 / JPY 9 / GBP 8 / CNY 5 / CHF 5 / Gold 26 | ✅ `blueprint.ts:22-30 STRATEGIC_PRIOR` matches §3.2 verbatim | — |
| §3.4 | Genesis weight init (USD-equivalent notionals = strategic prior) | ✅ `engine.ts:124-180 initReserveState` splits $1.1M × STRATEGIC_PRIOR across 7 components | — |
| §3.4 base fixings | EUR 1.05 / GBP 1.25 / JPY 0.0067 / CNY 0.14 / CHF 1.13 / Gold 2500 | ⚠️ `blueprint.ts:45-52 BASE_FIXINGS` matches all EXCEPT CHF: engine uses 0.88, blueprint §3.4 says "CHF/USD 1.1300" (i.e., 1 CHF = $1.13). fx.ts correctly returns ~$1.13 from Frankfurter via `1/r.CHF` inversion; the base fixing 0.88 is wrong (likely confused USD/CHF with CHF/USD). Genesis GFB drift ~0.002% from 1.0 if FX is live. | P2 |
| §3.5 / §18.4 | Price safety band 0.50 ≤ P_MTQ ≤ 2.00 | ✅ `blueprint.ts:128-129 PRICE_SAFETY_LOWER=0.50, UPPER=2.00` | — |
| §8.1 | Admissibility envelopes USD 23-32 / EUR 17-24 / JPY 7-12 / GBP 6-11 / CNY 3-7 / CHF 3-7 / Gold 20-32 | ✅ `blueprint.ts:67-75 ADMISSIBILITY_ENVELOPES` matches §8.1 verbatim | — |
| **§9.2** | **Chain-linked index: I_t = I_{t-1} × Σ W_{i,t-1} × P_{i,t}/P_{i,t-1}** | **❌ `engine.ts:347-361 computeGfbIndex` uses STATIC aggregate `Σ W^Prior × P_i / GFB_base`. §9.3 chain-link adjustment at rebalance (D_t = B_t⁻/B_t⁺) also missing.** | **P1** |
| §5.1 | Multi-Horizon Volatility σ_{i}^{MH} over {30d, 90d, 252d, 756d} | ⚠️ `mase.ts:267-290 estimateVolatility` uses single window; `engine.ts:1279-1294 estimateVolsFromState` uses VIX-scaled single-horizon. Code comment acknowledges "Pilot approximation." | P2 |
| §5.2 | Gold-Relative Purchasing-Power Signal GPR over {30, 90, 252, 756}d | ⚠️ `mase.ts:134-166 modelPurchasingPower` uses single-horizon price-relative (P_i vs base fixing), not multi-horizon GPR | P2 |
| §5.3 | Z-score standardization (rolling 90d, ε=1e-9) | ✅ `engine.ts:462-475 computeZScores` matches §5.3 (90-day rolling, ε=1e-9) | — |
| §5.4 | Regime Model: SIX regimes {Normal, Inflation, Deflation, Stress, Liquidity, Geopolitical} | ⚠️ `engine.ts:1305-1316 detectRegime` returns only 4: {calm, normal, stress, crisis}; labels don't match blueprint | P2 |
| §5.5 | Crisis-Risk Score (CrisisScore_t) aggregating 7 inputs | ❌ Not implemented as a dedicated score; regime detection is a coarse proxy | P2 |
| §6.3 | Model 1: Minimum Variance | ⚠️ `mase.ts:47-67 modelMinimumVariance` uses inverse-volatility weighting as approximation (no covariance matrix); code comment acknowledges | P2 |
| §6.4 | Model 2: Equal Risk Contribution (Risk Parity) | ⚠️ `mase.ts:72-79 modelEqualRiskContribution` uses naive 1/N equal weight (no iterative ERC solver); code comment acknowledges | P2 |
| §6.5 | Model 3: Maximum Diversification | ⚠️ `mase.ts:84-100 modelMaxDiversification` uses prior/vol approximation (no diversification ratio maximization); code comment acknowledges | P2 |
| §6.6 | Model 4: Tail Risk (CVaR) | ⚠️ `mase.ts:105-129 modelCVaR` uses heuristic prior×stress-multiplier, not true CVaR optimization at 95th percentile; code comment acknowledges | P2 |
| §6.7 | Drawdown Control (MDD envelope) | ❌ Not implemented as a constraint/penalty in the ensemble | P2 |
| §6.8 | Purchasing-Power objective (GPP, PPError) | ⚠️ `mase.ts:134-166 modelPurchasingPower` approximates via inverse price-relative; no GPP index from CPI inputs; code comment acknowledges | P2 |
| §7.1 | Strategic-Prior Penalty (soft anchor in objective) | ❌ Not implemented; the engine's `maseEnsemble` does not minimize a composite objective with prior-drift penalty — it averages model outputs | P1 |
| §7.2 | Diversification (Concentration) Penalty | ❌ Not implemented as part of objective (only the §8.1 hard envelopes constrain concentration) | P1 |
| §7.3 | Turnover Penalty | ❌ Not implemented as part of objective (turnover cap exists at execution layer §11.5.2, but not as a J-term) | P1 |
| §7.4 | Full Composite MASE Objective J(ΔW) | ❌ Not implemented — the engine's "ensemble" is a flat 1/N average of model outputs | P1 |
| §7.6 | Adaptive Model Weights (softmax of OOS performance) | ❌ `mase.ts:215-217 maseEnsemble` uses `1/models.length` equal weight; code comment explicitly says "Production: ensemble weights adapt based on model performance" | P1 |
| §8.4 | Stress-adaptive smoothing λ=0.20 EMA | ✅ `blueprint.ts:143 SMOOTHING_LAMBDA=0.20`; `mase.ts:245-255 smoothWeights` applies EMA | — |
| §10.1 | Daily calculation vs actual rebalancing | ⚠️ Pilot runs every 4s (TICK_MS=4000) with SIM_TICK_HOURS=0.25 simulating 15 min/tick; not daily. Informational — pilot cadence, not a fidelity bug. | ℹ️ |
| §10.3 | MARP Hierarchy (Levels 0-5) | ⚠️ `marp.ts:82-138 marpDecision` implements only 5 of 6 levels: no Level 1 Natural Flow (the helper `naturalCashFlowPreference` exists at marp.ts:143 but is never called from the decision pipeline), no Level 4 Structural Change, no Level 5 Emergency as distinct steps | P2 |
| §10.4 / §11.2 | Deviation formula Δ_t = W^obs − W^target | ✅ `engine.ts:527-529 evaluateRebalance` computes `deviation = observed - target`; `marp.ts:82 deviation = observed[c] - target[c]` | — |
| §10.8 / §11.3 | Cost-benefit gate (marginal benefit > execution cost) | ✅ `engine.ts:550-560 evaluateRebalance`; `marp.ts:48-59 costBenefitGate` both implement (simplified) cost-benefit | — |
| §11.3 | Dynamic Trigger Conditions (6 levels) | ⚠️ Legacy `evaluateRebalance` combines Levels 0/2/3 into a single gate; MARP path collapses Levels 1/4/5. Partial match only. | P2 |
| §11.4 | Liquidity-Sensitive Trade Sizing (10% of 24h pool depth) | ✅ `blueprint.ts:149 MAX_POOL_FRACTION=0.10`; `engine.ts:540-542 evaluateRebalance` uses `MAX_POOL_FRACTION × poolDepth24h` (poolDepth24h=$4M hardcoded for pilot) | — |
| §11.5.1 | Slippage Guard (1% both-sided vs oracle) | ✅ `blueprint.ts:147 SLIPPAGE_TOLERANCE=0.01`; `engine.ts:1647-1662 simulateQuote` implements two-sided guard; `engine.ts:547-548` legacy path checks estimated cost | — |
| §11.5.2 | Max Daily Turnover (5% NAV) | ✅ `blueprint.ts:148 MAX_DAILY_TURNOVER=0.05`; `engine.ts:543-545 evaluateRebalance` and `engine.ts:740-747 applyMarpRebalance` both enforce | — |
| §11.5.3 | Direction Lock (24h) + override when RR<1.05 | ⚠️ Legacy `engine.ts:519-524 evaluateRebalance` CORRECTLY implements same-direction block + RR<1.05 override (`inStress = rr < RR_STRESS`). But MARP path `engine.ts:755-762 applyMarpRebalance` INVERTS the lock (blocks opposite-direction reaction instead of same-direction repetition) and LACKS the override. Latent bug — MARP execution is feature-flagged off (`USE_MARP_EXECUTION=false` in pilot-state.ts:63). | P1 |
| §13.3 | Gold Index ≠ Reserve allocation (independent engines) | ⚠️ `engine.ts:140-176, 195-230 commitIndexGold + syncReserveFromTotal + syncTotalFromReserve` provide accounting split. BUT `buildMaseSnapshot` uses `mase.target` (MASE gold weight) as the smoothed target that drives `marpDecision(observed, smoothed, …)` for the reserve gold rebalance. §13.3 explicitly forbids: "the gold index weight is not a reserve target." Engines are NOT independent. | P1 |
| §14.1 | Haircuts table (asset-specific) | ✅ `blueprint.ts:118-121 HAIRCUTS`; engine applies per-asset in `reserveAssetValues` | — |
| §14.2 | Three Floors (TARGET 1.10 / STRESS 1.05 / HARD 1.00) | ✅ `blueprint.ts:99-101` matches §14.2.1 verbatim | — |
| §14.4.1 | Gold-Cost Rule (GoldSold>0 ⇒ ExceptionalCondition) | ⚠️ Engine sells gold for ordinary drift correction (which IS enumerated as "Methodology-driven allocation change: MASE target gold weight change executed through MARP gates"). But no explicit governance check for layer-5 core-gold consumption in `applyLoss`. | P2 |
| §16.2 | Dynamic Buffer BASE 62.5% / STRESS 85% / EMERGENCY 100% | ✅ `blueprint.ts:155-157 BUFFER_GOLD_BASE=0.625/STRESS=0.85/EMERGENCY=1.00`; `engine.ts:483-492 bufferBaseGoldRatio` matches §16.2 | — |
| §16.4 | First-Loss Waterfall (5 layers) | ⚠️ `engine.ts:1597-1614 applyLoss` implements all 5 layers in correct order (surplus → bufferFiat → bufferGold → coreFiat → coreGold). BUT §16.4 requires Layer 5 (Core Gold) consumption to require 4/7 Multi-Sig "Exhaustion Certificate" — engine does not enforce this governance gate. | P2 |
| §17.3.1 | Staleness (60s major FX/gold, 120s minor FX/VIX/DXY) | ⚠️ `oracle.ts:43 STALENESS_MS=60_000` uniform for ALL pairs. Blueprint differentiates 60s (EUR, GBP, Gold) vs 120s (JPY, CNY, VIX, DXY). Engine doesn't feed VIX/DXY through oracle, so only the JPY/CNY 60s vs 120s discrepancy is operative. | P2 |
| §17.3.2 | Confidence interval (<0.5% major FX, <1.0% minor/gold, <2.0% VIX/DXY) | ⚠️ `oracle.ts:44 CONFIDENCE_MAX_PCT=0.01` uniform for all. Blueprint differentiates 0.5% / 1.0% / 2.0% by asset class. | P2 |
| §17.3.3 | Deviation circuit breaker (<2.5% from median) | ✅ `oracle.ts:45 DEVIATION_MAX_PCT=0.025`; `oracle.ts:124-132` enforces | — |
| §17.3.4 | Source independence (≥2 distinct source families) | ❌ `oracle.ts:55-69 witness()` derives Pyth + Chronicle from the SAME reference price (Frankfurter/gold-api) with synthetic noise. All 3 feeds share one source family. Engine code comment acknowledges this is a pilot limitation. | P2 |
| §17.6 | Gold Oracle Confidence Mathematics (geometric aggregate of 5 factors, C_min=0.60) | ❌ `oracle.ts` outputs only `paused: boolean` and `spreadBps`. No `Confidence_G` score, no f(SourceAgreement, Freshness, Liquidity, Deviation, SourceCoverage). | P1 |
| §19.1 I5 | Minting priced against P_MTQ (adaptive index) | ✅ `engine.ts:880-895 applyMint` — `minted = (netUsd / price) × throttle` where `price = computeMtqPrice(gfb)`. | — |
| §19.1 I6 | Redemption priced against NAV_t | ❌ See §2.6 I6 row above — engine uses `inputMtq × price` (P_MTQ), not `Y × NAV_t`. The `auditGrossUsdNav` field is computed but explicitly NOT used as settlement. | **P0** |
| §19.2.2 | Step-by-step minting (7 steps) | ⚠️ `applyMint` implements Steps 1-3, 6-7 (fee, fetch price, compute amount, mint, update reserve). Steps 4 (atomic swap into full basket) and 5 (slippage guard `minMTQOut`) are NOT enforced — the pilot simply credits USDC split across 3 issuers. | P2 |
| §19.3.2 | Step-by-step redemption (8 steps, NAV_t pricing) | ❌ Step 1 (fetch NAV) is computed for audit only (`auditNavPerToken`); Step 2 uses P_MTQ instead of NAV_t (P0). Steps 4-6 (proportional basket release, full basket, optional router) partially implemented. | P0/P2 |
| §19.4 | Slippage Guard Mathematics | ⚠️ `engine.ts:873-881 applyMint` rejects when `!priceInSafetyBand(price)` (circuit breaker, not user-set `minMTQOut`). `applyRedeem` similarly. User-supplied `τ_user` not accepted — the API takes only `{amount, chain, wallet}`. | P2 |
| **§21.2** | **Six risk states (S1-S6) including S3 STRESS** | **❌ `engine.ts:464-470 determineStatus` has only 5 branches (NORMAL / CAUTION / DEFENSIVE / EMERGENCY / RECOVERY). The 1.02 ≤ RR < 1.05 range (S3 STRESS in §21.2) is collapsed into DEFENSIVE. `blueprint.ts:182 ProtocolStatus` type and `:184-190 RISK_STATE_MACHINE` table also list only 5 entries. RECOVERY branch is unreachable (returns after EMERGENCY). §21.3 48h-confirmation transition logic entirely missing.** | **P0** |
| §22.3 | Four Governance Layers (Constitutional 7/7 90d / Monetary DAO 51% 48h / Risk 4/7 24h / Emergency 4/7 instant) | ✅ `blueprint.ts:174-179 GOVERNANCE_HIERARCHY` matches §22.3 exactly | — |
| §24.4 | Rebalancing Decision Log (9 required fields) | ⚠️ `audit-trail.ts:105-146 persistRebalancingDecision` (called from `pilot-state.ts:284-294`) captures: tickAt, DecisionID (implicit DB id), navUsd, RR, observed/target weight (gold only — not full 7-component vector), deviationPct, direction, tradeUsd, reason, applied, pre/post-trade gold/fiat nets. MISSING: RiskScore (no crisis score field), ExpectedBenefit/ExpectedCost as numeric (encoded in `reason` text only), ExecutionPrice, full weight vectors. The pilot writes the log on every evaluated decision (including "no" decisions) per §24.4. | P2 |
| §25.2 | Supported claims | ✅ `blueprint.ts:192-201 HONEST_STATUS` (7 entries) covers §25.4 status table rows | — |
| §25.3 | Unsupported claims | ✅ `blueprint.ts:203-213 UNSUPPORTED_CLAIMS` (8 entries) matches §25.3 | — |
| §25.4 | Honest Status Table | ✅ HONEST_STATUS + UNSUPPORTED_CLAIMS reproduced (condensed from blueprint's 12 rows to 7+8). Production-Not-Authorized status is the headline. | — |

---

## Critical Findings (P0 / P1 / P2 with code citations)

### P0 — Constitutional invariant I6 violation: redemption priced against P_MTQ, not NAV_t

**Blueprint requirement (§2.6 I6, §19.1, §19.3.2 Step 2, §25.4):**
> "Redemption is always priced against NAV_t, never against a fixed USD peg." — §2.6 I6
> "RedeemValue_(USD) = Y × NAV_(t)" — §19.1
> "Step 2 — Compute the redemption value. RedeemValue_(USD) = Y × NAV_(t)" — §19.3.2
> "Minting / Redemption FIXED — priced against the reference index. MTQ_minted = X_net / P_{MTQ,t}; RedeemValue = Y × NAV_t (Chapter 19)." — §25.4 Honest Status Table

**Engine implementation (`src/lib/mtq/engine.ts:925-935`):**
```ts
const gfb = computeGfbIndex(fx);
const price = computeMtqPrice(gfb);  // price = gfb (the GFB index value)
…
const grossUsd = inputMtq * price; // redemption is priced against the GFB Index (§3.4.2)
```

The engine computes `auditNavPerToken = vals0.nav / circ` and `auditGrossUsdNav = inputMtq × auditNavPerToken` for "audit only" but does NOT use them as the settlement price. The `REDEMPTION_POLICY` constant (`engine.ts:1707-1716`) justifies this as a "§3.4.2 vs §12.2 reconciliation" — but **§3.4.2 of the v1.0 blueprint contains no redemption-pricing doctrine** (it's "Genesis Weight Initialization"). The engine appears to have carried over the v1.2 behavior (where `RedeemValueUSD = Y × P_{MTQ,t}` per v1.2 blueprint line 433) and mis-attributed the contradiction to a non-existent v1.0 section.

**Economic consequence:** at RR > 100%, the NAV_per_token (= V_net/S_circ) is HIGHER than P_MTQ. Pricing redemption against P_MTQ under-pays redeemers — the protocol keeps the buffer surplus that the v1.0 spec says belongs to the redeemer (the buffer surplus represents the excess collateral the redeemer is entitled to claim, per §16.3 `V_buffer,t = 0.10 × S_circ × P_MTQ,t`). This is a monetary-policy divergence, not just a labeling issue: it changes who gets the buffer surplus on exit.

**Severity: P0** — direct violation of a constitutional invariant (I6). Either the engine must be fixed to price redemption at NAV_t (matching the blueprint), or the blueprint must be amended (which is a §22.3 Constitutional-layer 7/7 + 90d-timelock act, not a developer decision).

---

### P0 — §21.2 SIX risk states collapsed to FIVE; S3 STRESS missing

**Blueprint requirement (§21.2):**
> "The protocol classifies itself into exactly six risk states, labeled S1 through S6 … State_(t) = F(RR_(t), LCR_(t)) ∈ {S₁,…,S₆}"
> - S1 NORMAL: RR ≥ 1.10 AND LCR ≥ 1.00
> - S2 CAUTION: 1.05 ≤ RR < 1.10 OR LCR < 0.90 (entry: "RR<1.10 or LCR<1.00")
> - S3 STRESS: 1.02 ≤ RR < 1.05 OR LCR < 0.90 (entry: "RR<1.05 or LCR<0.90") — "Minting paused. Redemption fee raised to 0.50%. Emergency rebalancing triggered."
> - S4 DEFENSIVE: 1.00 ≤ RR < 1.02 OR LCR < 0.80 — "Redemptions throttled (fee 1.00%). Rebalancing forced."
> - S5 EMERGENCY: RR < 1.00 (any LCR)
> - S6 RECOVERY: RR ≥ 1.05 (rising) AND LCR ≥ 0.90, from a more restrictive state after 48h sustained confirmation

**Engine implementation (`src/lib/mtq/engine.ts:464-470`):**
```ts
export function determineStatus(rr: number, lcr: number): ProtocolStatus {
  if (rr >= RR_TARGET && lcr >= LCR_TARGET) return "NORMAL";        // S1
  if (rr >= RR_STRESS && lcr >= 0.9) return "CAUTION";                // S2 (LCR≥0.9)
  if (rr >= RR_HARD) return "DEFENSIVE";                              // covers S3 (1.02-1.05) AND S4 (1.00-1.02) — collapsed
  if (rr < RR_HARD) return "EMERGENCY";                              // S5
  return "RECOVERY";                                                  // unreachable
}
```

And the constants (`src/lib/mtq/blueprint.ts:182-190`):
```ts
export type ProtocolStatus = "NORMAL" | "CAUTION" | "DEFENSIVE" | "EMERGENCY" | "RECOVERY";
// STRESS is NOT in the type union.

export const RISK_STATE_MACHINE = [
  { status: "NORMAL",    …,  rrTarget: 1.10 },
  { status: "CAUTION",   …,  rrTarget: 1.08 },
  { status: "DEFENSIVE", …,  rrTarget: 1.05 },
  { status: "EMERGENCY", …,  rrTarget: 1.00 },
  { status: "RECOVERY",  …,  rrTarget: 1.08 },
];  // 5 entries — STRESS row missing
```

**Consequences:**
1. The 1.02 ≤ RR < 1.05 range (S3 STRESS) is treated as DEFENSIVE in the engine, but §21.2 specifies different action profiles:
   - S3 STRESS: minting paused, redemption fee 0.50%, emergency rebalancing triggered
   - S4 DEFENSIVE: redemptions throttled with fee 1.00%, rebalancing forced, governance notified
   The engine's `applyMint` and `applyRedeem` use only the 5-state `ProtocolStatus`, so the S3 minting-pause and the 0.50% redemption fee are never triggered. `applyRedeem` uses `feeBps = 50` (0.50%) only when `status === "DEFENSIVE"` — which the engine sets for both S3 and S4 ranges. So the 0.50% fee IS triggered but at the wrong threshold boundary (1.05 instead of 1.02).
2. The `determineStatus` LCR check is incomplete: the blueprint says "the worse of the two metrics is always the binding constraint." The engine only checks LCR in CAUTION (`lcr >= 0.9`); DEFENSIVE ignores LCR (should be `LCR < 0.80`), and STRESS ignores LCR (should be `LCR < 0.90`).
3. The RECOVERY branch (`return "RECOVERY"`) is unreachable — every RR ≥ RR_HARD (1.00) returns NORMAL/CAUTION/DEFENSIVE first; every RR < 1.00 returns EMERGENCY. The function never falls through to RECOVERY.
4. §21.3 transition logic (48h sustained confirmation for upward transitions) is NOT implemented at all — the engine re-derives status from instantaneous (RR, LCR) every snapshot.

**Severity: P0** — direct deviation from the §21.2 normative state machine. Affects minting gate, redemption fee schedule, and emergency-rebalance triggering across the entire 1.02 ≤ RR < 1.05 stress band.

---

### P1 — §9.2 chain-linked index NOT implemented (static weighted aggregate instead)

**Blueprint requirement (§9.2):**
> "I_(t) = I_(t-1) [ Σ_(i) W_(i,t-1) (P_(i,t))/(P_(i,t-1)) ]" — COO-16 form
> "the recursion runs with a fixed weight vector and the index is a pure weighted price-relative aggregate; at an accepted update, the chain-link adjustment of Section 9.3 preserves continuity."

The blueprint REQUIRES that weight changes not create artificial index returns. Between accepted weight updates, the index advances by the weighted price-relative using the START-OF-PERIOD weights. At a weight update, a chain-link divisor (§9.3 D_t = B_t⁻/B_t⁺) preserves continuity.

**Engine implementation (`src/lib/mtq/engine.ts:347-361`):**
```ts
export function computeGfbIndex(fx: Pick<FxRates, ...>): number {
  const numerator =
    STRATEGIC_PRIOR.USD  * 1.0 +
    STRATEGIC_PRIOR.EUR  * fx.EUR_USD +
    STRATEGIC_PRIOR.JPY  * fx.JPY_USD +
    STRATEGIC_PRIOR.GBP  * fx.GBP_USD +
    STRATEGIC_PRIOR.CNY  * fx.CNY_USD +
    STRATEGIC_PRIOR.CHF  * fx.CHF_USD +
    STRATEGIC_PRIOR.Gold * fx.XAU_USD;
  return numerator / GFB_BASE_DENOMINATOR;
}
```

This is a STATIC Laspeyres-style aggregate using the genesis STRATEGIC_PRIOR weights and base-date fixings — NOT a recursive chain-linked index. The engine never updates the weight vector inside `computeGfbIndex` (it always uses STRATEGIC_PRIOR), so the MASE-computed target/smoothed weights never actually flow into the index calculation. §9.3 chain-link divisor at rebalance is also missing.

**Consequence:** if the MASE ensemble target moves (say gold from 26% to 28%), the engine's GFB index will NOT reflect this — it keeps using the genesis prior. The published weights (`weightStates.target/smoothed`) are decoupled from the index valuation. This is the "biggest missing equation" (COO-16) of the original spec, replicated in the engine.

**Severity: P1** — the chain-linked methodology is the keystone of the v1.0 "fixed methodology, not fixed weights" invariant (I3); a static aggregate with the genesis prior is structurally a fixed-weight index.

---

### P1 — §17.6 Gold Oracle Confidence Mathematics NOT implemented

**Blueprint requirement (§17.6):**
> "Confidence_(G) = f(SourceAgreement, Freshness, Liquidity, Deviation, SourceCoverage)"
> "Confidence_(G) < C_(min) ⇒ OracleDegraded"
> "Confidence_(G) = A^(β_A) · F^(β_F) · L^(β_L) · D^(β_D) · C^(β_C),  Σ β_k = 1,  C_min = 0.60"

The blueprint requires a gold-specific confidence SCORE (a [0,1] number from a geometric aggregate of 5 factors), with degraded mode triggered when the score drops below C_min = 0.60.

**Engine implementation (`src/lib/mtq/oracle.ts`):**
The oracle outputs only:
- `validCount: number` (count of feeds passing staleness + confidence + deviation)
- `finalPrice: number` (median or average)
- `method: "median" | "average" | "paused"`
- `paused: boolean`
- `spreadBps: number`

There is **no `Confidence_G` field**, no `SourceAgreement/Freshness/Liquidity/Deviation/SourceCoverage` factor computation, no geometric aggregate, no C_min threshold. The engine never enters a "degraded" mode for the gold oracle — only a binary "paused" when fewer than 2 feeds are valid.

**Consequence:** §17.6 says "three perfectly agreeing sources that are one second from staleness do not produce a publishable price" — but the engine will publish a gold price derived from 3 agreeing feeds that are all 59s old (just under the 60s threshold). The §17.6 confidence gradient is missing.

**Severity: P1** — §17.6 is explicitly a [COO-20] closure item (the v1.2 blueprint "supplied the oracle architecture but not the confidence calculation"). Its absence means the engine cannot detect gradual gold-feed degradation, only binary outages.

---

### P1 — §7.6 Adaptive Model Weights: 1/N equal ensemble instead of softmax of OOS performance

**Blueprint requirement (§7.6):**
> "α_(m,t) = (e⁻^(η Score)_(m,t))/(Σ_(k) e⁻^(η Score)_(k,t))"
> "Score_(m,t) = f(OOSRisk, CVaR, PPError, Turnover, Robustness)"

The ensemble weights must be a softmax of out-of-sample performance-stability scores, NOT equal weights. The score itself is a function of 5 OOS metrics, and the temperature η bounds how fast influence can shift (a fourth anti-oscillation defense).

**Engine implementation (`src/lib/mtq/mase.ts:215-225`):**
```ts
// Equal-weight ensemble
const ensembleWeight = 1 / models.length;
const target: WeightVector = { USD: 0, EUR: 0, … };
for (const m of models) {
  for (const c of COMPONENTS) {
    target[c] += m.weights[c] * ensembleWeight;
  }
}
```

The code comment explicitly acknowledges: "In the pilot: equal-weight ensemble (each model gets 1/6 weight). Production: ensemble weights adapt based on model performance." So this is a known, deferred divergence, not a silent bug.

**Consequence:** a model that consistently underperforms in OOS testing receives the same 1/6 weight as the best-performing model. The §7.6 anti-oscillation defense (no single model can dominate abruptly, but better models receive greater influence) is absent. The "ensemble" is structurally a flat average.

**Severity: P1** — deferred implementation but the spec is unambiguous; this is one of the §7.6 design pillars of v1.0 (vs the v1.2 single-engine approach).

---

### P1 — §13.3 Gold Index/Reserve Separation: accounting split only, engines NOT independent

**Blueprint requirement (§13.3):**
> "W_(Gold)^(Index) ≠ W_(Gold)^(Reserve)"
> "Neither is an input to the other — the gold index weight is not a reserve target, and the reserve holding is not evidence about the index."
> "the index gold weight may traverse its envelope without automatically triggering any reserve trade — a reserve trade must independently justify itself through the reserve engine and the MARP execution gates"

The v1.0 spec requires TWO INDEPENDENT ENGINES for gold: MASE for the index gold weight (the unit), and a separate reserve engine (driven by redemption risk, settlement liquidity, custody risk) for the reserve gold holding.

**Engine implementation:**
- Accounting split exists: `engine.ts:140-176` adds `indexPaxg/indexXaut/reservePaxg/reserveXaut` fields; `commitIndexGold()` (`engine.ts:195-230`) is the keeper-role way to move gold between the two pools; `syncReserveFromTotal` and `syncTotalFromReserve` maintain the invariant `total = index + reserve`.
- BUT the rebalance target IS the MASE gold weight: `engine.ts:1393-1416 buildMaseSnapshot` computes `mase.target` (MASE ensemble gold weight) → `constrained` (after envelopes) → `smoothed` (EMA) → `marpDecision(observed, smoothed, …)`. The MARP per-component decision for Gold uses the MASE-computed gold target as the reserve gold target.

So the engine PHYSICALLY separates the gold holdings into two accounting buckets, but the rebalance LOGIC uses the MASE gold target (which §13.3 says is for the index) as the reserve rebalance target (which §13.3 says must come from a separate reserve engine driven by redemption risk, settlement liquidity, custody risk).

**Consequence:** a MASE-driven increase in the index gold weight (e.g., from 26% to 28%) directly triggers a reserve gold rebalance to buy more gold — exactly the forced reserve turnover that §13.3 says must NOT happen ("index-driven drift never becomes forced reserve turnover").

**Severity: P1** — the separation is bookkeeping, not architectural. §13.3 is the "single most important rule" per §2.1, referenced from invariant I12.

---

### P1 — §11.5.3 MARP direction lock INVERTED + missing RR<1.05 override

**Blueprint requirement (§11.5.3):**
> "If the engine sold gold in the last 24 hours, it cannot sell gold again (but it can buy gold if the deviation reverses direction)."
> "If the engine bought gold in the last 24 hours, it cannot buy gold again (but it can sell gold)."
> "Exception. The direction lock is overridden if the reserve ratio drops below 1.05 (Stress Mode)."

The lock blocks REPETITION of the SAME direction (sold → cannot sell again); the OPPOSITE-direction trade remains available. Override: when RR < 1.05, the lock is bypassed to protect solvency.

**Legacy `evaluateRebalance` implementation (`src/lib/mtq/engine.ts:519-524`):** ✅ CORRECT
```ts
const inStress = rr < RR_STRESS;  // 1.05
if (!inStress && Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
  if ((deviation > 0 && s.lastTradeDir === -1) || (deviation < 0 && s.lastTradeDir === 1)) {
    return { …, reason: "Direction lock (24h whipsaw guard)" };
  }
}
```
- `deviation > 0` → sell gold (direction = -1)
- `lastTradeDir === -1` → last trade was a sell
- Blocked: "would sell again after selling" ✓ (matches §11.5.3 "cannot sell gold again")
- `inStress` (RR<1.05) bypasses the lock ✓ (matches the override)

**MARP `applyMarpRebalance` implementation (`src/lib/mtq/engine.ts:755-762`):** ❌ INVERTED
```ts
if (Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
  if ((dir === 1 && s.lastTradeDir === -1) || (dir === -1 && s.lastTradeDir === 1)) {
    skippedCount++;
    traces.push({ …, skipReason: 'direction lock (24h whipsaw guard)' });
    continue;
  }
}
```
- `dir === 1` (BUY) AND `lastTradeDir === -1` (last was SELL) → blocked
- This blocks the OPPOSITE-direction reaction (BUY after SELL), which §11.5.3 explicitly says should be AVAILABLE: "the opposite-direction trade remains available, so the protocol is never trapped away from its target."

The MARP path also lacks the `inStress` RR<1.05 override entirely.

**Consequence (latent — MARP execution is feature-flagged off via `USE_MARP_EXECUTION=false` in pilot-state.ts:63):** if the MARP path were enabled, the protocol would be UNABLE to react to a genuine deviation reversal within 24h — exactly the opposite of the spec's intent. The same-direction repetition that §11.5.3 is designed to prevent would NOT be blocked.

**Severity: P1** — latent bug in the v1.0 production-target execution path. Currently masked by the feature flag, but would be a critical execution-layer bug if MARP execution is enabled without fix.

---

### P1 — §7.4 Composite MASE Objective NOT implemented (no Strategic-Prior / Diversification / Turnover penalties)

**Blueprint requirement (§7.1, §7.2, §7.3, §7.4):**
> §7.1: Strategic-Prior Penalty (soft anchor): the objective penalizes drift from W^Prior
> §7.2: Diversification (Concentration) Penalty
> §7.3: Turnover Penalty
> §7.4: "The Full MASE Objective" J(ΔW) combining all the above with the candidate-model objective

The blueprint specifies a composite objective `J` that the optimizer minimizes — combining tracking error, strategic-prior drift, concentration, turnover, and execution cost. The strategic prior enters ONLY through this penalty term (§3.2: "The prior enters the MASE objective only through the StrategicDrift penalty term, so it influences but never dictates").

**Engine implementation (`src/lib/mtq/mase.ts:200-225 maseEnsemble`):**
The engine does NOT minimize any composite objective. It computes 6 model weight vectors, then averages them with 1/N weights. The Strategic Prior (W^Prior) is used only:
- as the initial genesis weight (correct)
- as a tilt inside `modelMaxDiversification` (prior/vol)
- as a tilt inside `modelCVaR` (prior × stress multiplier)
- as a tilt inside `modelPurchasingPower` (prior / price)
- as the fallback prev-smoothed in `smoothWeights`

But it is NOT used as a soft anchor in a composite objective. There is no J(ΔW) to minimize — the engine just averages model outputs.

**Consequence:** the prior cannot "influence but never dictate" because there is no penalty term where it acts as an anchor. The §7.1 soft-anchor design is structurally absent. The §7.2 concentration penalty is replaced by the §8.1 hard envelopes (which is a different mechanism — envelopes reject out-of-bounds weights outright; penalties steer toward in-bounds gradually). The §7.3 turnover penalty is absent (turnover cap exists at execution, but not as an objective term).

**Severity: P1** — the composite objective is the heart of §7; the engine's "ensemble" is a flat average of model outputs, structurally equivalent to a single "average model" rather than an optimizer.

---

### P2 findings (summary — see Findings Table for full citations)

- **§2.6 Invariants list incomplete** — `blueprint.ts:106-115` lists only I1–I6, I10, I11 (8 invariants); missing I7, I8, I9, I12. The invariants ARE honored elsewhere (I7/I8 via GOVERNANCE_HIERARCHY; I9 via oracle validation; I12 via the gold split), but they're not in the canonical CONSTITUTIONAL_INVARIANTS array.
- **§3.4 base fixing CHF** — `blueprint.ts:50 CHF_USD=0.88` is the inverse of §3.4's "CHF/USD 1.1300". Genesis GFB drifts ~0.002% from 1.0 if FX is live (small because CHF is only 5% of basket).
- **§5.1 Multi-Horizon Volatility** — engine uses single-horizon VIX-scaled vols; blueprint requires {30, 90, 252, 756}d blend.
- **§5.2 Gold-Relative Purchasing-Power Signal** — engine uses single-horizon price-relative, not multi-horizon GPR.
- **§5.4 Regime Model** — engine has 4 regimes (calm/normal/stress/crisis); blueprint has 6 (Normal/Inflation/Deflation/Stress/Liquidity/Geopolitical).
- **§5.5 Crisis-Risk Score** — not implemented as a dedicated score; regime detection is a coarse proxy.
- **§6.3-§6.6 Candidate Models** — all 4 implemented as simplified approximations (inverse-vol for minvar, 1/N for ERC, prior/vol for maxdiv, prior×stress for CVaR). Code comments acknowledge each.
- **§6.7 Drawdown Control** — missing as a constraint.
- **§6.8 Purchasing-Power objective** — approximated via inverse price-relative; no GPP index from CPI.
- **§10.1 Daily cadence** — pilot runs every 4s (SIM_TICK_HOURS=0.25 simulating 15 min/tick), not daily. Informational.
- **§10.3 MARP Hierarchy Levels 1, 4, 5** — Natural Flow / Structural Change / Emergency not implemented as distinct levels. The `naturalCashFlowPreference` helper exists but is never called from the decision pipeline.
- **§11.3 Dynamic Trigger Levels 1, 4, 5** — same as above.
- **§14.4 Gold-Cost Rule** — engine sells gold for ordinary drift correction (which IS one of the enumerated exceptional conditions: "Methodology-driven allocation change"); but no explicit governance check for layer-5 core-gold consumption.
- **§16.4 First-Loss Waterfall Layer 5 (Core Gold)** — 4/7 Multi-Sig Exhaustion Certificate not enforced in `applyLoss`.
- **§17.3.1 Staleness** — uniform 60s for all pairs; blueprint differentiates 60s (major FX, gold) vs 120s (minor FX, VIX, DXY).
- **§17.3.2 Confidence width** — uniform 1%; blueprint differentiates 0.5% / 1.0% / 2.0% by asset class.
- **§17.3.4 Source Independence** — all 3 oracle feeds derive from same reference price (acknowledged pilot limitation).
- **§19.2.2 Minting Steps 4-5** — atomic swap into full basket and user-supplied `minMTQOut` slippage guard not enforced.
- **§19.3.2 Redemption** — Steps 1-2 use P_MTQ instead of NAV_t (see P0 above); Steps 4-6 partially implemented.
- **§19.4 Slippage Guard Mathematics** — user-supplied `τ_user` not accepted; engine uses circuit-breaker band only.
- **§24.4 Rebalancing Decision Log** — partial fields captured (missing RiskScore, ExpectedBenefit/Cost numeric, ExecutionPrice, full 7-component weight vectors).

---

## Informational Findings

- **Pilot cadence vs §10.1 daily cadence** — the pilot runs a 4-second tick (TICK_MS=4000) with SIM_TICK_HOURS=0.25 (each tick simulates 15 minutes of macro time). This is ~96 ticks per simulated day. The engine therefore advances macro state far faster than the daily cadence the blueprint specifies. This is a deliberate pilot-speed choice (documented in `pilot-state.ts:50`), not a fidelity bug — but it means timing-sensitive logic (24h direction lock, 48h confirmation periods, RAMP_DURATION_HOURS=24 buffer ramp) is accelerated by ~96× in the pilot.
- **§17.4 Gold Price Reference Unit (LBMA spot basis)** — the engine uses `gold-api.com` (generic spot) and `metalpriceapi.com` as fallback (`fx.ts:91-111`). The blueprint specifies "an investment-grade, deliverable troy-ounce-equivalent quantity struck on the LBMA spot basis." The pilot feeds are not LBMA-specific, but the gold price reference unit is a methodology parameter not a code-level invariant.
- **Simulated VIX/DXY** — `fx.ts:11` and `engine.ts:1498-1501 stepMacroSignals` acknowledge that VIX/DXY are simulated via stochastic mean-reverting walk. The UI labels these as "SIMULATED PILOT MACRO SIGNALS." This is honestly disclosed (Reconciliation F3 in `engine.ts:getReconciliationFindings`).
- **Oracle feeds are synthetic witnesses** — `oracle.ts:55-69 witness()` derives Pyth + Chronicle from the Frankfurter/gold-api reference with small independent noise. Honestly disclosed in `oracle.ts:9-18`.
- **MARP execution feature-flagged off** — `pilot-state.ts:63 USE_MARP_EXECUTION = false`. The legacy §7 single-direction rebalance path is the active execution path; the MARP per-component path is computed but not applied. This is the right pilot choice for stability, but it means the P1 MARP direction-lock inversion is latent.
- **Genesis gold 50/50 split** — `engine.ts:155-167` chooses a 50/50 split between index and reserve gold (rather than e.g. 26%/74% matching the strategic prior). Code comment explains: "A 26/74 split would leave index gold at only ~6.8% of NAV — far below the 26% index weight it is supposed to back." This is a reasonable pilot choice but means the index gold is over-collateralized relative to its 26% weight.

---

## Reconciliation Matrix — Where the TS Engine Diverges, Is It the Safer Choice or a Bug?

| # | Divergence | Engine's rationale | Safer choice or bug? |
|---|---|---|---|
| 1 | Redemption priced against P_MTQ instead of NAV_t (I6) | "§3.4.2 vs §12.2 reconciliation; §3.4.2 arbitrage-safe" | **BUG** — §3.4.2 contains no redemption-pricing doctrine; blueprint UNAMBIGUOUSLY requires NAV_t. The engine's audit comment misrepresents the spec. The v1.0 spec says redeemers get the buffer surplus (V_net/S_circ); the engine keeps it. |
| 2 | 5 risk states instead of 6 (S3 STRESS missing) | (silent — constants table has 5 rows) | **BUG** — §21.2 normative table is "exactly six risk states, labeled S1 through S6." The 1.02 ≤ RR < 1.05 stress band gets the wrong action profile (DEFENSIVE 1.00% fee + forced rebalance instead of STRESS 0.50% fee + emergency rebalance). |
| 3 | Static GFB aggregate instead of chain-linked (§9.2) | (silent — code comment describes the formula but doesn't acknowledge divergence) | **BUG** — the engine's computeGfbIndex always uses STRATEGIC_PRIOR; MASE target weights never flow into the index. The "fixed methodology, not fixed weights" invariant I3 is structurally violated. |
| 4 | 1/N equal ensemble instead of adaptive softmax (§7.6) | "Production: ensemble weights adapt based on model performance" (acknowledged in code comment) | **KNOWN DEFFERAL** — honestly disclosed; pilot approximation. Not a silent bug. P1 because spec is unambiguous. |
| 5 | MARP direction lock inverted + no RR<1.05 override | (silent) | **LATENT BUG** — currently masked by `USE_MARP_EXECUTION=false`. If enabled, would prevent opposite-direction reactions (the opposite of the spec's intent). P1 because the MARP path is the documented v1.0 production target. |
| 6 | Gold index/reserve engines NOT independent (§13.3) | "commitIndexGold is the keeper-role equivalent; index gold is LOCKED" — but the MASE gold target IS the reserve rebalance target | **BUG** — accounting separation is correct but the engines are coupled. §13.3 explicitly forbids using the index gold weight as a reserve target. |
| 7 | §17.6 gold confidence score missing | (silent — oracle outputs only paused/spreadBps) | **BUG** — §17.6 is a [COO-20] closure item; the gold oracle cannot detect gradual feed degradation, only binary outages. |
| 8 | §7.4 composite MASE objective missing | (silent — ensemble is a flat average of model outputs) | **BUG** — §7.1-§7.4 design (prior as soft anchor in J) is structurally absent; the prior cannot "influence but never dictate." |
| 9 | CHF base fixing 0.88 vs §3.4's 1.13 | "CHF_USD: 0.8800, ~0.88 USD per CHF" (blueprint.ts:50) — appears to be a USD/CHF vs CHF/USD convention confusion | **BUG** — small numerical impact (CHF is 5% of basket → ~0.002% GFB drift at genesis with live FX). P2. |
| 10 | Uniform 60s staleness / uniform 1% confidence | (silent) | **BUG** — §17.3.1-2 differentiate by asset class. P2 — pilot limitation, not a safety regression (60s is stricter than 120s for minor FX). |
| 11 | Oracle source independence not honored | Acknowledged in code comment (no real Chainlink/Pyth/Chronicle feeds in pilot) | **HONEST LIMITATION** — pilot cannot do real source-family diversity without on-chain feeds; correctly disclosed. P2. |
| 12 | VIX/DXY simulated | Acknowledged in code comment + UI label | **HONEST LIMITATION** — no free no-key VIX/DXY feed exists; correctly disclosed. P2. |
| 13 | MARP Levels 1/4/5 not implemented | `naturalCashFlowPreference` helper exists but is never called; structural-change and emergency are not distinct levels | **KNOWN DEFFERAL** — pilot implements the workhorse levels (0/2/3); full hierarchy deferred. P2. |
| 14 | First-Loss Waterfall Layer 5 missing 4/7 Multi-Sig gate | (silent) | **BUG** — §16.4 requires Exhaustion Certificate for core-gold consumption. Pilot's `applyLoss` consumes core gold without governance check. P2 (pilot doesn't actually take losses in normal operation). |

---

## Final Score — 62/100

### Breakdown

| Section | Weight | Score | Notes |
|---|---|---|---|
| §2.6 Constitutional Invariants | 15 | 8/15 | I1, I2, I3, I4, I5, I10 ✓; I6 ❌ P0; I7, I8, I9, I12 missing from constants (I12 partially honored via accounting split, but engines not independent); I11 partial |
| §3 Basket (strategic prior, genesis, base fixings) | 8 | 7/8 | §3.2 ✓; §3.4 ✓; CHF base fixing wrong (P2) |
| §8.1 Admissibility envelopes | 5 | 5/5 | Verbatim match |
| §9 Chain-Linked Index | 10 | 2/10 | §9.2 recursive form NOT implemented (P1); §9.3 chain-link divisor NOT implemented (P1); static aggregate only |
| §5 MASE Input Signals | 8 | 4/8 | §5.3 z-scores ✓; §5.1/§5.2 multi-horizon ⚠️; §5.4 4/6 regimes ⚠️; §5.5 CrisisScore ❌ |
| §6 Candidate Models | 10 | 6/10 | All 4 candidate models present as approximations (P2); §6.7 Drawdown ❌; §6.8 PPP partial |
| §7 Composite Objective + Ensemble | 12 | 3/12 | §7.1-§7.4 composite objective ❌ P1; §7.6 adaptive weights ❌ P1; §8.4 smoothing ✓ |
| §10 MARP Hierarchy | 6 | 3/6 | §10.3 partial (3 of 6 levels); §10.4 no-trade zone ✓; §10.8 cost-benefit ✓ |
| §11 Execution Mechanics | 10 | 7/10 | §11.2 deviation ✓; §11.4 liquidity sizing ✓; §11.5.1 slippage ✓; §11.5.2 turnover ✓; §11.5.3 direction lock ✓ (legacy) but ❌ (MARP) P1 |
| §13.3 Gold Separation | 5 | 2/5 | Accounting split ✓; engines NOT independent (P1) |
| §14 Reserve Valuation & Risk | 5 | 4/5 | §14.1 haircuts ✓; §14.2 three floors ✓; §14.4 gold-cost rule partial |
| §16 Dynamic Buffer | 4 | 3/4 | §16.2 three states ✓; §16.4 waterfall ✓ (5 layers) but missing Layer 5 governance gate (P2) |
| §17 Oracle | 8 | 4/8 | §17.3.1/3.3 ✓ (uniform thresholds ⚠️); §17.3.2 uniform ⚠️; §17.3.4 independence ❌; §17.6 confidence score ❌ P1 |
| §19 Mint/Redeem | 8 | 3/8 | §19.1 I5 mint ✓; §19.1 I6 redeem ❌ P0; §19.2.2/§19.3.2 steps partial; §19.4 slippage guard partial |
| §21 Risk State Machine | 8 | 2/8 | §21.2 5 of 6 states ❌ P0; §21.3 48h confirmation ❌; S3 STRESS action profile wrong |
| §22.3 Governance | 4 | 4/4 | Verbatim match |
| §24.4 Decision Log | 3 | 2/3 | Partial fields captured; missing RiskScore / ExpectedBenefit-Cost / ExecutionPrice / full vectors |
| §25 Honest Status | 3 | 3/3 | HONEST_STATUS + UNSUPPORTED_CLAIMS faithfully reproduced |
| **TOTAL** | **132** | **82/132 = 62%** | **Final score: 62/100** |

### Severity counts
- **P0 (constitutional / direct spec violation):** 2 — (1) I6 redemption pricing, (2) §21.2 six-state machine
- **P1 (critical architecture divergence):** 6 — (3) §9.2 chain-linked index, (4) §17.6 gold confidence, (5) §7.6 adaptive ensemble, (6) §13.3 gold engines not independent, (7) §11.5.3 MARP direction lock inverted, (8) §7.4 composite objective
- **P2 (fidelity gap / informational):** 18 — see Findings Table

### Top 3 critical findings (verbatim for the orchestrator summary)
1. **P0 — Redemption priced against P_MTQ, not NAV_t (I6 violation)** — `engine.ts:933 applyRedeem` uses `inputMtq × price` (GFB index), not `Y × NAV_t` as required by §2.6 I6, §19.1, §19.3.2 Step 2, §25.4. The engine's `REDEMPTION_POLICY` justification cites a non-existent §3.4.2.
2. **P0 — §21.2 SIX risk states collapsed to FIVE; S3 STRESS (1.02 ≤ RR < 1.05) missing** — `engine.ts:464-470 determineStatus` and `blueprint.ts:182-190 RISK_STATE_MACHINE` both have only 5 entries. The 1.02–1.05 band gets the wrong action profile (DEFENSIVE 1.00% fee + forced rebalance instead of STRESS 0.50% fee + emergency rebalance). §21.3 48h confirmation entirely missing.
3. **P1 — §9.2 chain-linked index NOT implemented** — `engine.ts:347-361 computeGfbIndex` is a static Laspeyres-style aggregate using the genesis STRATEGIC_PRIOR; the recursive form `I_t = I_{t-1} × Σ W_{i,t-1} × P_{i,t}/P_{i,t-1}` and §9.3 chain-link divisor are both absent. MASE target weights never flow into the index — invariant I3 ("fixed methodology, not fixed weights") is structurally violated.

---

## Audit provenance

- Blueprint extracted to `/home/z/my-project/audit-work/blueprint-v1.0.txt` (21,227 lines, verified via `wc -l`).
- All 8 in-scope TS files read in full via `Read` tool (no `find`/`grep` bash commands used; all searches via the `Grep` tool).
- No code was modified (READ-ONLY audit per task brief).
- Audit-trail.ts was read for §24.4 verification (it's the persistence layer called from pilot-state.ts) but is not in the formal audit scope.
- `brand.ts` was skipped per task brief (not monetary).
