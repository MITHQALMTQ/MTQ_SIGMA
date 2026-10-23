# MTQΣ — Equation-by-Equation Alignment Audit Report (v3 Master Deliverable)

**Document under audit:** MTQ Σ Equation-by-Equation Developer Alignment Specification (uploaded `MTQSigma_Equation_by_Equation_Developer_Alignment_Specification.docx`; extraction at `audit-work/v3/eq-by-eq-spec.md`)
**Source of truth:** MTQ Σ Master Monetary Architecture & Quantitative Specification v1.0, Master Edition, issued 2026-09-08 (extraction `audit-work/v2/blueprint-full.txt`, verified identical to the uploaded TechnicalDoc v1.0)
**Method:** 175 equations traced input→normalization→optimization→constraints→smoothing→execution→reserve accounting→API/UI→tests, by 7 parallel audit passes (blueprint source verification + 5 equation-trace groups + live test evidence). No formula was rewritten or "corrected"; no unspecified function was filled with a guess.
**Code state audited:** single-commit `fb6bb6c` + one type-only fix this session (`succession.ts:227`, `?? null` — restores `bun run typecheck` to green; zero behavior change).
**Platform status:** CANDIDATE FOR PUBLIC TESTING — **NOT PRODUCTION-AUTHORIZED** (unchanged; enforced platform-wide).

---

## 1. Executive verdict

| Dimension | Verdict |
|---|---|
| Alignment spec vs master blueprint | **Faithful with 5 exceptions** — parameter table 27/27 CONFIRMED; 13/15 RG gates accurately described; RG-09 premise **false** (blueprint *does* print `argmin` + λ values); RG-01/RG-12 ambiguity **overstated** (blueprint pins both conventions itself); RG-10 **understated** (worse conflict than the spec lists); RG-02/RG-13 **miss real conflicts** (glossary NAV_t; §14.2.2 five-status table vs §21.2 six-state; 48h governance-class conflict) |
| Monetary core (index, NAV/RR/LCR, mint/redeem, states, genesis) | **COMPLIANT** — 64 of 175 equations VERIFIED against blueprint, all canonical/e2e/stress/backtest suites green |
| Constitutional separations | **HELD in engine** — 3 mathematical layers separate; 4 weight states stored & published distinctly; index vs reserve weights never conflated; **no USD peg anywhere** (live P_MTQ $1.195907; PAR=1.00 is unit-of-account; mint divides by index; redeem at haircut NAV) |
| Historical formulas quarantine | **Engine PASS / Presentation LEAK** — legacy GFB & core+buffer formulas are code-quarantined, but 4 UI surfaces mislabel the strategic prior as live/constitutional, and one UI panel shows the deprecated Laspeyres formula with a stale CHF fixing |
| Full MASE/MARP (§5–7, §10.9) | **PILOT-SUBSTITUTED, mostly disclosed** — 14 DEVIATION-class simplifications (equal ensemble α, inverse-vol "min-var", 1/N "ERC", no covariance/VaR/CVaR/MDD/GPP, hard 4-state regime classifier); symbolic blueprint forms were *not* filled with invented "canonical" constants (RG-15 PASS) |
| Open spec-level conflicts resolved by code choice | RG-01 → form B implemented (matches blueprint's own operative convention, tested); RG-12 → cumulative-of-original (matches blueprint text + Listing 14); RG-13 → §21.2 six-state row-for-row; RG-14 → I_base = 1.0, no double normalization |
| Open conflicts NOT yet resolved | RG-08 (§17.2 median vs §17.5 filtered-mean — code chose median, decision not recorded); RG-10 (>$10 ε advisory vs >0 active gate); RG-11 (legacy gold target still drives the ACTIVE execution path) |
| Production readiness | **NOT MET** — 11 §25.5 honest-status gates still NOT CONDUCTED; §23 validation program incomplete; see §7 gate list |

**Bottom line:** the platform's *monetary definition layer* is blueprint-faithful and test-evidenced. The *adaptive intelligence layer* (MASE §5–7) is an honestly-labeled pilot substitute. The highest-risk items are **presentation-layer mislabeling of the strategic prior** (directly violates EQ-011/013), the **dual execution/profitability paths** (RG-10/11), and the **oracle aggregation decision** (RG-08) — all fixable without touching the monetary model.

---

## 2. Consolidated traceability rollup (175 equations)

Full per-equation records (inputs/outputs, units, scaling, rounding, cadence, params, tests, quotes) live in the five trace files (§9 file index). Compact rollup:

**Status legend:** ✅ VERIFIED · 🟡 PARTIAL-DOCUMENTED · 🔶 DEVIATION · 🟦 LEGACY-OK (quarantined) · ⬜ NOT-IMPL-RESEARCH-OK (blueprint itself symbolic/validation-stage) · ❌ NOT-IMPL-GAP (required, missing) · ⛔ NOT-IMPL-BY-DESIGN (rejected variant)

### EQ-001–024 — Architecture, variables, basket, constituency (`trace-EQ-001-024.md`)

| EQ | § | Status | Code anchor | Note |
|---|---|---|---|---|
| 001 | 2.3/3.2 | ✅ | engine.ts `buildMaseSnapshot` 2008–2106 → `weightStates{prior,target,smoothed,execution}` | 4 states stored/published; UI 4-state table; /api/metrics |
| 002 | 2.4 | ✅ | `buildObservedWeights` 1986–2004; redeem ∝ actual holdings | index/reserve weights never copied |
| 003 | 2.5/18.1 | ✅ | PAR=1.00; `getMTQPrice`=I_t; `applyMint` divides by P | live P $1.1959 ≠ $1 — **no USD peg** |
| 004 | 2.5/20.1 | ✅ | totalSupply ±; `circulatingSupply` 626–628 | net-only accounting; reconstructible from DB log |
| 005 | 2.5/18.2 | ✅ | `computeLiability` = S_circ × P_MTQ | shared identity |
| 006 | 2.5/14.1 | ✅ | `reserveAssetValues` 569–624; HAIRCUTS blueprint.ts 148–155 | haircut-adjusted everywhere |
| 007 | 2.5/14.2 | ✅ | `computeReserveRatio`; tiers 1.10/1.05/1.00 | EMERGENCY <1.00 |
| 008 | 2.5/13.4 | ✅ | `computeLcr` = fiatNet/(S_circ·P·0.25) | gold 0% liquid |
| 009 | 2.4 | 🟡 | succession.ts `CANDIDATE_UNIVERSE` 55–66 | static active set (disclosed) |
| 010 | 3.1 | ✅ | `advanceMase` → `commitChainIndexWeights`; live = W^Smooth (documented) | |
| 011 | 3.1 | 🔶 | page.tsx:162 "Live Weights" = hardcoded prior; /api/gfb:16–22 prior unlabeled | **presentation deviation** — engine OK |
| 012 | 3.2/26.4 | ✅ | `STRATEGIC_PRIOR` genesis-only init | |
| 013 | 3.1 | 🔶 | page.tsx:185 false "constitutional immutable" claim; PitchSection:39; ReserveDonut uncaptioned | **presentation deviation** — contradicts I3 |
| 014 | 3.3[hist] | 🟦 | S×K absent; SUPERSEDED constants quarantined blueprint.ts 427–448 | |
| 015 | 3.3 | 🟡 | MASE envelope (20–32%) commits adaptive gold; **active executed target = legacy** `computeTargetGoldWeight` 770–775 (26.25%±3%, clamp 22–30%) | USE_MARP_EXECUTION=false |
| 016 | 3.4/9.6 | ✅ | `initChainIndex` I₀=1.0, G₀=1.0 | denominator recompute warn-only |
| 017–021, 023, 024 | 4.x/5.1 | ⬜ (7) | no Q_i/Q_min/normalization/z-scores/hysteresis/Σω_h | static constituency; §21.5 analogues exist in succession |
| 022 | 4.6 | 🟡 | `replaceComponent` 276–334 — successor admitted **instant at full seed weight** (no r_t=t/T ramp) | velocity-capped; drill-only; disclosed |

### EQ-025–058 — MASE signals, risk models, objective, ensemble (`trace-EQ-025-058.md`)

| EQ | § | Status | Code anchor | Note |
|---|---|---|---|---|
| 025 | 5.1 | 🟡 | `estimateVolsFromState` 1938–1950 — static baselines × VIX/18.5 | no ω_h 30/90/252/756 blend (disclosed) |
| 026 | 5.2 | ⬜ | gold tracked in USD only | |
| 027 | 5.2 | ❌ | proxy `modelPurchasingPower` mase.ts:134–166 uses **opposite quote direction** ("buy depreciated") | GPR absent; **seeding risk** — must not seed §5.2 |
| 028 | 5.2 | ⬜ | f symbolic | |
| 029 | 5.3 | 🔶 | `rollingStats` 710–716; window = 90 **ticks (~4s)** not days; population sd ✓; clamps VIX[10,80] DXY[80,120]; synthetic seed | comment says "90-day" — mismatch |
| 030 | 5.3 | 🟡 | `computeZScores` ε=1e-9 | feeds legacy θ path only, not MASE |
| 031 | 5.4 | ❌ | `detectRegime` 1956–1964 — invented hard 4-state (VIX 15/22/30; DXY 88/115) **unlabeled** | substitutes §5.4 six-regime probability model |
| 032 | 5.4 | ❌ | `modelRegimeAdaptive` hard switch; crisis gold 0.50 vector | |
| 033 | 5.5 | ⬜ | CrisisScore absent (0.70 constant inert) | |
| 034 | 5.5 | ⬜ | λ_CVaR,0/k absent; ρ_stress substitutes | |
| 035 | 6.1 | ❌ | no covariance (corr=null) | |
| 036 | 6.2 | ⬜ | shrinkage absent | |
| 037 | 6.3 | 🔶 | `modelMinimumVariance` = inverse-vol ("Simplified pilot") | not the named objective |
| 038 | 6.4 | ❌ | no RC/σ_p/RC% | |
| 039 | 6.4 | 🔶 | `modelEqualRiskContribution` = 1/N ("Simplified") | |
| 040 | 6.5 | 🔶 | `modelMaxDiversification` = prior/vol heuristic ("Simplified") | |
| 041 | 6.6 | ❌ | no VaR estimator (α=95% text only) | |
| 042 | 6.6 | ❌ | `modelCVaR` = heuristic tilt, computes no CVaR ("Simplified") | |
| 043 | 6.7 | ❌ | no M/DD/MDD | |
| 044–046 | 6.8 | ⬜ (3) | GPP/PPError/metrics absent (goal disclosed blueprint.ts:405) | |
| 047 | 7.1 | ❌ | no L2 drift term (prior enters multiplicatively in models 3/4/6) | |
| 048 | 7.1 | ⬜ | L1/L2 unselected | |
| 049 | 7.2 | ❌ | basket HHI absent | |
| 050 | 7.2 | ⬜ | λ_C unspecified | |
| 051 | 7.3 | 🟡 | velocity caps + 5% NAV/day | canonical 2.6 |
| 052 | 7.3 | ⬜ | λ_T unspecified | |
| 053 | 7.4 | ❌ | **no 8-term optimizer** (0/8 penalty terms) | envelopes substitute |
| 054 | 7.4/8.5 | 🟡 | envelopes + velocity + MARP gates; execution flag off | |
| 055 | 7.5 | 🔶 | `maseEnsemble` equal α=1/6 families; Stability=50/50; post-mixture projection ✓ | 45/35/20 correctly NOT used |
| 056–058 | 7.6 | ⬜ (3) | Score/softmax absent — **RG-06 dormant-clean** | equal α disclosed in code + UI |

### EQ-059–100 — Constraints, smoothing, chain index, MARP, execution (`trace-EQ-059-100.md`)

| EQ | § | Status | Code anchor | Note |
|---|---|---|---|---|
| 059/060 | 8.2 | ⬜ | static envelopes only (mase.ts 287–311) | dynamic f symbolic (RG-15) |
| 061 | 8.2 | ✅ | containment inside immutable constitutional arrays | static-degenerate |
| 062 | 8.3 | ✅ | `applyVelocityCaps` 342–366; MAX_VELOCITY .50/.30/.20% blueprint-verbatim | **no dedicated test** |
| 063 | 8.3 | ⬜ | g symbolic | |
| 064 | 8.4 | ✅ | `smoothWeights` ρ 0.50/0.75 | 0.70 crisis constant dead; stress flag = risk-state level |
| 065 | 8.5 | 🟡 | envelope + velocity + MARP monitor 2063–2073 | |
| 066 | 9.1 | ✅ | `advanceIndex` 101–128; G_t tracked; recursion ≡ value-aggregate (audit-verify <1e-9) | |
| 067 | 9.1 | ✅ | I₀=1 | |
| 068 | 9.2A | ⛔ | form A rejected | by design |
| 069 | 9.2B | ✅ | chain-index.ts:112–115 prior-period weights; rationale in header; continuity tested | **RG-01 RESOLVED** |
| 070/071 | 9.3 | ✅ | `commitWeights` 162–181; D_t = B⁻/B⁺; I_t unchanged (self-test 1e-12, succession swap bit-identical) | no phantom return |
| 072–075 | 9.4 | ❌ (4) | attribution absent in engine; UI ReferenceChart data **synthetic** | audit-verify ad-hoc only |
| 076 | 9.7.1 | ✅ | GFB quarantined/deprecated; snapshot gfbIndex = I_t | UI leak noted in §5-F1 |
| 077 | 10.1 | 🟡 | `marpDecision` advisory; USE_MARP_EXECUTION=false; legacy auto-exec 346–355 | daily calc ≠ trade holds for MARP; legacy path auto-executes (simulated) |
| 078 | 10.2 | 🔶 | `computeUrgency` simplified; skip if U<0.05 | a–e coefficients absent |
| 079 | 10.4–5 | ✅ | `inNoTradeZone`; θ_base 0.75%/1.5% | canonical 2.6; C.1 |
| 080/081 | 10.5 | ⬜ | static κ-form (disclosed marp.ts:40–44) | |
| 082 | 10.6 | ✅ | `partialCorrection` β=0.50 | doc 0.40 = example (disclosed) |
| 083 | 10.6 | ⬜ | adaptive β absent | |
| 084 | 10.7 | ❌ | `naturalCashFlowPreference` dead helper (0 call sites) | **C.3 ABSENT** |
| 085 | 10.7 | 🟡 | sizing + 5% turnover cap | |
| 086 | 10.8 | 🟡 | 2-term cost (slippage + $50 gas); no routerFee/150k gasUnits | |
| 087 | 10.8 | ✅ | MARP gate `netBenefit > $10 ε` | c4-check mirror |
| 088 | 10.8 | ⬜ | expanded benefits not measured | |
| 089 | 10.9 | ⬜ | J optimizer absent — **RG-09 compliant-by-omission** | only a comment cites §10.9 |
| 090 | 10.10 | ⬜ | fixed 4s cadence | |
| 091 | 11.1 | ✅ | observed weights, haircut-consistent basis | e2e 1.3 |
| 092 | 11.4/12.4 | 🟡 | $50 gas fallback; flat slippage | |
| 093 | 11.4/12.4 | 🟡 | legacy path only; poolDepth24h = $4M hard-coded | MARP path lacks pool cap |
| 094/095 | 11.5.1/12.3 | 🟡 (2) | `simulateQuote` unwired; τ=1% | |
| 096/100 | 12.1/12.7 | 🟡 (2) | 2-term cost; no routerFee | |
| 097 | 12.1 | ⬜ | T_max/I_max absent | |
| 098 | 12.5 | ✅ | ACTIVE legacy gate `benefit > cost` (**>0, no ε**) | **RG-10 flag** |
| 099 | 12.5 | ✅ | MARP advisory `> ε ($10)` | dual thresholds coexist |

### EQ-101–134 — Reserve, coverage, buffer, oracle (`trace-EQ-101-134.md`)

| EQ | § | Status | Code anchor | Note |
|---|---|---|---|---|
| 101 | 13.1 | 🟡 | fixed genesis × prior + flow paths; no sizing f | |
| 102 | 13.2 | ✅ | RR + EMERGENCY + stability pool | |
| 103 | 13.2.1 | ✅ | net NAV single source | |
| 104 | 13.3 | 🟡 | accounting-only split of ONE physical PAXG+XAUT pot (engine.ts:321–323 admits) | index gold 13% NAV vs 26% weight — known compromise |
| 105–107 | 13.4 | ✅ (3) | LCR bands; fiatNet numerator (gold 0%); 0.25 stress demand | |
| 108 | 13.5 | ⬜ | strategic gold sizing f absent | |
| 109/110 | 13.5.2/16.3 | 🟡 (2) | NAV measured on TOTAL pool; legacy = target only; waterfall caps | live NAV never decomposed — RG-11 core PASS |
| 111 | 13.5.2 | 🔶 | `computeTargetGoldWeight` (0.20+0.10×B_gold, clamp 22–30%) drives **live default-path target** | disclosed engine.ts:270–276; retire with MARP flip |
| 112 | 14.1 | ✅ | `reserveAssetValues` reused at 10+ sites | backtest drift: navFromHoldings omits gold min-rule (+0.13%) |
| 113 | 14.1 | ✅ | min(ref, ref×0.995) reserve-ONLY; index path raw/independent | **RG-03-style separation held** |
| 114 | 14.2 | ✅ | shared RR/L identity | |
| 115 | 15.6.1 | 🟡 | registry warn ≥25%/breach ≥30% **report-only, untested**; no 35% crisis path | Circle ~29% pinned by EURC single-issuer floor |
| 116 | 15.6.2 | ❌ | per-instrument C_max absent | |
| 117 | 15.6.3 | 🟡 | index envelopes only; reserve-side cap absent | |
| 118 | 16.3 | ✅ | 62.5→85 ramp both directions; EMERGENCY immediate | canonical 567–573 |
| 119/120 | 16.3 | 🔶 (2) | legacy gold/fiat target formulas (with 111) | sums to 1 ✓; historical-init status per RG-11 |
| 121 | 15.2/14.3 | 🟡 | 8-criteria registry + sanctions; no E_min; WATCH assets don't gate engine | |
| 122 | 17.2 | 🔶 | **<3 valid feeds → pause** (stricter than §17.2's <2) | disclosed COO/PM directive |
| 123 | 17.2–3 | 🟡 | 3-count enforced; family independence unchecked; all 3 "sources" = synthetic witnesses on ONE upstream | disclosed oracle.ts:19–31 |
| 124–126 | 17.3.x | ✅ (3) | staleness per class (source timestamp); confidence caps 0.5/1/1/2%; 2.5% median-anchor breaker pre-aggregation | canonical 541/994 |
| 127/128 | 17.4 | 🟡 (2) | median over 1 live + 2 synthetic; no AMM-defined gold ✓; liquidity-quality filter absent | |
| 129 | 17.5 | 🟡 | conjunctive gates; per-feed P_min/P_max sanity band absent | |
| 130 | 17.5 | 🔶 | **median returned** (not §17.5 filtered mean); 2-feed average only via governance override | RG-08 unresolved in code (F-7) |
| 131/132 | 17.6 | ⬜ (2) | confidence aggregate + C_min 0.60 absent | HONEST_STATUS "confidence scoring" overclaims |
| 133 | 17.7 | 🟡 | valid + discardReason; no 5-state enum (HALTED absent) | |
| 134 | 17.8–9 | ❌ | correlation-warning counter / pause-after-3 **absent** — the exact §17.8-9 risk (all feeds share one upstream) | **F-2** |

### EQ-135–175 — Pricing, mint/redeem, genesis, risk states, succession, validation, pipeline, Appendix C (`trace-EQ-135-175.md`)

| EQ | § | Status | Code anchor | Note |
|---|---|---|---|---|
| 135/141 | 18.1/19.2 | ✅ | `getMTQPrice` = I_t × PAR(1.00); I_base = 1.0 normalized | **RG-14 PASS** — genesis denominator value 650.644103 stored reference-only, never divided |
| 136 | 18.2 | ✅ | shared identity (pilot-state inline duplicate — DRY risk) | |
| 137 | 18.3 | 🟡 | DailyStateVector 30s: W/Risk/Liquidity/Coverage/OracleConfidence ✓; CVaR/MDD/PPError/CrisisScore/Turnover/Cost absent | |
| 138 | 18.3 | ✅ | state-driven; calendar never forces trades | |
| 139/140 | 19.2 | ✅ | fee 10 bps once; minted = net/P × throttle; price band 0.50–2.00 + oracle-pause gate; no peg | canonical Economic; I5 |
| 142–145 | 19.3 | ✅ (4) | NAV_t = V_net(haircut)/S_circ; fee once (0.15/0.50/1.00/0.30%); pro-rata at ACTUAL net holdings; 7 legs | **RG-02 PASS** — navPerMtq vs nav vs I_t distinct symbols |
| 146 | 19.4.1 | ❌ | minOut/τ_user/deadline **not enforced** (constants + UI labels only) | |
| 147 | 19.4.2 | ❌ | redemption execution-price guard unwired | |
| 148 | 20.1 | 🟡 | amounts = doc example; canonical RR at pure genesis = ∞ (locked supply) | no 1.10 test |
| 149 | 20.1.5 | ✅ | GFB_BASE_DENOMINATOR 650.644103; **CHF 1.1300 + gold $2,500 included** | unlike legacy GFB ✓ |
| 150 | 20.3.1 | 🟡 | sweep >$10k **keeps $5k float**; no threshold test | semantic nit vs "sweep only above" |
| 151 | 20.4 | 🟡 | mint/redeem fees ✓ excluded from NAV ✓; **rebalance fee 0.20% ABSENT** | |
| 152–154 | 21.2–21.3 | ✅ (3) | exact §21.2 thresholds; worse-binds; immediate escalation; 48h/rung; no S5→S1 jump | **RG-13 AGREE** row-for-row; 17/17 self-tests |
| 155/156 | 21.5.4 | ✅/🟡 | R_score 0.40/0.25/0.20/0.15, gate 0.80 ✓ | reverse-ladder 0.85/0.90 constants-only |
| 157 | 21.5.3 | 🟡 | EJECT_STAGES cumulative-of-original 0.10/0.25/0.50/1.00 → increments 10/15/25/50 ✓ | **RG-12 RESOLVED (matches blueprint)**; RR-coupled triggers + 5% pause unwired; phantom `evaluateEjectStage` comment |
| 158 | 22.3–22.4 | ✅ | no weight-setting endpoint anywhere; GOVERNANCE_LAYERS + PARAMETER_REGISTRY | governance sets rules only ✓ |
| 159/160 | 23.3/23.4 | ⬜ (2) | walk-forward/purged-CV documented "not run" (honest) | |
| 161 | 23.6 | ✅ | pilot form: ±50% grid, 3200 trajectories, 99.0% ≥ 90% | audit-stress Scenario 11 |
| 162 | 23.7 | ⬜ | model-selection score absent (MASE simplified) | |
| 163 | 23.11 | ✅ | 11 scenarios; survival/minRR per scenario (S10 combined minRR 1.1426) | pilot form, not literal CoverageRatio_s |
| 164 | 24.1 | ✅ | SHA-256 + --verify-only + --fixed-input; mulberry32 seeds; D3 restart-invariant | pilot-grade; hash covers weights only |
| 165 | 24.5 | ✅ | Data→Ensemble→Constrain→Smooth→commit order verified; MARP advisory | **RG-165 pipeline order PASS** |
| 166 | 24.5 | 🟡 | no CVaR/PP/Liquidity/Cost MASE inputs (disclosed) | |
| 167/168 | 24.5 | ✅ | projection (box∩simplex, 12 iters, tol 1e-9) + ρ ladder + velocity caps | |
| 169 | 24.5 | 🟡 | decision layer complete; execution feature-flagged OFF | |
| 170 | 26.4 | ✅ | Σ=1; non-frozen universe proven live (SGD admission drill) | |
| 171 | C.1 | ✅ | Trade=0 at D=0.3%; pilot θ_base 0.75% vs doc example 1.0% (outcome identical) | |
| 172 | C.2 | 🔶 | pilot β=0.50 → −1.20pp vs doc β=0.40 → −0.96pp | documented, **unasserted** in test |
| 173 | C.3 | ❌ | natural-flow netting: placeholder helper, no test | |
| 174 | C.4 | ✅ | **EXACT**: B $1,200 < C $1,700 → Trade=0 (c4-check live) | |
| 175 | C.5 | ✅ | 29.2% ∈ Gold envelope 20–32% | |

### Rollup counts (175 total)

| Status | Count | Reading |
|---|---|---|
| ✅ VERIFIED | **64** | implemented, blueprint-matching, tested |
| 🟡 PARTIAL-DOCUMENTED | **37** | implemented with disclosed simplification/gap |
| 🔶 DEVIATION | **14** | conflicts with blueprint (each disclosed except where noted) |
| 🟦 LEGACY-OK / ⛔ by-design | **2** | EQ-014 quarantined; EQ-068 form A rejected (form B is blueprint-operative) |
| ⬜ NOT-IMPL-RESEARCH-OK | **37** | blueprint itself symbolic/validation-stage — acceptable, must be itemized in disclosures |
| ❌ NOT-IMPL-GAP | **21** | required for the real system, missing in pilot (see §7 P1/P2) |

---

## 3. The three constitutional separations & four weight states

| Requirement | Verdict | Evidence |
|---|---|---|
| Three mathematical layers separate (constituency / MASE target / MARP execution+reserve) | **HELD** | Constituency = static + succession drill (read-only sim); MASE = mase.ts pipeline (advanceMase 2128–2155); MARP = marp.ts advisory + legacy execution path separately flagged (`USE_MARP_EXECUTION=false`, pilot-state.ts:104). No layer reaches into another's state. Caveat: the legacy §7 execution path mutates reserves on tick — it is the pre-MARP pilot path, disclosed engine.ts:12–16. |
| Four weight states distinct (Prior/Target/Smooth/Execution) | **HELD** | `weightStates{prior,target,smoothed,execution}` built in `buildMaseSnapshot` (engine.ts 2084–2089), published via /api/metrics, rendered as a 4-state table in MaseEngine.tsx (301–312); raw optimizer output additionally at `mase.ensembleTarget`; trade intents in `marp.decisions`. No state is labeled "the" live state without naming which. |
| Reference-basket weights ≠ reserve-portfolio weights | **HELD** | Observed reserve weights (navShares, buildObservedWeights) computed independently of index weights; redemption pro-rata at ACTUAL holdings; reserve never allocated to index weights; the one coupling (mint deposits at live W^Smooth per §19.2.2) is blueprint-specified. |
| MTQ Σ NOT pegged to USD | **HELD — verified live** | PAR = 1.00 basket-unit (unit-of-account); `getMTQPrice` = I_t; mint divides by P_MTQ (250 USDC → 249.75 MTQ at genesis-basis; fewer tokens at index > 1); redemption at haircut NAV/token; live P_MTQ **$1.195907**; canonical I5 no-peg invariant; grep found no 1 MTQ = $1 hardcode in any monetary path. USD appears only as reporting numeraire (labeled so in UI). |
| Prior is not presented as live | **VIOLATED in 4 presentation surfaces** | See Finding F-1. Engine is clean (prior = genesis init + EMA anchor only; index receives only smoothed MASE output, verifiably diverged: gold 26→29%). |

---

## 4. The 15 reconciliation gates — verdicts

| Gate | Blueprint says (verified vs source) | Code does | Verdict |
|---|---|---|---|
| **RG-01** index recursion weights | Both forms printed (lines 2079/2083) **but** blueprint pins form B: "Listing 3 implements exactly this convention" (line 2087) | Form B — prior-period weights (chain-index.ts:112–115), rationale documented (kills notional short-gold bug), continuity via divisor, tested (canonical 1.1/1.2, self-test, succession 1e-12) | **RESOLVED — code matches blueprint's operative convention.** Spec's ambiguity claim overstated. Action: promote recursion↔value-aggregate equivalence test from ad-hoc audit-verify.ts into canonical suite. |
| **RG-02** NAV symbol overload | 3 definitions (§2.5 index; §14.1 V_net; §19.3 per-token) **+ 4th in Appendix A.1 glossary the spec missed** | Distinct symbols everywhere: `I_t`/`mtqPrice` vs `nav`/`navUsd` vs `navPerMtq`; UI labels "reporting numeraire" for index | **RESOLVED in code.** Actions: nomenclature map doc; add NAV/token UI card; fix glossary in next spec revision. |
| **RG-03** gross getter vs net manager | Listing 1 returns gross `fiatValue+goldValue`; §14.1/Listing 5 require net+haircuts | Single net source `usdNet+…+goldNet` (engine.ts:593); all 10+ consumers net; canonical test "NAV < gross" | **PASS.** One drift: historical-backtest `navFromHoldings` re-implements NAV omitting gold min-rule (+0.13%, test-only path). |
| **RG-04** legacy GFB | 5-term formula (no CHF/gold), line 2237; v2.0 replaces it | Engine: quarantined + deprecated; `gfbIndex` = I_t. **UI: GfbBasket.tsx:92–100 shows the deprecated formula titled "Chain-Linked Index Formula" and :89 shows CHF fixing 0.88 (blueprint = 1.1300)** | **ENGINE PASS / UI LEGACY-LEAK** — fix panel. |
| **RG-05** Q_min collision | Confirmed (lines 1367–1377): threshold vs observed-min reuse | Constituency scoring not implemented — collision cannot materialize | **DORMANT.** Disambiguate symbols (Q_threshold vs Q_min^obs) in methodology doc before §4 lands. |
| **RG-06** softmax orientation | exp(−η·Score) + "better models greater weight" ⇒ lower-is-better; η unspecified | No softmax; equal α=1/6 (disclosed in code mase.ts:236–238 + UI + docs) | **DORMANT-CLEAN.** Must pin score orientation with a known-vector test before §7.6 adaptive weights land. |
| **RG-07** GPR sign | GPR = P_{t−1}/P_t − 1 (gold price in currency i); blueprint itself defers direction convention to methodology version | GPR absent. Proxy `modelPurchasingPower` uses the **opposite** quote direction and "buy depreciated" logic | **NO LIVE RISK / SEEDING RISK.** The proxy must not seed the §5.2 implementation. |
| **RG-08** oracle aggregation | §17.2: median-3/average-2/pause; §17.5: median = anchor, aggregate = filtered mean; §17.4 gold: median again — **blueprint-internal conflict** | ≥3 valid → median; 2 valid → average only with governance override; <3 → pause (stricter than §17.2, disclosed directive); 2.5% breaker pre-aggregation; per-class staleness + confidence caps | **OPEN — code chose median (consistent with §17.2 + §17.4 gold) but §17.5 filtered-mean is unimplemented and the decision is not recorded.** Action: governance truth-table decision record. |
| **RG-09** J(ΔW) operator | **Spec premise FALSE** — blueprint line 2971 prints `ΔW* = argmin J(ΔW)` and λ = 0.40/0.30/0.20/0.10 (2960–2966). Real residual issue: λ₃·Urgency is ΔW-invariant | J optimizer not implemented (only a comment cites §10.9) | **COMPLIANT-BY-OMISSION.** Correct the alignment spec: the gate should target the ΔW-invariant urgency term, not a missing operator. |
| **RG-10** profitability threshold | §10.8 >ε; §12.5 both >0 and >ε. **Worse than the spec lists:** ε fixed twice with different units — Listing 4 BENEFIT_MARGIN 1% vs Listing 5 MIN_PROFITABILITY $10 | TWO coexisting gates: MARP advisory `netBenefit > $10` (marp.ts:66); ACTIVE legacy path `benefit > cost` (>0, no ε) (engine.ts:840–843) | **OPEN DIVERGENCE — the executing route uses the weaker >0 form.** Must unify (ε > 0 with fixed units) before MARP execution flips on. |
| **RG-11** buffer legacy vs adaptive gold | Confirmed v1.2 init values; v2.0 core gold adaptive | Live NAV never decomposed core+buffer (accounting separation holds); legacy 0.20+0.10×B_gold survives ONLY as the ACTIVE default-path gold target (`computeTargetGoldWeight`) + waterfall caps — disclosed engine.ts:270–276 | **PARTIAL.** Core question PASS; the live legacy target is a documented deviation that must retire when MARP execution enables (MASE envelope output 20–32% then drives targets). |
| **RG-12** de-peg ladder denominator | Blueprint resolves itself: "of the original position" + cumulative 10→25→50→100 table + Listing 14 `totalValue` arithmetic | `EJECT_STAGES` cumulative-of-original (0.10/0.25/0.50/1.00 → increments 10/15/25/50, Σ=100%); matches blueprint exactly; verified in succession drill + self-test | **RESOLVED — code matches.** Spec's ambiguity claim overstated. Runtime gaps: RR-coupled triggers + 5% pause unwired; phantom `evaluateEjectStage` comment. |
| **RG-13** six-state mapping | §21.2 canonical S1–S6 confirmed. **Plus a real conflict the spec missed:** §14.2.2 has a FIVE-status table (no STRESS; DEFENSIVE 1.00–1.05 LCR-Any; RECOVERY LCR ≥ 0.95) implemented by Listing 6 — vs §21.2's six states | state-machine.ts implements §21.2 row-for-row (thresholds, worse-binds, immediate escalation, 48h/rung, EMERGENCY only via RR hard-floor, RECOVERY residual posture); 17/17 self-tests | **RESOLVED for code (follows the constitutional chapter).** Record the §14.2.2-vs-§21.2 blueprint conflict + the 48h governance-class conflict (§2.9 DAO-vote vs Listing 13 immutable) in governance decision records. |
| **RG-14** genesis/index-price scaling | I₀=1.0000; P_MTQ=I_t/I_base; 7-component I_base (CHF 1.1300, gold $2,500) | I_base = 1.0 (normalized); genesis denominator **value** 650.644103 stored immutable as reference-only — never divided ("dividing would give P ≈ 1/650 — clearly wrong", chain-index.ts:188–195); P_MTQ = I_t × PAR; live 1.195907 = independent recompute; restart-invariant | **PASS — no double normalization.** |
| **RG-15** symbolic forms | Confirmed symbolic at §4.2, §5.5, §8.2–8.3, §10.5–10.6, §13.5 (spec's §15.2 citation imprecise — §15.2 is concrete pass/fail; symbolic E_j lives in §14.3/§13.5.3) | **No invented constant masquerades as canonical.** Simplified substitutes are labeled "Simplified pilot"/"Simplified"/"Pilot approximation" — except: regime thresholds (VIX 15/22/30, DXY 88/115), crisis gold 0.50 vector, ε=1e-9, 12-iteration/1e-9 projection, $4M pool depth — **unlabeled** | **PASS with labeling actions.** |

---

## 5. Cross-cutting findings (ranked)

**F-1 · PRIOR PRESENTED AS LIVE/CONSTITUTIONAL (UI/API) — the top user-visible deviation.**
(a) `page.tsx:162` — "7-Component Basket · **Live Weights**" renders the hardcoded strategic prior; (b) `page.tsx:185` — claims prior weights are "constitutional (§9 — immutable)", which contradicts Invariant I3 (methodology fixed, **weights adaptive**); (c) `/api/gfb:16–22` — returns prior as unlabeled `components.*.weight` (live weights only in `chainIndex.prevWeights`); (d) `GfbBasket.tsx:92–100` — shows the **deprecated Laspeyres fixed-quantity formula** under the title "Chain-Linked Index Formula", and :89 shows stale CHF fixing **0.88** (blueprint = **1.1300**); (e) `PitchSection:39` fixed-composition rhetoric; (f) `ReserveDonut` prior segments uncaptioned. Directly violates EQ-011/EQ-013/EQ-076 discipline. Engine itself is clean.

**F-2 · Dual execution + profitability paths (RG-10/11 operational risk).**
`USE_MARP_EXECUTION=false`: MARP is advisory-only; the legacy §7 gold↔USDC path **auto-executes simulated trades every 4s tick** when its gates pass, with the weaker `benefit > cost (>0)` gate, and its gold target is the legacy `0.20+0.10×B_gold` clamp[22,30]% formula (EQ-111) rather than the MASE envelope output. MASE smoothed weights ARE committed to the chain index meanwhile — so index math is adaptive while execution targets are legacy. All disclosed in code, but the divergence is not surfaced in `/api/honest-status`.

**F-3 · Oracle: median-vs-filtered-mean unresolved + correlation counter absent (RG-08 + EQ-134).**
Code returns the median (matches §17.2 + §17.4-gold) but never implements §17.5's filtered mean, and no governance decision record exists. Meanwhile all three "sources" are synthetic witnesses over ONE upstream feed (disclosed), and the §17.8–9 correlation-warning counter (pause after 3 warnings) — the exact safeguard this architecture needs — is absent.

**F-4 · Gold index/reserve separation is accounting-only (EQ-104, known compromise).**
One physical PAXG+XAUT pot backs both the 26% index gold weight and reserve obligations; index gold ≈ 13% of NAV vs the 26% weight it notionally references (admitted engine.ts:315–323). Blueprint §14.1 requires enforced separation. Acceptable for pilot ONLY with continued disclosure; must be resolved before production claims.

**F-5 · MASE numerical core absent; two honest-status lines overstate.**
No covariance (corr=null), VaR, CVaR, MDD, GPP, PPError, HHI, 8-term objective, or adaptive softmax anywhere; regime detection = invented **unlabeled** hard 4-state classifier; vol = static baselines scaled by VIX. Mostly code-labeled, but `HONEST_STATUS` (blueprint.ts:392, :394) claims "VaR/CVaR + MASE ensemble" and "confidence scoring" — overclaims; and `/api/honest-status` does not itemize the MASE/oracle simplifications (equal α, single-window vol, hard regime classifier, synthetic witnesses, median-not-mean).

**F-6 · Missing transaction guards (EQ-146/147) + fee/parameter drifts.**
minOut/τ_user/5-minute deadline not enforced on mint/redeem API; rebalance fee 0.20% (§20.4) absent; sweep keeps $5k float once >$10k (semantic nit vs "sweep only above"); β=0.50, U_min=0.05, λ₁=0.4, $50-gas, $4M-pool-depth are ungoverned (not in PARAMETER_REGISTRY).

**F-7 · Concentration controls incomplete (EQ-115/116/117).**
Issuer breach (≥30%) is report-only and **untested** (canonical imports dead); no 35% crisis path; no per-instrument C_max; Circle ≈ 29% pinned by the EURC single-issuer floor — one issuer event from the hard cap.

**F-8 · Test debt.**
Appendix C regressions live in ad-hoc scripts (audit-verify.ts / c4-check.ts), not the canonical suite; **C.3 natural-flow netting absent entirely**; no dedicated tests for velocity caps, ρ ladder, equal-α, urgency; C.2 β mismatch printed but unasserted; attribution (EQ-072–75) absent from the engine while the UI chart uses synthetic data; INV-5 label ("divergence < 5%") mismatches its printed max (8.22%).

**F-9 · Succession runtime gaps (EQ-157/155).**
Eject-ladder RR-coupled triggers (RR < 1.08/1.05/1.02) and the 5%-pause rule are declared but unenforced; phantom `evaluateEjectStage` reference (engine.ts:1145); reintegration escalation rungs (0.85/0.90) + sustained-hours are constants-only; depeg-timer decay text says 2× but code uses 0.5×dt (succession.ts:374 vs engine.ts:1142).

**F-10 · Minor.**
pilot-state.ts:412–416 re-implements L/RR/LCR inline (DRY risk on the EQ-136 identity); historical-backtest NAV drift (+0.13% from omitted gold min-rule); DailyStateVector lacks CVaR/MDD/PPError/CrisisScore/Turnover/Cost; no NAV/token UI card; EQ-022 successor admission instant-at-seed (no §4.6 ramp) — acceptable drill-only; EQ-029 window is 90 ticks not 90 days vs comment; legacy monte-carlo.ts stale (5-component doctrine).

---

## 6. Automated test evidence (all green; details in `test-evidence.md`)

| Suite | Result |
|---|---|
| Canonical invariants (159 checks, 7 layers, P0-1..P0-4 proofs) | **ALL PASS** (exit 0) |
| E2E integration (mint→advance→redeem, stress, recovery, oracle-pause) | **26/26 PASS** |
| Stress re-run §23 (11 scenarios, fixed seeds) | **11/11 PASS** (S5 survival 100%) |
| Historical backtest Layer 6 (2562 days, 2014→2024; DEGRADED data mode documented) | **5/5 invariants PASS** (RR min 1.0775; no EMERGENCY; oracle 100% valid) |
| Audit retention (10k cap/prune/cleanup) | **PASS** |
| State-machine self-test / chain-index self-test / audit-verify / c4-check | **17/17 · PASS · all-match · EXACT** |
| typecheck / lint | **PASS (after 1-line type fix) / 0 errors** |

Failing tests: **none**. Coverage gaps vs the spec's checklist: natural-flow netting (C.3), correlated-feed warnings, direction-lock, thin-liquidity deferral, issuer-freeze override, mint minOut, redemption slippage guard — all catalogued as ❌ GAP items, none silently passing.

---

## 7. Recommended code changes (with rationale) — **NOT implemented in this audit session** (except the type fix); awaiting authorization

### P0 — before any further pilot exposure
1. **Presentation-cluster fix (F-1)** — relabel page.tsx "Live Weights" → "Strategic Prior (§3.2)"; delete the false "constitutional immutable" sentence (replace with I3-correct wording); label `/api/gfb` fields `prior` + add live `prevWeights` to the payload; rewrite GfbBasket panel to show the actual chain-linked recursion (form B + divisor) and CHF fixing **1.1300**; caption ReserveDonut; soften PitchSection. *Rationale: EQ-011/013 are constitutional; users must never see the prior as live composition.*
2. **Unify RG-10** — one normative per-route profitability rule with fixed ε units ($10 absolute vs 1% relative — blueprint itself conflicts; pick one via governance note), and make the ACTIVE path use it. *Rationale: the executing route currently uses the weaker >0 form.*
3. **Surface the dual-path status** — add honest-status items: `USE_MARP_EXECUTION=false`, legacy gold target active, equal ensemble α, single-window vol, hard regime classifier, no VaR/CVaR/MDD/GPP, synthetic oracle witnesses, median-not-filtered-mean, issuer breach report-only. Correct the two overclaiming HONEST_STATUS lines. *Rationale: §25 honest-status is the platform's disclosure contract.*

### P1 — before MARP execution can be enabled
4. **Retire the legacy execution path** behind the MARP flag flip: gold target from MASE envelope output (20–32%) instead of `0.20+0.10×B_gold` clamp; wire the $10-ε gate; add direction lock + thin-liquidity deferral; replace $4M hard-coded pool depth with feed data.
5. **Oracle decision record + correlation counter (F-3)** — governance truth-table (3/2/1/0 × family-independence × outlier) choosing median vs filtered-mean; implement the §17.8–9 warning counter; record that pilot witnesses cannot satisfy ≥2-family quorum.
6. **Transaction guards (F-6)** — mint `minOut`, redemption `τ_user` + 5-min quote deadline on the API routes; add rebalance fee 0.20%; register β/U_min/λ₁/gas/pool-depth in PARAMETER_REGISTRY.
7. **Concentration enforcement (F-7)** — test issuer breach, define breach action, add 35% crisis path + per-instrument C_max.

### P2 — hardening
8. Promote Appendix C regressions (incl. missing **C.3**) into the canonical suite; assert C.2 pilot β explicitly; add velocity/ρ-ladder/urgency tests; promote the recursion↔value-aggregate equivalence test.
9. Implement EQ-072–75 attribution in the engine (replace synthetic UI chart data); add NAV/token UI card; extend DailyStateVector fields as features land.
10. Wire succession RR-coupled triggers + 5% pause; remove the phantom `evaluateEjectStage` comment; implement reintegration 0.85/0.90 rungs + sustained hours; fix depeg-timer decay text; fix historical-backtest NAV reuse + INV-5 label.
11. Nomenclature map doc (RG-02/RG-05 symbols); governance decision records for every RG; label the remaining unlabeled pilot constants (regime thresholds etc.).

**None of these change the monetary model, the basket method, or introduce any USD peg.** Items 1–3 are pure labeling/disclosure; 4–7 are blueprint-mandated guards; 8–11 are test/doc hardening.

---

## 8. Unresolved ambiguities (not resolvable by code reading; require governance/owner decision)

1. **RG-08:** §17.2 (median/average/pause) vs §17.5 (median-anchor + filtered mean) vs §17.4 (gold median) — which aggregate is normative per feed-count? Blueprint self-conflicts.
2. **RG-10:** ε units — Listing 4 `BENEFIT_MARGIN 1%` vs Listing 5 `MIN_PROFITABILITY $10`; and §12.5's bare `>0` form.
3. **RG-13:** §14.2.2 five-status table (Listing 6) vs §21.2 six-state table — code follows §21.2; blueprint must reconcile. Also §2.9 "48h DAO vote" vs Listing 13 "immutable 48h".
4. **Blueprint glossary** Appendix A.1 defines NAV_t as *reserve* NAV while §2.5 defines it as *index* value — nomenclature fix needed in the next spec revision (spec's RG-02 missed the glossary instance).
5. **§9.2 P596/P598 locator** cited by the alignment spec is unresolvable in the plain-text extraction (paragraph vs page numbering) — quote-based citation is used instead in this audit.
6. **EQ-019/RG-05:** Q_min as threshold vs observed-minimum — must be disambiguated before the constituency engine is implemented.
7. **EQ-155 reintegration weights** (0.40/0.25/0.20/0.15) — blueprint gives no feature normalization spec; pilot uses labeled simulated liquidityDepth.
8. **§23.8 gold shock set:** spec lists +50/+25/−10/−20/−30; code scenarios are +50/−30/−20 (+20% in canonical) — align the scenario ledger naming.

---

## 9. File index (audit-work/v3/)

| File | Content |
|---|---|
| `eq-by-eq-spec.md` | Extraction of the audited alignment specification (2862 lines) |
| `blueprint-source-verification.md` | RG-01..RG-15 source quotes + 27/27 parameter-table verification (Task 2-b) |
| `trace-EQ-001-024.md` | Full records: architecture/variables/basket/constituency (Task 2-c) |
| `trace-EQ-025-058.md` | Full records: MASE signals/models/objective/ensemble (Task 2-d) |
| `trace-EQ-059-100.md` | Full records: constraints/index/MARP/execution (Task 2-e) |
| `trace-EQ-101-134.md` | Full records: reserve/coverage/buffer/oracle (Task 2-f) |
| `trace-EQ-135-175.md` | Full records: pricing/mint-redeem/genesis/states/succession/validation (Task 2-g) |
| `test-evidence.md` | All suite results + live values + service health + checklist coverage map |
| `EQUATION-BY-EQUATION-AUDIT-REPORT.md` | **This report** |

Prior-stage artifacts: `audit-work/v2/MASTER-AUDIT-REPORT.md` (56-row matrix), `blueprint-full.txt` (source of truth extraction), `audit-verify.ts`, `c4-check.ts`.

---

## 10. Production authorization posture

**Production remains DISABLED — correctly.** All 11 canonical §25.5 honest-status gates remain NOT CONDUCTED; the §23 validation program (walk-forward, purged CV, perturbation bounds, model-selection) is honestly disclosed as not-run; the blueprint's own status is Candidate for Public Testing. The equation-by-equation audit confirms the *monetary definition layer* is implementable and evidenced, but the adaptive layer (MASE §5–7), oracle independence (RG-08 + witness architecture), execution unification (RG-10/11), and concentration enforcement must be completed and evidenced before any production-authorization claim could even be considered. No change made in this session alters that posture.

*Audit method note: no formula was rewritten; no unspecified function was filled with a guess; every claim above carries a file:line or blueprint-line citation in the trace files. Where the alignment specification itself misreads the blueprint (RG-09 premise; RG-01/12 overstatement; RG-02/13 missed conflicts; §15.2 citation), this is reported rather than adopted.*
