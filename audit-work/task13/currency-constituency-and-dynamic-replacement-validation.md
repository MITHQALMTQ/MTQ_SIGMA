# MTQΣ — Currency Constituency & Dynamic Replacement — Validation Document (MANDATE-006 §16.2)

**Document ID:** MTQSIGMA-T13-CCY-VAL · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §3 (Adaptive currency constituency and dynamic replacement), §16.2, §19
**Controlling specification:** `currency-constituency-and-weight-transition-spec.md` (deliverable 4, PROPOSED v1). This document does **not** replace or compete with that specification — it validates the specification's coverage against every MANDATE-006 §3 requirement, maps the mandated acceptance tests, and states the honest implementation/test status.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

**Headline honest status (v2, MANDATE-007 cycle 2026-10-22):** dynamic currency replacement is `SPECIFIED` (proposal-level, with alternatives). **A NON-PRODUCTION PROTOTYPE now exists and its end-to-end substitution cycle is TESTED** (`evidence/dynamic-replacement/` — 15/15 assertions × 2 fresh runs, exit 0; all ten §4 behaviors + the §7 mandated scenarios demonstrated on a deterministic labeled dataset; parameters UNAPPROVED DRAFT). **The PRODUCTION system remains `NOT IMPLEMENTED`** — the production architecture is still static (see §6), so **no production capability claim may be made**: the MANDATE-006 §3.6 acceptance criterion is met **at prototype-evidence level only**, and production implementation stays gated on the approvals in §8. Original v1 headline (MANDATE-006 cycle) preserved: “dynamic currency replacement is `SPECIFIED` (proposal-level, with alternatives) and **`NOT IMPLEMENTED`** and **`NOT TESTED`**. No capability claim may be made. The codebase itself attests ‘Constituency is STATIC… §4 eligibility scoring not live’ (`honest-status.ts:245`) — still true for production.”

---

## 1. The requirement (SPECIFIED — owner direction, not reopenable)

Per MANDATE-006 §3: the basket must not be permanently restricted to its initial currencies merely because they were included at genesis or are easiest to encode in a contract. This is a **core functional requirement**, not an optional enhancement. The owner has stated this required capability (§18); what remains open is its precise technical implementation and required approvals.

## 2. Expandable candidate universe (SPECIFIED; registry NOT IMPLEMENTED)

The mandated registry maintains, per §3.1: active basket currencies · watch-listed currencies · eligible-but-excluded currencies · candidates awaiting adequate data · retiring and excluded currencies · emergency-suspended currencies · reinstated currencies undergoing renewed eligibility assessment.

- **Specification coverage:** the controlling spec §2–§3 defines the component registry model and the lifecycle `CANDIDATE → ELIGIBLE → ACTIVE → WATCH → RETIRING → EXCLUDED` plus a separate emergency-suspension path and controlled reinstatement (spec §3, §5.6). `SPECIFIED`.
- **Initial documented candidate universe:** USD, EUR, JPY, CNY, GBP, CHF, with candidates such as CAD, AUD, SGD and others considered through the approved methodology. This is an **initial research universe** — not a permanently closed list, and **not an approval** for any candidate. `SPECIFIED`.
- **Admission rule:** a candidate must not enter merely because it is not currently held; it must satisfy the **same admission methodology** as every other candidate. `SPECIFIED` (spec §4.2 hard gates).
- **Implementation:** none. The only current registries are the asset registry (whose members ARE basket instruments, `registry.ts:57-115`) and inert universe lists (`RESERVE_CURRENCY_UNIVERSE` 11 currencies, `DIGITAL_UNIVERSE` 7 stablecoins in `mtq-final-reserve-spec.ts:397-419`). `NOT IMPLEMENTED`.

## 3. Eligibility scoring (SPECIFIED; scoring NOT IMPLEMENTED)

The controlling spec §4 defines the scoring inputs (each normalized to [0,1] before aggregation), composite score, hard gates, and hysteresis. Coverage check against MANDATE-006 §3.2 — every mandated factor family is addressed in the spec's input table:

| Mandated input family (§3.2) | Spec coverage | Status |
|---|---|---|
| Monetary and inflation performance | Scoring inputs table (§4.1) | `SPECIFIED` |
| Relative exchange-rate behavior | Scoring inputs table (§4.1) | `SPECIFIED` |
| Purchasing-power characteristics | Scoring inputs table (§4.1) | `SPECIFIED` |
| Market liquidity and depth | Scoring inputs table (§4.1) | `SPECIFIED` |
| Convertibility and access | Scoring inputs table (§4.1) | `SPECIFIED` |
| International trade and payment relevance | Scoring inputs table (§4.1) | `SPECIFIED` |
| Economic and reserve significance | Scoring inputs table (§4.1) | `SPECIFIED` |
| Diversification contribution | Scoring inputs table (§4.1) | `SPECIFIED` |
| Volatility and downside behavior | Scoring inputs table (§4.1) | `SPECIFIED` |
| Geopolitical and capital-control risks | Scoring inputs table (§4.1) | `SPECIFIED` |
| Data quality and reliability | Scoring inputs table (§4.1) | `SPECIFIED` |

Per-input metadata obligations (§3.2: unit, direction, normalization, data source, update frequency, missing-data behavior, impact on the composite) are defined spec-side at §4.1; normalization and aggregation are defined mathematically at §4.1–§4.2, including zero-range, missing-observation, stale-data, and outlier handling.

**Anti-gaming rules (§3.2, restated as testable properties):** currency appreciation alone is not proof of deserving a larger weight; a temporarily weakening currency is not automatically removed; the methodology differentiates economic performance, FX performance, structural suitability, and risk. `SPECIFIED` — no implementation exists to test them against (`NOT IMPLEMENTED`).

## 4. Entry, retirement, and substitution — the ten mandatory behaviors (§3.3)

| # | Mandatory behavior | Spec coverage | Current status |
|---|---|---|---|
| 1 | Incumbent may move to WATCH on deteriorating indicators | Spec §3 (WATCH state), §4.2 | `SPECIFIED` / `NOT IMPLEMENTED` |
| 2 | Retirement begins only per exit threshold + persistence rule + mandatory conditions (emergency excepted) | Spec §4.2 hysteresis, §5.6 lifecycle | `SPECIFIED` / `NOT IMPLEMENTED` |
| 3 | System evaluates the entire admissible universe, including eligible currencies outside the basket | Spec §4 (whole-universe scoring) | `SPECIFIED` / `NOT IMPLEMENTED` |
| 4 | A qualifying candidate may replace a retiring currency if it meets the entry threshold and all eligibility conditions | Spec §3 (substitution), §4.2 | `SPECIFIED` / `NOT IMPLEMENTED` |
| 5 | Retiring weight redistributed through an explicit, deterministic transition policy | Spec §5.4 (redistribution; exclusion-zero guarantee) | `SPECIFIED` / `NOT IMPLEMENTED` |
| 6 | Entrant weight ramps per its approved transition schedule | Spec §5.6 (transition lifecycle semantics; deterministic intermediate weights §5.5) | `SPECIFIED` / `NOT IMPLEMENTED` |
| 7 | All intermediate weights valid and sum to 100% within declared tolerance | Spec §5.3 (normalization to exactly 100%, rounding, tie-breaking) | Submission-time checks only today (V2 `submitTargetWeights` sum==1e18); transition-period checks `NOT IMPLEMENTED` |
| 8 | Fully excluded component has **exactly zero** weight — no unintended positive minimum | Spec §5.4 | **Defect recorded:** V2 `submitTargetWeights` is positive-weights-only — a departure cannot reach 0 (`baseline-and-change-matrix.md` §5 Stage C). `NOT IMPLEMENTED` |
| 9 | Index remains continuous across a rebalance per the chain-link methodology — no artificial gain/loss from composition change | Reference-index spec §2.2 (zero-artificial-gain/loss proof design) | `SPECIFIED`; **untestable today** — composition cannot change (static 7) |
| 10 | Entire decision reproducible from published inputs, scoring rules, methodology version, and transition state | Spec §4.3 (recording obligation) | `SPECIFIED` / `NOT IMPLEMENTED` |

## 5. Hysteresis and anti-oscillation (SPECIFIED; NOT IMPLEMENTED)

Per §3.4, the spec defines **separate entry and exit thresholds**, persistence windows, observation requirements, minimum transition duration, and reinstatement criteria (spec §4.2, §5.6): a recently excluded currency must not re-enter on a short-lived score improvement; a WATCH currency must not oscillate on insignificant daily fluctuations. **Emergency suspension must not be blocked by ordinary hysteresis** when a material data-integrity or market-access risk is established (spec §3 emergency path; `oracle-and-emergency-state-spec.md` §6, D-13.17). All `SPECIFIED` / `NOT IMPLEMENTED` / `NOT TESTED`.

## 6. Fixed-size implementation limitations — removal plan (§3.5)

The fixed-seven hard-coding inventory (VERIFIED, file:line citations in `baseline-and-change-matrix.md` §7): `blueprint.ts:22-30/55-62/78-96/241-246`; `chain-index.ts:236-241` (`!== 7` throw); `mase.ts:10-11`; `currency.ts:5-23`; `genesis.ts:120-128`; `registry.ts:57-115`; `oracle.ts:685-742` (6 legs); V2/V3 `bytes3[7]`/`uint256[7]`/enum/immutable constants with `setEnvelopes` unable to change count and **positive-weights-only** submission; deployed v1.2 = 5-currency fixed with gold hard-coded at index 6 and legacy 26.25%±3% clamps (`MtqEcosystem.sol:143,159`).

**Mandated redesign (SPECIFIED):** registry-based representation with **stable component identifiers** and an **explicit versioned component set**; defined historical index calculation after membership changes; **no silent position assignment, no currency-identifier reuse, no weakening of weight constraints** to simulate support. The controlling spec §2 defines this model (registry schema, versions, governance refs).

**Deployed-contract incompatibility (recorded, per §3.5):** the deployed v1.2 estate **cannot support dynamic membership safely** — documented here as the incompatibility finding; the clean-replacement path is the v3.0 clean-slate program (D-13.4 proposed), with the legacy estate's disposition a separate decision (D-13.22). **No deployed contract may be altered or migrated without separate approval** (and all on-chain action is further blocked by the Task 12 authority chain).

## 7. Required currency-substitution acceptance tests (§3.6) — mapping and status

The mandated deterministic test set, mapped to the planned Stage-K families (spec §10; `test-matrix-and-results.md` §3). **None exist; none have run.** Status column is the honest current state:

| Mandated test (§3.6) | Planned family | Status |
|---|---|---|
| GBP falls below exit threshold while an eligible excluded candidate qualifies to replace it | CCY-LC (lifecycle) | `NOT IMPLEMENTED` |
| CHF qualifies for entry while an incumbent remains eligible | CCY-LC / SCORE | `NOT IMPLEMENTED` |
| Both currencies remain if both qualify | CCY-LC | `NOT IMPLEMENTED` |
| No substitution when no excluded candidate satisfies entry conditions | CCY-LC | `NOT IMPLEMENTED` |
| Temporary deterioration triggers WATCH but not retirement | HYS (hysteresis) | `NOT IMPLEMENTED` |
| Entrant falls below eligibility threshold during transition | ANN (anniversary/transition) | `NOT IMPLEMENTED` |
| Emergency suspension from stale/manipulated data | EMER + T-ORC | `NOT IMPLEMENTED` |
| Reinstatement after required evidence and observation window | CCY-LC | `NOT IMPLEMENTED` |
| Zero-weight enforcement for an excluded component | EXCL | `NOT IMPLEMENTED` |
| Exact weight-sum preservation throughout the entire transition | CCY-SUM / CCY-BOUND | `NOT IMPLEMENTED` |
| Index continuity during membership changes | IDX-CONT-* | `NOT IMPLEMENTED` |
| Reproducibility from identical data, methodology version, prior state | CCY-REPRO | `NOT IMPLEMENTED` |

**Acceptance criterion (MANDATE-006 §3.6):** prove a complete test cycle where a previously excluded eligible currency replaces a retiring incumbent **without breaching the weight invariants or creating an artificial index jump**. **MANDATE-007 update (2026-10-22): the cycle is now DEMONSTRATED at non-production prototype level** — `evidence/dynamic-replacement/run-dynamic-replacement-e2e.ts` executes the complete substitution (GBP retirement ← CHF entry) with exclusion at exactly 0 bp, every intermediate vector summing to 100% within 1e-9, and composition-only index delta 0.000e+0 (15/15 PASS × 2 runs, exit 0). **NOT MET at production level** — the production architecture remains static per §6 and per the mandate: no capability is implemented or operational in production, and no such claim may be made until the production redesign passes source review and recorded tests under the §8 approvals.

## 8. Honest status summary (v2 — MANDATE-007 cycle 2026-10-22; production columns unchanged, prototype column added)

| Capability | Specified | Implemented (production) | Implemented (non-production prototype) | Tested (prototype) | Deployed |
|---|---|---|---|---|---|
| Expandable candidate universe + registry | YES (proposal) | NO | **YES** (`evidence/dynamic-replacement/constituency-lifecycle.ts` — dynamic membership, stable IDs, no position reuse) | YES (DR-02/03/08) | NO |
| Eligibility scoring + hysteresis | YES (proposal) | NO | **YES** (composite score, hard gates, entry/exit persistence windows, WATCH-not-retirement) | YES (DR-01/02/09/14) | NO |
| Entry/retirement/substitution lifecycle | YES (proposal) | NO | **YES** (full CANDIDATE→…→EXCLUDED + emergency + reinstatement) | YES (DR-01..DR-15) | NO |
| Exclusion-zero + sum-preservation transitions | YES (proposal) | NO (positive-weights-only defect recorded) | **YES** (exclusion exactly 0 bp; max sum deviation 2.220e-16) | YES (DR-04/05/15) | NO |
| Index continuity at composition change | YES (design) | NO (untestable — static composition) | **YES** (chain-link adjustment; composition-only delta 0.000e+0) | YES (DR-06) | NO |
| Emergency suspension + reinstatement | YES (proposal) | NO | **YES** (hysteresis-bypassing suspension; observation-window reinstatement) | YES (DR-13/14) | NO |
| Full substitution acceptance cycle | design defined | NO | **YES — demonstrated** (15/15 × 2 runs, exit 0) | YES | NO |
| Full-decision reproducibility from versioned inputs | YES (spec §4.3) | NO | **YES** (sha256-tagged dataset; decision record byte-identical on re-run; perturbed input → different digest) | YES (DR-07) | NO |

**Production statuses in this table are unchanged from v1** — the prototype column records MANDATE-007 §3 non-production evidence ONLY (prototype ≠ production authorization). Full results: `evidence/dynamic-replacement/RESULTS.md`.

**Blocking approvals:** Gate B (D-13.3–D-13.7) → D-13.11 (max basket size), D-13.14 (rounding/sum conventions), D-13.12 (gold disposition), D-13.13 (GPP); Task 12 D8 authority chain for any on-chain step. Numerical draft parameters remain UNAPPROVED (spec §13).

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
