# MTQΣ — v3.0 PURCHASING-POWER VALIDATION PLAN (separate from the legacy S3 result)

**Document ID:** MTQSIGMA-V3-VALIDATION-PLAN · **Date:** 22 October 2026
**Renamed this cycle:** `v3-quantitative-validation-plan.md` → **`v3-purchasing-power-validation-plan.md`** per MANDATE-006 §16.8 (git history preserved; all prior citations of the old name refer to this file). Content updated the same cycle: §9 (MANDATE-006 §11 risk-family coverage map) and §10 (MANDATE-006 §11.1/§11.3 pre-registration and independent-evidence requirements) added; §5.3 comparative arms cross-referenced.
**Mandate:** MTQSIGMA-COO-MANDATE-005 Priority 3 — *"Design a separate v3.0 quantitative validation plan tied to the selected model. Do not reuse reserve-ratio success as a substitute for testing market, index, oracle, supply, or operational risks."* — extended by **MANDATE-006 §5.3/§11/§16.8** (purchasing-power comparative validation + required risk families + pre-registration).
**STATUS: PLANNED (v1.1) — VALIDATION NOT RUN.** Zero v3.0 validation runs exist. No scenario, window, metric, or comparison below has been executed. No effectiveness claim is made or implied by this document.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

**Purchasing-power framing (MANDATE-006 §1.2/§5.3):** the owner's objective is long-term purchasing-power resilience measured against **a separately defined and independently reproducible purchasing-power benchmark** — index-quality metrics alone are insufficient. The five-arm comparative campaign (fixed-weight basket · gold-inclusive static basket · an established external reference such as the SDR with differences explained · the purchasing-power benchmark (GPP per D-13.13) · the adaptive MTQΣ methodology) and the eleven measured dimensions are specified at the methodology level in `reference-index-and-purchasing-power-methodology.md` §4 and executed under this plan's Stage-J extension (`quantitative-validation-plan.md` §4–§7, cross-referenced — not duplicated). **No purchasing-power superiority claim may be made until the evidence exists and has been independently reviewed.**

---

## 1. Why this plan is separate — the non-substitution rule

The only quantitative stochastic results in the repo today (`layer7-economic-meaning-review.md`; `evidence/canonical-layer7/`) belong to the **reserve-era family**: they measure a modeled **reserve ratio** under synthetic shocks. The v3.0 architecture (per the Gate-B proposals, D-13.3–D-13.7) has **no reserve, no redemption promise, and no price-alignment mechanism** — the reserve ratio is not merely unimportant in v3.0, it is **undefined** there.

**Non-substitution rule (standing):**
1. Reserve-ratio metrics — survival %, minimum RR, breach rates — are **legacy-family metrics**. They are **prohibited** as v3.0 acceptance criteria in any form, direct or derived.
2. The Layer-7 PASS (S3 42.5% vs the 35.1% legacy comparison figure; S5 100%/1.110; S6 both) is **inadmissible as v3.0 evidence** — it validates nothing about a no-reserve architecture, market-price behavior, or any v3.0 module.
3. Passing a v3.0 software test is **code-quality evidence only** — never economic safety, market acceptance, or regulatory acceptability.
4. The v3.0 quantitative validation is **NOT PERFORMED** until the runs in this plan are executed under the pre-registration (D-13.25) and validator-independence (D-13.26) protocols.

This plan extends — and does not duplicate — the Stage-J index-benchmark program (`quantitative-validation-plan.md`, deliverable 11), which validates the **adaptive index methodology** against benchmarks. This document adds the **v3.0-architecture-level** program: market, oracle, supply, and operational risk, plus the index-risk items Stage J does not cover. Where the two overlap (index benchmarking), Stage J governs and is cross-referenced.

## 2. Model binding

This plan is drafted for the advisory model **M1 + M4** (floating market-priced token + structural separation) because that is the recommended Gate-B outcome — **but Gate B is not closed, so nothing here is active.** The plan re-bases before any run if the owner selects differently:

| If Gate B selects… | Plan status |
|---|---|
| M1 + M4 (advisory) | Runs as written below |
| M2 (index-linked obligation) | Add obligor-performance, hedge-book, and tracking-error-breach families; add counterparty-default scenarios; re-base §3.1 |
| M3 (redemption facility) | Add redemption-run, facility-solvency (a reserve-style RR returns — but for the facility, explicitly labeled), haircut/suspension-rule families; largest scope change |
| Deferral | Plan dormant; no v3.0 validation claims of any kind are permitted |

**Phase 0 precondition:** Gate B closed (D-13.3–D-13.7 decided) **and** the corrected Layer-8 baseline green (D-13.26 evidence pack applied and the §9 regression set passed) **and** the Task 12 authority-migration chain complete for anything that touches chain state. Specification and test *development* may proceed under Gate B closure alone; **no deployment, signing, or live-chain action is authorized by this plan at any phase.**

## 3. The five v3.0 risk families (all PLANNED — none implemented, none run)

### 3.1 Market risk — V3M-MKT (token price vs the index)
What must be characterized: the **divergence between the token's market price and the reference index**, with no mechanism assumed to close it.
- **V3M-MKT-1 · Structural-no-anchor verification (design-stage, implementable first):** negative tests that (i) no price-alignment mechanism exists in the v3.0 codebase (no mint/burn coupled to price, no redemption path, no treasury intervention hook) and (ii) no interface string implies one. This is a *test-of-absence* proving the D-13.5 wording is implemented honestly.
- **V3M-MKT-2 · Synthetic market simulation (labeled SIMULATED):** agent-based or stochastic price paths with **no assumed anchor** to the index; measure divergence statistics (mean, tail, persistence), reaction to index jumps, and the behavior of payment quotes under divergence. Every liquidity/depth/participation assumption must be disclosed as an assumption. **Outputs may not be used to claim stability, tracking, or value support — the family exists to quantify and disclose divergence, not to minimize it.**
- **V3M-MKT-3 · Extreme-divergence scenarios:** sustained premium/discount regimes; index-quoting-under-divergence (does the payment layer degrade gracefully, disclose, or fail closed per its spec).
- **V3M-MKT-4 · Post-launch monitoring design (design deliverable, not a run):** the metrics, data sources, and disclosure cadence for reporting market-vs-index divergence once a live market exists.
- **Explicitly out of scope for simulation claims:** real market acceptance, real liquidity, real price behavior — no simulation result may be presented as a forecast.

### 3.2 Index risk — V3M-IDX (computation, error, and continuity)
- **V3M-IDX-1 · Computation correctness:** recomputability — an independent implementation from the published methodology reproduces the reference implementation bit-for-bit within disclosed tolerances (extends Stage-J §2 leakage controls).
- **V3M-IDX-2 · Error propagation:** input-error injection (bad ticks, mispriced sources, stale vintages) → measured index impact vs pre-registered bounds; revision policy exercised.
- **V3M-IDX-3 · Continuity at composition changes:** divisor-framework continuity tests at every transition type in the constituency spec (IDX-CONT-* set, deliverable 4/5); no artificial jumps at rebalance boundaries (the zero-artificial-return property proven at the fixture level).
- **V3M-IDX-4 · Benchmark comparisons:** per Stage-J (historical + stress windows, the eight mandated metric families) — **cross-referenced, not duplicated**; acceptance criteria stay symbolic until D-13.25 pre-registration.
- **V3M-IDX-5 · Bad/missing-data control verification:** the D-13.5 §(v) behaviors — staleness, disagreement, fail-closed transitions — exercised per the oracle spec's twelve-scenario map (deliverable 10) and proven to degrade the index honestly (disclosed, not silently smoothed).

### 3.3 Oracle risk — V3M-ORC
- **V3M-ORC-1 · Independence standard (D-13.16):** ≥3 independent upstreams per pair before any index-quality claim; verify no silent single-upstream fallback.
- **V3M-ORC-2 · Manipulation injection:** the A-1…A-7 attack surface (deliverable 10) driven adversarially — spikes, slow-drift divergence, witness collusion, timestamp games; measures: detection time, discard correctness, index impact, disclosure.
- **V3M-ORC-3 · Staleness and state machine:** five-state classification, HALTED vs STALE, recovery; the fail-closed DEGRADED target (D-13.15) and the known redeem-on-DEGRADED divergence closure.
- **V3M-ORC-4 · Emergency coupling:** oracle-emergency interlocks (circuit breakers, correlation warnings §17.9) under concurrent index stress.

### 3.4 Supply risk — V3M-SUP
- **V3M-SUP-1 · Governed-issuance correctness:** issuance only via the defined authority + caps + timelocks + disclosure path; per-action seven-ledger accounting reconciles; replay/idempotency protections hold.
- **V3M-SUP-2 · No-automatic-minting negative tests (the D-13.6 wording as executable claims):** (i) no payment-volume→supply coupling; (ii) no rebalance→supply coupling; (iii) no operational-metric→supply coupling. Test-of-absence, like V3M-MKT-1.
- **V3M-SUP-3 · Fixed-cap enforcement:** cap cannot be exceeded under any governed path, including concurrent-chain issuance attempts; burn accounting symmetric.
- **V3M-SUP-4 · Cross-chain duplicate-supply prevention (D-13.10):** the selected cross-chain model's invariants (per the cross-chain review) under adversarial sequences — double-issuance attempts, replay across chains, reconciliation divergence.
- **V3M-SUP-5 · Authority separation:** minter/issuer/burner/timelock roles cannot be collapsed (extends the Task 12 authority packages into v3.0 tests).

### 3.5 Operational risk — V3M-OPS
- **V3M-OPS-1 · Settlement finality and refund paths:** quote expiry, partial-fill, refund, three-book reconciliation (payment spec deliverable 6).
- **V3M-OPS-2 · Emergency state machine:** entry/exit correctness, pause scope, fail-closed target; the four-state operation table (deliverable 10).
- **V3M-OPS-3 · Recovery and idempotency:** crash/replay at every state transition; ledger reconciliation after recovery.
- **V3M-OPS-4 · Governance operationality:** timelock accuracy, disclosure emission, upgrade-path authorization under the three-role separation.

## 4. Methodology requirements (all runs)

1. **Pre-registration (D-13.25):** every threshold, window, and acceptance bound is symbolic (UNAPPROVED) until pre-registered before the corresponding run; post-hoc thresholds are void.
2. **Validator independence (D-13.26):** validators ≠ designers; the graded runs are executed and signed by the independent validator; leakage-controlled data splits (time-only; no scenario fitting).
3. **Synthetic-data labeling:** every SIMULATED input is labeled in the artifact and in any derived report (evidence-status legend, `README.md`).
4. **Determinism and replay:** every run reproducible from a recorded seed/vector set; divergence from a replay is a finding, not noise.
5. **Prohibited metrics list (re-stated):** survival %, minimum reserve ratio, breach-count-vs-reserve-floor — legacy-family metrics, barred from v3.0 acceptance.

## 5. Acceptance criteria — symbolic (every row UNAPPROVED until D-13.25 pre-registration)

| Family | Draft acceptance direction (symbolic) | Meaning if met | Never means |
|---|---|---|---|
| V3M-MKT | Divergence statistics characterized and disclosed; no-anchor structure verified; monitoring live-design approved | The market-risk posture is **measured and disclosed** | Price stability, tracking, liquidity, market acceptance |
| V3M-IDX | Recomputability within tolerance; continuity at every transition; error impact within pre-registered bounds; Stage-J criteria met | The index behaves as published | Holders' value protection; price support |
| V3M-ORC | Independence standard met; every A-scenario detected/handled per spec; fail-closed verified | Oracle stack integrity under adversarial input | Manipulation-immunity claims beyond tested scenarios |
| V3M-SUP | No ungoverned supply path exists (proven); cap holds; cross-chain duplicates impossible under the selected model | Supply governance is enforceable | Monetary-policy optimality |
| V3M-OPS | Finality/refund/emergency/recovery behave per spec under fault injection | Operational readiness of the design | Production readiness (separate release gates) |

**The "validated" label is forbidden** until the independent validator completes the graded runs under §4 — and even then it means "the v3.0 design met its pre-registered quantitative criteria," never economic safety, value support, or regulatory acceptability.

## 6. Sequencing (all phases PROPOSED)

- **Phase 0 (preconditions):** Gate B closed · D-13.26 re-pins applied + full regression green · D-13.25/D-13.26 protocols ratified.
- **Phase 1 (design-stage structural & negative tests):** V3M-MKT-1, V3M-SUP-2, and the spec-level acceptance tests already named in deliverables 4–10 (no market data needed; implementable as tests).
- **Phase 2 (synthetic scenarios):** V3M-MKT-2/3, V3M-IDX-2/5, V3M-ORC-2/3/4, V3M-OPS-1…4 (SIMULATED-labeled).
- **Phase 3 (independent graded runs):** validator executes the pre-registered set; grades against pre-registered bounds.
- **Phase 4 (post-launch monitoring):** deploy only after all release gates; monitoring per V3M-MKT-4 and the honest-status disclosure cadence.

## 7. What this plan does NOT do

- Does not authorize deployment, signing, minting, burning, transfer, or any live-chain action at any phase.
- Does not convert any passing result into economic, legal, or marketing claims.
- Does not reuse or re-badge the Layer-7 reserve-era results (§1 non-substitution rule).
- Does not select numerical parameters — supply cap, allocations, issuance schedule remain separate owner approvals.

## 8. Dependencies and owner decisions (all OPEN)

Gate B (D-13.3–D-13.7) · D-13.10 (cross-chain supply model) · D-13.15/16/17 (oracle/emergency) · D-13.18/19 (payment registry) · D-13.25 (pre-registration) · D-13.26 (validator independence) · D-13.27 (payment-issuance reconciliation, opened MANDATE-006 cycle) · Task 12 D8 authority chain (for anything touching chain state).

*(Annotation 2026-10-23, Task M8-2b: D-13.27 above is now **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION** — ALT-4 hybrid + periodic attestation + the four sub-decisions + fee/quote FORM, full record: `payment-instrument-registry-and-settlement-spec.md` §14.6 REVISION 2; production implementation remains gated, so for validation-program purposes D-13.27's owner-ratification dimension stays open. Every other dependency in this list remains OPEN.)*

## 9. MANDATE-006 §11.2 risk-family coverage map (added 2026-10-22 — every mandated family must be covered; none is run)

| MANDATE-006 §11.2 family | Covered by (existing plan families + Stage-J siblings) | Status |
|---|---|---|
| **Purchasing-power risk** (index vs the approved GPP benchmark; inflationary and deflationary periods) | Stage-J VAL-* arms incl. the purchasing-power benchmark arm (`quantitative-validation-plan.md` §4, §6.2; `reference-index-and-purchasing-power-methodology.md` §4) — the primary purchasing-power evaluation | `SPECIFIED` (PLANNED) — **zero runs** |
| **Currency risk** (divergence, correlated depreciation, crisis regimes, eligibility changes, candidate substitutions) | V3M-IDX-3 (continuity at every constituency transition) + Stage-J crisis windows + CCY-LC/HYS fixture sets (`currency-constituency-and-dynamic-replacement-validation.md` §7) | `SPECIFIED` (PLANNED) — zero runs |
| **Gold risk** (drawdowns, rallies, volatility, stale prices, source disagreement, weight interactions) | V3M-IDX-2/5 + V3M-ORC-2/3 + Stage-J gold-shock stress windows; the reserve-era S5/S6 gold-shock results are **inadmissible** (§1) | `SPECIFIED` (PLANNED) — zero runs |
| **Index risk** (recomputation accuracy, chain-link continuity, normalization, reproducibility, revisions, retire→enter transitions) | V3M-IDX-1/2/3/5 (recomputability by an independent implementation; error propagation; IDX-CONT-* continuity; revision policy §3.4) | `SPECIFIED` (PLANNED) — zero runs |
| **Oracle risk** (manipulation, outages, source dependence, stale data, fail-closed) | V3M-ORC-1…4 (independence standard D-13.16; A-1…A-7 injection; five-state machine; emergency coupling) | `SPECIFIED` (PLANNED) — zero runs |
| **Supply risk** (issuance authorization, cap enforcement if approved, accounting consistency, duplicate-issuance prevention, cross-chain integrity) | V3M-SUP-1…5 (governed issuance; no-automatic-minting negative tests; cap; cross-chain duplicates; authority separation) | `SPECIFIED` (PLANNED) — zero runs |
| **Payment risk** (stablecoin depegs, settlement finality, failed payments, CBDC access restrictions, adapter failures, reconciliation errors) | V3M-OPS-1 (finality/refund/three-book) + T-PAY-01…03 (`payment-instrument-registry-and-settlement-spec.md` §8, §14) | `SPECIFIED` (PLANNED) — zero runs |
| **Operational & governance risk** (concurrency, recovery, emergency states, permissions, auditability, methodology-version control) | V3M-OPS-2/3/4 + V3M-SUP-5 + the release-gate/controls suites (already exercised repo-side: 13/13, 12/12) | Design `SPECIFIED`; recovery/concurrency fault-injection `PLANNED` — zero v3.0 runs |

## 10. MANDATE-006 §11.1/§11.3 — pre-registration and independent-evidence requirements (added 2026-10-22; restates and binds this plan)

**Before the principal validation campaign (§11.1):** the approved methodology version · the candidate universe and data period · benchmarks and evaluation metrics · the in-sample/out-of-sample split · the recorded parameter-selection process · established acceptance thresholds with their rationale · the identified independent validator and their independence criteria — all recorded **before** any graded run; the pre-registration (D-13.25) and validator-independence (D-13.26) approvals remain the gating decisions, subject to their designated owner approvals.

**Independent evidence (§11.3):** all test commands, source versions, dataset versions, parameter values, output hashes where appropriate, failed scenarios, and limitations are recorded per run. **Prohibited conclusions (verbatim effect):** the model may not be described as validated, optimal, superior, stable, or robust merely because a simulation passes a narrow acceptance test. **Failure protocol:** if results fail the pre-registered acceptance criteria, report the failure and return to design review — **never adjust criteria after seeing the outcome.**

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
