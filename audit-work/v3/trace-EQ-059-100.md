# Traceability Records EQ-059..EQ-100

Task ID: 2-e · Scope: §8 constraints/smoothing → §9 chain-linked index → §10 MARP → §11–12 execution mechanics.
Implementation under audit: `/home/z/my-project/src/lib/mtq/` (mase.ts 438, chain-index.ts 453, marp.ts 167, engine.ts 2522, blueprint.ts 475, pilot-state.ts 596, audit-trail.ts 358, state-machine.ts 358).
Status: CANDIDATE FOR PUBLIC TESTING — NOT PRODUCTION-AUTHORIZED (unchanged by this audit; read-only).

Key parameter values (blueprint.ts, all cited):
- ADMISSIBILITY_ENVELOPES §8.1 (blueprint.ts:73–81): USD 0.23–0.32 · EUR 0.17–0.24 · JPY 0.07–0.12 · GBP 0.06–0.11 · CNY 0.03–0.07 · CHF 0.03–0.07 · Gold 0.20–0.32.
- MAX_VELOCITY §8.3 (blueprint.ts:236–239): USD 0.005 · EUR 0.005 · JPY 0.003 · GBP 0.003 · CNY 0.002 · CHF 0.002 · Gold 0.005 (per accepted update).
- SMOOTHING_RHO_NORMAL 0.50 / SMOOTHING_RHO_STRESS 0.75 / CRISIS_SCORE_STRESS_THRESHOLD 0.70 (blueprint.ts:224–226).
- NO_TRADE_BAND_BASE 0.0075 (0.75%, §11.8 Listing 4) / NO_TRADE_BAND_STRESS 0.015 (§11.6 crisis widening) (blueprint.ts:255–256).
- MIN_PROFITABILITY_USD 10 (ε, Listing 5 §12.8) (blueprint.ts:261). MAX_DAILY_TURNOVER 0.05, MAX_POOL_FRACTION 0.10, DIRECTION_LOCK_HOURS 24, SLIPPAGE_TOLERANCE 0.01 (blueprint.ts:242–245). SLIPPAGE_TOLERANCES: stable 0.5% / gold 1.0% / minor-FX 1.5% (blueprint.ts:182–186). DEFAULT_USER_SLIPPAGE 0.005 (§19.7).

Cadence note (applies to all §8–§12 items): the pilot tick loop runs every TICK_MS = 4000 ms (pilot-state.ts:67, 198–205). "Daily" calculation is therefore simulated per-tick (e2e treats 1 tick = 1 day, e2e-integration.ts:178). Rounding: all TS math is float64; no fixed-point rounding in the reference engine (contract-side 1e18 noted in chain-index.ts:28). `fin()` (audit-trail.ts:67–69) only coerces non-finite → 0 for SQLite.

## Master table

| EQ | Blueprint § | Status | Code (file:fn/line) | Inputs→Outputs | Units | Cadence | Params | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 059 | §8.2 | NOT-IMPLEMENTED-RESEARCH-OK | — (static only: mase.ts `applyEnvelopes` 287–311; blueprint.ts:73–81) | target W → clamped W | weight fraction | per tick | static ADMISSIBILITY_ENVELOPES.lower | canonical-invariants 2.1 (envelope ≤1pp breach tol) | Dynamic f(L_base,Q,Risk,Liq) symbolic (RG-15); pilot uses static constitutional envelopes only — correctly not fabricated |
| 060 | §8.2 | NOT-IMPLEMENTED-RESEARCH-OK | — (same as EQ-059, upper bounds) | target W → clamped W | fraction | per tick | ADMISSIBILITY_ENVELOPES.upper | canonical-invariants 2.1 | Same as EQ-059 |
| 061 | §8.2 | VERIFIED (degenerate: static-only) | mase.ts `applyEnvelopes` 287–311 | W → W ∈ [lower,upper], Σ=1 | fraction | per tick | envelopes (immutable, PARAMETER_REGISTRY CONSTITUTIONAL blueprint.ts:339) | canonical-invariants 2.1 | With dynamic bounds absent, containment L_const≤L_t≤U_t≤U_const holds trivially; no code can widen beyond constitutional arrays |
| 062 | §8.3 | VERIFIED (enforcement upstream-only; test gap) | mase.ts `applyVelocityCaps` 342–366; called by `smoothWeightsConstitutional` 382–390 ← engine.ts `advanceMase` 2143, `buildMaseSnapshot` 2026 | (prev W, next W) → velocity-capped W (clamp → renorm → re-clamp → renorm) | fraction (Δ per update) | per accepted update | MAX_VELOCITY (above) | **no dedicated test** — canonical-invariants imports `smoothWeightsAdaptive`/`targetVelocity` (75–76) but never asserts them; indirect via e2e tick() | chain-index `commitWeights` has NO velocity check (chain-index.ts:146–183) — enforcement only in MASE pipeline; direct commit callers bypass it |
| 063 | §8.3 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | — | — | State-dependent Δ_i,t = g(Liq,Stress,Cost,Structural) absent; only static MAX_VELOCITY (RG-15) |
| 064 | §8.4 | VERIFIED (caveats: 0.70 constant unwired; no dedicated test) | mase.ts `smoothWeights` 322–332 (`λ·target+(1−λ)·prev`, λ=1−ρ), `smoothWeightsConstitutional` 382–390 | (W_prev, W_target, stressLevel) → W_smooth = ρ·W_prev+(1−ρ)·W_target, then velocity caps | fraction | per tick | ρ 0.50 normal / 0.75 stress (stressLevel≥2 → STRESS/DEFENSIVE/EMERGENCY, state-machine.ts:275–284) | e2e (advanceMase exercised); no ρ-ladder assertion | CRISIS_SCORE_STRESS_THRESHOLD 0.70 defined (blueprint.ts:226) but **never referenced**; operative selector is risk-state stressLevel; float64, sum-to-one by convexity (~1e-16) + explicit renorm in applyVelocityCaps; no fixed-point rounding in TS |
| 065 | §8.5 | PARTIAL-DOCUMENTED | mase.ts `applyEnvelopes` 287–311 + `applyVelocityCaps` 342–366; engine.ts `buildMaseSnapshot` envelope monitor 2063–2073 (ok/warn/breach); risk machine RR/LCR separate (state-machine.ts) | W_target → feasible W (Σ=1, w≥0, envelopes, velocity); Coverage/LCR via RR/LCR state | fraction | per tick | envelopes + MAX_VELOCITY + RR/LCR bands | canonical-invariants 2.1, 2.6; state-machine self-test 17/17 | No consolidated feasibility gate at commit: `commitWeights` validates only array length (no Σ=1/envelope/velocity); Coverage≥100% & LCR gates live in risk machine, not weight commit; no emergency override bypasses envelopes (EMERGENCY pauses rebalancing per RISK_STATE_MACHINE blueprint.ts:381) |
| 066 | §9.1 | VERIFIED (as recursive equivalent; G_t tracked) | chain-index.ts `advanceIndex` 101–128; G_t in state + `commitWeights` 170, `replaceComponent` 323; engine.ts `advanceChainIndex` 534–538, `getMtqPriceFromState` 559–561; snapshot `chainIndex` 1873–1880 | (state, P_t) → I_t = I_{t−1}·Σ W_{i,t−1}·(P_t/P_{t−1}); G_t = Π D_s maintained & published but I_t not computed via G_t×Σ W·(P/P₀) | index ratio (I_0=1) | per tick | STRATEGIC_PRIOR, BASE_FIXINGS, GFB_BASE_DENOMINATOR (blueprint.ts:50–69) | canonical-invariants 1.1; audit-verify.ts:22–28 (Σ contributions ≡ I_t, <1e-9); chain-index runSelfTest | Value-aggregate form computed nowhere; equivalence vs recursion demonstrated only in ad-hoc audit script; P_MTQ = I_t × PAR = I_t (chain-index.ts:186–198) |
| 067 | §9.1 | VERIFIED | chain-index.ts `initChainIndex` 84–91 (I_t=1.0, G_t=1.0); engine init 390 | genesis → I_0 = 1.0000 | ratio | genesis | baseDenominator = Σ W^Prior·P_{i,0} | canonical-invariants 1.1 (advance from 1.0); runSelfTest; worklog 6636 D3 (restart-anchoring fixed) | P_MTQ ≈ 1.0 at base date; contract uses 1e18-scaled absolute form (comment 188–192) |
| 068 | §9.2 form A | NOT-IMPLEMENTED (by design — convention resolved to form B) | — (rejected; header comment chain-index.ts:3–4) | — | — | — | — | n/a | Current-period-weight recursion deliberately NOT chosen; rationale recorded in code (see RG-01 below) |
| 069 | §9.2 form B | **VERIFIED — RG-01 resolved** | chain-index.ts `advanceIndex` 110–116: `periodReturn += w * (currentPrices[i] / pPrev)` with `w = state.prevWeights[i]` | (I_{t−1}, W_{t−1}, P_{t−1}, P_t) → I_t | ratio | per tick | — | canonical-invariants 1.1/1.2; runSelfTest (369–442); stress-rerun S5 (gold+50% → I_t 1.13); audit-verify.ts:15–33 | Prior-period weights; convention documented in comments (lines 3–8, 23–26, 95, 121–123) |
| 070 | §9.3 | VERIFIED | chain-index.ts `commitWeights` 162–169: bMinus=Σ W_prev·P_t; bPlus=Σ W_new·P_t; D=bMinus/bPlus (guard bPlus>0); same basis `currentPrices` for both | (W_prev, W_new, P_t) → D_t, G_t×=D | divisor factor | per weight commit | — | canonical-invariants 1.2 (divisor=1.0 same-weights); runSelfTest 381–395; audit-verify.ts:30–33 (live D_t=0.8966, I_t unchanged) | Same-price basis confirmed (both sums use `currentPrices`, lines 165–166); succession variant `replaceComponent` 310–322 (ejected at frozen price, successor at admission quote) |
| 071 | §9.3 | VERIFIED | chain-index.ts `commitWeights` 171–181 (`I_t: state.I_t` — unchanged); comments 140–145 | commit → I_t continuous (zero artificial return) | ratio | per commit | — | canonical-invariants 1.2 ("commit DIFFERENT weights → I_t STILL 1.13"); runSelfTest 386–395, succession 418–420 (I_t bit-identical, tol 1e-12); worklog 6659/6667 ("swap leaves I_t bit-identical") | Implemented as "I_t unchanged + D_t folded into G_t" — equivalent to I_t⁺ = D_t·B_t⁺ under the normalized-ratio convention |
| 072 | §9.4 | NOT-IMPLEMENTED-GAP | — in engine (UI ReferenceChart.tsx:118–129 `priceEffect` is **synthetic** random-walk decomposition); real computation only in audit-verify.ts:22 (`w·(P_t/P_base−1)`) | (W_{t−1}, P) → Contribution_G | pp | — | — | audit-verify.ts (ad-hoc) | No production per-component return-contribution API; no W_{t−1}×(P_t/P_{t−1}−1) in live path |
| 073 | §9.4 | NOT-IMPLEMENTED-GAP | — (same as 072) | — | — | — | — | audit-verify.ts:22–28 (7 components) | Canonical order [USD,EUR,JPY,GBP,CNY,CHF,Gold] (chain-index.ts:29–30) |
| 074 | §9.4 | NOT-IMPLEMENTED-GAP | — | Σ Contribution_i vs R_MTQ reconciliation absent from engine | — | — | — | audit-verify.ts:26–28 (Σ contributions == I_t−1, match <1e-9) | Reconciliation exists only in the ad-hoc script; execution costs not separately reported alongside (RG checklist item) |
| 075 | §9.4 | NOT-IMPLEMENTED-GAP | — | — | — | — | — | audit-verify (7-component print) | Constituency is generalized via `replaceComponent` (succession) but attribution expansion not computed |
| 076 | §9.7.1 | VERIFIED (LEGACY-OK, quarantined) | blueprint.ts:430–434 (Q_USD 0.389 … Q_CNY 0.055, "SUPERSEDED — use STRATEGIC_PRIOR"); engine.ts `computeGfbIndex` 503–518 (deprecated weighted-Laspeyres, retained for audit-stress sims only) | — | ratio | — | GFB_BASE_DENOMINATOR | stress-rerun (legacy comparison), audit-stress.ts | No q_USD·1.00 fixed-quantity formula anywhere in the live path; snapshot `gfbIndex` now mirrors chainIndex.I_t (engine.ts:1697–1698), NOT the legacy form — no legacy leak (RG-04 satisfied) |
| 077 | §10.1 | PARTIAL-DOCUMENTED | marp.ts `marpDecision` 82–151 (advisory); engine.ts `buildMaseSnapshot` 2030–2059 (read-only projection, "what MARP WOULD do"); pilot-state.ts:104 `USE_MARP_EXECUTION = false`; active execution = legacy `evaluateRebalance`/`applyRebalanceTrade` (engine.ts 795–844/889–914, pilot-state.ts 346–355) | (observed, target, nav, rr, vols, band) → per-component decisions | weights, USD | per tick (4s) | — | canonical-invariants 2.6; e2e (tick uses legacy path, "feature flag stays default" line 193) | Calc/execution separation holds for MARP (advisory, persisted applied:false); BUT the legacy path **auto-executes** simulated trades when gates pass. Calc_t tuple partial: W^Target ✓, ReserveCoverage ✓ (rr), Risk≈vol ✓; CVaR, Liquidity, OracleHealth, TransactionCost not passed into the decision fn (oracle pause gated separately, pilot-state.ts:324/346) |
| 078 | §10.2 | DEVIATION (documented pilot simplification) | marp.ts `computeUrgency` 24–36; used at level 2 (marp.ts:105–109, skip if urgency<0.05) | (deviation, rr, vol) → U ∈ [0,1] = clip((min(1,dev/0.05)+max(0,(1.10−rr)/0.10))·(1−min(0.5,2·vol))) | fraction | per tick | hard-coded: 0.05 dev norm, 1.10 RR, 0.10 RR scale, 0.5 vol damp, 0.05 U_min | canonical-invariants 2.6 (levels incl. low-urgency path) | §10.2 coefficient form aD+bRiskDeter+cPPDeter+dCrisis−eCost NOT implemented; a–e absent (magic constants in function body, not governed params); comment "Urgency = f(deviation, reserveRatio, volatility)" acknowledges simplification |
| 079 | §10.4–10.5 | VERIFIED | marp.ts `inNoTradeZone` 45–50 + `marpDecision` level 1 98–102; legacy engine.ts `evaluateRebalance` 808–816 | D_i,t = observed − target (signed); \|D\|<θ → Trade=0 | weight fraction | per tick | NO_TRADE_BAND_BASE 0.0075 / STRESS 0.015 | canonical-invariants 2.6 Level 1; audit-verify C.1 (D 0.3% < 0.75% → Trade=0 ✓) | Band selection: MARP path stressLevel≥2 (engine.ts:2037); legacy path rr<RR_STRESS 1.05 (engine.ts:813) |
| 080 | §10.5 | NOT-IMPLEMENTED-RESEARCH-OK (disclosed) | — (marp.ts:40–44 comment: full dynamic form is research deliverable; pilot = base + crisis widening) | — | — | — | θ_base only | — | Static θ; disclosure present in code + worklog 6644 ("static θ κ-form") |
| 081 | §10.5 | NOT-IMPLEMENTED-RESEARCH-OK (disclosed) | — (blueprint.ts:247–254 comment: κ vector validation-stage) | θ = 0.75% base, 1.5% crisis | fraction | per tick | κ₁..κ₄ absent | — | κ-form not implemented; no silent invention of κ values (RG-15 compliant) |
| 082 | §10.6 | VERIFIED (β pilot 0.50; example-0.40 disclosed) | marp.ts `partialCorrection` 71–76 (β default 0.5), sizing 112–113 (`tradeUsd = \|β·dev\|·nav`) | deviation → β·deviation | fraction / USD | per decision | β=0.50 function default (NOT in blueprint/PARAMETER_REGISTRY) | audit-verify C.2 (doc 0.40 → −0.96pp vs pilot 0.50 → −1.20pp, "both partial, doctrine-compliant"); worklog 6640 | Disclosure that Appendix C 0.40 is an example ✓; β is ungoverned magic constant — governance gap |
| 083 | §10.6 | NOT-IMPLEMENTED-RESEARCH-OK | — (static β; no clip(β₀+β₁U−β₂Impact, β_min, 1)) | — | — | — | — | — | No adaptive β; β_min not published |
| 084 | §10.7 | NOT-IMPLEMENTED-GAP (helper unwired; economic partial via D4) | marp.ts `naturalCashFlowPreference` 155–167 — **zero call sites**; D4 fix: applyMint purchases basket at W^Smooth (worklog 6637) | (pendingMint, pendingRedeem) → reducesTrade flag (unused) | USD | — | — | none (C.3 regression absent) | Explicit TradeNeeded = Gap − CF netting not performed before sizing; MASTER-AUDIT-REPORT R27/P6 "netting still pending" |
| 085 | §10.7 | PARTIAL-DOCUMENTED | marp.ts sizing 112–136 (β·dev·nav, 5% NAV cap, defer rest); legacy engine.ts 827–833 (min(\|dev\|·nav, 10%·poolDepth, daily-turnover remainder)) | residual need → trade size | USD | per decision | MAX_DAILY_TURNOVER 0.05 | canonical-invariants 2.6 Level 5 (capped at 5% NAV) | f = linear partial + caps; §10.7's "exact f through MARP execution rules" not formally defined |
| 086 | §10.8 | PARTIAL-DOCUMENTED (2-term simplification) | marp.ts `costBenefitGate` 56–67: `cost = tradeUsd·slippage + gasCost`; engine.ts:836 `estCost = tradeUsd·0.001 + 50` | (dev, nav, tradeUsd) → cost USD | USD | per decision | slippage 0.001, gas $50 (GAS_FALLBACK §11.8 comment) | c4-check.ts; audit-verify C.4 | Spread/Fees/Impact/Operational not modeled; slippage flat (not size-dependent); units consistently USD ✓ |
| 087 | §10.8 | VERIFIED (gate semantics exact) | marp.ts `costBenefitGate` 62–67: `netBenefit = benefit − cost; pass = netBenefit > MIN_PROFITABILITY_USD` | (dev, nav, tradeUsd) → {pass, benefit, cost, netBenefit} | USD | per decision | ε = $10 (blueprint.ts:258–261, Listing 5 §12.8); λ₁=0.4 (legacy LAMBDA_1, marp.ts:63 "§10.9 J term") | c4-check.ts (mirror case passes with ε); canonical-invariants 2.6 | MARP gate = **NetBenefit > ε ($10)**, documented in blueprint+marp comments. BUT the ACTIVE legacy gate is `benefit > estCost` (i.e. > 0, no ε) — see RG-10 |
| 088 | §10.8 | NOT-IMPLEMENTED-RESEARCH-OK | — (benefit proxy: \|dev\|·nav·0.4; legacy adds RR-deficit term engine.ts:837) | — | — | — | — | — | No RiskReduction/PPImprovement/Diversification decomposition or normalization documented |
| 089 | §10.9 | NOT-IMPLEMENTED-RESEARCH-OK (RG-09 respected) | — (no optimizer; marp.ts:63 borrows λ₁-weighted deviation term only, comment cites §10.9 J term) | — | — | — | λ₁–λ₄ absent (legacy LAMBDA_* marked SUPERSEDED blueprint.ts:445–448) | — | Operator/sign NOT silently resolved — no arbitrary minimizer built; must be defined before production implementation |
| 090 | §10.10 | NOT-IMPLEMENTED-RESEARCH-OK | — (fixed 4s tick; no Frequency_t = f(Drift,Risk,Liq,Cost,Structural)) | — | — | fixed | — | — | Quarterly methodology review not modeled (governance metadata only) |
| 091 | §11.1 | VERIFIED | engine.ts `buildObservedWeights` 1986–2004; snapshot `navShares` 1770–1778; values from `reserveAssetValues` 569–619 | holdings+fx → W_obs = V_i^net/nav | fraction (Σ=1) | per snapshot | HAIRCUTS §14.1.1 (blueprint.ts:148–155) | e2e (NAV suite 1.3); worklog 6658 (navShares Σ=1) | Numerator & denominator both post-haircut net (consistent basis ✓); gold = total gold (index+reserve) goldNet/nav; gold priced at min(ref, exec 0.995) (engine.ts:578–582) |
| 092 | §11.4/§12.4 | PARTIAL-DOCUMENTED | marp.ts:59–64; engine.ts:836 | tradeUsd → gas + slippage | USD | per decision | gas $50 flat; slippage 0.1% flat | c4-check.ts | Gas = flat $50 (no gasPrice×gasUnits; **150,000 gas units figure absent from code**); slippage not \|ΔW\|-shaped |
| 093 | §11.4/§12.4 | PARTIAL-DOCUMENTED (legacy path only; synthetic depth) | engine.ts `evaluateRebalance` 827–833: `tradeUsd = min(surplusUsd, MAX_POOL_FRACTION·poolDepth24h)` then daily-turnover cap; poolDepth24h = 4_000_000 hard-coded ("assumed PAXG/USDC 24h depth for the pilot", line 828) | deviation+nav → capped trade size | USD | per decision | MAX_POOL_FRACTION 0.10, MAX_DAILY_TURNOVER 0.05 | canonical-invariants 2.6 Level 5 (5% NAV cap) | MARP path (marpDecision) has 5%-NAV cap but **no pool-depth cap**; pool depth data source = hard-coded constant, no live feed |
| 094 | §11.5.1/§12.3 | PARTIAL-DOCUMENTED (implemented in unwired helper) | engine.ts `simulateQuote` 2327–2340: sell `withinBound = quoteRate ≥ oracleRate·(1−SLIPPAGE_TOLERANCE)` | (amountUsd, oracle) → quote/bound/withinBound | USD/oz | n/a (no live calls) | τ = SLIPPAGE_TOLERANCE 0.01 (1% uniform) | none | `simulateQuote` has **zero call sites** — τ-bound not enforced on any execution path; per-asset-class SLIPPAGE_TOLERANCES (0.5/1.0/1.5%) defined but unused in gates |
| 095 | §11.5.1/§12.3 | PARTIAL-DOCUMENTED (same) | engine.ts `simulateQuote` 2333–2334: buy `quoteRate ≤ oracleRate·(1+τ)` | same | same | n/a | τ = 1% | none | Both sides implemented and independently checked in the helper, but helper unwired |
| 096 | §12.1 | PARTIAL-DOCUMENTED | marp.ts:59–67; engine.ts:836 | q → cost(q) | USD | per decision | — | c4-check | Only Slippage+Gas of the four terms; Spread/Impact/Fees absent (slippage flat, not q-dependent) |
| 097 | §12.1 | NOT-IMPLEMENTED-RESEARCH-OK | — (no T_max/I_max anywhere; absent from PARAMETER_REGISTRY blueprint.ts:336–353) | — | — | — | — | — | Pilot has no live execution needing them; production must define in governed registry + fail closed |
| 098 | §12.5 | VERIFIED (in ACTIVE legacy gate — flags RG-10 divergence) | engine.ts `evaluateRebalance` 840–843: `if (benefit <= estCost) … shouldRebalance:false` — executes iff benefit > cost (strict > 0) | (benefit, cost) → trade/reject | USD | per tick | no ε on this path | e2e (rebalance steps); canonical-invariants economic suite | This is the §12.5 >0 form, live on the only executing path; conflicts with the ε=$10 MARP gate |
| 099 | §12.5 | VERIFIED (MARP advisory gate) | marp.ts:66 `pass: netBenefit > MIN_PROFITABILITY_USD` (ε=$10 > 0) | (benefit, cost) → pass | USD | per advisory decision | MIN_PROFITABILITY_USD 10 | c4-check mirror (`TRADE (net > ε=$10 ✓)`) | §10.8/§12.8 ε-form; advisory only (USE_MARP_EXECUTION=false) |
| 100 | §12.7 | PARTIAL-DOCUMENTED | marp.ts:59–64; engine.ts:836 | — → gas + slippage (no routerFee) | USD | per decision | gas $50; slippage 0.1% | c4-check | gasPrice×gasUnits collapsed to flat $50; **routerFee absent**; §12.7's three-term estimate partially realized |

Status counts (EQ-059..EQ-100, 42 equations):
- VERIFIED: **15** (061, 062, 064, 066, 067, 069, 070, 071, 076, 079, 082, 087, 091, 098, 099)
- PARTIAL-DOCUMENTED: **10** (065, 077, 085, 086, 092, 093, 094, 095, 096, 100)
- DEVIATION (documented pilot simplification): **1** (078)
- NOT-IMPLEMENTED-RESEARCH-OK: **10** (059, 060, 063, 080, 081, 083, 088, 089, 090, 097)
- NOT-IMPLEMENTED-GAP: **5** (072, 073, 074, 075, 084)
- NOT-IMPLEMENTED (by design, convention resolved to EQ-069): **1** (068)

## RG-relevant findings

### RG-01 — Index recursion weight-timestamp convention: **RESOLVED (form B / EQ-069 implemented)**
The code implements **EQ-069** (prior-period weights W_{i,t−1}) — decisive quote, chain-index.ts:110–116:
```ts
let periodReturn = 0;
for (let i = 0; i < currentPrices.length; i++) {
  const w = state.prevWeights[i] ?? 0;
  const pPrev = state.prevPrices[i] ?? 0;
  if (pPrev <= 0) continue; // skip invalid prev prices (defensive)
  periodReturn += w * (currentPrices[i] / pPrev);
}
const newIndex = state.I_t * periodReturn;
```
- Convention documented in code: header (lines 3–8: "I_t = I_{t−1} × Σ_i [W_{i,t−1} × (P_{i,t} / P_{i,t−1})]"), rationale (lines 23–26: weights each component's RETURN by prior weight so gold's 50% shock contributes 26%×50%=13%, eliminating the legacy notional-dominance/short-gold bug), and purity note (95–100, 121–123).
- (a) §9.3 continuity at rebalance preserved: `commitWeights` computes D_t = B⁻/B⁺ on the same price vector and leaves I_t unchanged (line 176 `I_t: state.I_t`); asserted by `runSelfTest` (381–395: same-weights divisor=1.0; different-weights I_t stays 1.13) and succession checks (418–420, tol 1e-12 "must be zero artificial return").
- (b) Contribution convention consistent: the (audit-script) attribution uses prior weights (`contrib = w·(P_t/P_base−1)`, audit-verify.ts:22) matching W_{t−1}.
- Equivalence recursion ↔ value-aggregate demonstrated in audit-verify.ts:22–28 (`chain-index I_t = 1+Σ contributions (match: <1e-9)`), **but only as an ad-hoc script, not a repo test-suite case** — canonical-invariants 1.1 covers the recursion arithmetic (gold+50% → 1.13).
- Verdict: RG-01 resolved in implementation with recorded rationale; remaining action = promote the value-aggregate equivalence check into the formal suite.

### RG-09 — J(ΔW) optimization operator/sign: **COMPLIANT-BY-OMISSION (open for production)**
No optimizer exists; the code does not silently pick argmin/argmax. The only trace of §10.9 is marp.ts:63 (`const benefit = Math.abs(deviation) * nav * 0.4; // λ₁-weighted deviation value (§10.9 J term)`) — a benefit proxy, not the J objective. λ₁–λ₄ are not a published parameter set (legacy LAMBDA_* constants are marked SUPERSEDED, blueprint.ts:445–448). The spec's warning ("do not infer it silently") is respected; the direction/sign must still be specified before any production implementation.

### RG-10 — Profitability threshold ε vs 0: **OPEN DIVERGENCE — both semantics exist in code on different paths**
Exact code gate semantics:
- MARP advisory gate (marp.ts:66): `pass: netBenefit > MIN_PROFITABILITY_USD` → **NetBenefit > ε, ε = $10** (blueprint.ts:258–261 documents: "The §10.8 cost-benefit gate requires NetBenefit > ε; Listing 5 initializes minProfitability to $10 (§12.8). The pilot's gate uses this absolute floor."; marp.ts:52–55 repeats it).
- ACTIVE legacy execution gate (engine.ts:840–843): `if (benefit <= estCost) return { shouldRebalance: false, … }` → executes iff **benefit > cost (i.e. > 0, no ε)**.
Because `USE_MARP_EXECUTION = false` (pilot-state.ts:104), the path that actually mutates state uses the §12.5 `>0` form while the §10.8 ε-form is advisory-only. The ε choice is documented for the MARP gate, but the coexistence of two thresholds — and which is normative for the executing route — is **not** reconciled in a single policy statement. §10.8-vs-§12.5 divergence documentation status: partial (comments on the ε side only).

### RG-15 — Symbolic dynamic forms: **RESPECTED (no fabricated constants)**
EQ-059/060/063 (dynamic bounds/velocity), EQ-080/081 (θ κ-vector), EQ-083 (adaptive β), EQ-088 (benefit decomposition), EQ-097 (T_max/I_max) are all absent, and each absence is disclosed in code comments (marp.ts:40–44; blueprint.ts:247–254) or the worklog (6644 "static θ κ-form" listed as disclosed PARTIAL item). No undocumented constants were invented. Classification NOT-IMPLEMENTED-RESEARCH-OK throughout.

### Appendix C regression status
- **C.1 (no-trade)**: audit-verify.ts:57–61 — D_USD = 0.3%, `inNoTradeZone(θ=0.75%)` → Trade=0 ✓ (console check).
- **C.2 (partial β)**: audit-verify.ts:62–64 — D_gold = 2.4% > band; doc β=0.40 → −0.96pp; pilot β=0.50 → −1.20pp; labeled "both partial, doctrine-compliant". Matches worklog 6640 (β pilot 0.50 vs doc example 0.40).
- **C.3 (natural flow)**: **NO regression test** — consistent with the EQ-084 gap (naturalCashFlowPreference unwired; MASTER-AUDIT-REPORT R27: "explicit TradeNeeded = Gap − CF netting still pending — P6").
- **C.4 (cost-gate rejection)**: c4-check.ts:1–9 — EXACT: benefit $1,200 (dev 0.003×$1M×0.4) vs cost $1,700 (0.0017×$1M + $0 gas) → net −$500 → `Trade=0 (rejected — negative net benefit ✓)`; mirror: benefit $2,400 → pass (`net > ε=$10 ✓`). audit-verify.ts:65–67 runs a C.4-style check.
- **C.5 (gold adaptive shift)**: audit-verify.ts:68–69 — target 29.2% within Gold envelope 20–32% → admissible ✓, prior≠target ✓.
- All four regressions are **ad-hoc console scripts under audit-work/v2** (audit-verify.ts, c4-check.ts), not formal suite assertions; canonical-invariants.ts 2.6 covers related (not identical) MARP levels. Worklog 6640 records the verified run.

### Direct answers to the three platform questions
**(a) Auto-execution on recalculation:** YES — one path does. The **legacy §7 path auto-executes trades every tick** when its gates pass: pilot-state.ts:346–355 (`evaluateRebalance` → `applyRebalanceTrade`), active because `USE_MARP_EXECUTION = false`. It mutates only the pilot's **simulated** reserve state (instant book transfers at oracle prices; no DEX/router/AMM call exists — costs are modeled, never realized). Gates (no-trade band → direction lock → turnover cap → cost-benefit) mean trades fire only on justified triggers, honoring I11's substance; but the cadence is a 4s tick, not a daily cycle, and nothing operator-facing gates execution. The MARP per-component path is properly decision-only (advisory snapshot + `applied:false` rows).
**(b) MARP decision log:** YES — persisted. `persistRebalancingDecision` (audit-trail.ts:132–173, §24.2, every evaluated decision applied-or-not: shouldRebalance/direction/tradeUsd/reason/blockedBy/applied/pre-post-trade fields, Prisma `RebalancingDecision` table, schema.prisma:127+) and `persistMarpDecisions` (audit-trail.ts:239–294, per-component rows `reason: "[MARP:{component}] {reason}"`, `blockedBy`, `applied: false`, throttled 60s). Wired in the tick (pilot-state.ts:456–490) with retention pruning (audit-trail.ts:297+, caps 10k/5k/5k; audit-retention-test.ts). Caveats: urgency and β are not first-class columns (urgency appears only inside `reason` text; β is implicit in tradeUsd), and benefit/cost figures are likewise text-only.
**(c) Appendix C regressions:** C.1 ✓, C.2 ✓ (β 0.50 pilot vs 0.40 doc example, disclosed), C.4 ✓ EXACT ($1,200 < $1,700 → Trade=0; mirror passes with ε), C.5 ✓ admissible — but as ad-hoc scripts, and **C.3 absent** (see above).

## Findings requiring attention

1. **RG-10 open divergence (High):** two profitability gates coexist — active legacy `benefit > cost` (>0, engine.ts:840–843) vs advisory MARP `netBenefit > ε=$10` (marp.ts:66). The executing route uses the weaker §12.5 form. Production must declare one normative threshold (Listing 5's ε=$10 is the documented candidate) and align/delete the legacy gate.
2. **Auto-execution path (Medium):** legacy `applyRebalanceTrade` mutates reserve state automatically each tick when gates pass (pilot-state.ts:346–355). Acceptable for a simulation pilot; for production the executing path must be the gated MARP pipeline (currently flag-disabled) with human/governance authorization, per I11.
3. **Velocity/smoothing test gap (Medium):** `applyVelocityCaps`, `smoothWeightsConstitutional` (ρ 0.50/0.75), and MAX_VELOCITY have **no dedicated regression test**; canonical-invariants.ts:75–76 imports `smoothWeightsAdaptive`/`targetVelocity` but never uses them (dead imports). The §8.3/§8.4 constitutional constraints are enforced only in the live path, unasserted.
4. **Dead crisis-score constant / stale comment (Low):** `CRISIS_SCORE_STRESS_THRESHOLD = 0.70` (blueprint.ts:226) is referenced nowhere; ρ_stress is actually selected by `stressLevel(riskState) ≥ 2` (mase.ts:387, state-machine.ts:275–284), while mase.ts:317–318's comment still describes a "crisis-score path (threshold 0.70)". Doc/code mismatch — update comment or wire the constant.
5. **commitWeights validates nothing (Medium):** chain-index.ts:146–183 checks only array lengths — no sum-to-one, envelope, or velocity validation at commit. Constraint enforcement is purely upstream (advanceMase); any direct caller (tests, succession drill, future API) can commit infeasible weights into the canonical index. Add defense-in-depth validation.
6. **Return attribution absent from production path (Medium):** EQ-072–075 have no engine implementation; UI `ReferenceChart.priceEffect` is a **synthetic random-walk decomposition** (ReferenceChart.tsx:118–129) that could be mistaken for real attribution. The only true attribution is the ad-hoc audit-verify.ts script.
7. **Natural-flow netting unwired (Medium):** `naturalCashFlowPreference` (marp.ts:155–167) has zero call sites; TradeNeeded = Gap − CF is never computed; C.3 regression absent (matches MASTER-AUDIT-REPORT P6).
8. **Pool-depth cap partial + synthetic (Low-Medium):** EQ-093 implemented only on the legacy path with `poolDepth24h = 4_000_000` hard-coded (engine.ts:828); the MARP path has no pool-depth cap at all; no live depth feed.
9. **Ungoverned MARP constants (Low):** β=0.50 (marp.ts:73), urgency threshold 0.05 (marp.ts:106), urgency normalizers (0.05/1.10/0.10/0.5, marp.ts:30–34), λ₁=0.4 benefit weight (marp.ts:63), gas $50, slippage 0.1% — all function-body constants, not in blueprint.ts/PARAMETER_REGISTRY. §22.4 requires published, layer-owned parameters.
10. **Cost-model gaps vs §11.4/§12.7 (Low):** no gasUnits (150k figure absent), no routerFee, flat (not size-dependent) slippage; per-asset-class SLIPPAGE_TOLERANCES (0.5/1.0/1.5%) defined but unused in any gate.
11. **τ-bound helper unwired (Low):** `simulateQuote` (EQ-094/095, τ=1%) has no call sites — no execution path enforces exec-rate bounds (fine for the pilot's book-transfer model; mandatory before any live routing).
12. **Appendix C regressions not in formal suite (Low):** port C.1/C.2/C.4/C.5 (and add C.3 once EQ-084 lands) from audit-work/v2 scripts into canonical-invariants.ts so CI enforces them.

## Evidence quotes

**Recursion (RG-01, EQ-069)** — chain-index.ts:110–117:
```ts
let periodReturn = 0;
for (let i = 0; i < currentPrices.length; i++) {
  const w = state.prevWeights[i] ?? 0;
  const pPrev = state.prevPrices[i] ?? 0;
  if (pPrev <= 0) continue;
  periodReturn += w * (currentPrices[i] / pPrev);
}
const newIndex = state.I_t * periodReturn;
```
Header (chain-index.ts:3–4): `The canonical chain-linked index I_t per Master Listing 3 / §9.2 COO-16: I_t = I_{t-1} × Σ_i [W_{i,t-1} × (P_{i,t} / P_{i,t-1})]`

**Divisor + continuity (EQ-070/071)** — chain-index.ts:162–182:
```ts
let bMinus = 0; // B_t^- = Σ W_{i,t-1} × P_{i,t}
let bPlus = 0;  // B_t^+ = Σ W_{i,t}   × P_{i,t}
for (let i = 0; i < currentPrices.length; i++) {
  bMinus += (state.prevWeights[i] ?? 0) * currentPrices[i];
  bPlus  += (newWeights[i] ?? 0)       * currentPrices[i];
}
const divisor = bPlus > 0 ? bMinus / bPlus : 1.0;
const newG = state.G_t * divisor;
const newState: ChainIndexState = { ...state,
  I_t: state.I_t,   // I_t stays the SAME — the divisor preserves continuity.
  G_t: newG, prevWeights: [...newWeights], prevPrices: [...currentPrices], lastUpdate: now };
```
Self-test assertions (chain-index.ts:383–395): `commitWeights divisor … expected 1.0`; `commit2 I_t … expected 1.13 (zero artificial return)`; succession (418–419): `I_t changed across swap … — must be zero artificial return`.

**θ / β / cost gate (EQ-079/082/086/087)** — marp.ts:45–76:
```ts
export function inNoTradeZone(deviation: number, threshold: number = NO_TRADE_BAND_BASE): boolean {
  return Math.abs(deviation) < threshold;
}
…
export function costBenefitGate(deviation, nav, tradeUsd, slippage = 0.001, gasCost = 50) {
  const benefit = Math.abs(deviation) * nav * 0.4; // λ₁-weighted deviation value (§10.9 J term)
  const cost = tradeUsd * slippage + gasCost;
  const netBenefit = benefit - cost;
  return { pass: netBenefit > MIN_PROFITABILITY_USD, benefit, cost, netBenefit };
}
…
export function partialCorrection(deviation: number, correctionFactor: number = 0.5): number {
  return deviation * correctionFactor;
}
```
Band selection (engine.ts:2037): `const noTradeBand = stressLevel(s.riskState.state) >= 2 ? NO_TRADE_BAND_STRESS : NO_TRADE_BAND_BASE;`

**Legacy active gate — RG-10 (EQ-098)** — engine.ts:835–843:
```ts
// Cost-benefit (simplified): estimate cost ~ 0.1% slippage + $50 gas equiv
const estCost = tradeUsd * 0.001 + 50;
const benefit = Math.abs(deviation) * nav * LAMBDA_1 + (rr < RR_TARGET ? (1 / Math.max(rr, 0.5)) * nav * LAMBDA_3 : 0);
…
if (benefit <= estCost) {
  return { shouldRebalance: false, … reason: `Cost (${estCost.toFixed(0)}) ≥ benefit (${benefit.toFixed(0)})` };
}
return { shouldRebalance: true, … reason: "Benefit > cost; executing" };
```

**Execution flag + decision-log wiring (EQ-077, questions a/b)** — pilot-state.ts:104 `const USE_MARP_EXECUTION = false;`; 346–355 (legacy auto-execute); 456–490:
```ts
// §24.2 — RebalancingDecision (every evaluated decision, applied or not).
if (rebalanceAudit) { await persistRebalancingDecision(store.tickCount, … ); }
…
store.lastMarpAdvisoryAt = await persistMarpDecisions(store.tickCount, finalSnap, store.lastMarpAdvisoryAt);
```
audit-trail.ts:280–282: `reason: \`[MARP:${d.component}] ${d.reason}\`, blockedBy: d.shouldTrade ? null : d.reason, applied: false, // MARP decisions are advisory in the pilot — not executed as trades`

**P_MTQ (EQ-066/067)** — chain-index.ts:196–198 `return state.I_t;` ("P_MTQ = I_t × PAR (PAR = 1.00)"); engine.ts:1697–1698 `const price = getMtqPriceFromState(s); const gfb = price; // gfbIndex now mirrors the chain-linked I_t`.

**Smoothing (EQ-064)** — mase.ts:329 `result[c] = lambda * target[c] + (1 - lambda) * (prevSmoothed[c] ?? STRATEGIC_PRIOR[c]);` with `lambda = 1 − ρ`; 387 `const rho = stressLevel >= 2 ? SMOOTHING_RHO_STRESS : SMOOTHING_RHO_NORMAL;`.

**Velocity (EQ-062)** — mase.ts:351 `clamped[c] = (prev[c] ?? 0) + Math.max(-cap, Math.min(cap, delta));` (then renormalize → re-clamp → renormalize, 353–364).

**Observed weights (EQ-091)** — engine.ts:1993–2003 `USD: vals.usdNet / nav, … Gold: vals.goldNet / nav` (all net-of-haircut; gold = index+reserve total, §14.1 note at 2000–2002).

**Quote bounds (EQ-094/095)** — engine.ts:2333–2334:
```ts
const bound = isBuyGold ? oracleRate * (1 + SLIPPAGE_TOLERANCE) : oracleRate * (1 - SLIPPAGE_TOLERANCE);
const withinBound = isBuyGold ? quoteRate <= bound : quoteRate >= bound;
```
