# Traceability Records EQ-135..EQ-175
Task ID: 2-g · READ-ONLY audit · Scope: pricing (P_MTQ), mint/redeem, genesis/treasury, 6-state risk machine, succession/eject ladder, validation pipeline, Appendix C worked examples.
Implementation audited: `/home/z/my-project/src/lib/mtq/` (engine.ts 2523 L, chain-index.ts 453 L, state-machine.ts 357 L, succession.ts 609 L, marp.ts, mase.ts, blueprint.ts, audit-stress.ts 1471 L, pilot-state.ts 595 L, honest-status.ts 153 L, compute-engine.ts 278 L, audit-trail.ts), API `/api/simulate/mint|redeem`, `/api/metrics`, `/api/gfb`, `/api/succession`, UI `BasketValueDisplay.tsx`, tests `canonical-invariants.ts` (159), `e2e-integration.ts` (26), `stress-rerun.ts` (11), `audit-work/v2/audit-verify.ts`, `audit-work/v2/c4-check.ts`.

Live evidence re-run during this audit (2026, sandbox):
- `canonical-invariants` **159/159 PASS**; `e2e-integration` **26/26 PASS**; `stress-rerun` **11/11 PASS** (S11 perturbation grid 99.0% ≥ 90%).
- `c4-check.ts`: `C.4 exact: benefit=$1200 cost=$1700 net=$-500 pass=false → Trade=0 ✓`.
- `audit-verify.ts`: independent index recompute `I_t = 1.195907` matches engine `P_MTQ = 1.195907`; `commitWeights (gold 26→29%): divisor D_t = 0.896631, I_t unchanged`; state-machine self-test 17/17; chain-index self-test PASS.
- `bun run src/lib/mtq/state-machine.ts` self-test (module-load): 17 cases PASS (not re-run separately — runs at import in every suite above).

Status vocabulary: VERIFIED / PARTIAL-DOCUMENTED / DEVIATION / NOT-IMPLEMENTED-RESEARCH-OK / NOT-IMPLEMENTED-GAP / NOT-VERIFIABLE.

## Master table

| EQ | Blueprint § | Status | Code (file:fn/line) | Inputs→Outputs | Units | Cadence | Params | Tests | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 135 | §18.1 | VERIFIED | chain-index.ts `getMTQPrice` L196-198; engine.ts `getMtqPriceFromState` L559-561; snapshot `mtqPrice`/`gfbIndex` L1697-1698, L1816; `/api/gfb`, `/api/metrics` | ChainIndexState.I_t → P_MTQ = I_t × PAR (PAR=1.0) | USD-equivalent per MTQ (PAR = 1.00 basket-unit) | every 4s tick | PAR 1.00; I_0 = 1.0; PRICE_SAFETY 0.50–2.00 | canonical L1.1/L1.2 ("gold +50% → I_t=1.13"), L3 ("snapshot.mtqPrice = chain index I_t"), audit-verify §B | I_base = 1.0 normalized convention; baseDenominator 650.644103 stored immutable, NOT divided (see RG-14) |
| 136 | §18.2 | VERIFIED | engine.ts `computeLiability` L630-632, `computeReserveRatio` L634-637, `circulatingSupply` L626-628 | (S_circ, P) → L; (V_net, L) → RR | USD; ratio | every computation site | genesisReserve excluded | canonical L1.4 "L = S_circ × P_MTQ", L1.5 "RR = V_net/L", L3 snapshot RR/LCR | Shared identity at: computeSnapshot L1701-1703, applyMint L1244, applyRedeem L1464/L1493, stepEngineCanonical L1232-1234, audit-trail rows; ⚠ pilot-state tick L412-416 re-implements inline (finding 8) |
| 137 | §18.3 | PARTIAL-DOCUMENTED | engine.ts `computeSnapshot` L1518-1906 (MetricsSnapshot); audit-trail.ts `persistDailyStateVector` L83-127 (throttle 30s), `persistOracleSamples` L177-208 | state+fx+oracle → published vector | mixed (USD, ratios, weights) | 4s tick; persisted ≥30s (pilot "daily" vector is 30s-throttled) | DAILY_VECTOR_THROTTLE_MS=30_000 | audit-retention-test.ts (row caps) | Present: W (gold weights in persisted row; full 7-comp `weightStates` in live snapshot), Risk (rr/lcr/status), Liquidity (lcr), Coverage (=rr), OracleConfidence (OracleSample validCount/spreadBps/method + snapshot.oracle), pegHealth, ejectStage, bufferState. ABSENT from persisted vector: CVaR, MDD, PPError, CrisisScore, Turnover, Cost (finding 13) |
| 138 | §18.3 | VERIFIED | pilot-state.ts `tick` L208-522; engine.ts `evaluateRebalance` L795-844 (no-trade/cost gates); marp.ts `marpDecision` L82-151; state-machine.ts policy fns | X_t → Action; tick only triggers calculation | — | 4s tick | θ_base 0.75% / 1.5% crisis; MIN_PROFITABILITY $10 | canonical L2 MARP Level 1/5/6; e2e 26/26 | Calendar never forces a trade: gates = no-trade zone, urgency, cost-benefit, turnover cap, direction lock, oracle-pause, price band |
| 139 | §19.2 | VERIFIED | engine.ts `applyMint` L1200-1201 | (X, F_mint) → X_net = X − X×10bps ≡ X×(1−F) | USD | per mint | MINT_FEE_BPS=10 (0.10%, state-independent §19.7) | canonical L1.6 "fee_usd = X × MINT_FEE_BPS/10000" | Fee applied once, on the deposit, before pricing |
| 140 | §19.2 | VERIFIED | engine.ts `applyMint` L1202-1240 | (X_net, P_MTQ, throttle) → MTQ_minted = X_net/P × throttle; basket purchase at live W^Smooth | MTQ units (float, no decimal flooring) | per mint | throttle 1.0/0.5/0.25/0; MIN_MINT_MTQ=1; PRICE_SAFETY band; oracle-pause gate (pilot-state L562-569) | canonical L1.6, L2 throttle per state, L5 MIN_MINT ($1 reject, $2 ok); live 250 USDC → 208.82 MTQ @ P=1.1959 | NO 1:1 peg anywhere (I5); grep found no hardcoded 1.0 mint rate; guards = price band + oracle pause + min-mint; no quote-expiry (see EQ-146) |
| 141 | §19.2 | VERIFIED | same as EQ-135 | duplicate form aligned | USD/MTQ | 4s | — | canonical L3 "snapshot.mtqPrice = chain index I_t" | §18.1 and §19.2 forms are the same wiring; no separate scaling path |
| 142 | §19.3 | VERIFIED | engine.ts `applyRedeem` L1328 (`navPerMtq = circ>0 ? vals0.nav/circ : price`); snapshot `indexNavDivergence.navPerMtq` L1722 | (V_net, S_circ) → NAV_t | USD per MTQ | per redeem / per snapshot | genesis fallback = P_MTQ (documented) | canonical L1.3 "NAV_per_MTQ = V_net / S_circ", L1.7 | RG-02: symbol `navPerMtq` (alias `auditNavPerToken`); V_net is haircut-adjusted |
| 143 | §19.3 | VERIFIED | engine.ts `applyRedeem` L1372 (`grossUsd = inputMtq × navPerMtq`) | (Y, NAV_t) → gross | USD | per redeem | — | canonical L1.7 "grossUsd = Y × NAV_t (I6 + §19.3.2, not P_MTQ)", L3 cross | Settles at NAV (Invariant I6); legacy index-priced value retained as `auditGrossUsdIndex` (audit-only) |
| 144 | §19.3 | VERIFIED | engine.ts `applyRedeem` L1354-1374; state-machine.ts `redeemFee` L236-245 | (gross, F_redeem(state)) → net; fee ONCE | USD; feeBps = round(frac×10⁴) | per redeem | 0.15% N/C · 0.50% STRESS · 1.00% DEFENSIVE · 0.30% RECOVERY; EMERGENCY paused | canonical L2 feeBps 15/50/100, L4 fee escalation + RECOVERY 0.30%, L5 EMERGENCY paused | State-dependent fee chosen exactly once (single `feeFraction` application) |
| 145 | §19.3 | VERIFIED | engine.ts `applyRedeem` L1376-1417 (share = V_i_net/nav); L1390-1402 PAXG/XAUT + USDC/USDP/USDT splits by actual holdings; B9 guard L1429-1469 | (net, V_i/V_net) → Release_i | USD + native units | per redeem | actual-holdings basis (§19.3.2 Step 4) | canonical L3 "basket Gold weight = actual pre-settlement share", L5 B9 (no negative holdings, Σ usdValue = netUsd) | Pro-rata at ACTUAL net (haircut-adjusted) holdings, never target weights; dust: MIN_REDEEM_MTQ=1; B9 conservation guard rejects short baskets |
| 146 | §19.4.1 | NOT-IMPLEMENTED-GAP | constants blueprint.ts L174-175; UI MintSimulator.tsx L108 label; TransactionFlow.tsx L187 minOutput (display-only) | — | — | — | DEFAULT_USER_SLIPPAGE=0.005; TRADE_DEADLINE_MINUTES=5 | none (no revert test) | minOut/deadline NOT enforced: applyMint has no minOut revert; API accepts only {amount, chain, wallet}; TransactionFlow displays minOutput at 1% (≠ 0.5% default) — display-only. Contract-level §19.4.1 requirement (finding 1) |
| 147 | §19.4.2 | NOT-IMPLEMENTED-GAP | engine.ts `simulateQuote` L2327-2340 (gold route quotes only, §10.1/§12.3; not wired to redemption) | — | — | — | SLIPPAGE_TOLERANCES 0.5/1.0/1.5% | none | No ExecPrice < OraclePrice×(1−τ_user) guard on the redeem path; pilot redemption is a direct NAV settlement (no router execution), so the guard has no hook yet (finding 1) |
| 148 | §20.1 | PARTIAL-DOCUMENTED | engine.ts `initReserveState` L277-345 (deposit 1_100_000; totalSupply/genesisReserve 1_000_000); comment L265-268 "RR = 1,100,000 / (1,000,000 × 1.00) = 1.10"; blueprint.ts GENESIS_DEPOSIT_USDC/GENESIS_SUPPLY_MTQ L178-179 | deposit/supply → book RR 1.10 | USD / MTQ | genesis only | $1.1M / 1M (matches doc example verbatim) | no test asserts genesis RR = 1.10 | Pilot genesis amounts ARE the doc example; but canonical RR_t at pure genesis = ∞ (L=0 — genesis supply LOCKED, excluded from liability per blueprint Ch.18); 1.10 is book value only. Legacy monte-carlo.ts uses a different 880K/220K 5-component split (legacy file, finding 12) |
| 149 | §20.1.5 | VERIFIED | blueprint.ts `GFB_BASE_DENOMINATOR` L62-69 (=650.644103); `BASE_FIXINGS` L50-57; chain-index.ts `initChainIndex` L55-92 (7-component + Σw=1 + denominator checks); engine.ts L390-395 genesis wiring | (W^Prior, P_0) → baseDenominator | USD price level (ref-only) | genesis (immutable) | EUR 1.0500 · GBP 1.2500 · JPY 0.0067 · CNY 0.1400 · CHF 1.1300 · XAU $2,500; CHF and Gold INCLUDED (unlike legacy GFB) | chain-index runSelfTest; canonical L1.1/L1.2; initChainIndex validation | Pilot uses prior-weight shares × fixings (q_i notionals derived from $1.1M deposit); baseDenominator is reference-only because I_t is normalized (RG-14) |
| 150 | §20.3.1 | PARTIAL-DOCUMENTED | engine.ts `maybeTreasurySweep` L2261-2274; call sites pilot-state.ts L452 (every tick), L575/L580 (after trial fees) | hotWallet → sweep excess to coldTreasury | USD | every tick / per trial | TREASURY_SWEEP_THRESHOLD_USD=10_000; TREASURY_SWEEP_AUTHORITY 4/7; float $5,000 | L4 "mint/redeem fee accrues to treasury hot wallet" (no threshold-equality test) | DEVIATION-minor: triggers at >$10,000 but sweeps balance − $5,000 float (i.e., below the $10k line), vs blueprint "sweep only the balance above 10,000" (finding 4). Fees excluded from reserve NAV ✓ (hotWallet not in reserveAssetValues) |
| 151 | §20.4 | PARTIAL-DOCUMENTED | MINT_FEE_BPS L163; REDEEM_FEE_* L165-169; applyMint L1239 / applyRedeem L1489 (`s.treasury.hotWalletUsd += feeUsd`) | fees → operational hot wallet | USD (bps) | per mint/redeem | 0.10% mint; redeem ladder; rebalance 0.20% **absent** | canonical L4 fee accrual ×2 | Operational-wallet destination = hot wallet (→ cold treasury via sweep); excluded from NAV ✓. REBALANCE fee 0.20% (blueprint L9356) NOT implemented — no constant, no accrual (finding 3) |
| 152 | §21.2-21.3 | VERIFIED | state-machine.ts `instantaneous` L92-104, `rrInstantaneous` L69-75, `lcrDerived` L80-87, `SEVERITY` L59-66 | (RR, LCR) → S1..S6 | ratios | every tick/mint/redeem/rebalance/price update | S1 ≥1.10/≥1.00; S2 1.05-1.10/≥0.90; S3 1.02-1.05/≥0.80; S4 1.00-1.02/≥0.70; S5 RR<1.00 ONLY; S6 ≥1.05/≥0.90 + residual | state-machine runSelfTest 17 cases; canonical L1.8 (8 boundary cases incl. residual RECOVERY 1.20/0.65), L2, L5 | Matches blueprint §21.2 table exactly; worse-binds; EMERGENCY only via RR hard floor; doc-internal tension (earlier table: DEFENSIVE LCR "Any", RECOVERY ≥0.95) resolved to §21.2 normative (≥0.70/≥0.90) — see RG-13 |
| 153 | §21.3 | VERIFIED | state-machine.ts L169-179 (immediate downgrade), `stepUp` L107-116, `destinationHolds` L123-132 | breach → immediate; thresholds exact | — | every tick | boundary values as EQ-152 | canonical L5 "cannot skip the ladder", "49h → DEFENSIVE (one rung)"; self-test cases 2-6c | Escalation immediate ✓; no state-skip ✓; RECOVERY inserted as a ladder rung (STRESS→RECOVERY→CAUTION) per §21.2's ranking note — the literal §21.3 ladder line omits RECOVERY (documented interpretation, RG-13) |
| 154 | §21.3 | VERIFIED | state-machine.ts `determineState` L144-216; `advanceRiskState` engine.ts L675-694 (persists hysteresis) | sustained 48h per rung → upgrade | ms clock | every tick | RECOVERY_CONFIRMATION_PERIOD 48h; clock resets on dip (L207-215) | self-test 7/7b/8/9/10/10b/11; canonical L2 persisted-confirmation tests; e2e Step 10 recovery loop (ladder walked with backdated 48h ticks) | No EMERGENCY→NORMAL jump (tested); one rung per 48h; dip re-arms full 48h |
| 155 | §21.5.4 | VERIFIED | engine.ts `updateReintegration` L2208-2256; blueprint.ts `REINTEGRATION_WEIGHTS` L462 | (TimeInBand, LiquidityDepth, OracleAgreement, 1−Vol) → R_score | [0,1] normalized | every tick (SIM_TICK_HOURS=0.25) | w = 0.40/0.25/0.20/0.15 (Σ=1) | state constants asserted in blueprint; exercised via stress S8 depeg | All four inputs normalized [0,1]; liquidityDepth is randomized-simulated (honest label, finding 14); oracleAgreement = validCount/3; vol = spreadBps/100 |
| 156 | §21.5.4 | PARTIAL-DOCUMENTED | engine.ts L2246-2255 (`score > REINTEGRATION_THRESHOLD` → repurchaseStage 1→2→3 = 25/50/100%); blueprint.ts L463-470 | R_score ≥ 0.80 → staged re-purchase | score | every tick | REINTEGRATION_THRESHOLD=0.80; REINTEGRATION_STAGE_THRESHOLDS (0.80/24h, 0.85/48h, 0.90/72h) | none specific | 0.80 gate implemented; reverse-ladder per-stage escalation (0.85/0.90) + sustained-hours (24/48/72h) exist ONLY as constants + succession.ts `reintegrationNote` (L548) — updateReintegration increments a stage per tick call without enforcing escalating scores or sustained hours (finding 9) |
| 157 | §21.5.3; Listing 14 | PARTIAL-DOCUMENTED | blueprint.ts `EJECT_STAGES` L291-296 (cumulative 10/25/50/100); engine.ts `updatePegHealth` L1119-1154 (runtime ladder); succession.ts `pushStage` L287-303 + planner L270-305 | depeg hours/price → staged sells | % of ORIGINAL sleeve; USD proceeds per MTQ | every tick / drill | stage hours 12/24/48; stage-4 >96h OR price<0.9/>1.1; PEG_BANDS ±0.5/±1.0/±1.5; DEPEG_DETECTION_HOURS=12; EJECT_PAUSE_RULE_PCT=0.05 | chain-index runSelfTest (succession math); stress S8 (depeg ladder PASS); live /api/succession drill (worklog: realized 0.05316 vs hold 0.03525; artificialReturnPct=0; successor sanity PASS) | RG-12: cumulative-against-ORIGINAL (increments 10/15/25/50, Σ=100%) — matches blueprint. Gaps: RR-coupled triggers ("OR RR<1.08/1.05/1.02") and the 5% pause rule declared but NOT enforced at runtime; engine.ts L1145 comment cites non-existent `evaluateEjectStage` (findings 2); stage-4 uses 96h/90%-par proxy for "issuer freeze" (documented) |
| 158 | §22.3-22.4 | VERIFIED (pilot) | blueprint.ts `GOVERNANCE_LAYERS`/`PARAMETER_REGISTRY` L303+; engine.ts `getParameterGovernance` L700-707; snapshot L1904-1905; advanceMase is the ONLY weight-mutation path | governance → rules metadata; no live-weight setters | — | static metadata | 4 layers (CONSTITUTIONAL/MONETARY/RISK/EMERGENCY), envelopes, immutable flags | canonical L3 "PAR owned by CONSTITUTIONAL (immutable)", "RR_TARGET MONETARY envelope [1.05,1.20]", "PAUSE_MINT EMERGENCY" | No admin/API endpoint sets live weights (grep: no commitWeights/forceRebalance/setWeight routes); I8; timelocks modeled as metadata only (contract will enforce); /api/succession is a read-only state-clone drill |
| 159 | §23.3 | NOT-IMPLEMENTED-RESEARCH-OK | documented in canonical-invariants.ts L1196-1203 ("DOCUMENTED (not run)") + honest-status.ts G2 ("walk-forward/purged-CV pending"); historical-backtest.ts = §23.2 replay only (no walk-forward code) | — | — | — | — | Layer 6 documentation asserts | Explicitly disclosed as pending post-audit; gate G2 honest NOT-CONDUCTED |
| 160 | §23.4 | NOT-IMPLEMENTED-RESEARCH-OK | same documentation; no purge/embargo/leakage code in historical-backtest.ts / monte-carlo.ts | — | — | — | — | Layer 6 documentation asserts | As above |
| 161 | §23.6 | VERIFIED (pilot form) | audit-stress.ts `scenario11ParameterPerturbation` L1148-1390; stress-rerun.ts S11 L1213+ | ±50% perturbations of α/β/θ_max/λ/λ1..4 → survival | survival rate; minRR | ad-hoc run | 3200 trajectories; target ≥90% per perturbation | stress-rerun S11 "99.0% ≥ 90% — PASS" (live re-run) | MC-sensitivity form, not the literal symmetric ΔPerformance(θ±δ) ≤ B_θ Risk-Council bound; S11 also in canonical Layer 7 grid |
| 162 | §23.7 | NOT-IMPLEMENTED-RESEARCH-OK | absent (no Score = a(−Vol)+… function); MASE simplified to six §7.5 families, equal-weight ensemble (disclosed: MASTER-AUDIT-REPORT partial items; worklog Task 6) | — | — | — | — | — | Model-selection ranking score not needed until multi-model selection is live; disclosure exists |
| 163 | §23.11 | VERIFIED (pilot form) | audit-stress.ts scenarios 1-11 (§23.5 ×4, §23.8.1 ×2, §23.8.5, §23.9, §23.10, §23.11 S10, §23.6 S11); stress-rerun.ts targets table L1467-1477 | shocks → survivalRate/meanMinRR/worstMinRR per scenario | ratios | ad-hoc run | per-scenario targets (95/99/100/90%) | stress-rerun 11/11 PASS (live re-run; S10 worst minRR 1.1426 ≥ 1) | Coverage published as survival (RR≥1.00) + minRR per scenario, not a metric literally named CoverageRatio_s; S10 is the §23.11 combined-shock reserve-stress case |
| 164 | §24.1 | VERIFIED (pilot-grade) | compute-engine.ts (SHA-256 weight-vector.json, `--verify-only` recompute, `--fixed-input` determinism, pinned Docker env); canonical/stress mulberry32 seeds; pilot-state STATE_SCHEMA_VERSION=15 + D3 restart-invariant init L152-170; honest-status.ts version "master-v1.0-pilot" | same inputs ⇒ same W (hash-equal) | SHA-256 over canonical weights JSON | daily cron / CI | hash excludes timestamp | compute-engine --verify-only; audit-verify independent recompute (match 1e-9) | Hash covers the weights object only, not the full (Data_t, Parameters_t, Versions_t) tuple; version label published via /api/honest-status |
| 165 | §24.5; §26.3 | VERIFIED (order) | engine.ts `advanceMase` L2128-2155: buildPriceData/estimateVols/detectRegime (Data) → `maseEnsemble` (Ensemble; Constituency static in pilot) → `applyEnvelopes` (Constrain) → `smoothWeightsConstitutional` (Smooth) → `commitChainIndexWeights` (registry commit); Execute = MARP (`marpDecision` in buildMaseSnapshot L2038; `applyMarpRebalance` L963, flag OFF) | Data → W^Live (smoothed, published) | weights Σ=1 | every tick | USE_MARP_EXECUTION=false (legacy §7 path mutates in pilot) | canonical L3 "chain index prevWeights = MASE smoothed weights (post commit)" | Order correct: Constituency→Ensemble→Constrain→Smooth→Execute. W_Live published = snapshot.weightStates.smoothed (registry state); smoothed-vs-executed distinction maintained in the 4-state block (prior/target/smoothed/execution) |
| 166 | §24.5 | PARTIAL-DOCUMENTED | engine.ts `estimateVolsFromState` L1938-1950 (VIX-scaled), `detectRegime` L1956-1963; buildPriceData L1966-1977 | (fx, VIX, DXY, state) → MASE target | weights | every tick | baseline vols × VIX/18.5 | canonical L2 MASE target sum/envelope tests | MASE inputs simplified: no CVaR/PP/Liquidity/Cost inputs (pilot simplification, disclosed); provenance via fx.source + audit-trail rows |
| 167 | §24.5 | VERIFIED | mase.ts `applyEnvelopes` L287-311 (iterative box ∩ simplex alternating projection) | target → feasible Σ=1 in-envelope | weights | every tick | ADMISSIBILITY_ENVELOPES (§8.1 table) | canonical L2 "constrained weights still sum to 1.0", "every component within envelope (1pp tolerance)" | Reproducible feasible vector; replaced the v1.2 single-clamp that could breach by 1.25pp |
| 168 | §24.5 | VERIFIED | mase.ts `smoothWeightsConstitutional` L382-390, `smoothWeights` L322-332, `applyVelocityCaps` L342-366 | ρ·W_prev + (1−ρ)·W_constrained, then velocity caps | weights | every tick | SMOOTHING_RHO 0.50 normal / 0.75 stress (crisis threshold 0.70 → conservative stressLevel≥2 default); MAX_VELOCITY USD/EUR 0.50% · JPY/GBP 0.30% · CNY/CHF 0.20% · Gold 0.50% | canonical L2 (MASE smoothed computed), L3 (prevWeights = smoothed post-commit) | Same smoothing state as the on-chain registry (persisted s.maseSmoothed; committed to chain index) |
| 169 | §24.5 | PARTIAL-DOCUMENTED | marp.ts `marpDecision` L82-151 (6-level: no-trade→urgency→partial→cost→turnover→execute); engine.ts `applyMarpRebalance` L963-1116 (flag-gated); snapshot `marp`/`marpExecution` L1619-1632 | (W^Smooth, W^Actual, Cost, Liquidity, RR) → trade/no-trade | USD trades | every tick (advisory) | θ 0.75%/1.5%; β=0.50; turnover 5% NAV; MIN_PROFITABILITY $10 | canonical L2 MARP Level 1/5/6; snapshot mirrors path | Decision layer fully implemented and always computed; the EXECUTION mutation path is feature-flagged OFF in the pilot (USE_MARP_EXECUTION=false → legacy §7 single-direction path mutates). "execution" weight state = observed actual composition (defensible, but ≠ MARP's post-decision output — note under EQ-165) |
| 170 | §26.4 | VERIFIED | chain-index.ts `initChainIndex` L67-71 (Σw≈1 validation); mase.ts renormalization; `renormalizeExcluding` L260-270 / `replaceComponent` L276-334 (Σ=1 preserved); succession.ts CANDIDATE_UNIVERSE L59-66 | 7-component W_t, Σ=1; universe adaptable | weights | every commit | Strategic Prior 27/20/9/8/5/5/26 | chain-index runSelfTest (renorm sums to 1, successor weight = seed); live SGD-admission drill (USD 31.52% · SGD 5.00% · Gold 20.27% in-envelope) | Non-frozen universe PROVEN by the succession drill (SGD admitted into CNY's slot via replaceComponent, zero artificial return) |
| 171 | App. C §C.1 | VERIFIED (pilot param) | marp.ts `inNoTradeZone` L45-50 (θ_base 0.75%); audit-verify.ts L57-61 | D=0.3% < θ → Trade=0 | weight pp | per decision | NO_TRADE_BAND_BASE 0.0075 (§11.8; doc example quotes θ_USD=1.0%) | audit-verify C.1 (live: "D_USD = 0.3% inNoTradeZone(θ=0.75%) = true → Trade=0 ✓"); decisions logged via persistRebalancingDecision (§24.2) | Outcome exact (0.3% < 0.75% < 1.0%); pilot's band is the §11.8 75bps base (D1 fix), a parameter deviation from the example's 1.0% — documented |
| 172 | App. C §C.2 | DEVIATION (documented) | marp.ts `partialCorrection` L71-76 (β=0.50 default) | D=2.4% > θ_Gold → trade = β×(27.0−29.4) | pp | per decision | pilot β=0.50 vs doc β=0.40 | audit-verify C.2 prints BOTH (doc −0.96pp; pilot −1.20pp), asserts neither | The regression DEMONSTRATES the pilot value, not the doc's; both β<1 partial (doctrine-compliant); post-trade 28.44%/residual 1.44% not re-derived in the pilot test |
| 173 | App. C §C.3 | NOT-IMPLEMENTED-GAP (minor) | marp.ts `naturalCashFlowPreference` L155-167 (simplified: totals natural flow; no per-component residual arithmetic); §10.7 netting implemented economically via applyMint basket purchase L1208-1238 | — | — | — | — | NO regression test for TradeNeeded = 1.5% − 0.9% = 0.6% | C.3 absent from C.1/C.2/C.4/C.5 regression set (worklog confirms); helper is a placeholder |
| 174 | App. C §C.4 | VERIFIED | marp.ts `costBenefitGate` L56-67; audit-work/v2/c4-check.ts (exact) | B=$1,200 < C=$1,700 → net −$500 → Trade=0 | USD | per decision | λ₁=0.4 benefit weighting; MIN_PROFITABILITY $10 (ε) | c4-check live: "benefit=$1200 cost=$1700 net=$-500 pass=false → Trade=0 ✓" + mirror case ($2,400 > $1,700 → TRADE) | EXACT reproduction lives in c4-check.ts; ⚠ audit-verify.ts's "C.4-style" line (L66-67) is miscalibrated (benefit $4,800 vs cost $3 → pass=true) and mislabeled "negative-net rejected" (finding 6) |
| 175 | App. C §C.5 | VERIFIED | ADMISSIBILITY_ENVELOPES.Gold {0.20, 0.32} (blueprint.ts L73-81); audit-verify.ts L68-69 | 29.2% ∈ [20%, 32%] → admissible; prior 26% ≠ target | weight % | static envelope | Gold envelope 20-32% | audit-verify C.5 (live: "target 29.2% in Gold envelope 20–32% = true") | Treated as illustrative (not an approved live allocation) per the spec's alignment note |

**Status counts (41 equations):** VERIFIED 26 · PARTIAL-DOCUMENTED 8 (EQ-137, 148, 150, 151, 156, 157, 166, 169) · DEVIATION 1 (EQ-172) · NOT-IMPLEMENTED-RESEARCH-OK 3 (EQ-159, 160, 162) · NOT-IMPLEMENTED-GAP 3 (EQ-146, 147, 173) · NOT-VERIFIABLE 0.

## RG-relevant findings

### RG-02 · NAV symbol overload — naming map (verdict: NO CONFLATION; distinct symbols per site)
| Concept | Engine symbol | API surface | UI surface |
|---|---|---|---|
| (a) Index value | `chainIndex.I_t`; `getMTQPrice()`; snapshot `gfbIndex` + `mtqPrice` | `/api/gfb` `gfbIndex`/`mtqPrice`; `/api/metrics` `mtqPrice` | Hero "MTQ Price"; BasketValueDisplay footnote "1 MTQΣ ≈ $… at the live chain-linked index I_t = … · P_MTQ = I_t × PAR" (explicitly "reporting numeraire only — never a peg") |
| (b) Total reserve net value | `reserveAssetValues().nav`; snapshot `nav` / `reserve.nav` | `/api/metrics` `nav` | Hero/LiveMonetaryState/HomeSection "Reserve NAV" (total, correctly labeled); audit-trail column `navUsd` |
| (c) Per-token redemption NAV | `navPerMtq` (applyRedeem L1285, L1328); alias `auditNavPerToken`; snapshot `indexNavDivergence.navPerMtq` | `/api/simulate/redeem` `redeem.navPerMtq`; `/api/metrics` `indexNavDivergence.navPerMtq` | **No dedicated UI card** (only `ProductionReadinessDashboard` evidence text) — finding 10 |
- Distinct fourth quantity: `holdings.perMtq.*` = per-MTQ backing in each asset's NATIVE unit (gold-grams headline) — deliberately not a USD NAV/token, with `basis: "circulating" | "total"` label for the genesis fallback.
- Conflation check: no site labels total NAV as "NAV/token" or vice versa; `indexNavDivergence` explicitly computes and publishes the (b)-vs-(a) gap (`divergencePct`, 5%/10% monitor/stress). Engine, API, UI, and audit-trail all use the distinct names above. **RG-02: PASS** (visibility gap only, finding 10).

### RG-12 · Staged ladder denominator — verdict: CUMULATIVE percentages of the ORIGINAL position (code matches blueprint; internally consistent)
- Blueprint (blueprint-full.txt §21.5.3): *"Each stage sells an additional fraction of the **original position**"*; table: *"Stage 1 10% … Stage 2 25% — Sell an additional 15% (total 25%) … Stage 3 50% — Sell an additional 25% (total 50%) … Stage 4 100% — Sell the remaining 50% (total 100%)"*; *"The cumulative percentages (10% → 25% → 50% → 100%) are constitutional and immutable."*
- Code: `EJECT_STAGES = [{stage:1, sellPct:0.10…}, {stage:2, sellPct:0.25…}, {stage:3, sellPct:0.50…}, {stage:4, sellPct:1.00…}]` (blueprint.ts L291-296, "cumulative sell %"); succession.ts `pushStage` (L287-298): `const incremental = EJECT_STAGES[s-1].sellPct - prevCum; … proceedsUsdPerMtq = ejectedHolding × incremental × price` — i.e., each increment is a fraction of the **original** sleeve (`ejectedHolding`), and 10%+15%+25%+50% = 100% exactly. **NOT** percentages of the remaining position.
- Trigger hours (§21.5.2/21.5.3): 12h consecutive out-of-band detection window (`DEPEG_DETECTION_HOURS`), stages 1-3 at cumulative hours 12/24/48 (updatePegHealth L1148-1150; succession planner L281 `stageHourThresholds = [12, 24, 48, 96]`). Stage 4: blueprint "Issuer freeze confirmed OR RR < 1.02"; code uses `h > 96 || p < 0.9 || p > 1.1` (engine L1151) / `>96h OR price < 90% of pre-crisis par` (succession L189, L282) as the freeze/full-collapse proxy, and the RR-coupled OR-triggers are **not wired** (finding 2). The 5% stage-pause rule (`EJECT_PAUSE_RULE_PCT = 0.05`, blueprint *"each stage executes only if the previous stage's sell did not worsen the deviation by more than 5%"*) is a constant only — not enforced.
- Self-verification: chain-index `runSelfTest` (eject/admit zero-artificial-return, Σ=1, successor-slot tracking); live `/api/succession` drill (worklog 6667): CNY −40% → depeg h12, stage1 h24, stage4 (price<90% par) h30, eject+SGD at h30, `artificialReturnPct = 0`, ladder realized 0.05316 vs hold 0.03525 USD/MTQ.

### RG-13 · 6-state table comparison — code vs blueprint §21.2/21.3
| State | Blueprint §21.2 (normative) | state-machine.ts | Agreement |
|---|---|---|---|
| S1 NORMAL | RR ≥ 1.10, LCR ≥ 1.00 | `rr ≥ 1.10 → NORMAL`; `lcr ≥ 1.00 → NORMAL`; worse-binds | ✅ exact |
| S2 CAUTION | 1.05 ≤ RR < 1.10, LCR ≥ 0.90 | `1.05 ≤ rr < 1.10 → CAUTION`; `0.90 ≤ lcr < 1.00 → CAUTION` | ✅ exact |
| S3 STRESS | 1.02 ≤ RR < 1.05, LCR ≥ 0.80 | `1.02 ≤ rr < 1.05 → STRESS`; `0.80 ≤ lcr < 0.90 → STRESS` | ✅ exact |
| S4 DEFENSIVE | 1.00 ≤ RR < 1.02, LCR ≥ 0.70 | `1.00 ≤ rr < 1.02 → DEFENSIVE`; `0.70 ≤ lcr < 0.80 → DEFENSIVE` | ✅ exact |
| S5 EMERGENCY | RR < 1.00, any LCR — *"S5 entry trigger is immediate"* hard-floor only | `if (rr < 1.00) return "EMERGENCY"` before worse-binds; LCR collapse never produces EMERGENCY | ✅ exact (tested: 1.20/0.65 → RECOVERY, 0.99/0.60 → EMERGENCY) |
| S6 RECOVERY | RR ≥ 1.05 (rising), LCR ≥ 0.90; residual when *"ratios fail the DEFENSIVE liquidity test while solvency holds — for example, RR ≥ 1.05 with LCR below 0.70"* | `destinationHolds(RECOVERY) = rr ≥ 1.05 && lcr ≥ 0.90`; residual: `lcr < 0.70 && rr ≥ 1.05 → RECOVERY` | ✅ exact |
| Escalation | *"Movement toward a more restrictive state … is immediate upon breaching the threshold"* | `SEVERITY[raw] >= SEVERITY[previous] → take raw now, reset clock` (L169-179) | ✅ |
| Recovery ladder | §21.3 line: *"EMERGENCY → DEFENSIVE → STRESS → CAUTION → NORMAL (48 h sustained confirmation per step)"* + per-step thresholds (RR ≥ 1.00 / 1.02 / 1.05 / 1.10 to leave EMERGENCY/DEFENSIVE/STRESS/CAUTION); §21.2 note: RECOVERY *"sits deliberately between CAUTION and STRESS, which is also how the transition logic of Section 21.3 ranks it"* | `stepUp`: EMERGENCY→DEFENSIVE→STRESS→**RECOVERY**→CAUTION→NORMAL; `destinationHolds` = RR ≥ 1.00 / 1.02 / (≥1.05 & LCR ≥ 0.90) / (≥1.05 & LCR ≥ 0.90) / (≥1.10 & LCR ≥ 1.00); 48h per rung; dip resets clock | ✅ thresholds exact; ⚠ RECOVERY inserted as an explicit rung (documented interpretation grounded in §21.2's ranking sentence; the literal §21.3 ladder line omits it). No EMERGENCY→NORMAL jump (tested). |
| Doc-internal tension | Earlier chapter table (blueprint-full.txt L5242-5248): DEFENSIVE `1.00 ≤ RR < 1.05, LCR Any`, RECOVERY `LCR ≥ 0.95` | Code follows §21.2 (DEFENSIVE 1.00-1.02/LCR ≥ 0.70; RECOVERY LCR ≥ 0.90) | Resolved to the normative §21.2 table — consistent with EQ-152/153/154's checkpoint values |
**RG-13 verdict: AGREE** on all six states, worse-binds priority, immediate escalation, 48h-per-step recovery, EMERGENCY-only-via-RR-floor; one documented interpretation (RECOVERY rung insertion).

### RG-14 · Genesis scaling trace (P_MTQ = I_t / I_base)
- **Convention:** the pilot's `I_t` is the ALREADY-NORMALIZED index ratio: `initChainIndex` sets `I_t: 1.0, G_t: 1.0` (chain-index.ts L84-91). Therefore **I_base = 1.0000** in the pilot's read path — `getMTQPrice(state) { return state.I_t; }` (L196-198), i.e., P_MTQ = I_t / 1.0 × PAR(1.00).
- **The genesis denominator VALUE is stored but never divided:** `baseDenominator = Σ W^Prior_i × P_{i,0}` = 0.27×1 + 0.20×1.05 + 0.09×0.0067 + 0.08×1.25 + 0.05×0.14 + 0.05×1.13 + 0.26×2500 = **650.644103** (blueprint.ts `GFB_BASE_DENOMINATOR` L62-69; validated at init, chain-index L72-83). The code explicitly documents why dividing again would be WRONG: *"dividing by baseDenominator would give P_MTQ ≈ 1/650 at genesis — clearly wrong… the TS engine uses the normalized form (I_0 = 1.0)"* (L188-195). **NO double normalization** — `getMtqPriceFromState` → `getMTQPrice` is a single pass, no other scaling anywhere (canonical L3 asserts snapshot.mtqPrice = chain I_t).
- **Blueprint consistency:** §3.4's calibration invariant (*"the USD-equivalent genesis notionals sum to exactly 1.0000 per MTQ unit, which is what makes I_0 = 1.0000 exact"*, blueprint-full.txt L2205) and §19.2's contract form `P = I_t/I_base` (absolute-value storage with 1e18 scaling) — the pilot keeps I normalized and I_base=1, which is the same map without the fixed-point divide.
- **Units:** P_MTQ comes out in **USD-equivalent per MTQ** (PAR = 1.00 basket-unit; live P_MTQ $1.195907). q_i quantities at genesis (initReserveState L283-309): USD $297K split USDC/USDP/USDT ⅓ each; EURC 220,000/1.05 = 209,523.8; JPY 99,000/0.0067 = 14.776M; GBP 88,000/1.25 = 70,400; CNY 55,000/0.14 = 392,857; CHF 55,000/1.13 = 48,672.6; gold 286,000/2,500 = 114.4 oz split PAXG/XAUT 50/50 (index/reserve split 50/50 per §14.1).
- **Cross-check:** live P_MTQ $1.1959 with I_t ≈ 1.196 — ✅ consistent with the I_base = 1.0000 convention (audit-verify independent recompute: Σ contributions 19.591% → I_t = 1.195907, engine match `true`; restart-invariant per D3 fix, pilot-state L152-170).
- **Genesis RR math:** deposit $1.1M / 1M supply → book RR **1.10** (comment L268); canonical RR_t at pure genesis = ∞ (L = circulating × P = 0; genesis supply LOCKED and excluded from L_t per blueprint Ch.18: *"genesis tokens never count toward the protocol liability"*). Total-supply basis appears only in the per-MTQ holdings display fallback (`basis: "total"`, labeled in UI). **RG-14: PASS** — single normalization, immutable base fixings, USD-equivalent output.

## Findings requiring attention

1. **EQ-146/147 slippage guards not enforced (NOT-IMPLEMENTED-GAP).** `DEFAULT_USER_SLIPPAGE = 0.005` and `TRADE_DEADLINE_MINUTES = 5` exist (blueprint.ts L174-175) and are displayed (MintSimulator L108 "min 1 MTQΣ · τ 0.5% · deadline 5m (§19.7)"; TransactionFlow shows a display-only `minOutput` at a *different* 1% tolerance), but `applyMint`/`applyRedeem` and `/api/simulate/mint|redeem` accept no minOut/deadline/τ_user parameter and implement no revert. Contract-level §19.4 requirement — must exist before real-value public testing.
2. **Eject-ladder RR coupling + 5% pause rule unwired.** `EJECT_STAGES` declares "OR RR < 1.08 / 1.05 / 1.02" triggers and `EJECT_PAUSE_RULE_PCT = 0.05` exists, but the runtime ladder (`updatePegHealth` engine.ts L1144-1152) advances on out-of-band hours and price only; the engine comment (L1145) references a function `evaluateEjectStage` **that does not exist anywhere in src/** (grep: single comment hit). Stage 4 uses >96h / price<0.9 / >1.1 as the issuer-freeze proxy (documented in succession.ts, not in the engine comment).
3. **Rebalance fee 0.20% (§20.4) not implemented.** No constant, no accrual on `applyRebalanceTrade`/`applyMarpRebalance`; MARP cost-benefit uses slippage+gas only. Mint 0.10% / state-dependent redeem fees DO accrue to the operational hot wallet and are excluded from NAV (tested).
4. **Treasury sweep semantics deviate from "sweep only above $10,000".** `maybeTreasurySweep` triggers at hotWallet > $10,000 but sweeps `hotWallet − $5,000` (keeps a $5k float), so a $12k balance sweeps $7k, not $2k (engine.ts L2264-2268). No threshold-equality test exists.
5. **EQ-172 (Appendix C.2) β mismatch, documented but unasserted.** Pilot `partialCorrection` β=0.50 → −1.20pp vs doc β=0.40 → −0.96pp; the audit-verify regression prints both and asserts neither. If doc-exactness is wanted, add an explicit assertion or a β parameter override.
6. **audit-verify.ts "C.4-style" line is miscalibrated and mislabeled** (L66-67): its inputs yield benefit $4,800 vs cost $3 → `pass=true`, while the printed label says "negative-net rejected ✓". The EXACT C.4 reproduction is `c4-check.ts` ($1,200 < $1,700 → Trade=0, verified live). Fix the audit-verify line to avoid evidence confusion.
7. **Appendix C.3 has no regression test** and `naturalCashFlowPreference` (marp.ts L155-167) is a simplified placeholder (totals the flows; no per-component `TradeNeeded = gap − naturalFlow` residual arithmetic). §10.7 netting is implemented economically (mint purchases the basket at live weights) but the worked example is untested.
8. **pilot-state tick re-implements the L/RR/LCR identity inline** (L412-416: `(totalSupply − genesisReserve) × postPrice`, `postNav/postLiability`, `fiatNet/(postLiability × 0.25)` with a hardcoded 0.25) instead of calling `computeLiability`/`computeReserveRatio`/`computeLcr`. Numerically identical today, but it is a second implementation of the EQ-136 shared identity (drift risk).
9. **Reverse reintegration ladder enforced only at the 0.80 gate.** `REINTEGRATION_STAGE_THRESHOLDS` (0.80/24h, 0.85/48h, 0.90/72h) are constants plus a succession.ts note string; `updateReintegration` increments `repurchaseStage` on any tick with `score > 0.80` — no escalating 0.85/0.90 thresholds, no sustained-hours windows.
10. **NAV/token (USD) has no UI card.** The P_MTQ-vs-NAV_per_token distinction is enforced and published in the engine/API (`indexNavDivergence`, redeem `navPerMtq`) but the UI shows only P_MTQ ("reporting numeraire") + total "Reserve NAV" + native-unit per-MTQ backing. Add a NAV/token card (or divergence badge) for EQ-142/143 transparency.
11. **/api/gfb publishes STATIC Strategic Prior weights** (hardcoded 0.27/0.20/…) as `components.*.weight`, not the live W^Smooth. Live weights are on `/api/metrics` (`weightStates.smoothed`). Label the gfb weights as "prior" or publish the live smoothed vector to avoid consumer confusion.
12. **Legacy `monte-carlo.ts` is stale doctrine:** 5-component basket (no CHF/gold in index), 880K/220K genesis split, legacy fee constants. Not referenced by the canonical suites, but it lives in `src/lib/mtq/` — mark deprecated or remove to prevent accidental evidence use.
13. **EQ-137 persisted vector gaps:** DailyStateVector rows omit CVaR, MDD, PPError, CrisisScore, Turnover, Cost, and the full 7-component weight vector (only gold weights + live snapshot carry them). OracleConfidence IS persisted (OracleSample validCount/spreadBps/method).
14. **Reintegration liquidity-depth input is randomized** around per-currency baselines (engine.ts L2227-2228, "honest: simulated") — acceptable for pilot, must be replaced by real DEX-volume data before production claims.

### Carry-over questions answered
- **(a) circulating vs total supply:** No wrong usage. Liability, mint throttle economics, redeem guard (`inputMtq > circ`), LCR and RR all use `circulatingSupply = totalSupply − genesisReserve` (engine L626-628). `applyMint` adds to `totalSupply` (genesis reserve fixed →净 circulating), `applyRedeem` subtracts with the circ guard. Total supply appears ONLY as the labeled per-MTQ display basis fallback at pure genesis (`holdings.basis = "total"`, BasketValueDisplay L73-76) and in the genesis book-RR comment.
- **(b) P_MTQ vs NAV/token in the UI:** P_MTQ visible (hero "MTQ Price" pill; BasketValueDisplay "reporting numeraire" footnote with I_t and PAR breakdown). NAV/token USD is NOT rendered as a card anywhere (API-only; finding 10). No conflation in either direction.
- **(c) haircut-adjusted V_net on redemption:** YES. `applyRedeem` derives `navPerMtq` from `reserveAssetValues().nav` (net of HAIRCUTS: USD 0.5%, EUR 0.7%, GBP/JPY/CHF 1%, CNY 1.5%, XAU/PAXG/XAUT 1%) and computes release shares from net values (`share(vals.*Net)`); gold additionally priced at min(ref, 0.995×ref). Tests: canonical L2 haircut asserts, L4 "NAV < gross (haircuts applied)".

## Evidence quotes

**P_MTQ / I_base (EQ-135/141, RG-14)** — chain-index.ts L185-198:
```ts
// Get the current MTQ reference price:
//   P_MTQ = I_t × PAR  (where PAR = 1.00)
// Why not `I_t / baseDenominator × PAR` as the spec comment suggests? Because
// I_t starts at 1.0 (a normalized ratio), so dividing by baseDenominator
// would give P_MTQ ≈ 1/650 at genesis — clearly wrong. …
export function getMTQPrice(state: ChainIndexState): number {
  return state.I_t;
}
```
engine.ts L557-561: `// The canonical MTQ reference price: P_MTQ = I_t × PAR (PAR = 1.0).` `export function getMtqPriceFromState(s) { return getMTQPrice(s.chainIndex); }`

**Genesis init (EQ-148/149, RG-14)** — engine.ts L264-268, L277-309, L390-395:
```ts
// Protocol deposits $1,100,000 → buys the 7-component Strategic Prior basket
// (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%) at oracle
// prices → mints 1,000,000 MTQΣ to the Genesis Reserve Account.
// RR = 1,100,000 / (1,000,000 × 1.00) = 1.10 (110%).
…
chainIndex: initChainIndex(GFB_BASE_DENOMINATOR, strategicPriorToWeights(STRATEGIC_PRIOR), baseFixingsToPrices(BASE_FIXINGS), Date.now()),
```
blueprint.ts L62-69: `GFB_BASE_DENOMINATOR = STRATEGIC_PRIOR.USD*1.0 + EUR*1.05 + JPY*0.0067 + GBP*1.25 + CNY*0.14 + CHF*1.13 + Gold*2500` (= 650.644103; CHF 1.1300 and Gold $2,500 included).

**Mint (EQ-139/140)** — engine.ts L1199-1205:
```ts
const throttle = mintThrottle(status);
const feeUsd = inputUsd * (MINT_FEE_BPS / 10_000);
const netUsd = inputUsd - feeUsd;
const minted = (netUsd / price) * throttle;
// §19.7 — constitutional minimum mint (1 MTQ); rejects dust-sized mints.
if (minted < MIN_MINT_MTQ) { … }
```

**Redeem (EQ-142/143/144/145, RG-02)** — engine.ts L1328, L1354-1374, L1376-1383:
```ts
const navPerMtq = circ > 0 ? vals0.nav / circ : price;
…
const feeFraction = redeemFee(status);
…
const grossUsd = inputMtq * navPerMtq; // §19.3.2 Step 2 — NAV-based (Invariant I6)
const feeUsd = grossUsd * feeFraction;
const netUsd = grossUsd - feeUsd;
// §19.3.2 Step 4 — proportional release per ACTUAL reserve composition:
//   Release_i = RedeemValue_net × (V_i / V_net)
const share = (v: number) => (nav > 0 ? v / nav : 0);
```

**State table (EQ-152/153/154, RG-13)** — state-machine.ts L8-27 (header), L92-104:
```ts
//   S1 NORMAL      RR ≥ 1.10         LCR ≥ 1.00
//   S2 CAUTION     1.05 ≤ RR < 1.10  LCR ≥ 0.90
//   S3 STRESS      1.02 ≤ RR < 1.05  LCR ≥ 0.80
//   S4 DEFENSIVE   1.00 ≤ RR < 1.02  LCR ≥ 0.70
//   S5 EMERGENCY   RR < 1.00         Any      hard-floor breach ONLY (I2)
//   S6 RECOVERY    RR ≥ 1.05 (rising) LCR ≥ 0.90  … ALSO the residual posture …
function instantaneous(rr, lcr) {
  if (rr < 1.00) return "EMERGENCY"; // S5 entry: hard-floor breach ONLY (I2)
  …
  if (rr >= 1.05) return "RECOVERY";  // residual (LCR < 0.70, solvency holds)
```
Blueprint §21.2 (blueprint-full.txt L9944-9957) matches row-for-row; §21.3 L9965-9967: "NORMAL → CAUTION → STRESS → DEFENSIVE → EMERGENCY (immediate on breach)" / "EMERGENCY → DEFENSIVE → STRESS → CAUTION → NORMAL (48 h sustained confirmation per step)".

**Ladder stages (EQ-157, RG-12)** — blueprint.ts L290-297 + succession.ts L287-298:
```ts
export const EJECT_STAGES = [
  { stage: 1, sellPct: 0.10, condition: "De-peg confirmed for more than 12 hours" },
  { stage: 2, sellPct: 0.25, condition: "De-peg for more than 24 hours OR RR < 1.08" },
  { stage: 3, sellPct: 0.50, condition: "De-peg for more than 48 hours OR RR < 1.05" },
  { stage: 4, sellPct: 1.00, condition: "Issuer freeze confirmed OR RR < 1.02" },
] as const;
```
```ts
const pushStage = (s: number, trig: number) => {
  const incremental = EJECT_STAGES[s - 1].sellPct - prevCum;
  const price = priceAt(trig);
  ladder.push({ stage: s, sellPct: incremental, … proceedsUsdPerMtq: ejectedHolding != null ? ejectedHolding * incremental * price : 0 });
  prevCum = EJECT_STAGES[s - 1].sellPct;
};
```
Runtime ladder (engine.ts L1144-1152): `if (h > 48) stage = 3; else if (h > 24) stage = 2; else if (h > 12) stage = 1; if (h > 96 || p < 0.9 || p > 1.1) stage = 4;`

**Reintegration (EQ-155/156)** — engine.ts L2240-2247:
```ts
r.score = REINTEGRATION_WEIGHTS.w1_TimeInBand * r.timeInBand48h
        + REINTEGRATION_WEIGHTS.w2_LiquidityDepth * r.liquidityDepth
        + REINTEGRATION_WEIGHTS.w3_OracleAgreement * r.oracleAgreement
        + REINTEGRATION_WEIGHTS.w4_OneMinusVolatility * (1 - r.volatility);
if (s.ejectStage[c] > 0 && r.score > REINTEGRATION_THRESHOLD) { r.repurchaseStage = Math.min(3, r.repurchaseStage + 1); … }
```
blueprint.ts L462-463: `REINTEGRATION_WEIGHTS = { w1_TimeInBand: 0.40, w2_LiquidityDepth: 0.25, w3_OracleAgreement: 0.20, w4_OneMinusVolatility: 0.15 }`; `REINTEGRATION_THRESHOLD = 0.80`.

**Treasury sweep (EQ-150)** — engine.ts L2260-2273:
```ts
// If hot-wallet surplus stablecoins > $10,000 → sweep excess to 4/7 Cold Treasury.
export function maybeTreasurySweep(s, feeRevenueAddedUsd = 0) {
  s.treasury.hotWalletUsd += feeRevenueAddedUsd;
  if (s.treasury.hotWalletUsd > TREASURY_SWEEP_THRESHOLD_USD) {
    const excess = s.treasury.hotWalletUsd - 5_000; // keep $5k operating float
```

**Pipeline order (EQ-165-169)** — engine.ts `advanceMase` L2128-2155:
```ts
const mase = maseEnsemble(vols, prices, null, regime);        // Ensemble
const constrained = applyEnvelopes(mase.target);              // Constrain
s.maseSmoothed = smoothWeightsConstitutional(prevSmoothed, constrained, sl);  // Smooth (ρ + velocity)
…
commitChainIndexWeights(s, fx, s.maseSmoothed);               // registry commit
```
marp.ts `marpDecision` L98-147 (Level 1 no-trade → 2 urgency → 3 partial (β=0.5) → 4 cost-benefit → 5 turnover cap 5% → 6 execute); mase.ts `smoothWeightsConstitutional` L387-389: `const rho = stressLevel >= 2 ? SMOOTHING_RHO_STRESS : SMOOTHING_RHO_NORMAL; … return applyVelocityCaps(prevSmoothed, smoothed);`

**Appendix C regressions (EQ-171-175)** — audit-verify.ts L57-69 + c4-check.ts (live output above); marp.ts L45-50 (`inNoTradeZone`, θ_base 0.75%), L56-67 (`costBenefitGate`, `netBenefit > MIN_PROFITABILITY_USD`), L71-76 (`partialCorrection`, factor 0.5).

**Fee schedule (EQ-151)** — blueprint.ts L163-169: `MINT_FEE_BPS = 10; REDEEM_FEE_NORMAL = 0.0015; REDEEM_FEE_STRESS = 0.005; REDEEM_FEE_DEFENSIVE = 0.01; REDEEM_FEE_RECOVERY = 0.003; REDEEM_FEE_EMERGENCY = 0.02; // UNUSED — redemption is PAUSED in S5`. Blueprint §20.4 (blueprint-full.txt L9356): "Rebalancing Fee 0.20% — Operational Wallet"; "Fees are … excluded from NAV calculations."

**Governance boundary (EQ-158)** — blueprint.ts CONSTITUTIONAL_INVARIANTS L122 (I8: "no governance body may set individual live weights by discretion"); canonical L3 asserts PAR→CONSTITUTIONAL/immutable, RR_TARGET→MONETARY/envelope [1.05, 1.20], HAIRCUTS→RISK, PAUSE_MINT→EMERGENCY. No weight-setting route exists under `src/app/api/`.

**Reproducibility (EQ-164)** — compute-engine.ts L21-31: "Writes weight-vector.json with the computed weights + SHA-256 hash … The hash covers ONLY the canonical JSON of the weights object … `--verify-only` … Exit 0 if MATCH, exit 1 if MISMATCH"; canonical-invariants.ts L175-184 `mulberry32(seed)`; pilot-state.ts L92-98 (STATE_SCHEMA_VERSION 15, D3 note: "the index anchors at the immutable BASE_FIXINGS (§3.4) so P_MTQ measures the true base-date→today basket level and is restart-invariant (§24.1)").
