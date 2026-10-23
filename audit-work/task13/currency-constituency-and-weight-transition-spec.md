# MTQΣ — TASK 13 · Currency Constituency & Weight-Transition Specification (deliverable 4)

**STATUS: PROPOSED (v0.1 draft, Stage C) — Gate C. NOT IMPLEMENTED. Nothing in this document is approved.**
**Mandate:** MTQSIGMA-COO-MANDATE-003 §5 (Stage C) + §6 ("Implement the basket methodology as a specification first") + §4 clause D. This document is a **PROPOSAL with alternatives where material choices exist** — never a silent choice (mandate §16).
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence legend (per README): `VERIFIED` (reproduced this session, cited) · `DEVELOPER-REPORTED` (prior in-repo work, cited) · `SIMULATED` · `PROPOSED` (this document's design content) · `UNVERIFIED` · `NOT IMPLEMENTED`.
**No parameter below is canonical. No value is claimed optimal, stable, manipulation-resistant, or validated. Draft values remain explicitly UNAPPROVED (mandate §2 rule 8; §6 closing rule).**

---

## 0. Purpose & scope

Specify — as a specification **before** any production-oriented implementation — the v3.0 constituency engine: a versioned, registry-based component model with a configurable maximum basket size (D-13.11), a lifecycle state machine with **separately defined** eligibility, entry, normal retirement, emergency suspension and reinstatement, eligibility scoring on normalized inputs, and complete weight-transition rules that keep every intermediate weight vector valid (sum, bounds, concentration, velocity) and end with excluded components at **exactly zero** weight.

Out of scope (cross-referenced instead): index-continuity mechanics and the divisor algebra (deliverable 5); payment-instrument registry design (deliverable 6); oracle failure states and the emergency-state spec (deliverable 10); quantitative validation (deliverable 11); the "what MTQΣ is" decision (D-13.3, deliverable 3) — which is a **precondition**: scoring weights and thresholds cannot be finalized until the stability objective (D-13.5) and family selection (D-13.4) are decided.

Preconditions and dependencies (owner decisions, all OPEN): D-13.3, D-13.4, D-13.5, D-13.11, D-13.12; new decisions opened by this document: **D-13.14** (weight rounding/tie-break/sum-tolerance and aggregate-cap convention — §5.3, §13).

## 1. Evidence & source references — existing implementation (VERIFIED unless noted)

Evidence-base limits (honest): citations below were re-read this session directly in the repo (VERIFIED) except where marked DEVELOPER-REPORTED (taken from the Stage A baseline `baseline-and-change-matrix.md` §5/§7/§11 or the worklog and not independently re-executed); Foundry-suite behavior is UNVERIFIABLE in this sandbox (no forge — baseline §9); the deployed v1.2 bytecode was NOT re-probed this session.

| Item | Evidence (file:line) | Status |
|---|---|---|
| Strategic Prior 27/20/9/8/5/5/26, genesis notional table | `src/lib/mtq/blueprint.ts:22-30`, `:37-45` | VERIFIED |
| Base fixings (CHF 1.13 fix, XAU 2500), GFB denominator | `blueprint.ts:55-62`, `:67-74` | VERIFIED |
| Admissibility envelopes 23–32% … 20–32% | `blueprint.ts:78-86`, `:88-96` | VERIFIED |
| Smoothing ρ 0.50/0.75; MAX_VELOCITY 0.50/0.30/0.20%/period classes | `blueprint.ts:229-234`, `:241-244` | VERIFIED |
| MARP execution turnover cap 5% NAV/day | `blueprint.ts:248` | VERIFIED |
| I3 "methodology, not fixed weights"; I7 layered governance; I8 "no governance body may set individual live weights by discretion" | `blueprint.ts:122`, `:127`, `:128` (I1–I12 ladder `:119-132`) | VERIFIED |
| `length !== 7` guard in index init; length checks in advance/commit | `src/lib/mtq/chain-index.ts:236-241`, `:291-295`, `:406-415` | VERIFIED |
| 7-component literal union + array (MASE) | `src/lib/mtq/mase.ts:10-11` | VERIFIED |
| 7-currency literal union + record | `src/lib/mtq/currency.ts:5`, `:15-23` | VERIFIED |
| 6-leg oracle board (EUR/GBP/JPY/CNY/CHF/XAU — USD implicit base) | `src/lib/mtq/oracle.ts:685-741` | VERIFIED |
| "Constituency is STATIC… §4 eligibility scoring not live" | `src/lib/mtq/honest-status.ts:241-246` (D-constituency) | VERIFIED |
| Genesis registry members ARE basket instruments (9 records incl. PAXG/XAUT; GBP/JPY/CNY WATCH/TBD) | `src/lib/mtq/registry.ts:57-115` | VERIFIED |
| Inert candidate universes (11-currency list; 7-stablecoin DRQS list) | `src/lib/mtq-final-reserve-spec.ts:397-419` | VERIFIED |
| Genesis sum-check tolerance 1e-9 | `src/lib/mtq/genesis.ts:126-127` | VERIFIED |
| Succession/ejection machinery (proportional re-normalization; zero-artificial-return swap; read-only drill) | `chain-index.ts:506-562` (`renormalizeExcluding:546`, `replaceComponent:562`); `src/lib/mtq/succession.ts:211` | VERIFIED |
| MASE ensemble: uniform cold-start α=1/6 → adaptive softmax on OOS scores; walk-forward OOS ledger | `src/lib/mtq/mase.ts:1624-1681`, `:1616-1621`; `src/lib/mtq/engine.ts:3133-3176` | VERIFIED |
| Contracts fixed arrays: `bytes3[7] COMPONENTS`, `uint256[7]` bounds/velocity, immutable `Q_*`/`BASE_*` | `contracts/MTQSigmaV2.sol:277-305`; `contracts/MTQSigmaV3.sol:288-295` | VERIFIED |
| `submitTargetWeights` **positive-weights-only** (`target[i] > 0` else Err62), exact sum `1e18`, envelopes, velocity, per-component floor-division smoothing | V2 `:518-555` (positivity `:526`, sum `:529`, smoothing `:542-547`); V3 `:1310-1342` (positivity `:1317`) | VERIFIED |
| `setEnvelopes` = the ONLY in-code basket-shape control; cannot change count (still fixed `[7]`) | V2 `:557-564`; V3 `:1344-1348` | VERIFIED |
| On-chain weight-sum tolerance ±1e14 (0.01%) at index commit | V2 `:630-638`; V3 `:1384-1388` | VERIFIED |
| Deployed v1.2 pilot = 5-currency fixed (gold reserve-only); legacy 26.25%±3% clamps | `baseline-and-change-matrix.md` §7 (`MtqEcosystem.sol:143,159` cited there) | DEVELOPER-REPORTED |
| RR 1.10 (V2 family) vs 1.30 (V3 family) fork; 7-ccy vs 11-ccy vs 5-ccy fork | baseline §11 C-INV-1, C-INV-2; `blueprint.ts:110`; `MTQSigmaV3.sol:255` | VERIFIED / DEVELOPER-REPORTED |
| V2/V3 7-component contracts are **source-only, never deployed** | worklog Task 13-a2; baseline §3 | DEVELOPER-REPORTED |

Baseline cross-refs: fixed-basket inventory with file:line = `baseline-and-change-matrix.md` §7; Stage C change-matrix rows = §5 (Stage C); contradictions C-INV-1/2/3/4 = §11.

## 2. Proposed component registry model (PROPOSED)

A **versioned registry** replaces the hard-coded 7-tuple everywhere. Each component record carries: stable identifier (bytes3 code + registry uint ID); type (fiat currency / commodity(XAU) / GPP pseudo-leg if D-13.13 adopts Option A); price sources incl. the required ≥2 independent families and their validation classes; unit conventions (USD price per unit; XAU = USD per troy ounce — deliverable 5 §4); current eligibility score with **normalized inputs and their provenance** (§4); target/current weight; approved min/max weight (envelope, ACTIVE-only — §5.2); lifecycle status (§3); activation/retirement metadata (timestamps, decision IDs, methodology version); data-quality/liquidity status flags (fed by the oracle layer, deliverable 10); model/methodology versions; governance/audit references (decision ID, quorum, timelock). Registry version = content hash of the record set; every transition emits an append-only record (no in-place mutation of history).

Alternatives (owner-visible, not chosen here): (a) on-chain registry as the sole source of truth (max transparency, max gas/migration rigidity — any schema change is a contract change); (b) off-chain registry + on-chain commitment of the hash (cheaper, but adds a trust dependency on the off-chain keeper — weakens "no unexplained weight"); (c) hybrid: on-chain stores only {id, status, bounds, weight}, full metadata off-chain. **Draft recommendation: (c)**, because status/bounds/weights are what the index math consumes on-chain; the full dossier is audit evidence. UNAPPROVED (D-13.11).

Registry record schema (draft field list; every field appears in the versioned content hash — PROPOSED):

| Field group | Fields (draft) |
|---|---|
| Identity | registryId (uint), code (bytes3), displaySymbol, name, componentType (FIAT / XAU / GPP_LEG-if-D-13.13-A) |
| Pricing | unitConvention (e.g., USD per unit; XAU = USD per troy ounce), oracle leg id, source families[2..] with validation class, staleness/heartbeat parameters |
| Scoring | normalized dimension scores s_{i,k} with per-input provenance rows (source, series id, fetch timestamp, publication timestamp of the underlying value), composite S_i, hard-gate results |
| Weights | currentWeight (bp), targetWeight (bp), approved [w_min, w_max] (ACTIVE-only), velocity class Δ_i |
| Lifecycle | status, enteredAt/exitedAt, transitionId, scheduledGlide {start, N, endpoint}, suspensionCause (T7 only) |
| Governance | decisionId, role quorums, timelock reference, methodologyVersion, registryVersion, audit-hash-chain predecessor |

Provenance tiers for scoring inputs (PROPOSED, applies to §4.1): tier 1 = primary official statistics (statistical offices, BIS); tier 2 = regulated market data (fixings, vendors with ≥2 independent families); tier 3 = protocol-internal oracle ledger (data-quality dimension only). Tier-3 inputs may never measure *market relevance* — only tiers 1–2 may (reinforces §8). A dimension whose inputs fall below its required tier scores 0 (fail-closed), never a neutral default.

## 3. Lifecycle state machine (PROPOSED)

States: `CANDIDATE → ELIGIBLE → ACTIVE → WATCH → RETIRING → EXCLUDED`, with `EMERGENCY-SUSPENDED` as a **distinct overlay path** (not a normal-retirement state) and `ELIGIBLE` as a queue state (scored in, not yet in the basket). Weights exist only for `ACTIVE` (+ `WATCH`, `RETIRING` retain decaying weights; all others exactly 0).

State/property matrix (PROPOSED — what each state implies for the math layers):

| State | May hold weight > 0 | In MASE optimization domain | Oracle leg active | Eligibility scoring continues |
|---|---|---|---|---|
| CANDIDATE | no (0) | no | provisioned for evaluation | yes |
| ELIGIBLE | no (0) | no | provisioned | yes (exit thresholds also watched) |
| ACTIVE | yes (≥ w_min_i) | yes | yes | yes |
| WATCH | yes | yes | yes (with data-quality warning flags) | yes (intensified) |
| RETIRING | yes (glide-decaying) | no (endpoint pinned) | yes until T6 | no (decision made) |
| EXCLUDED | no (**exactly 0**) | no | leg retired | dossier only (T9 re-entry) |
| EMERGENCY-SUSPENDED | frozen at suspension value (or glide per §5.6 alt.) | no | in the oracle-emergency path (deliverable 10) | suspension-cause evidence |

| # | Transition | Who triggers (role) | Evidence required | Min observation | Hysteresis | Public notice |
|---|---|---|---|---|---|---|
| T1 | → CANDIDATE | Economic Authority nominates; Risk Council dockets | Provenance dossier: all §4 inputs with named sources + publication calendars + ≥2 independent price families demonstrably available | — | — | Nomination published at docket time |
| T2 | CANDIDATE → ELIGIBLE | **Rule-driven** (score ≥ θ_in sustained), Risk Council (4/7) confirms | Composite score S_i ≥ θ_in over the FULL entry window T_obs_entry with no hard-gate failure (§4.2) | T_obs_entry (draft 180d) | Entry θ_in strictly above exit θ_out by band H (draft 0.10) | Confirmation published; admission is NOT yet weight-bearing |
| T3 | ELIGIBLE → ACTIVE | Monetary Authority proposes admission; Constitutional-layer ratification with timelock (per I7/I8: membership is governed, **never individual weights**) | Slot availability (N_active < N_max, D-13.11) + T2 record + planned ramp schedule (§5.5) | — | — | **Pre-announcement ≥ T_ann (draft 30d)** with effective timestamp + ramp duration |
| T4 | ACTIVE → WATCH | Automatic on warning-band breach (S_i < θ_out + H/2 sustained T_watch, or any hard gate entering its warning band) | Score series + oracle data-quality flags | T_watch (draft 30d) | Warning band strictly inside [θ_out, θ_in] | Watch status + reason published |
| T5 | WATCH → RETIRING (normal retirement) | Risk Council (4/7) confirms after T_watch | S_i < θ_out sustained over T_obs_exit; WATCH record complete | T_obs_exit (draft 120d) | Exit threshold below entry threshold (hysteresis band H) | **Pre-announcement ≥ T_ann** with glide schedule (§5.5) |
| T6 | RETIRING → EXCLUDED | Automatic on glide completion | Deterministic completion of the §5.5 glide (weight = 0 exactly) | N_ret periods | — | Completion record published |
| T7 | any ACTIVE/WATCH → EMERGENCY-SUSPENDED | Emergency Council (2-of-3 emergency quorum), **or** automatic interlock from the oracle/emergency spec (deliverable 10: feed FAILED/HALTED, depeg, sanctions freeze, convertibility loss) | Documented trigger event + post-hoc report; **no pre-announcement** (by definition) | none (immediate) | none (emergency is not score-driven) | Post-hoc disclosure **within 24h** with cause, scope, and exit plan |
| T8 | EMERGENCY-SUSPENDED → resolution | Emergency Council + Risk Council joint | Either (a) cause resolved + suspension < T_rein (draft 30d) → fast-track reinstatement to ACTIVE with the pre-suspension glide resumed, or (b) cause persists → EXCLUDED via accelerated glide N_em (draft ≤3 periods) | — | Fast-track expires at T_rein; after that only a fresh T1–T3 pass | Published with the T7 report and at resolution |
| T9 | EXCLUDED → CANDIDATE | Same as T1 | Fresh dossier; **no automatic re-admission** — a full new T1→T2→T3 cycle (oscillation guard) | Full T_obs_entry | Full hysteresis re-applies | As T1 |

Design notes: (i) T2 and T4 are rule-driven, T3/T5/T8 are governance-confirmed — consistent with I8 (`blueprint.ts:128`: no discretionary individual live weights). (ii) The emergency path (T7/T8) is **separate from normal retirement** in trigger authority, evidence standard, notice, and transition speed — satisfying the mandate's "urgent-suspension path… distinct from normal membership changes". (iii) Alternative for T7 mid-glide behavior (freeze weight vs accelerated glide vs immediate removal with divisor adjustment) is presented in §5.6; immediate removal remains feasible because index continuity is divisor-protected (deliverable 5 §2.2) — the constraint is economic (transition cost/turnover), not index-mathematical.

## 4. Eligibility scoring (PROPOSED)

### 4.1 Scoring inputs — each normalized to [0,1] before aggregation

| Dimension | Raw measurement (defined units/range) | Normalization to [0,1] | Missing-data behavior | Provenance (named candidate sources) | Publication-lag handling |
|---|---|---|---|---|---|
| Liquidity L_i | FX market turnover share (economy-wide), % of global turnover, [0, 100] | s = share / max_universe_share (capped 1) | Missing cycle → carry last value 1 cycle; 2+ cycles → dimension scores 0 and hard gate fails (fail-closed) | BIS Triennial Central Bank Survey (3-year cycle — the score is stale by design between surveys; a rolling venue-depth proxy from the oracle layer supplements it) | Interim value carried with "stale-survey" label; age published |
| Data quality QD_i | Fraction of oracle rounds with ≥2 valid independent sources over trailing 90d, [0,1] | identity (already [0,1]) | No data → 0 (fail-closed) | The protocol's own oracle ledger (deliverable 10) | none (live) |
| Convertibility CV_i | Capital-control restrictiveness score, ordinal [0,10] (higher = more restrictive) | s = 1 − raw/10 | Missing → 0 and hard gate fails | IMF AREAER currency-restriction indicators (annual) + onshore/offshore basis spread as a market-based cross-check | Annual value carried with label; basis spread is continuous |
| Jurisdictional restrictions JR_i | Binary permissibility gates (sanctions exposure, clearing/access) — pass(1)/fail(0) per gate; aggregate = min | s = min over gates | Any missing gate → 0 (fail-closed) | Sanctions-screening provider + counsel review (Gate-relevant, D-13.3 context) | reviewed per admission + on watch triggers |
| Currency-control exposure CC_i | Onshore/offshore spread (e.g., CNY/CNH basis), bps, trailing 90d median, [0, ∞) | s = 1 − min(spread_bps / S_max, 1), S_max draft 200bps | Missing spread → 0.5 neutral with "neutral" label | FX data vendors (≥2 independent families required — currently NOT MET, see §9) | continuous |
| Benchmark availability BA_i | Investable/published fixing exists with ≥5y history and published calendar — pass/fail per criterion; count/5 | s = criteria_passed / 5 | Missing criteria → not passed | ECB ref rates; WM/Reuters-type fixes; LBMA gold fix (XAU leg) | calendar pinned at T1 |
| Volatility V_i | Annualized 90d return vol of the component, [0, ∞) | s = 1 − min(σ_i / σ_max, 1), σ_max draft 30% | No series → 0 (fail-closed) | Same validated multi-source prices as the index (deliverable 5 §2.1/§4; consistency requirement) | none |
| Diversification D_i | Mean pairwise correlation with the CURRENT basket + candidate universe, [−1,1] | s = (1 − ρ̄)/2 | No matrix → 0.5 neutral | §6.1 covariance layer (MASE, `mase.ts` §6.1 — VERIFIED implemented on a SIMULATED window) | none |
| Reserve/trade relevance RR_i | **Exogenous, economy-wide FX-use share only** (BIS survey); MTQΣ-internal payment volume is FORBIDDEN as an input (§8) | as L_i | as L_i | BIS | as L_i |
| Geopolitical exposure GE_i | Composite of jurisdictional-risk indicators (sanctions-list proximity, conflict/occupation status of issuer jurisdiction, reserve-asset freeze history) — ordinal [0,10], higher = riskier | s = 1 − raw/10 | Missing → hard gate fails (fail-closed: cannot score what counsel has not cleared) | Sanctions-screening provider + counsel review; history desk research (documented sources per record) | reviewed per admission + on watch triggers |
| Concentration (aggregate) C | Not a per-component score — the aggregate HHI / top-k constraint (§5.2) evaluated on the whole ACTIVE vector after projection | n/a (constraint, not score) | n/a | — | checked at every commit (CCY-BOUND-1) |

**All normalization constants (max_universe_share, S_max, σ_max, …) are UNAPPROVED DRAFT PARAMETERS (§13).** Sign conventions: higher score = more admissible everywhere (convertibility/volatility inverted at normalization).

### 4.2 Composite score, hard gates, hysteresis

Composite: `S_i = Σ_k γ_k · s_{i,k}` with `Σγ_k = 1`; **draft γ = uniform 1/9** pending Stage J calibration (PROPOSED; alternatives: liquidity-weighted; risk-weighted — all UNAPPROVED). Hard gates g_k (a composite cannot rescue a failed gate; draft: L ≥ 0.30, QD ≥ 0.50, CV ≥ 0.50, JR = 1.0 all gates, BA ≥ 0.60): any hard-gate failure blocks T2/T3 and forces WATCH if ACTIVE. Distinct symbols: observed score `S_i,t`; entry threshold `θ_in`; exit threshold `θ_out`; warning threshold `θ_out + H/2`; hysteresis band `H = θ_in − θ_out > 0` (mandate: entry threshold strictly above exit). Draft: θ_in 0.75, θ_out 0.65, H 0.10 — **UNAPPROVED**.

### 4.3 Recording obligation

Every input value, normalized score, threshold evaluation, decision, timestamp, and model/methodology version is recorded in an append-only registry audit log (mandate §6 bullet 1; §24-style hash-chained rows). No score is computed without provenance. **NOT IMPLEMENTED** today (the codebase's own admission: `honest-status.ts:245`).

## 5. Weight computation & transition rules (PROPOSED)

### 5.1 Pipeline (per rebalance period; MASE interaction detailed in §6)

1. MASE ensemble produces `W^Target` over the ACTIVE set (non-ACTIVE components pinned to 0 — they are excluded from the optimization).
2. **Admissibility projection**: clamp each ACTIVE component into its envelope `[w_min_i, w_max_i]`; re-normalize the ACTIVE set to sum 1 (projection is over ACTIVE only).
3. **Transition overlay**: if a glide is in flight (§5.5), the period's endpoint is the glide value, not the raw MASE target (deterministic intermediates take precedence).
4. **Rounding** to the declared quantum (§5.3) with deterministic tie-breaking.
5. **Commit**: registry update + divisor record for the chain-linked index (deliverable 5 §2.2 — continuity proof; acceptance tests in its §8).

### 5.2 Floors, ceilings, aggregate caps

- Per-component floor `w_min_i > 0` applies **only to ACTIVE components**; per-component ceiling `w_max_i`; both set per component by the constitutional layer (the registry-era replacement of `setEnvelopes`, V2:557-564 / V3:1344-1348 — which today cannot change count).
- Aggregate concentration: **Alternative A** — single-component cap `w_cap` (draft 35%) + HHI cap `HHI_max` (draft 0.35) evaluated after projection; **Alternative B** — top-k share cap (e.g., top-3 ≤ 75%). Both enforceable; A is proposed as the draft because it bounds the whole distribution, not just the extremes. **UNAPPROVED (D-13.14).** Draft starting point for per-component envelopes: the current 7-component values (`blueprint.ts:78-86`) for the incumbent set, extended per new admission by governance.
- Component count invariant: `N_active ≤ N_max` (§7) checked at T3 and at every commit.

### 5.3 Normalization to exactly 100%, rounding, tie-breaking

Quantum: weights are published and committed in **basis points** (1e-4; on-chain 1e18-scale ⇒ multiples of 1e14). Rounding rule: **largest-remainder method** — floor every weight to the quantum, distribute the residual units one-by-one to the largest fractional remainders; **ties broken by ascending lexicographic order of the stable component ID** (bytes3). Result: the committed integer vector sums to exactly 1e18 on-chain and exactly 100% off-chain, so `Σ|w_i − w_i'| = 0` — within the declared float tolerance `≤ 1e-9` (matching the existing genesis precedent, `genesis.ts:126-127`; the existing on-chain commit tolerance is ±1e14 = ±1bp, V2:638/V3:1388 — v3.0 **tightens this to exact** because bp quantization makes exactness achievable). Determinism: identical inputs ⇒ identical vector (mandate: deterministic tie-breaking). **Convention as a whole is a NEW owner decision D-13.14.**

Worked example (arithmetic illustration only — no performance implied; PROPOSED): 3-component vector after projection/smoothing `w = (0.333356, 0.333344, 0.333300)`. bp floors: (3333, 3333, 3333) = 9999 bp; residual 1 bp. Fractional remainders: (0.56, 0.44, 0.00) → the 1 bp goes to component 1. Result (3334, 3333, 3333) = 10000 bp exactly. Tie case: remainders (0.50, 0.50, …) → lexicographic order of bytes3 IDs decides. The rule is order-independent of input ordering — the only ordering input is the ID itself, which is stable across versions.

Existing-implementation caveat this fixes (VERIFIED): V2/V3 smoothing uses per-component integer floor division (`V2:546`, `V3:1334`) with no final re-normalization, so the committed smoothed vector can drift from exact sum by up to ~7 wei (1e-18-scale); immaterial today but inconsistent with an exact-sum registry invariant. v3.0 rounds/re-normalizes **after** smoothing.

### 5.4 Redistribution on exit; the exclusion-zero guarantee

- On exit (T5/T6 or emergency): the departing component's weight is removed and the freed weight is redistributed pro-rata to surviving ACTIVE components' pre-exit weights — exactly the existing `renormalizeExcluding` convention (`chain-index.ts:546-556`, VERIFIED: slot → 0, survivors rescaled to sum exactly 1). The next MASE recomputation then moves survivors to their unconstrained targets.
- **Excluded ⇒ exactly 0**: envelopes/floors are defined per-state (§5.2 — floor applies only to ACTIVE); the projection step pins non-ACTIVE components to 0; after rounding, an EXCLUDED component's weight is exactly 0 with no residual minimum. This is the mandate's "prevent an excluded component from retaining an unintended positive minimum weight" — and it is the honest reason the existing `submitTargetWeights` **positive-weights-only** rule (`V2:526`, `V3:1317`) is a BLOCKER for v3.0: today a departure can never reach 0, so no exit transition can be expressed on-chain at all (baseline §5 Stage C row 3).
- No negative weight, no unallocated weight (sum = 1 exactly at every step), no duplicated component (registry uniqueness), no unexplained weight (every committed vector carries a methodology version + decision reference).

### 5.5 Deterministic intermediate weights during multi-period transitions

Entry ramp (T3) and retirement glide (T5/T6) are **linear glide paths**: for transition from `w^0` to `w^final` over `N` periods, `w^(k) = w^0 + (k/N)·(w^final − w^0)`, k = 1..N. Properties (prove-by-construction, tested in §10): (i) **sum-to-one at every intermediate** — both endpoints sum to 1, and the interpolation is affine, so every intermediate sums to 1; (ii) **bounds at every intermediate** — both endpoints respect their envelopes and caps, and each intermediate is a convex combination, so envelopes/caps hold at every step; (iii) **velocity respected per period** — per-period movement is `|w^final − w^0|/N`; choose `N = ceil(max_i |w_i^final − w_i^0| / Δ_i)` (Δ_i = the per-component velocity class, `blueprint.ts:241-244` draft-carried) so every step satisfies the velocity cap. N is thereby **derived, not free**: deterministic given endpoints and Δ. Draft bound N ∈ [1, 10] periods. Freed-weight redistribution (§5.4) defines the retirement endpoint; the entry endpoint is the post-admission MASE target under the enlarged ACTIVE set.

Worked derivation (arithmetic illustration only; PROPOSED): a retirement frees 9% of weight while the largest survivor move is 1.2% with Δ = 0.30%/period ⇒ N = ceil(1.2/0.3) = 4 periods; each period moves each survivor by exactly one quarter of its endpoint delta; the departing component's per-period exit step is 9%/4 = 2.25% ≤ its Δ only if its own velocity class permits — otherwise N widens to `ceil(9/Δ_departing)` = 18 periods for Δ = 0.50%… which exceeds the draft N bound; the bound then forces the §5.6 emergency-alternative discussion into normal-retirement scope as well (a component whose exit cannot complete within N_ret bound is a design flag for the owner, not a silent clamp). This interaction (velocity vs retirement speed) is explicitly UNRESOLVED — it is one concrete reason N_ret is a decision (D-13.14), not a derived constant.

### 5.6 Transition lifecycle semantics

Start/effective timestamp and duration are published with the T3/T5 pre-announcement. Interruption: only (a) emergency suspension (T7 — the suspended component's glide freezes at the current vector; remaining components continue their own glide with the sum invariant re-normalized over the survivors) or (b) governance cancellation before the first weight move (returns to prior state). Mid-glide score recovery does **NOT** reverse a retirement (oscillation guard; T9 is the only re-entry) — **Alternative presented**: discretionary mid-glide reversal by Risk Council (rejected as draft because it reopens the oscillation/threshold-gaming surface; if the owner prefers it, hysteresis guarantees weaken — owner's call, D-13.11). Completion: automatic; emits the T6 record. Emergency exit option: immediate removal is feasible with divisor continuity preserved (deliverable 5 §2.2) at the cost of a one-period jump inside the emergency cap — **Alternative A freeze / B accelerated glide (N_em ≤ 3) / C immediate-with-divisor**; draft recommendation B; UNAPPROVED (D-13.11 + deliverable 10). Previous methodology + full index history are preserved: every boundary emits a divisor record (deliverable 5 §2.3/§8); no transition rewrites history.

## 6. Interaction with the MASE multi-model ensemble (PROPOSED)

- **Forecast combination (retained form, VERIFIED as implemented today for the fixed 7):** per-family targets (minvar/erc/maxdiv/cvar/ppp/institutional/regime) combined by ensemble weights α — uniform 1/6 per §7.5 family at cold start, §7.6 softmax `α_m ∝ e^(−η·Score_m)` over walk-forward OOS EWMA scores thereafter (`mase.ts:1616-1621`, `:1624-1681`; `engine.ts:3133-3176`). v3.0 changes the **domain** (variable ACTIVE set) not the combination rule. No effectiveness claim is made for any ensemble member until Stage J runs (mandate §6 opening rule; honest-status D-ensemble-alpha `:199-204` discloses the empty cold-start OOS ledger).

What changes vs today, itemized (all PROPOSED):

1. **Domain**: `mase.ts:10-11` hard-codes the 7-member `Component` union; v3.0 MASE reads the ACTIVE set from the registry and treats non-ACTIVE slots as pinned-0 (excluded from every model's optimization).
2. **Ensemble cold start**: unchanged in form (uniform per family until the first walk-forward window closes — disclosed, not invented; honest-status `:199-204`); η and score-window length remain calibration-stage (D-13.11-adjacent; Stage J owns them).
3. **Admissibility projection**: today `applyEnvelopes` runs after ensemble averaging (`engine.ts:3158`; mase.ts `:1627` "projected AFTER averaging"); v3.0 additionally enforces aggregate caps (§5.2) and the exclusion pin in the same projection step, in a fixed order (publish the order: ensemble → per-component envelope clamp → aggregate-cap repair → sum re-normalization → glide overlay → rounding).
4. **Smoothing**: ρ-form retained (`blueprint.ts:229-234`); the glide overlay composes with it — during a glide, the smoothing step's output is the glide point, not a ρ-blend of the raw target (otherwise two smoothing layers would compose non-deterministically).
5. **Walk-forward OOS ledger**: per-model scoring continues to exist per model *and now per registry version*; a registry change resets the ledger's comparability (scores across different domains are not commensurable) — the ledger is segmented by registryVersion, disclosed as such. NEW hazard, UNRESOLVED (§12).

Retained mechanics (unchanged in form, restated for completeness):

- **Per-rebalance movement:** target → envelope projection → constitutional smoothing ρ (0.50/0.75, `blueprint.ts:229-234`) → glide overlay (§5.5) → bp rounding (§5.3) → commit. Each accepted update respects per-component velocity Δ_i.
- **Turnover caps (two distinct concepts, both UNAPPROVED drafts):** (i) *weight turnover* per rebalance period `Σ_i |Δw_i| ≤ T_cap` (draft 2.0%/period) — a v3.0 aggregate cap on top of per-component velocity (D-13.14); (ii) *execution turnover* — MARP's existing 5%-of-NAV daily cap (`blueprint.ts:248`) governs trading, not weights; index continuity does not require trading (divisor mechanism — deliverable 5 §2.2).
- **Hysteresis interaction:** scoring thresholds (T2/T4/T5) gate *membership*; MASE+velocity+glide govern *weights*. Once a transition is scheduled, in-flight membership is immutable except via T7/T8. A component in WATCH keeps its weight and normal MASE treatment; a RETIRING component's weight is glide-determined and it is excluded from the MASE optimization domain as of the glide endpoint.

## 7. Configurable maximum basket size (D-13.11) — PROPOSED

`N_max` is a constitutional-layer registry parameter. **Draft bound: 7–15 (initial value 7, preserving current composition)** — chosen as a draft for computational/oracle-provisioning honesty: every admitted component needs ≥2 independent price families (currently NOT MET even for the existing legs — single live upstream per pair, `oracle-feeds.ts` disclosure; honest-status D-oracle-witnesses `:224-228`), a scoring dossier, and governance review. Alternatives: stay at 7 (zero index-math migration; no new oracle legs; weakest breadth) vs 15 (breadth; more vendor/legal surface, more transitions, more arbitrage windows). **Explicitly UNAPPROVED — owner decision D-13.11 (Gate C).** A change of N_max is itself a constitutional event (timelock + version bump), never an incidental edit.

## 8. The separation invariant (PROPOSED, to be made testable)

**INV-SEP-1: payment-instrument volume, payment-instrument registry membership, or any protocol-internal flow metric shall NEVER be an input to eligibility scoring, weight computation, or the MASE objective.** "Trade/payment relevance" (§4.1 row RR_i) is defined strictly as *exogenous, economy-wide* FX-use (BIS-type survey share) — never MTQΣ-internal volumes. Rationale: prevents circular self-admission (a widely-held payment instrument voting itself into the reference basket), keeps the reference index an *observation* of external markets, and keeps the payment-instrument registry (deliverable 6, Stage E) cleanly separable — today that separation does not exist: the only registry in the codebase is the asset registry whose members ARE the basket instruments (`registry.ts:57-115`). Testable (Stage K family CCY-SEP-1): feed synthetic payment-volume spikes into the scoring input stream; assert zero change to any score, threshold evaluation, or weight.

## 9. Existing implementation vs v3.0 — honest conclusion, breaking changes, migration

**Conclusion (BLOCKER, honest):** the fixed-7 architecture is hard-coded at every layer, so an expandable constituency engine requires **contract-level redesign of the undeployed V2/V3**, not parameter changes. `setEnvelopes` is the only basket-shape control and cannot change count (V2:557-564 / V3:1344-1348); `submitTargetWeights` is positive-weights-only so exits cannot reach zero (V2:526 / V3:1317); every loop is `i < 7` over `bytes3[7]`/`uint256[7]` (V2:298-305 / V3:288-295). This redesign is **NOT applicable to the deployed v1.2 5-currency pilot without migration** — v1.2 is a different economic family (C-INV-2; baseline §7: deployed 5-ccy fixed, gold reserve-only, legacy 26.25%±3% clamps) and cannot be parameter-migrated into a registry model; adopting v3.0 on-chain requires a new deployment (the historical-immutable + migration default of `UPGRADEABILITY.md`, Option A; DEVELOPER-REPORTED).

Breaking changes enumerated (v3.0 vs V2/V3 source): (1) `bytes3[7]` → registry ID mapping + dynamic iteration; (2) `uint256[7]` envelope/velocity arrays → per-record fields; (3) positive-weights-only submission → **0 allowed exactly for non-ACTIVE slots** + ACTIVE-set membership precondition + sum-exact-after-bp-rounding (D-13.14); (4) exact-1e18 submit check stays, commit tolerance tightens from ±1e14 (V2:638, V3:1388) to exact; (5) TS reference layer: literal unions (`mase.ts:10-11`, `currency.ts:5-23`) → registry-driven; `length !== 7` guard (`chain-index.ts:236-241`) → registry-length validation; 6-leg oracle board (`oracle.ts:685-741`) → per-component leg provisioning; genesis 7-fixings (`genesis.ts:120-128`) → genesis over the registered set; (6) Foundry suites for V2/V3 must be rewritten for the registry ABI (current suites: 30/14 tests, forge execution UNVERIFIED in sandbox — baseline §9). Migration implications: none on-chain today for V2/V3 (never deployed — DEVELOPER-REPORTED, `MTQSigmaV2-PENDING.json` per Stage A); the deployed v1.2 + ecosystem modules are untouched and remain the honest "what runs today" (testnet only). Shadow mode: all of the above is TS-reference-layer work until Gate C + deployment approvals; no gate advances (README rule 3).

Breaking-change → migration/test implication map:

| # | Breaking change | Migration implication | Test family required (§10) |
|---|---|---|---|
| 1 | Fixed `bytes3[7]`/`uint256[7]` → registry | new contract ABI; V2/V3 source rewritten before ANY deployment; v1.2 untouched (incompatible family) | CCY-LC-*, CCY-DET-1 |
| 2 | Positive-weights-only → 0-for-excluded | submit/commit validation rewrite; on-chain exit transitions become expressible at all | CCY-EXCL-1, CCY-SUM-1 |
| 3 | ±1e14 commit tolerance → exact bp-sum | keeper commitment path must round, not the contract; contract verifies | CCY-SUM-1, CCY-SCORE-1 |
| 4 | 6-leg oracle board → per-component legs | oracle-layer re-provisioning per admission; independence precondition (deliverable 10) | CCY-EMER-1 (joint), oracle families (deliverable 10) |
| 5 | `setEnvelopes` count-invariance → per-record bounds + N_max parameter | constitutional governance surface changes (new proposal/timelock types) | CCY-BOUND-1, CCY-LC-3 |
| 6 | `length !== 7` guards → registry-length validation | index math unchanged (deliverable 5) but init/genesis paths re-verified | CCY-LC-3, IDX-CONT-* (deliverable 5) |

## 10. Tests required (Stage K families; NOT RUN — none exist yet)

- **CCY-LC-1..9**: each T1..T9 transition legal exactly as specified; illegal transitions rejected (state-machine family — baseline test-matrix row: "NONE (constituency static by construction)").
- **CCY-HYS-1**: θ_in > θ_out honored; no state oscillation within observation windows (hysteresis family).
- **CCY-SCORE-1**: score determinism at boundaries (exactly θ_in, θ_out, warning band edges; largest-remainder tie-break determinism).
- **CCY-SUM-1 / CCY-BOUND-1 / CCY-VEL-1**: sum = 1 exactly, envelopes + aggregate caps, and per-period velocity hold **after every transition and at every glide intermediate** (mandate family "weight sum + bounds after every transition").
- **CCY-EXCL-1** (exclusion-zero-weight): after T6 completion (and after emergency exit under each §5.6 alternative), the excluded component's committed weight is exactly 0.
- **CCY-SEP-1**: separation invariant (§8) — synthetic payment-volume perturbation ⇒ zero score/weight delta.
- **CCY-EMER-1**: T7/T8 distinct from T5/T6 (different authority path, different notice record); index continuity across the emergency boundary (joint test with deliverable 5 IDX-CONT-*).
- **CCY-ANN-1**: notice timestamps present and ordered (T_ann honored; T7 post-hoc ≤ 24h).
- **CCY-DET-1**: end-to-end determinism — same inputs ⇒ identical committed vector and registry version.
All are **required before Gate C can close**; none are claimed as run (NOT IMPLEMENTED).

Test preconditions and environment honesty (PROPOSED): (i) the suite runs first against the TS reference layer (bun-testable, deterministic seeds) and only then as Foundry suites for any registry-era contract — Foundry execution remains UNVERIFIABLE in this sandbox (no forge; baseline §9) and must never be reported as PASS without a runner; (ii) every test seeds its own synthetic scoring inputs (tier-labeled) — no live vendor call is permitted inside a Stage K test; (iii) joint acceptance tests with deliverable 5 (IDX-CONT-*) assert that every T3/T5/T6/T7 boundary emits a divisor record and the index level is unchanged across it — these cannot be written until both specs land, per the Stage A note that composition-change continuity tests "cannot exist until Stage C lands" (baseline §5 Stage D row 3); (iv) property/fuzz variants are required for CCY-SUM-1/CCY-BOUND-1/CCY-EXCL-1 (random valid registries and random glide endpoints), not only example vectors.

## 11. Risks (security & economic implications; no mitigation claimed as sufficient)

1. **Governance capture of admission** — whoever controls T3/T5 ratification controls the admissible set (weights stay MASE-computed, but the domain is a governance object). Mitigations to specify at Gate C: role separation (I7/I8), timelocks, published criteria, independent review; residual risk remains and is stated, not solved. PROPOSED.
2. **Data-vendor dependence** — scoring inputs and the per-component oracle legs both depend on external data; today even the existing legs are single-live-upstream per pair with synthetic witnesses (`oracle-feeds.ts`; honest-status `:224-228`) — independence is a precondition for honest scoring, currently NOT MET. VERIFIED gap.
3. **Transition-window arbitrage** — public pre-announcement (T_ann) creates a predictable flow window around the effective timestamp; multi-period glides dilute step discontinuity and the divisor keeps the *index* continuous (no artificial jump), but any execution leg (MARP) remains exposed. Tradeoff disclosed; alternatives (shorter notice = less front-running, worse holder fairness) are the owner's. PROPOSED.
4. **Oscillation / threshold gaming** near θ boundaries — hysteresis + observation windows are the control; effectiveness UNVERIFIED until simulated (Stage J).
5. **Emergency-path abuse** — T7 bypasses notice; constrained by 2-of-3 emergency quorum + mandatory 24h post-hoc disclosure + automatic re-validation (T8); abuse risk remains and is disclosed. PROPOSED.
6. **Registry authority risk** — any on-chain registry inherits the standing authority problem (both keys compromised, unresolved — Task 12 carry): no v3.0 admission logic is safe to deploy before the Task 12 authority migration executes. Carried, blocking.

## 12. Assumptions & unresolved questions

- **Assumption (blocking):** D-13.3/D-13.4/D-13.5 land first — scoring weights γ and the meaning of "reserve relevance" depend on what MTQΣ is declared to be. UNRESOLVED.
- θ/γ/H/g/T drafts assume monthly scoring cadence and daily rebalance periods; cadence itself is UNAPPROVED (D-13.11).
- GPP-as-leg (deliverable 5 §5, D-13.13 Option A) would add a non-price pseudo-component to this registry — interaction with §4 scoring (a GPP leg has no FX liquidity) must be re-specified if adopted. UNRESOLVED cross-dependency.
- Whether the candidate universe is the inert 11-currency list (`mtq-final-reserve-spec.ts:417-419`), a wider set, or includes XAU-only-then-fiat — UNRESOLVED (D-13.11/D-13.4).
- On-chain/off-chain division: this draft assumes the TS reference layer computes and a future on-chain layer verifies (shadow-mode posture); full on-chain scoring would change the registry decision (§2). UNRESOLVED.
- OOS-ledger segmentation by registryVersion (§6 item 5) — does a composition change reset ensemble-α history, or do scores carry with a discount? Both are defensible; neither is chosen here. UNRESOLVED (D-13.11).
- Aggregate-cap repair order (§6 item 3): where a projected vector violates HHI_max, the repair rule (proportional shave of the largest weights vs re-projection under a tightened w_cap) must be pinned before implementation — draft favors proportional shave of the top offenders toward the cap, deterministic by ID order; UNRESOLVED (D-13.14).
- Velocity-vs-retirement-speed conflict (§5.5 worked derivation): a large-weight component with a small Δ_i cannot exit within the draft N bound — options are (a) widen N_ret for that case, (b) allow a one-period emergency-style jump under a distinct "fast-retirement" authorization, or (c) accept the long glide. Owner's call; UNRESOLVED (D-13.14).
- Whether WATCH status carries *any* weight consequence (e.g., tightened envelope) or is purely informational before T5 — draft: informational; UNRESOLVED (D-13.11).

## 13. UNAPPROVED DRAFT PARAMETERS (single table — every value requires owner approval)

| Symbol | Meaning | Draft value | Decision ID |
|---|---|---|---|
| N_max | maximum basket size | 7–15 (initial 7) | D-13.11 |
| θ_in / θ_out / H | entry / exit score thresholds; hysteresis band | 0.75 / 0.65 / 0.10 | D-13.11 |
| T_obs_entry / T_obs_exit / T_watch | entry / exit observation windows; watch window | 180d / 120d / 30d | D-13.11 |
| T_ann | public pre-announcement (T3/T5) | ≥ 30d | D-13.11 |
| T_rein / N_em | fast-track reinstatement window / emergency glide | 30d / ≤3 periods | D-13.11 (+ deliverable 10) |
| γ_k, g_k | scoring weights; hard-gate minima | uniform 1/9; L≥0.30, QD≥0.50, CV≥0.50, JR=1.0, BA≥0.60 | D-13.11 |
| σ_max, S_max, max_share | normalization constants (§4.1) | 30% vol; 200bps basis; universe max | D-13.11 |
| w_min_i / w_max_i | per-component envelope (ACTIVE-only) | current values as starting point | D-13.11 / constitutional (envelope path) |
| w_cap / HHI_max (or top-k) | aggregate concentration cap | 35% / 0.35 (alt: top-3 ≤ 75%) | **D-13.14 (NEW)** |
| quantum, tie-break | bp quantization; largest-remainder; lexicographic bytes3 ID | 1e-4 / as specified | **D-13.14 (NEW)** |
| sum tolerance | off-chain float / on-chain | 1e-9 / exact 1e18 | **D-13.14 (NEW)** |
| T_cap (weight turnover/period) | aggregate weight-move cap per rebalance | 2.0% | **D-13.14 (NEW)** |
| Δ_i | per-component velocity (per accepted update) | carry 0.50/0.30/0.20% classes | D-13.14 (constitutional envelope change path) |
| N_ret glide bound | derived N range for ramps/glides | [1, 10] periods | D-13.14 (NEW) |
| scoring cadence | score recomputation frequency | monthly | D-13.11 |
| ρ (smoothing) | normal/stress adoption | 0.50 / 0.75 (existing) | carried constitutional values; re-ratify at Gate C |

**New decision IDs opened by this document (to be registered by the orchestrator in deliverable 14): D-13.14** (weight rounding/tie-breaking/sum-tolerance/aggregate-cap convention). D-13.13 is opened in deliverable 5 (GPP inclusion).

## 14. Owner approvals required (all OPEN — none may be inferred from this document)

- [ ] **D-13.11** — max basket size + admission rules (this spec's §3/§4/§7/§13) — Gate C.
- [ ] **D-13.14 (NEW)** — rounding/tie-break/sum-tolerance + aggregate cap convention — Gate C.
- [ ] **D-13.12** — gold component disposition (affects whether XAU is an ACTIVE component at all) — Gates B/C.
- [ ] **D-13.5 / D-13.3 / D-13.4** — stability objective / what MTQΣ is / family selection (preconditions for final scoring calibration) — Gate B.
- [ ] **Gate C ratification** of the state machine (§3), scoring dimensions (§4), and transition rules (§5) as methodology version v3.0-ccy-registry-1.
- [ ] Cross-gated: authority migration (Task 12 D8 chain) must execute before any on-chain registry deployment; oracle source-independence (deliverable 10) must be resolved before T2 confirmations are honest.

## 15. What has NOT been tested / implemented (explicit)

NOT IMPLEMENTED: the entire registry model, state machine, scoring, transitions, glide paths, rounding rule, separation invariant (the pilot's own disclosure: "Constituency is STATIC… §4 eligibility scoring not live", `honest-status.ts:245`). NOT RUN: every test in §10 (no simulation, no backtest, no historical statistic for any threshold — none exists and none is invented here). NOT IMPLEMENTED: eligibility data feeds (BIS/AREAER/vendor ingestion does not exist in the codebase). UNVERIFIED: any claim about Foundry-suite behavior after a registry rewrite; any effectiveness of hysteresis against real data. The succession drill (`succession.ts:211`) is a read-only simulation of a *swap*, not this lifecycle, and instant-at-seed admission there is itself disclosed as not-live (`honest-status.ts:245`).

## 16. Mandate §6 / §5 compliance map (self-check; for orchestrator review)

| Mandate clause (§6 verbatim topic) | Section |
|---|---|
| Normalized inputs, units/ranges, missing-data, provenance | §4.1 |
| Eligibility, entry, normal retirement, emergency suspension, reinstatement defined separately | §3 (T1–T9; T7/T8 distinct) |
| Hysteresis + minimum observation periods | §4.2, §3 (T_obs_*, H, T_watch) |
| Weight floors, ceilings, redistribution, rounding, deterministic tie-breaking | §5.2–§5.4 |
| Every valid vector sums to 100% within declared tolerance | §5.3 |
| Excluded component retains no unintended positive minimum | §5.4 (CCY-EXCL-1) |
| Deterministic intermediate weights during transitions | §5.5 |
| Index continuity: no artificial gain/loss at rebalance boundaries | deliverable 5 §2.2 (divisor algebra) + §8 (IDX-CONT-*), cross-ref §5.6 |
| Configurable max basket size | §7 (D-13.11) |
| Separation from payment-instrument influence | §8 (INV-SEP-1) |
| No optimality/stability/manipulation-resistance/validation claims; parameters unapproved | throughout; §13 |

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
