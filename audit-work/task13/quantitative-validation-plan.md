# MTQΣ — TASK 13 · Quantitative Validation Plan (deliverable 11, Stage J)

**STATUS: PLANNED (v1) — VALIDATION NOT RUN; NO EFFECTIVENESS CLAIMS.** This document is a plan only. No validation has been executed under it; no historical window, stress window, scenario, metric, or comparison has been run; no result is asserted. It replaces the Stage A placeholder stub for this deliverable in full.
**Mandate:** MTQSIGMA-COO-MANDATE-004 §6 (verbatim: "Compare the adaptive model against fixed-basket and relevant benchmark alternatives using historical and stress-period data. Report performance, volatility, drawdowns, tracking behavior, turnover, concentration, data failures, and sensitivity to parameter changes. Do not label the model optimal, stable, manipulation-resistant, or validated without supporting evidence. Draft parameter values must remain explicitly unapproved.") + §11 (deliverable honesty rules) + §12 scope carried from the Stage A stub. Stage J drafting; acceptance is owned by Gate J (per `reference-index-and-gold-methodology.md` §7 — the Stage A stub's "Gate F" label is superseded; flagged to the orchestrator).
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence-status legend (per `README.md`): `VERIFIED` (independently reproduced this session from the cited source) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited) · `SIMULATED` (synthetic data, labeled) · `PROPOSED` (this document's design content — requires approval, not implemented) · `UNVERIFIED` (could not be confirmed; environmental limits are UNVERIFIED, never PASS) · `NOT IMPLEMENTED`.
**Standing forbidden-language rule for this deliverable:** nothing in this plan, and no run under it, may be described as showing the model is *optimal, stable, manipulation-resistant, or validated* — this document contains no such claim and no run under it may generate one; any future use of those labels additionally requires Gate J closure on pre-registered evidence **and** explicit owner authorization of the specific wording, and even then the claims register (`claims-and-honest-status.md` §B) continues to prohibit market-price-stability, backing, and independence claims. Draft parameter values remain explicitly UNAPPROVED throughout.

---

## 1. Purpose & scope

### 1.1 What independent quantitative validation must demonstrate (before ANY Gate B–J claim)

Before any gate in the B–J range may cite quantitative support, this program must demonstrate, with reproducible artifacts:

1. **Mechanical integrity under change** — the adaptive model preserves the index-continuity, sum, bounds, and velocity invariants at every composition-change and weight-commit boundary (extends the IDX-* acceptance tests of `reference-index-and-gold-methodology.md` §8 and the CCY-* Stage K families of `currency-constituency-and-weight-transition-spec.md` §10 — this plan extends, never duplicates, those frameworks).
2. **Behavior on historical and stress-period data** — the adaptive arm measured against the fixed-basket and benchmark alternatives (§4 arms) across pre-registered windows (§3), with all eight mandated metric families reported (§5) per window and per arm.
3. **Failure honesty** — data-failure incidence (oracle outages, fallback usage, missing rows, publication suspensions) is counted and published, not silently absorbed (§5 metric 7; §3.5).
4. **Parameter robustness** — sensitivity of every reported metric to the UNAPPROVED parameter set, reported as deltas; no "best" configuration declared on calibration data (§5 metric 8).
5. **Reproducibility** — fixed seeds, disclosed windows/vintages, recorded commands and environments; deterministic layers re-run byte-identically; environmental limits recorded as UNVERIFIED, never PASS.
6. **Absence of leakage** — all time-based splits honored, thresholds pre-registered before results are seen (§2.3, §7.1).

### 1.2 What validation can NEVER demonstrate (hard boundary)

- No simulation, backtest, or scenario run **can prove future market-price stability** — the reference index is a published statistic, not a mechanism connecting it to any market price (`claims-and-honest-status.md` §B; Stage A stub anchoring rule; `economic-model-options.md` §5 preamble).
- No run under this plan converts a draft parameter into an approved one; every parameter touched by validation remains UNAPPROVED until its owner decision closes (mandate §2 rule 8).
- No result advances any gate other than by feeding Gate J evidence (reference-index §7 discipline); tests, documentation, typecheck, and lint never advance gates (Task 10 D8 / Task 11 D9 / Task 12 D10 standing rule).
- No result can certify security or authorization: the compromised-key authority estate (Task 12 carry) blocks any on-chain use regardless of validation outcomes.
- No validation claim is honest while oracle legs remain single-live-upstream with synthetic witnesses (D-13.16 precondition, §11).

### 1.3 Evidence & source references (inputs this plan is built from)

| Input | Use here | Status |
|---|---|---|
| `reference-index-and-gold-methodology.md` §7 (benchmark-comparison plan, "PLANNED — NOT RUN"), §8 (IDX-* tests), §12 (draft parameters) | §4 arms, §5 metric conventions, §7 tolerances — cross-referenced, not duplicated | PROPOSED (sibling draft) |
| `currency-constituency-and-weight-transition-spec.md` §10 (CCY-*/HYS/SCORE/SUM/BOUND/VEL/EXCL/SEP/EMER/ANN/DET families), §13 (UNAPPROVED DRAFT PARAMETERS) | §6 scenario families, §5 turnover/concentration inputs | PROPOSED (sibling draft) |
| `economic-model-options.md` D9 per model (§5–§8) | §6/§9 per-model evidence requirements that Stage J must serve for whichever model the owner selects | PROPOSED (sibling draft) |
| `baseline-and-change-matrix.md` §5 Stage J row | scope anchor: "no leakage-controlled split, no purchasing-power benchmark, no train/val/test discipline, no sensitivity suite" today | DEVELOPER-REPORTED |
| `test-matrix-and-results.md` §1–§3 (2026-10-22 records) | §8 current test-suite state | VERIFIED (this session's records) |
| `unresolved-decisions-and-owner-approvals.md` §A D-13.5 | objective ⇒ benchmark set + tracking-error metric | OPEN decision |
| `test-matrix-and-results.md` §3 (17 mandated Stage K families) | §6.2 VAL-* families are additive to that coverage plan | VERIFIED (record) |
| `claims-and-honest-status.md` §B | prohibited-claim boundary for any future result narrative | VERIFIED (record) |
| Code facts re-read this session: `blueprint.ts:22-30` (STRATEGIC_PRIOR 27/20/9/8/5/5/26), `:248` (MAX_DAILY_TURNOVER = 0.05), `historical-backtest.ts:115-130` (FRED VIXCLS/DTWEXBGS/GOLDAMGBD228NLBM/DGS10 + Frankfurter, 2015–2025, genesis RR 1.10), `canonical-invariants.ts:150-155` (S5/S6/S3 fixed seeds), `:1554-1556` (scenario selection), `:1865-2349` (Layer-8 assertion sites), `stress-rerun.ts:1-23` (11 fixed-seed §23 scenarios) | §3, §5, §6, §8 | VERIFIED |

### 1.4 Division of labor with sibling documents (this plan extends, never duplicates)

| Sibling deliverable | Owns | This plan adds |
|---|---|---|
| 4 (currency constituency spec) | lifecycle, scoring, transition rules; Stage K families CCY-* | execution-grade validation design over those semantics (windows, arms, metrics, scenarios, acceptance) |
| 5 (reference-index & gold methodology) | index math, continuity proof, publication surface; IDX-* tests; the §7 benchmark-comparison PLAN | the executable expansion of that plan: independence, data onboarding, metric definitions, VAL-* families, pre-registered acceptance |
| 10 (oracle & emergency spec) | feed states, LKG/emergency semantics; D-13.15/D-13.16 | oracle-failure and emergency scenario families (VAL-ORAC, VAL-EMER) and the independence precondition for metrics |
| 13 (test matrix) | the run records | every Stage J run records its commands and results there (§2 of that file); this plan's §8 cites its 2026-10-22 records |
| 3 / economic-model-options (Stage B) | which model exists at all (D-13.3..D-13.7); per-model D9 evidence lists | the model-agnostic validation machinery; the selected model's D9 list maps onto §5–§7 rows at execution time |

## 2. Independence requirements (PROPOSED)

### 2.1 Personnel independence — new decision D-13.26

- Validators executing Stage J runs must **not be the methodology designers**: no author of deliverables 3–10 (or of the v2.0/MITHQAL-era model text) may run, adjudicate, or sign off the validation whose design content they drafted. Commissioning follows the CKPT-9 pattern (carried Task 12: independent reviewer commissioned before any "contained"-class language) extended to quantitative validation. **OPEN — D-13.26 (new; ID allocation per the orchestrator's decision-ID map).**
- Conflict-of-interest disclosure file per validator (prior work on the model, financial exposure to basket constituents, vendor relationships) — PROPOSED artifact class, fail-visible if absent.
- Adjudication of assertion-vs-code conflicts (e.g., the six §8.2 failures) is a joint validator + owner act, never a designer's unilateral edit.

### 2.2 Evidence-class rules for validation artifacts

- Every artifact row records: command (verbatim), exit code, seed(s), window, data vintage labels, code commit/tree hash, environment notes, and an evidence status. `SIMULATED` (synthetic data) and historical-data results are never mixed in one table row without labels.
- Deterministic layers must reproduce byte-identically across two independent executions before being cited; the sandbox's execution limits are recorded as **UNVERIFIED, never PASS** (standing rule; `test-matrix-and-results.md` §2 precedent).
- **Chunked-execution fidelity rule:** any result produced by chunked/isolated execution (e.g., the Layer 7 S3 trajectory-chunked exact-cover merge) must either demonstrate equivalence to the single-process form on a bounded case, or be labeled a distinct execution mode with its own reproduction record. Chunk boundaries may never change assertion content.
- No live vendor call is permitted inside any test or scenario (Stage K precondition, currency spec §10(ii)); vendor access is confined to data-onboarding steps with logged vintages.
- Raw outputs are archived (hash-chained, append-only) before interpretation; negative and null results are published with the same prominence as favorable ones.

### 2.3 Leakage-controlled protocol

- **Splits are by TIME only.** Train / validation / test windows are contiguous, non-overlapping, ordered periods. Shuffled or random splits are prohibited (they destroy the temporal structure that the leakage risk lives in). Walk-forward / purged-CV design is the reference form (documented NOT RUN today — `honest-status.ts` D-validation, cited in reference-index §1).
- **No parameter tuning on test windows.** Test windows are touched exactly once per pre-registered configuration; any test-window-informed change requires a fresh, disclosed pre-registration and a re-run on untouched windows.
- **Disclosed data windows and vintages.** Every series carries source, series ID, first/last usable date, publication-lag convention, and revision policy (§3.4). CPI-style inputs are keyed by **publication date**, never reference date (lookahead prohibition; reference-index §5 lag-alignment rule).
- **Fixed seeds pre-registered.** New stochastic scenarios declare seeds before running (existing precedents: S5=5000, S6=6000, S3=3000 — `canonical-invariants.ts:150-155`, VERIFIED).
- **Pre-registered acceptance thresholds BEFORE runs** (§7.1): every threshold in §7 is an UNAPPROVED DRAFT mapped to a decision ID; the threshold values must be ratified (D-13.25) before any comparison run whose outcome they will grade. Threshold drafts map to D-13.5 (objective/tracking), D-13.13 (GPP/benchmark inclusion), D-13.14 (tolerances/rounding/quantities they constrain).

## 3. Data plan (all selections CANDIDATE — nothing onboarded, nothing run)

### 3.1 Historical windows (CANDIDATES, to be pre-registered under D-13.25)

| Window | Purpose | Feasibility notes (status) |
|---|---|---|
| Full-history armature, candidate 1999–2025 | longest common coverage for FX legs (Frankfurter serves ECB reference rates from 1999) | coverage must be re-verified per leg at onboarding; UNVERIFIED until onboarding (PROPOSED) |
| Existing 10-year harness window 2015–2025 | continuity with the existing backtest harness | `historical-backtest.ts:121-122` (data_version `fred+frankfurter-2015-2025`) — VERIFIED as the harness's window; the harness itself is DEVELOPER-REPORTED for the OLD fixed-7 family and must NOT be reused as evidence for a registry-era model (per `economic-model-options.md` D9) |
| Rolling 3y and 5y sub-windows (count TBD) | regime diversity; window-chopping stability of every §5 metric | PROPOSED; window boundaries pre-registered |
| Train / validation / test segmentation (ratios TBD) | leakage control (§2.3) | PROPOSED; boundaries pre-registered before any run |

Per-leg candidate coverage (feasibility screen — **TO VERIFY at onboarding**; no dataset has been pulled for any window):

| Leg / series | Candidate coverage | Constraint |
|---|---|---|
| FX via Frankfurter (ECB ref rates) | from 1999 (candidate) | single family; independence unmet (§3.3) |
| FRED `DTWEXBGS` (broad USD index) | from 2006 (candidate) | pre-2006 windows cannot use this arm |
| FRED `GOLDAMGBD228NLBM` (London AM fix) | historical, **discontinued 2024** (`fred.ts:36`, VERIFIED citation in reference-index §1) | post-2024 gold history depends on the `GC=F` proxy with UNDOCUMENTED basis |
| Yahoo `GC=F` (futures proxy) | active fallback | roll convention + futures-vs-spot basis must be documented before validation use |
| FRED `VIXCLS`, `DGS10` | long (candidates) | auxiliary regime/context series in the existing harness |
| CPI candidates (BLS/Eurostat/ONS/NBS/BFS/IFS/MEI) | varies by source | monthly legs need per-source publication calendars at onboarding (reference-index §5) |

### 3.2 Stress-period windows (CANDIDATE selections — labeled, not run)

| Candidate stress window | Stress type it represents | Notes |
|---|---|---|
| 2008-09 (GFC) | broad FX + gold + volatility crisis | coverage subject to per-leg availability; PROPOSED |
| 2015-01 (SNB CHF floor abandonment) | single-currency discontinuity; CHF is a 5% basket leg | PROPOSED |
| 2015-08 (CNY devaluation) | managed-currency step; capital-control episode adjacent | PROPOSED |
| 2020-03 (COVID liquidity shock) | correlated cross-asset stress; VIXCLS spike in harness data | PROPOSED |
| 2022 FX/gold stress (Fed hiking cycle, USD surge, JPY weakness, RUB convertibility loss) | sustained dollar trend + gold drawdown + sanctions episode | PROPOSED |

Additional mandated-but-unscheduled families from the Stage A stub: correlated currency shocks, gold shocks, capital-control episodes, missing data, outliers, data revisions, extreme conditions — each becomes a VAL-* scenario family (§6.2) and/or a window selection under the same pre-registration rule. **Final window selection is an owner-ratified act (D-13.25); the list above is candidate input to that ratification, not a selection.**

### 3.3 Provenance & licensing (per reference-index §4/§5 and the Stage A stub; statuses there)

- **FX:** Frankfurter (ECB reference rates) — single family; the ≥2-independent-families requirement is NOT MET today (single live upstream per pair + synthetic witnesses — `oracle-feeds.ts:942`, VERIFIED citation in reference-index §1); independence remediation is deliverable 10 / D-13.16 and is a **precondition** for honest data-failure and disagreement metrics.
- **Gold:** live family gold-api.com XAU spot; metalpriceapi **demo-key fallback must be removed** from any approved configuration; history = FRED `GOLDAMGBD228NLBM` (London AM fix, **discontinued 2024**) → Yahoo `GC=F` front-month futures proxy (roll convention and futures-vs-spot basis UNDOCUMENTED — must be documented before any validation use); constant-2,500 terminal default may appear only as an explicitly DEGRADED-published state.
- **Benchmark/macro:** FRED `DTWEXBGS` (broad USD index), `VIXCLS`, `DGS10` (all in the existing harness — `historical-backtest.ts:122`, VERIFIED). CPI candidates per reference-index §5: US BLS CPI-U, Eurostat HICP, Japan national CPI, UK ONS, China NBS, Switzerland BFS; aggregates IMF IFS / OECD MEI (annual World Bank series not suitable for a monthly leg).
- **Scoring inputs (constituency dimension data):** BIS Triennial Survey (3-year cycle, stale-by-design between surveys), IMF AREAER (annual), sanctions-screening provider, plus protocol-internal oracle-ledger data-quality metrics (tier-3, never a market-relevance input) — per currency spec §4.1; none of these ingestion paths exist in the codebase (NOT IMPLEMENTED, DEVELOPER-REPORTED via currency spec §15).
- **Licensing:** each onboarding records license/redistribution terms per source (Frankfurter/ECB, FRED, Yahoo, gold vendors, BIS, IMF, AREAER) — a licensing dossier is a Stage J onboarding artifact (PROPOSED); no dataset is used in any published comparison before its terms are recorded.

### 3.4 Revision policy & vintage discipline

- The index publication ledger is append-only with no silent revisions (reference-index §2.3; IDX-REV-1) — validation consumes the same discipline: a corrected historical value is a new record, and backtests state which vintage they consumed.
- Per-source revision behavior documented at onboarding: FX reference rates effectively unrevised; CPI headline rarely revised but subject to **rebasing events** (methodology events, not data patches); gold fix series frozen by construction.
- **Point-in-time (as-first-published) data is the default requirement** for any input with a publication lag; where the source offers vintage archives (e.g., FRED/ALFRED-style vintage access for CPI/USD-index series — CANDIDATE mechanism, PROPOSED), vintages are pinned per window; where unavailable, the publication-lag carry rule of reference-index §5 is applied and the affected rows are labeled lower-confidence.

### 3.5 Missing-data injection tests (VAL-DATA, PLANNED — none exist)

- Synthetic gaps injected per leg at onboarding-test time: missing tick, missing day, missing CPI month, feed-stale-beyond-bound, vendor retraction, outlier spike, and boundary-day gaps; assert the fail-visible rules (carry-forward ≤2 cycles with staleness flag for CPI-type legs; missing share disclosed; **no silent interpolation anywhere**).
- Assert that every injected failure surfaces in the data-failure metric (§5 metric 7) and in the publication record's freshness/confidence fields — a gap that does not count is a test failure.
- Gold ladder specifically: FRED-fix → `GC=F` proxy → constant-2,500 transitions each publish their source label (existing loader labels `goldSource` — VERIFIED citation, reference-index §1) and the DEGRADED state is published, never silently passed through.

## 4. Benchmark arms (cross-reference — not duplicated here)

The arm set is **reference-index §7** (PROPOSED there; mapped to D-13.5): (1) the v3.0 adaptive basket (registry + MASE per deliverables 4/5); (2) the **fixed-basket baseline** — static 7-component Strategic Prior 27/20/9/8/5/5/26 (`blueprint.ts:22-30`, VERIFIED this session; gold-inclusive by construction, which also satisfies the stub's "gold-inclusive static basket" arm); (3) a broad **USD index** (FRED `DTWEXBGS` — the stub's "relevant single-currency benchmark" as specified in reference-index §7); (4) an **EUR-hedged** basket variant; (5) **gold (XAU)**; (6) a **CPI purchasing-power benchmark** (only if D-13.5/D-13.13 adopt one); (7) **USD cash**. Rules adopted unchanged from reference-index §7: the static-7 baseline is mandatory (never a cherry-picked alternative); no arm is selected on calibration data; every result row carries window, data vintage, and evidence status. If the owner's D-13.5 objective implies a different anchor, the arm set is re-opened — mapped to D-13.5, never silently edited here.

## 5. Metrics — the eight mandated families (definitions = reference-index §7 conventions, extended)

All metrics are computed **per arm, per window, per vintage**, and reported as tables with evidence status; computing any of them is NOT RUN. Cadence convention: daily close-of-record levels (reference-index §2.3 draft), annualization factor declared per cadence (DRAFT, D-13.5-adjacent).

| # | Metric | Definition / formula (draft convention) | Reporting requirement |
|---|---|---|---|
| 1 | Performance | cumulative chain-linked return `R = I_T / I_0 − 1` of the arm's level path; plus the distribution of period returns (median, tails) | per window; never annualized-only; no ranking headline without the full matrix (anti-cherry-pick rule) |
| 2 | Volatility | annualized stdev of period returns, `σ_ann = stdev(r_t) · √A`; downside deviation reported alongside | per window; state A and cadence; report both full-period and stress-window values |
| 3 | Drawdowns | `MDD = max_t (1 − I_t / max_{s≤t} I_s)`; plus drawdown duration, recovery time, top-5 episodes | per window; the §7 draft acceptance form compares adaptive MDD vs benchmark arms with threshold TBD (UNAPPROVED) |
| 4 | Tracking behavior | vs the **declared objective** (D-13.5 — undefined until decided): tracking error `TE = √(mean((r_arm − r_obj)²)) · √A` plus mean signed deviation (bias); per objective definition the objective series is the USD-constant path, a defined basket path, or a GPP aggregate (D-13.13) | **not computable until D-13.5 closes** — reported as BLOCKED, never with a stand-in objective; per-window and full-period |
| 5 | Turnover | (a) weight turnover `Σ_i \|w_{i,t} − w_{i,t−1}\|` per rebalance period, summed per window; (b) realized execution turnover vs the existing 5%-of-NAV daily cap (`MAX_DAILY_TURNOVER = 0.05`, `blueprint.ts:248`, VERIFIED — cited as code fact, unapproved as policy); (c) glide-induced turnover (T3/T5/T6 ramps) reported separately | include estimated transaction costs using an explicit, versioned cost model (existing pilot cost input REBALANCE_FEE_BPS 20 is a cited code fact, not an approved cost); turnover per component and aggregate |
| 6 | Concentration | `HHI_t = Σ_i w_{i,t}²` at every commit; max single weight; top-3 share | full time series per arm; violations vs draft caps (w_cap 35%, HHI_max 0.35 — UNAPPROVED DRAFT, currency spec §13/D-13.14) are reported as breaches, not assumed prevented |
| 7 | Data failures | per-leg counts and durations of DEGRADED/STALE/HALTED/FAILED oracle states; missing CPI rows per reference-index §5; gold-source fallback usage (GC=F days, DEGRADED-constant days); oracle disagreement events; publication-suspension events | per arm, per window; cross-checked against the VAL-DATA injections (§3.5); zero-unexplained-gap requirement |
| 8 | Parameter sensitivity | re-run grid over the UNAPPROVED parameter set — θ_in/θ_out/H, T_obs/T_watch/T_ann windows, γ_k scoring weights, ρ smoothing, T_cap, Δ_i velocity classes, envelopes, N_max, ω_h/λ/λ_CVaR/η (MASE), rounding conventions (D-13.14) — reporting Δmetric per Δparameter as an elasticity table | **no "best" is declared on calibration data**; ranking stability across windows is reported as a finding, never as an optimality claim; grid itself pre-registered (D-13.25) |

Computation conventions (DRAFT — all map to open decisions; none applied yet):

- Cadence and annualization factor A are declared once per run set and never changed mid-report (D-13.5-adjacent); reported metrics themselves are rounded only at publication per the D-13.14 rule (never before divisor/return math).
- Costs and fees: any turnover-cost estimate uses an explicit versioned cost model; the pilot's REBALANCE_FEE_BPS 20 and the fee ladder are cited code facts, not approved economics, and are labeled as such in every table that uses them.
- `SIMULATED` (synthetic-path) results and historical-data results are reported in separate tables; no blended row is permitted.
- Every metric value carries window, vintage, arm, seed (if stochastic), and evidence status; a missing cell is printed as NOT RUN, never omitted.

### 5.1 Per-model evidence mapping (from `economic-model-options.md` D9 — for whichever model the owner selects)

- Model 1 / Model 4 D9 lists map onto this plan as: index-methodology reproduction + continuity suite (§1.1(1), §6.2 VAL-COMP), oracle multi-source remediation evidence (D-13.16 precondition), reference-vs-market deviation-reporting harness (noted NOT IMPLEMENTED — no market-price feed exists; Stage K family), shadow-mode supply-policy simulation on historical data (feeds D-13.6 evidence), and the explicit rule that **no test can claim price alignment** — the honest test is that the system never claims it.
- Model 2 / Model 3 D9 lists additionally require tracking-error backtests under tolerance rules, hedge/redemption-flow simulations under historical crises, and enforceability/capital-plan evidence from qualified parties — those live with counsel/finance owners; this plan supplies only the quantitative harness rows (§5 metrics 1–8, §6 scenarios) they would consume.
- This mapping is PROPOSED bookkeeping, not a selection among models (all of D-13.3..D-13.7 remain OPEN).

## 6. Scenario & stress validation (PLANNED families; none exist)

### 6.1 Existing fixed-seed stochastic assets (cross-referenced — re-run status NOT asserted here)

- **Canonical Layer 7** (`canonical-invariants.ts:17`, `:150-155`, `:1569-1758` — VERIFIED this session): S5 gold +50% shock (seed 5000, 100 runs × 30 ticks), S6 gold −30% shock (seed 6000, 100 runs), S3 Cauchy fat-tailed shock (seed 3000, 200 runs). **Layer 7 is being re-run this cycle in chunked isolation (S5/S6 single-process; S3 trajectory-chunked with exact-cover merge): see `test-matrix-and-results.md` §2 (2026-10-22 chunked-execution record) for the orchestrator's results — this document does not assert their values.**
- **11-scenario §23 stress suite** (`stress-rerun.ts:1-23`, VERIFIED this session): fixed per-scenario seeds, synthetic-2025-09-08 data, genesis RR 1.10, survival defined as RR ≥ 1.00 at all ticks.
- **Honest limitation (both assets):** these suites exercise the **reserve-era V3-corrected engine** (7-component Strategic Prior, RR-based survival semantics). Under a no-reserve v3.0 model their survival definitions do not transfer; their value here is regression continuity and harness reuse, not v3.0 evidence. Re-scoping them to v3.0 semantics is part of the Stage-K rewrite (§8.3) — PROPOSED.

### 6.2 New v3.0-specific scenario families (VAL-*; PLANNED — NOT IMPLEMENTED; extend the IDX-*/CCY-* framework)

| Family | Content (synthetic, fixed seeds, no live vendor calls) | Joints |
|---|---|---|
| VAL-COMP (composition-change windows) | entry ramps (T3), retirement glides (T5/T6), re-entry (T9), mid-glide interruption; stressed synthetic price paths across boundaries; assert zero artificial return at every boundary and correct post-boundary flow-through | IDX-CONT-1..3, CCY-LC-*/CCY-HYS-1; **blocked until the Stage C registry lands** |
| VAL-ORAC (oracle-failure windows) | per-leg STALE/HALTED/FAILED, two-family disagreement, gold ladder transitions, CPI missing-month carry; assert index never advances on a non-VALID leg; freeze/LKG/pause behavior per deliverable 10 | IDX-GOLD-1, D-13.15/D-13.16 (deliverable 10 owns the semantics) |
| VAL-EMER (emergency suspension windows) | T7/T8 under simulated 2-of-3 emergency quorum; frozen-weight vs accelerated-glide vs immediate-removal alternatives (currency spec §5.6); index continuity across the emergency boundary | CCY-EMER-1, joint IDX-CONT-*; every boundary emits a divisor record |
| VAL-DATA | §3.5 missing-data/outlier/revision injections end-to-end through publication records | IDX-REV-1, data-failure metric (§5 #7) |
| VAL-SENS | parameter-grid runs feeding §5 metric 8 (elasticity tables) | D-13.14/D-13.25 |
| VAL-MULTI | correlated shocks (multiple legs simultaneously; capital-control episode with CNY/CNH basis blowout; gold+volatility co-stress) | extends the single-shock S5/S6 form |
| VAL-TRK | tracking-behavior scenarios vs the declared objective once D-13.5 closes (incl. objective-series construction lags) | §5 metric 4; BLOCKED until D-13.5 |
| VAL-REPRO | reproduction protocol checks: two-run byte-identity (deterministic layers), chunk-merge fidelity demonstrations (§2.2), environment-limit labeling | §2.2; feeds no economic conclusion |

Common rules for every VAL-* family (PROPOSED):

- Deterministic PRNG with per-family seeds declared before running (§2.3); no seed is changed after any result is seen.
- No live vendor call inside any scenario (Stage K precondition, currency spec §10(ii)); all inputs are tier-labeled synthetic series or pre-archived vintages.
- Path counts, tick counts, and grid shapes per family are part of the D-13.25 pre-registration record (values TBD — deliberately absent here).
- Every scenario run retains: input series, seed, code tree hash, log, and summary artifact (append-only); negative results are published with the same schema as favorable ones.
- Scenario outcomes are labeled by data class (`SIMULATED` always, for synthetic paths) and may never be aggregated into a historical-window table row.

All VAL-* families are required as **evidence inputs to Gate J**, are additional to (not replacements for) the Stage K acceptance families, and none exist today (NOT IMPLEMENTED).

## 7. Acceptance criteria (UNAPPROVED draft thresholds — symbolic only)

### 7.1 Pre-registration rule (new decision D-13.25)

Acceptance thresholds, window lists, seeds, and metric definitions are **ratified by the owner BEFORE the runs whose outcomes they grade** (D-13.25). No number in §7.2 is a threshold: every value is TBD and UNAPPROVED. Any threshold changed after results are seen voids the affected results and requires a fresh pre-registration plus a re-run on untouched windows. This rule exists because post-hoc threshold setting is the single easiest way to manufacture a validation verdict (§10).

### 7.2 Draft acceptance table (every row UNAPPROVED; decision mapping explicit)

| Criterion (symbolic) | Draft form | Threshold | Decision |
|---|---|---|---|
| Boundary continuity (mechanical) | `\|ΔI\|` at every commit ≤ declared tolerance; on-chain 0 wei | tolerance draft 1e-12 relative (reference-index §12) — **UNAPPROVED** | D-13.14; mechanical, gate-relevant regardless of performance |
| Sum / bounds / velocity (mechanical) | exact bp-sum; envelopes + aggregate caps + velocity at every commit and glide intermediate | exact (DRAFT tightening from ±1e14) | D-13.14; joint CCY-SUM/BOUND/VEL |
| Exclusion-zero (mechanical) | excluded component weight = exactly 0 after T6/T7-exit | exact 0 | D-13.11/D-13.14 (blocked until Stage C) |
| Maximum drawdown | adaptive-arm MDD ≤ benchmark-arm MDD (which arm(s) TBD) | **TBD — UNAPPROVED** | D-13.5 (arm set) + D-13.25 (value) |
| Tracking error | `TE ≤ TBD` (annualized) vs the declared objective; mean bias ≤ TBD | **TBD — UNAPPROVED; not computable until D-13.5 closes** | D-13.5 + D-13.25 |
| Turnover | cumulative weight turnover ≤ TBD per window; execution turnover within the existing 5%-NAV daily cap (cap itself a code fact, not approved policy) | **TBD — UNAPPROVED** (T_cap draft 2.0%/period is a D-13.14 draft) | D-13.14 + D-13.25 |
| Concentration | HHI ≤ HHI_max (draft 0.35); max weight ≤ w_cap (draft 35%) | drafts UNAPPROVED — reported as breach counts either way | D-13.14 |
| Data failures | publication-suspension share of closes ≤ TBD; zero unexplained gaps (hard) | **TBD — UNAPPROVED**; the zero-unexplained-gap requirement is structural | D-13.25 + D-13.16 (independence precondition) |
| Sensitivity stability | §5 metric 8 ranking stability across windows ≥ TBD | **TBD — UNAPPROVED**; no optimality claim attaches at any value | D-13.25 |
| Reproducibility (mechanical) | two independent re-runs byte-identical (deterministic layers); chunk merges proven faithful | exact | §2.2; environmental failure ⇒ UNVERIFIED, never PASS |
| Existing Layer 7 internal assertions | the suite's own fixed thresholds (e.g., S5 survival 100%, S6 ≥ 95%, S3 > legacy 35.1%) are **code facts about the reserve-era suite**, not v3.0 acceptance criteria | n/a — cited as facts only; current re-run status: see test-matrix §2 | Stage-K rewrite scopes their successor (§8.3) |

### 7.3 What acceptance would mean — and would not mean

Even if every §7.2 row were later met on pre-registered windows, that outcome would mean only: **the pre-registered criteria were satisfied on the pre-registered data** — a bounded, dated, evidence-classed statement about the tested windows. It would not mean the model is optimal (no such claim is reachable by this program — §5 metric 8 forbids it), manipulation-resistant (scenario coverage is finite and non-representative by nature — §10 item 9), or a guarantee of future behavior (§1.2). Acceptance language at Gate J is drafted by the owner, not by this plan; this plan's obligation is that no acceptance criterion is computable by accident, and no criterion is movable after the fact (D-13.25).

## 8. Current test-suite state (fresh 2026-10-22 record — VERIFIED, per `test-matrix-and-results.md`)

### 8.1 Canonical-invariants isolation-mode execution

The canonical-invariants suite was executed in isolation mode this cycle, after harness changes authorized by the mandate (**selection-only** — the suite's scenario-selection flag `all|s5|s6|s3`, `canonical-invariants.ts:1554-1556`, VERIFIED; **assertions byte-identical**). Results (VERIFIED; command/result record in `test-matrix-and-results.md` §1–§2, 2026-10-22):

- **Layers 1–6 (deterministic layers): PASS — 131/131.**
- **Layer 8 (audit-fix suite): 85/91 — SIX documented assertion-vs-code failures**; deterministic and order-independent (reproduced both in the layers 1-6+8 run and in a Layer-8-only run; exit code 1 both times).
- **Suite verdict on this tree: FAIL (6 of 243 assertions).** No gate may be called PASS from an earlier task's record — Task 12's "canonical-invariants exit 0" is a record about a different execution context and is not citable as a current green baseline.
- **Layer 7:** re-run in chunked isolation this cycle (S5/S6 single-process; S3 trajectory-chunked with exact-cover merge) — **see test-matrix §2 (2026-10-22 chunked-execution record)**; this document asserts no values for it.

### 8.2 The six Layer-8 assertion-vs-code failures (names verbatim from the suite; sites re-read this session — VERIFIED)

| # | Failure (assertion name) | Assertion expectation | Observed code behavior | Site |
|---|---|---|---|---|
| 1 | C.1 no-trade-band strict-boundary expectation | band boundary is strict: `inNoTradeZone(0.0075) === false` (θ itself out of zone) | code treats θ = 0.0075 as in-zone | `canonical-invariants.ts:1870-1872` |
| 2 | C.3 partial-correction trade-size formula | `tradeUsd ≈ β × 0.6%×NAV = 0.50 × $6,000 = $3,000` (residual-based partial correction) | code computes tradeUsd = 5160 | `:1929` |
| 3 | RG-10 ε-boundary on small positive nets | net ≈ +$5 (positive but ≤ ε $10) ⇒ pass = false (no-trade) | the active path reasons with the unified §12.8 gate instead | `:1962` |
| 4 | RG-10 bare→0 form expectation | the unified rule (net > ε), not the bare `> 0` form, governs | active-path form differs from the asserted mirror | `:1954`, `:2117` |
| 5 | RG-10 rejection-reason citation | rejection reason must cite the unified §10.8/§12.8 gate (one rule, one ε, every route) | cited reason differs | `:2120` |
| 6 | §21.5.3 in-band decay de-escalation timing | in-band decay 2×dtHours (30h → 10h) → stage 0 → IMMEDIATE de-escalation | de-escalation timing differs in code | `:2349` |

### 8.3 Interpretation and the Stage-K rewrite PRECONDITION

Per the Stage A honest-status disclosure, these six are a family of **STALE Layer-8 assertions encoding superseded parameterization/spec text**; they are queued for the Stage-K rewrite. The rewrite must adjudicate each failure **assertion-vs-code** (fix the assertion where the spec superseded it; fix the code and open an incident where the code is wrong) — and it is a **PRECONDITION for treating the canonical suite as a green baseline** for any Stage J validation run: a suite with known-failing assertions cannot serve as the mechanical-integrity layer of §1.1(1). Until then, the suite's verdict on this tree is FAIL and every derived claim must say so.

### 8.4 Environmental UNVERIFIED items (standing)

- **Foundry suites** (V2: 30 tests; V3 LIQ-MGMT: 14): UNVERIFIABLE in this sandbox — no `forge` toolchain (`test-matrix-and-results.md` §1 row 10); never reported as PASS without a runner.
- **CI-runner execution:** UNVERIFIED — no git remote exists (OWNER-ATT-1 carry); identical commands have only ever run locally.
- **Worktree secret gate:** standing truthful RED — one finding (`upload/private_key.txt`, incident T13-INC-001) pending owner disposition D-13.1; unrelated to validation but part of the honest environment record.
- **Sandbox execution ceiling** (~600 s tool window) is the documented cause of the earlier three-attempt UNVERIFIED canonical run (`test-matrix-and-results.md` §2) and motivates the chunked-execution discipline of §2.2.

## 9. Security & economic implications

- **Security:** Stage J runs only in the shadow-mode sandbox; no on-chain action, no key handling, no vendor credentials in artifacts (FRED_API_KEY and similar remain env-name-only). Validation code must not weaken the secret-scan/release-control gates (no new allowlist entries without documentation). The compromised-key authority estate (Task 12 carry) means even a fully green Gate J changes no deployment fact. Divisor-path control (whoever commits weights controls `G_t`) remains the economic-security choke point; validation quantifies transition behavior but does not mitigate governance capture (currency spec §11 risk 1).
- **Economic:** validation outputs feed Gate J acceptance only; they are not marketing material, and cherry-picking a favorable window/arm/metric for publication would be a claims-register violation (§B). The eight-metric report is designed to make suppression visible (every arm/window row must exist or be listed as not-run). No result under this plan constitutes a promise about market price, redemption, or backing; sensitivity findings may equally justify rejecting the adaptive model — a negative result is a success of the program, not a failure of it.
- **Evidence-integrity:** the validation harness must consume the same committed weight vectors and index paths the live reference layer would publish (no parallel re-implementation that silently diverges); any divergence between harness math and `chain-index.ts` is itself a finding. Results produced on a machine that cannot complete the deterministic suites (sandbox ceilings) are UNVERIFIED and may not be cited at Gate J.
- **Publication discipline:** raw validation artifacts are internal evidence until the owner releases them; selective pre-release of favorable rows (e.g., to counterparties or in marketing drafts) is prohibited by the claims register and by mandate §11's never-claim-unverified rule.

## 10. Risks of the validation program itself (none claimed mitigated)

1. **Overfitting** — the adaptive model tuned (deliberately or accidentally) to the historical windows; controlled only by the §2.3 split discipline and by never declaring a best on calibration data.
2. **Data-snooping / multiple comparisons** — many arms × windows × metrics produce spurious "winners"; control: full-matrix publication, no single-metric headlines, pre-registered primary metrics.
3. **Benchmark selection bias** — an arm set chosen to flatter the adaptive model; control: the mandatory static-7 baseline (reference-index §10 risk 6) and D-13.5-mapped arm ratification.
4. **Survivorship in vendor data** — series that exist today survived (e.g., the FRED gold fix was discontinued in 2024; currency universes change); control: point-in-time universes and vintage pinning (§3.4), with residual risk stated.
5. **Lookahead / vintage contamination** — CPI reference-month timestamps and undocumented GC=F roll conventions can inject future information; control: publication-date keying (§3.4); residual risk until per-source calendars are documented at onboarding.
6. **Synthetic-witness laundering** — validating "multi-source agreement" that is actually one live upstream plus synthetic witnesses; control: D-13.16 independence precondition; any disagreement metric computed pre-remediation is labeled non-evidentiary.
7. **Stale-assertion debt** — the six §8.2 failures demonstrate that a suite can go stale while its subject moves; control: the Stage-K rewrite precondition (§8.3) and assertion-vs-code adjudication; residual risk remains and is stated.
8. **Harness artifacts** — chunked execution and selection modes changing results vs the single-process form; control: §2.2 fidelity rule and VAL-REPRO.
9. **Scenario non-representativeness** — fixed-seed synthetic scenarios and past stress windows cannot bound future behavior; stated, not solved.
10. **Threshold gaming** — post-hoc acceptance thresholds; control: D-13.25 pre-registration with voiding consequences.

## 11. Owner approvals required (all OPEN — none may be inferred from this document)

- [ ] **D-13.5** — stability objective (drives the §4 benchmark set, the §5 tracking metric, and whether several §7 rows are even computable) — Gate B.
- [ ] **D-13.13** — GPP inclusion (determines whether a CPI benchmark arm / GPP objective series exists) — Gate B/C.
- [ ] **D-13.14** — rounding/precision/tolerances (continuity tolerance, weight quantum, sum rule; draft caps w_cap/HHI_max; T_cap; Δ_i) — Gate C.
- [ ] **D-13.16** — oracle source independence (precondition for honest data-failure/disagreement metrics and for any validation claim) — deliverable 10 / Gate I-adjacent.
- [ ] **D-13.25 (NEW)** — threshold pre-registration protocol: ratify acceptance thresholds (all TBD values of §7.2), window lists (§3), seeds, and primary metrics BEFORE any graded run; post-hoc changes void affected results.
- [ ] **D-13.26 (NEW)** — validator independence & commissioning (CKPT-9-style): validators must not be methodology designers; conflict disclosures; adjudication protocol for assertion-vs-code conflicts.
- Cross-gated preconditions (not opened here): **D-13.11** (basket size — VAL-COMP/IDX-CONT-3 blocked without it), **D-13.12** (gold disposition — gold arm definition), **D-13.15** (LKG divergence — VAL-ORAC semantics), **D-13.1** (worktree secret gate disposition), the Task 12 authority chain before any on-chain validation artifact, and the Stage-K Layer-8 rewrite (§8.3) before any green-baseline citation.

## 12. What has NOT been tested / implemented (explicit — the plan exists; zero runs)

NOT RUN under this plan: everything — no validation window (historical or stress) has been evaluated; no arm comparison, no metric of §5, no VAL-* scenario, no leakage-controlled split, no sensitivity grid, no reproduction check. NOT IMPLEMENTED: the validation pipeline itself (leakage-controlled walk-forward harness, purchasing-power benchmark dataset, sensitivity suite, data-onboarding with vintage archives, licensing dossier, validator commissioning, threshold registry) — none exists in the codebase (baseline §5 Stage J row: DEVELOPER-REPORTED gap). KNOWN-STALE: the Monte-Carlo suite is built on the retired 5-currency v1.2 economics (`monte-carlo.ts:6` — Stage A stub record) and must be rebuilt for any v3.0 use; the six Layer-8 assertions (§8.2) await the Stage-K rewrite; the Layer-7 chunked re-run is recorded by the orchestrator (test-matrix §2) and no value is asserted here. UNVERIFIED: Foundry execution (no forge), CI-runner behavior (no remote), GC=F futures-vs-spot basis behavior, per-source publication calendars, chunked-merge equivalence (until VAL-REPRO exists). No gate is advanced by this document (standing rule).

## 13. Mandate §11 compliance map (self-check; for orchestrator review)

| Mandate §11 requirement | Section |
|---|---|
| Purpose and scope | §1 |
| Evidence and source references | §1.3 (plus per-claim statuses throughout) |
| Proposed design and alternatives | §2–§7 (alternatives noted at each branch: window candidates §3, arm re-opening §4, family alternatives §6.2, mechanical-vs-performance criteria §7.2) |
| Assumptions and unresolved questions | §2, §3.3–§3.4, §10 (and UNRESOLVED items flagged inline) |
| Tests performed and exact results | §8 (2026-10-22 fresh record; everything else NOT RUN) |
| Security and economic implications | §9 |
| Owner approvals required | §11 |
| What has not been tested or implemented | §12 |
| Append-only worklog discipline | maintained by the orchestrator (this agent does not edit `worklog.md`); no claim here asserts an unverified test pass |

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
