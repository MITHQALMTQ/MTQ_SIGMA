# Traceability Records EQ-025..EQ-058

Task ID: 2-d · Range: MASE input signals (§5), risk/candidate models (§6), composite objective + ensemble (§7)
Implementation under audit: `/home/z/my-project/src/lib/mtq/` (mase.ts 439L, engine.ts 2523L, blueprint.ts 476L, marp.ts, oracle.ts, fx.ts, fred.ts, audit-stress.ts, monte-carlo.ts, pilot-state.ts, compute-engine.ts) + Next.js UI/API.
Status context: CANDIDATE FOR PUBLIC TESTING — NOT PRODUCTION-AUTHORIZED (honest-status.ts:141-145; /api/honest-status disclaimer).

**Live MASE call path (verified):** `pilot-state.ts::tick` (4s, `TICK_MS=4000` line 67) → `advanceMacro` (engine.ts:2166) → `advanceMase` (engine.ts:2128) → `estimateVolsFromState` (1938) + `detectRegime` (1956) + `buildPriceData` (1967) → `maseEnsemble(vols, prices, null, regime)` (mase.ts:239; **corr always null**) → `applyEnvelopes` (mase.ts:287) → `smoothWeightsConstitutional` (mase.ts:382, ρ 0.50/0.75 + `applyVelocityCaps`) → `commitChainIndexWeights`. A second cadence: `compute-engine.ts` runs the identical `advanceMase` math daily via GitHub Actions cron (deterministic, 12-decimal hash). Snapshot exposure: `buildMaseSnapshot` (engine.ts:2008) → `/api/metrics` (full `MetricsSnapshot`; **no `/api/snapshot` route exists — /api/metrics is the snapshot endpoint**).

---

## Master table

| EQ | Blueprint § | Status | Code (file:fn/line) | Inputs→Outputs | Units | Cadence | Params | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 025 | §5.1 | PARTIAL-DOCUMENTED | engine.ts:estimateVolsFromState/1938-1950; mase.ts:estimateVolatility/415-438 (exported, **unused in live path**) | VIX → 7 vols = static baselines × (VIX/18.5); estimateVolatility: price history → log-returns → single-window vol | annualized vol (fraction); √(var×252) | per tick (4s); compute-engine daily | baselines {USD .05, EUR .10, JPY .12, GBP .11, CNY .09, CHF .10, Gold .15}; pivot VIX=18.5 | none direct (vols only via ensemble tests) | **No 30/90/252/756 blend; no ω_h** ("756" appears nowhere in src). Disclosed: engine.ts:1934-1937 "Pilot approximation … Production should use a rolling covariance from real price history". NOT in honest-status API |
| 026 | §5.2 | NOT-IMPLEMENTED-RESEARCH-OK | — (no gold-in-currency-i series; oracle board has XAU_USD only) | — | — | — | — | — | Pilot tracks gold in USD only (fx.XAU_USD; buildPriceData normalizes by base fixings). Gold-in-EUR/JPY/… quotes never fetched |
| 027 | §5.2 | NOT-IMPLEMENTED-GAP | nearest proxy: mase.ts:modelPurchasingPower/134-166 (NOT the formula) | proxy: prior_i / (P_i,t/P_i,0) → weights; **no (P_{t-1}/P_t)−1 anywhere** | price relatives (USD-base) | per ensemble call | floors 0.01 (JPY 0.001) | none direct | Formula fully specified in blueprint but absent. Proxy uses OPPOSITE quote direction (currency-in-USD) and "buy depreciated" response (mase.ts:139-141) — RG-07 seeding risk, see findings |
| 028 | §5.2 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | f symbolic | — | Correctly deferred: no GPR horizons, no invented f coefficients |
| 029 | §5.3 | DEVIATION | engine.ts:rollingStats/710-716; advanceMacro/2166-2181; seedHistory/414-424; init/346-347 | vixHistory/dxyHistory (≤90 samples) → {mean, sd} | VIX/DXY index points | per 4s tick (window = 90 **ticks**, not 90 days); tests use 1 tick=1 day (e2e:178) | ROLLING_WINDOW_DAYS=90 (blueprint:230); VIX clamp [10,80], DXY [80,120] (blueprint:449-452) | none direct | Formula matches: mean + **population** sd (÷N — matches blueprint's displayed denominator 90). Deviations: per-tick cadence, genesis-seeded **synthetic** 90-obs history (seedHistory(18.5,2.0,90) / (104.2,2.5,90)); comment at engine.ts:119 says "90-day" — inaccurate in live pilot |
| 030 | §5.3 | PARTIAL-DOCUMENTED | engine.ts:computeZScores/718-725; advanceMacro/2177-2178 | (VIX−μ)/(σ+ε), (DXY−μ)/(σ+ε) → zVix, zDxy | dimensionless | per tick | **ε = 1e-9** (unlabeled; blueprint leaves ε free); guard sd>ε else z=0 | none direct (legacy path exercised in stress-rerun θ perturbations) | z-formula exact. **Consumer mismatch:** z-scores feed only the legacy §6 θ path (computeRawTargetTheta/727-730, ALPHA .15/BETA .10/THETA_MAX ±.03 — blueprint:442-444 SUPERSEDED); MASE's regime detection uses RAW VIX/DXY levels, not z. Stale fallback lives at data layer (fx.ts: FRED→Yahoo→OU walk; oracle staleness VIX_DXY 120s, confidence 2% — oracle.ts:67,73) |
| 031 | §5.4 | NOT-IMPLEMENTED-GAP | substitute: engine.ts:detectRegime/1956-1964 | raw VIX/DXY → hard class {0 calm,1 normal,2 stress,3 crisis} | index points | per tick | invented thresholds VIX 15/22/30; DXY ≤88 or ≥115 → ≥stress (**unlabeled**) | none | No 6-regime vector [P(N),P(I),P(D),P(S),P(L),P(G)], no probabilities, no classifier versioning. Substitute NOT labeled as a §5.4 simplification |
| 032 | §5.4 | NOT-IMPLEMENTED-GAP | substitute: mase.ts:modelRegimeAdaptive/203-227 | regime class → model hard-switch (calm→minvar; normal→50/50 maxdiv+ppp; stress→CVaR; crisis→50/50 cvar+gold vector) | weights | per ensemble call | blend 0.5; crisis gold vector {USD .15,EUR .10,JPY .07,GBP .06,CNY .04,CHF .08,Gold .50} (mase.ts:224, unlabeled) | none direct | No Σ_r P(r\|X_t)·W^(r). The hard-switch is a §7.5 "Regime family" implementation, not the §5.4 probability-weighted target |
| 033 | §5.5 | NOT-IMPLEMENTED-RESEARCH-OK | — (constant only: blueprint.ts:226 CRISIS_SCORE_STRESS_THRESHOLD=0.70, inert) | — | — | — | threshold 0.70 claimed §8.4/§5.5-sourced | — | No CrisisScore computed anywhere (grep: only the constant + comments). f symbolic → correctly no invented coefficients |
| 034 | §5.5 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | λ_CVaR,0, k unspecified | — | No CVaR penalty path. ρ_stress selection substitutes the risk-state stress level for the crisis score; comments call it the "conservative default … when the score is unavailable" (mase.ts:317-318, blueprint:222-223) |
| 035 | §6.1 | NOT-IMPLEMENTED-GAP | — (maseEnsemble called with **corr=null** at engine.ts:2020, 2136; CorrelationData never built) | — | — | — | — | — | No component covariance anywhere in live path (audit-stress uses synthetic return paths for RR survival only). Root cause of model simplifications; partially disclosed via "Without a full correlation matrix…" (mase.ts:89, 139) |
| 036 | §6.2 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | λ, F unspecified | — | Correctly deferred (no invented shrinkage target) |
| 037 | §6.3 | DEVIATION | mase.ts:modelMinimumVariance/47-67 | vols → w_i ∝ 1/max(σ_i,0.01), normalized | weights (sum 1) | per ensemble call | vol floor 0.01 | canonical 2.1 (sum=1, envelopes) | Inverse-vol proxy, NOT min_w wᵀΣw. Disclosed: "Simplified pilot: inverse-volatility weighting (approximation of min-variance)" (mase.ts:46) |
| 038 | §6.4 | NOT-IMPLEMENTED-GAP | — | — | — | — | — | — | RC_i, σ_p, RC%_i computed nowhere (WeightChangeDrawer shows weight×vol "risk contribution" from SYNTHETIC vols — UI demo only, WeightChangeDrawer.tsx:45-55) |
| 039 | §6.4 | DEVIATION | mase.ts:modelEqualRiskContribution/72-79 | — → w_i = 1/7 | weights | per ensemble call | N=7 fixed | canonical 2.1 | 1/N proxy, no ERC solve. Disclosed: "Simplified: equal weight (1/N) — true ERC requires iterative solving" (mase.ts:71) |
| 040 | §6.5 | DEVIATION | mase.ts:modelMaxDiversification/84-100 | w_i ∝ prior_i/max(σ_i,0.01) | weights | per ensemble call | prior=STRATEGIC_PRIOR; floor 0.01 | canonical 2.1 | Prior/vol heuristic, NOT max (Σwσ)/√(wᵀΣw). Disclosed: "Simplified: weight by inverse correlation … approximate with inverse-vol * prior tilt" (mase.ts:83-89) |
| 041 | §6.6 | NOT-IMPLEMENTED-GAP | — (α=95% asserted in text only: mase.ts:103, blueprint MASE_MODELS:215) | — | — | — | α implied 95% (no estimator) | — | No VaR quantile computed anywhere (audit-stress/monte-carlo are RR-survival suites) |
| 042 | §6.6 | NOT-IMPLEMENTED-GAP | mase.ts:modelCVaR/105-129 (heuristic only) | prior × tilts {USD .9, EUR .9, JPY 1.1, GBP .8, CNY .7, CHF ×stressMult×1.2, Gold ×stressMult}, stressMult=1.3 if regime≥2 | weights | per ensemble call | tilt constants (labeled "Simplified" mase.ts:104) | canonical 2.1 | Named "Tail Risk (CVaR)" but computes **no CVaR** — safe-haven prior tilt. Disclosed as simplified; the 95% claim in the name/desc is unimplemented |
| 043 | §6.7 | NOT-IMPLEMENTED-GAP | — | — | — | — | — | — | No M_t / DD_t / MDD anywhere (audit-stress S5/S6 track min RR; historical-backtest tracks 5 RR/oracle/index invariants — no drawdown series) |
| 044 | §6.8 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | f symbolic; CPI weights must not be invented | — | Correctly deferred. Disclosure of the GOAL exists: blueprint.ts:405 '"1 MTQ = 1 Big Mac" … Replaced with "targets global purchasing-power index."' |
| 045 | §6.8 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | blocked by EQ-044 | — | No R_MTQ vs R_GPP comparison |
| 046 | §6.8 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | metric selection is research deliverable | — | Absent; no silent metric switching (nothing to switch) |
| 047 | §7.1 | NOT-IMPLEMENTED-GAP | — (no Σ(w−W^Prior)² term; prior enters multiplicatively in models 3/4/6) | — | — | — | — | — | No scalar objective exists at all (see EQ-053). Prior-anchoring via STRATEGIC_PRIOR in maxdiv/cvar/institutional models + envelope projection |
| 048 | §7.1 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | L1-vs-L2 selection unrecorded | — | Neither form implemented; selection properly left to methodology versioning |
| 049 | §7.2 | NOT-IMPLEMENTED-GAP | — (HHI exists only in systemic-exposure-engine.ts:298-311 = §20.6 **bank** exposure HHI, different subsystem) | — | — | — | — | — | Basket-weight HHI absent. Concentration bounded instead by §8.1 hard envelopes (constitutional layer) |
| 050 | §7.2 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | λ_C unspecified | — | No concentration penalty; envelopes substitute |
| 051 | §7.3 | PARTIAL-DOCUMENTED | mase.ts:applyVelocityCaps/342-366; targetVelocity/369-376; marp.ts level 5; engine.ts:applyMarpRebalance/993-1001 | per-component \|Δw\| capped; max-\|Δ\| diagnostic; USD turnover capped 5% NAV/day | weight fraction per accepted update; USD/day | per advanceMase tick; per trade | MAX_VELOCITY {USD/EUR .005, JPY/GBP .003, CNY/CHF .002, Gold .005} (blueprint:236-239); MAX_DAILY_TURNOVER .05 | canonical 2.6 "MARP: Level 5 (turnover cap at 5% NAV)…" | Σ_i\|Δw\| (total turnover metric) not computed; hard caps substitute for measurement. Velocity caps disclosed (mase.ts:334-341, blueprint:232-235) |
| 052 | §7.3 | NOT-IMPLEMENTED-RESEARCH-OK | — | — | — | — | λ_T unspecified | — | No λ_T penalty; §8.3 hard velocity cap + §10 daily-turnover cap are the disclosed substitutes |
| 053 | §7.4 | NOT-IMPLEMENTED-GAP | — (no optimizer/objective; pipeline = heuristic models → equal average → box∩simplex projection → ρ-smoothing → velocity caps) | — | — | per tick | no λ₁…λ₈ anywhere (LAMBDA_1..4 at blueprint:445-448 are legacy §7 benefit coefficients, marked SUPERSEDED) | — | Per-term presence: (1) Risk/variance — structural only (inverse-vol model); (2) CVaR — heuristic model, no penalty; (3) PPError — absent; (4) CorrRisk — absent (corr=null); (5) Turnover — hard caps not penalty; (6) StrategicDrift — absent (prior-anchored models); (7) Concentration — envelopes not penalty; (8) LiquidityRisk — absent from objective (liquidity enters via haircuts/LCR/state machine). 0/8 as penalized objective terms |
| 054 | §7.4/§8.5 | PARTIAL-DOCUMENTED | mase.ts:applyEnvelopes/287-311 (clamp→renormalize iterate, ≤12 iters, tol 1e-9); applyVelocityCaps/342-366; engine.ts:applyMarpRebalance/963-1130; marp.ts:marpDecision/88-146; state-machine.ts (RR/LCR) | ensemble → feasible W^Target; smoothed series velocity-capped; trades gated | weight fractions; USD | per tick; per trade | ADMISSIBILITY_ENVELOPES (blueprint:73-81); MAX_VELOCITY; NO_TRADE_BAND .0075/.015; MAX_DAILY_TURNOVER; DIRECTION_LOCK 24h | canonical 2.1 (sum=1 + envelopes, 1pp tolerance), 2.6 (MARP levels), 3.1/3.2/3.7 | Σw=1 ✓ (renormalize at every layer); w≥0 ✓ (lower bounds ≥.03); L≤w≤U ✓ (projection; test tolerates ≤1pp renormalization breach — documented); velocity ✓ on published smoothed series. **Coverage/LCR NOT re-checked inside applyMarpRebalance** (level gate + turnover + direction-lock only); coverage enforced at mint/RR-hard-floor + state machine. **USE_MARP_EXECUTION=false** (pilot-state.ts:104) — actual reserve mutation is the legacy §7 gold↔USDC path; MARP is a read-only projection (disclosed: page.tsx:630, RebalanceEngine.tsx, ProductionReadinessDashboard.tsx:124) |
| 055 | §7.5 | DEVIATION | mase.ts:maseEnsemble/239-277 | 6 §7.5 families → equal 1/6 average → (projected via applyEnvelopes at engine.ts:2137) | weights (Σ=1) | per tick; compute-engine daily | α_m = 1/6 per family; Stability = 50/50 minvar+ERC blend (mase.ts:248) | canonical 2.1 (target sums to 1; constrained sums to 1) | Equal weights, NOT adaptive. **Disclosed**: mase.ts:236-238 "In the pilot: equal-weight ensemble (1/6 per family). Production: adaptive softmax weights per §7.6"; UI: MaseEngine.tsx:200-204 ("6-model equal-weight ensemble", "equal weight = 1/6"), DocsSection.tsx:310. Post-mixture projection into admissible set ✓ (satisfies EQ-055 dev-check). **45/35/20 illustrative split NOT used anywhere** (grep clean) |
| 056 | §7.6 | NOT-IMPLEMENTED-RESEARCH-OK | — (comment only: mase.ts:237-238 lists Score_m feature family) | — | — | — | f symbolic; OOS-only rule | — | No Score_m computed. Disclosed as production plan in the same comment |
| 057 | §7.6 | NOT-IMPLEMENTED-RESEARCH-OK | — (no softmax; "softmax" appears only in mase.ts:237 comment) | — | — | — | η unspecified | — | No exp(−η·Score) anywhere → **no live RG-06 orientation exposure**. Score-orientation statement absent from code comments too (only feature list) |
| 058 | §7.6 | NOT-IMPLEMENTED-RESEARCH-OK | — (pilot ensemble is the static EQ-055 form) | — | — | per tick (static α) | — | — | Time-varying α_m,t absent; blocked by EQ-056/057 (research) |

**Status counts (34 equations):** VERIFIED 0 · PARTIAL-DOCUMENTED 4 (EQ-025, 030, 051, 054) · DEVIATION 5 (EQ-029, 037, 039, 040, 055) · NOT-IMPLEMENTED-GAP 11 (EQ-027, 031, 032, 035, 038, 041, 042, 043, 047, 049, 053) · NOT-IMPLEMENTED-RESEARCH-OK 14 (EQ-026, 028, 033, 034, 036, 044, 045, 046, 048, 050, 052, 056, 057, 058) · NOT-VERIFIABLE 0.

---

## RG-relevant findings

### RG-06 — Adaptive softmax orientation (EQ-055/056/057/058)
**Verdict: DORMANT-CLEAN in pilot; orientation must be specified before production.**
- No softmax / `exp(−η·Score)` code exists anywhere in src (grep: "softmax" only at mase.ts:237, a comment). Therefore no sign/orientation mistake is live.
- Pilot α_m = **equal 1/6 per §7.5 family** (mase.ts:268 `const ensembleWeight = 1 / families.length;`), with Stability = 50/50 minvar+ERC (mase.ts:248). Σα_m = 1 ✓. Mixture re-projected into admissible set (engine.ts:2137 `applyEnvelopes(mase.target)`) — satisfies EQ-055's developer check.
- Equal-weight deviation IS disclosed, with quotes:
  - mase.ts:236-238 — `// In the pilot: equal-weight ensemble (1/6 per family). Production: adaptive softmax weights per §7.6 (Score_m = f(OOSRisk, CVaR, PPError, Turnover, Robustness)).`
  - MaseEngine.tsx:200-204 — "§6 / §7 · MASE Candidate Models · 6-model equal-weight ensemble" / Pill "equal weight = 1/6"
  - DocsSection.tsx:310 — "combines them with equal weights (pilot) / adaptive weights (production target)"
- The blueprint's illustrative **45/35/20 split is NOT used** (grep for "45/35/20"/0.45-0.35 patterns: clean) — EQ-058's developer check satisfied.
- Gap: the code comment preserves Score_m's feature list but records **no lower-is-better orientation statement**; when §7.6 lands, tests must pin `α_m = exp(−η·Score_m)/Σexp(−η·Score_k)` with lower-score→higher-weight before any production authorization.

### RG-07 — GPR sign convention (EQ-026/027/028)
**Verdict: NO live sign risk (formula absent); SEEDING RISK from the coexisting proxy; must be resolved before production.**
- No code computes `GPR_i,t = (P_i,t−1 / P_i,t) − 1` (grep "GPR": absent). No gold-price-in-currency-i series exists (oracle pairs: EUR/GBP/JPY/CNY/CHF per USD + XAU_USD only).
- The nearest signal, mase.ts:modelPurchasingPower (134-166), uses a **different quote direction and different response direction**:
  ```ts
  // mase.ts:139-141
  // Without PPP fair-value data, approximate: weight toward currencies
  // that have depreciated (lower price = better purchasing power value)
  // mase.ts:151-152
  // Weight ∝ prior / price (buy undervalued)
  raw.EUR = prior.EUR / Math.max(priceDevs.EUR, 0.01)   // priceDevs.EUR = fx.EUR_USD / BASE_FIXINGS.EUR_USD
  ```
  Here `priceDevs` is **currency-i-in-USD** (USD per unit of currency i, relative to base). A currency that depreciated vs USD gets **over**-weighted. The blueprint's P_i,t is **gold priced in currency i**; if currency i loses gold purchasing power, P_i,t rises and GPR = P_{t-1}/P_t − 1 < 0 → the currency should be **down**-weighted. The proxy's "buy weakness vs USD" heuristic is the opposite response and must not seed the production GPR implementation. Disclosed as an approximation (mase.ts:133 "Simplified: weight by inverse of deviation from PPP fair value") but the comment does not flag the sign-convention difference vs §5.2.
- Note: gold appears in the proxy as just another component (`raw.Gold = prior.Gold / max(prices.Gold, 0.01)` → rising gold price **under**-weights Gold) — this is a relative-value tilt, not a purchasing-power-vs-gold measurement.

### RG-15 — Symbolic forms / invented constants
**Verdict: NO violation — no symbolic blueprint form was filled with a constant presented as canonical; all symbolic f/λ/η/ω/k/F (EQ-025 ω_h, EQ-028 f, EQ-033 f, EQ-034 λ_CVaR,0/k, EQ-036 λ/F, EQ-049–052 λ_C/λ_T, EQ-056 f, EQ-057 η) are left unimplemented, consistent with the spec's "do not invent" checks.** However the simplified pilot substitutes carry many invented constants; labeled status:

**Labeled as pilot simplification (in-code):**
| Constant | Value | Location | Label |
|---|---|---|---|
| min-var vol floor | 0.01 | mase.ts:53-59, 94 | "Simplified pilot: inverse-volatility weighting (approximation of min-variance)" (mase.ts:46) |
| ERC | 1/7 | mase.ts:77-78 | "Simplified: equal weight (1/N) — true ERC requires iterative solving" (mase.ts:71) |
| max-div form | prior/vol | mase.ts:90-99 | "Simplified: weight by inverse correlation to the basket … approximate with inverse-vol * prior tilt" (mase.ts:83-89) |
| CVaR model tilts | USD .9 · EUR .9 · JPY 1.1 · GBP .8 · CNY .7 · CHF ×1.2 · Gold ×1.0; stressMult 1.3 (regime≥2) | mase.ts:113-123 | "Simplified: overweight gold + CHF (safe havens) in stress" (mase.ts:104) |
| PPP form | prior/price, floors .01 (JPY .001) | mase.ts:152-160 | "Simplified: weight by inverse of deviation from PPP fair value … approximate" (mase.ts:133, 139) |
| Institutional tilts | JPY ×1.05 · CNY ×0.9 · CHF/Gold ×stressMult 1.15 | mase.ts:183-192 | "Pilot approximation: the strategic prior IS the published intersection…" (mase.ts:172-175) |
| Ensemble α | 1/6 (+ Stability 50/50 blend) | mase.ts:248, 268 | "In the pilot: equal-weight ensemble (1/6 per family). Production: adaptive softmax…" (mase.ts:236-238) |
| Vol baselines + VIX pivot | {0.05,0.10,0.12,0.11,0.09,0.10,0.15} × (VIX/18.5) | engine.ts:1941-1949 | "Pilot approximation: scale baseline vols by VIX / 18.5 … Production should use a rolling covariance" (engine.ts:1934-1937) |
| Macro walk (fallback) | OU μ=19/104, σ=2, bounds [10,80]/[80,120] | engine.ts:2184-2187; fx.ts:141-148 | "honest: simulated pilot macro signals" (engine.ts:2183); "Honest simulation" (fx.ts:89) |
| Drawer demo vols/prices | SYNTHETIC_VOLS; synthetic drift 1.6/0.1/0.4 | WeightChangeDrawer.tsx:47-72 | "Synthetic … production would read this from a rolling-window vol estimator" (45-46, 57-60) |

**Unlabeled / under-labeled invented constants (flag for governance tagging):**
| Constant | Value | Location |
|---|---|---|
| Regime classifier thresholds | VIX ≥15/≥22/≥30 → 1/2/3; DXY ≤88 or ≥115 → ≥stress | engine.ts:1956-1962 (mirrored MaseEngine.tsx:150-153, WeightChangeDrawer.tsx:75+) — described, never labeled as §5.4 pilot simplification |
| Crisis gold vector | {USD .15, EUR .10, JPY .07, GBP .06, CNY .04, CHF .08, Gold .50} | mase.ts:224 |
| Regime blend weights | 0.5 (maxdiv+ppp; cvar+gold; minvar+erc) | mase.ts:217, 225, 248 |
| z-score ε | 1e-9 | engine.ts:721-723, 2177-2178 (blueprint leaves ε free; value is a de-minimis guard but unlabeled) |
| Velocity fallback cap | 0.005 (missing-component default) | mase.ts:350, 359 |
| Envelope projection knobs | maxIterations 12; tolerance 1e-9 | mase.ts:287, 306 |
| Genesis macro history | seedHistory(18.5,2.0,90)/(104.2,2.5,90) synthetic walk | engine.ts:346-347, 414-424 |
| Legacy θ κ-form | ALPHA .15 · BETA .10 · THETA_MAX .03 | blueprint.ts:442-444 (marked SUPERSEDED but still live in the parallel legacy path: engine.ts:727-735 → computeTargetGoldWeight:770-775) |

---

## Findings requiring attention

1. **[HIGH] MASE/MARP is a read-only projection; the legacy §7 path mutates reserves.** `USE_MARP_EXECUTION = false` (pilot-state.ts:104). `advanceMase` DOES commit smoothed weights to the chain index (engine.ts:2151 `commitChainIndexWeights`), so the published index weights move with MASE while actual reserve composition is rebalanced only by the legacy gold↔USDC `evaluateRebalance` path. The smoothed-vs-observed divergence is surfaced (envelope ok/warn/breach on observed weights, engine.ts:2063-2073) and disclosed in UI (page.tsx:630 "Read-only projection — actual mutation requires USE_MARP_EXECUTION=true"; ProductionReadinessDashboard.tsx:124 "MARP execution … PARTIAL … feature-flagged off"), but NOT in /api/honest-status. Before public testing, either flip the flag or add the divergence bound to the honest-status evidence.
2. **[MED] Regime detection is an invented, unlabeled hard classifier.** `detectRegime` (engine.ts:1956-1964) uses raw VIX/DXY level thresholds 15/22/30 and 88/115 — none are blueprint-sourced (§5.4's classifier is symbolic). The substitute is neither labeled a pilot simplification nor tagged governance-pending, unlike the vol/ensemble simplifications. Also the blueprint's 6-regime probability model (EQ-031/032) has no mapping to the pilot's 4 states.
3. **[MED] EQ-029 window is 90 ticks, not 90 days, over synthetic-seeded history.** engine.ts:119 comments "rolling 90-day VIX samples", but the pilot pushes one sample per 4s tick (`TICK_MS=4000`, pilot-state.ts:67; `advanceMacro` engine.ts:2171-2174 caps at ROLLING_WINDOW_DAYS=90 samples). Genesis history is a synthetic mean-reverting walk (engine.ts:346-347, 414-424). Formula itself matches (population sd ÷N = blueprint's denominator-90 form). Tests run 1 tick = 1 day (e2e-integration.ts:178), masking the cadence gap.
4. **[MED] z-scores feed the legacy θ engine, not MASE.** `computeZScores` (engine.ts:718-725) is spec-exact (ε=1e-9 additive, zero-fallback), but its only consumer is the legacy `computeRawTargetTheta` → `computeTargetGoldWeight` (§6/§8, static κ-form ALPHA .15/BETA .10/±3%). MASE's inputs (regime) bypass z-scores entirely. The blueprint positions §5.3 z-scores as MASE inputs — consumer wiring is a deviation to record when §5 is implemented.
5. **[MED] No covariance, no VaR/CVaR/MDD numerics anywhere.** `maseEnsemble(..., null, regime)` at engine.ts:2020/2136 — CorrelationData is never built. EQ-041/042/043 have no estimator in engine.ts, audit-stress.ts (11 RR-survival scenarios), monte-carlo.ts (scenario configs), or historical-backtest.ts (5 invariants). The "Tail Risk (CVaR)" model computes no CVaR (heuristic tilt, disclosed). Any UI/API text implying live VaR/CVaR would be an honesty issue — none found (HONEST_STATUS line 392 claims "Full chain-linked index + VaR/CVaR + MASE ensemble" under "Mathematical Consistency" — **this overstates the implementation; recommend rewording** since VaR/CVaR are unimplemented).
6. **[LOW] Test gaps for the MASE layer.** No test asserts: the 1/6 equal family weights or the Stability 50/50 blend; `applyVelocityCaps` caps (only indirect via chain-commit equality); the ρ ladder (0.50 normal / 0.75 stress selection via stressLevel≥2); `detectRegime` thresholds; the ε guard; `applyEnvelopes` iteration/convergence (canonical 2.1 tolerates 1pp breach — documented in-test at canonical-invariants.ts:441-461). Covered: sum-to-1 (pre/post constraint), envelope containment (1pp), MARP 6 levels, chain-commit equality, snapshot mase/marp non-null, e2e RR invariant with MASE enabled, stress-rerun S5 "MASE trims gold to envelope upper 32%" (stress-rerun.ts:810).
7. **[LOW] blueprint.ts MASE_MODELS table (6 models, no "institutional") vs mase.ts `mase.models` (7 models incl. institutional).** DocsSection renders the 6-row table; MaseEngine heatmap renders 7 model rows. The ensemble itself correctly uses six §7.5 FAMILIES (mase.ts:260-267) — doc/UI mismatch only.
8. **[LOW] Wrong § cite in mase.ts:** "Model 5: Purchasing-Power Parity (§6.7)" (mase.ts:131) — per the eq-by-eq spec, §6.7 is MDD (EQ-043); purchasing-power benchmarking is §6.8 (EQ-044-046). Documentation-only.
9. **[LOW] honest-status API does not disclose the MASE-specific simplifications** (equal ensemble, VIX-scaled vols, hard regime classifier, corr=null, no VaR/CVaR/MDD, no GPP, legacy θ parallel path). Disclosures live only in code comments + UI text (DocsSection.tsx:310/336-337, MaseEngine.tsx:174-180/554, ProductionReadinessDashboard.tsx:80/124/152). G2 evidence (honest-status.ts:51) is generic ("internal research program partially executed … walk-forward/purged-CV pending"). Recommend a per-equation disclosure annex surfaced via /api/honest-status or /api/implementation-status.
10. **[LOW] Velocity re-clamp heuristic:** `applyVelocityCaps` renormalizes → re-clamps once → renormalizes (mase.ts:353-364); the final renormalize can again perturb capped components marginally. In-code rationale: "two passes converge for practical weight vectors — the envelopes' lower bounds sum to 79%" (mase.ts:339-341). De-minimis; consistent with the 1pp test tolerance, but should be an explicit convergence assertion in production.
11. **[INFO] Positive controls verified:** Σw=1 enforced at model, ensemble, envelope and velocity layers; equal-weights deviation disclosed in code AND UI; 45/35/20 illustrative split absent; post-mixture projection present (EQ-055 dev-check); 4-state weights distinctly exposed (see (b) below); ρ ladder values are blueprint-verbatim (0.50/0.75, blueprint.ts:224-225); velocity caps are blueprint-verbatim (Listing 1/2 values, blueprint.ts:236-239); no invented coefficients for any symbolic blueprint form.

---

## Answers to the two explicit questions

**(a) Unspecified blueprint functions filled with invented constants (RG-15)?**
NO canonical-form violation: every symbolic form (EQ-025 ω_h, EQ-028 GSignal f, EQ-033 CrisisScore f, EQ-034 λ_CVaR,0/k, EQ-036 λ/F, EQ-050 λ_C, EQ-052 λ_T, EQ-056 Score f, EQ-057 η, EQ-059+ L_i,t=f out of range) is left **unimplemented** — the code never presents an invented constant as the blueprint's coefficient. The invented constants that DO exist belong to the simplified substitute models and are inventoried in the RG-15 table above: most are labeled ("Simplified pilot", "Simplified:", "Pilot approximation"); the unlabeled set is: regime thresholds 15/22/30 & 88/115 (engine.ts:1956-1962), crisis gold vector (mase.ts:224), 0.5 blend weights (mase.ts:217/225/248), ε=1e-9 (engine.ts:721), velocity fallback 0.005 (mase.ts:350), projection iterations 12 / tol 1e-9 (mase.ts:287/306), synthetic seed history (engine.ts:346-347). These should be tagged as pilot simplifications subject to governance (finding 2/9).

**(b) Does the UI/API expose W_Target vs W_Smooth vs W_Prior distinctly?**
YES. `MetricsSnapshot.weightStates = {prior, target, smoothed, execution}` (engine.ts:1613-1617, populated at 2084-2089: prior=STRATEGIC_PRIOR, target=constrained ensemble, smoothed=ρ/velocity-processed, execution=observed reserve composition) plus `mase.models` + `mase.ensembleTarget` (pre-constraint average, engine.ts:2076-2083). Served by **/api/metrics** (returns the full `getSnapshot()` payload; note there is no /api/snapshot route). UI: MaseEngine.tsx renders the 4-state table per component (lines 301-312: prior/target/smoothed/execution columns + smoothed→execution deviation), the 7-model heatmap with the ensemble-target row, envelope bars, and MARP decisions; DocsSection.tsx:274/280/334 reiterates W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution; /api/succession consumes `snap.weightStates.smoothed` (route.ts:44). MaseEngine.tsx:253 correctly states the equal-weight average "becomes W^Target before envelope constraints are applied" (i.e., snapshot weightStates.target is the post-envelope constrained vector, mase.ensembleTarget is pre-envelope — both exposed).

---

## Evidence quotes (key code snippets)

**Equal-weight ensemble (EQ-055, RG-06):**
```ts
// mase.ts:229-238
//   W^Stability (min-variance / risk-parity) · W^Diversification · W^TailRisk ·
//   W^PurchasingPower · W^Institutional · W^Regime
// Stability covers both Minimum-Variance and ERC …
// In the pilot: equal-weight ensemble (1/6 per family). Production: adaptive
// softmax weights per §7.6 (Score_m = f(OOSRisk, CVaR, PPError, Turnover, Robustness)).
```
```ts
// mase.ts:268-273
  const ensembleWeight = 1 / families.length;
  …
      target[c] += f[c] * ensembleWeight;
```

**Simplified candidate models (EQ-037/039/040/042):**
```ts
// mase.ts:44-46  — "Simplified pilot: inverse-volatility weighting (approximation of min-variance)."
// mase.ts:69-71  — "Simplified: equal weight (1/N) — true ERC requires iterative solving."
// mase.ts:81-83  — "Simplified: weight by inverse correlation to the basket."
// mase.ts:102-104 — "Minimize conditional value-at-risk at 95th percentile.
//                     Simplified: overweight gold + CHF (safe havens) in stress, underweight risk currencies."
```

**Vol proxy (EQ-025):**
```ts
// engine.ts:1934-1937
/** Estimate per-component annualized volatility from the engine's macro state.
 *  Pilot approximation: scale baseline vols by VIX / 18.5 (the "normal" VIX
 *  baseline) … Production should use a rolling covariance from real price history. */
```

**90-obs rolling stats + z (EQ-029/030):**
```ts
// engine.ts:710-716, 718-725
function rollingStats(hist: number[]): { mean: number; sd: number } {
  const filled = hist.filter((x) => x > 0);
  …
  const variance = filled.reduce((a, b) => a + (b - mean) * (b - mean), 0) / filled.length; // population sd
  return { mean, sd: Math.sqrt(variance) };
}
export function computeZScores(s, vix, dxy) {
  …
  const eps = 1e-9;
  const zVix = v.sd > eps ? (vix - v.mean) / (v.sd + eps) : 0;
```

**Regime hard classifier (EQ-031/032):**
```ts
// engine.ts:1952-1963
/** Detect the market regime from VIX (primary) + DXY (secondary).
 *  0 = calm, 1 = normal, 2 = stress, 3 = crisis.
 *  VIX thresholds: <15 calm, <22 normal, <30 stress, ≥30 crisis.
 *  DXY extremes (<88 or >115) bump the regime up to ≥ stress. */
```

**Constraint projection + velocity (EQ-054):**
```ts
// mase.ts:279-287 — "Clamp each component to its admissibility envelope, renormalize to sum to
// 1, and REPEAT (alternating projection onto the box ∩ simplex set) until the
// vector is feasible … the envelopes' lower bounds sum to 79% and uppers to 125% …"
export function applyEnvelopes(weights: WeightVector, maxIterations: number = 12): WeightVector {
// mase.ts:334-341 — "|w_i,t − w_i,t−1| ≤ Δ_i for the published (smoothed) weight series.
//   USD & EUR 0.50% · JPY & GBP 0.30% · CNY & CHF 0.20% · Gold 0.50% per accepted update."
```

**Smoothing ρ ladder (EQ-054/§8.4, consumed by advanceMase):**
```ts
// mase.ts:313-318 — "W^Smooth = ρ·W_prev + (1−ρ)·W^Target … ρ_normal = 0.50 … ρ_stress = 0.75 …
// The stress flag is sourced from the crisis-score path (threshold 0.70; conservative default
// to stress when the score is unavailable — §8.4)."
// mase.ts:387 — const rho = stressLevel >= 2 ? SMOOTHING_RHO_STRESS : SMOOTHING_RHO_NORMAL;
```

**advanceMase (live entry point):**
```ts
// engine.ts:2136-2143
  const mase = maseEnsemble(vols, prices, null, regime);   // corr = null — no covariance
  const constrained = applyEnvelopes(mase.target);
  const prevSmoothed = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  const sl = stressLevel(s.riskState.state);
  s.maseSmoothed = smoothWeightsConstitutional(prevSmoothed, constrained, sl);
```

**PPP proxy (EQ-027, RG-07):**
```ts
// mase.ts:139-141, 151-152
  // Without PPP fair-value data, approximate: weight toward currencies
  // that have depreciated (lower price = better purchasing power value)
  …
  // Weight ∝ prior / price (buy undervalued)
```

**Execution flag (EQ-054 execution-time):**
```ts
// pilot-state.ts:104
const USE_MARP_EXECUTION = false;
// engine.ts:934-940 — "Constraints enforced (§10): MAX_DAILY_TURNOVER (5% of NAV) …
//   DIRECTION_LOCK_HOURS (24h) … Only decisions with shouldTrade=true AND level>=6 are executed"
```

**Covering tests (names verbatim):**
- canonical-invariants.ts L2: "MASE: ensemble target weights sum to 1.0"; "MASE: constrained weights still sum to 1.0 (renormalised)"; "MASE: every component within admissibility envelope (1pp tolerance — applyEnvelopes renormalisation)"; "MARP: Level 1 (no-trade zone) when deviation < 0.5%"; "MARP: Level 6 (execute) when deviation > 5% with positive cost-benefit"; "MARP: Level 5 (turnover cap at 5% NAV) when trade size exceeds cap".
- canonical-invariants.ts L3: "Cross: MASE smoothed weights are computed (not null)"; "Cross: chain index prevWeights = MASE smoothed weights (post commit)"; "Cross: snapshot.marp decisions cover all 7 components"; "Cross: snapshot.mase (post-advance) is non-null".
- historical-backtest.ts: "MASE ensemble ENABLED — advanceMase() called per day" (line 40; INV-1…INV-5 across 2015-2025).
- e2e-integration.ts / stress-rerun.ts: advanceMase in every tick/stress path; stress-rerun S5 note "MASE trims gold to envelope upper 32%".
