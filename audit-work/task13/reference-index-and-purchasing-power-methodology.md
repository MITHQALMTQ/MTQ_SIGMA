# MTQΣ — Reference Index & Purchasing-Power Methodology (MANDATE-006 §16.4)

**Document ID:** MTQSIGMA-T13-IDXPP · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §5 (Purchasing-power evaluation and Global Purchasing Power) + §6 (Published reference index and continuity), §16.4
**Controlling specifications:** `reference-index-and-gold-methodology.md` (deliverable 5 — construction/gold/GPP options) · `currency-constituency-and-weight-transition-spec.md` (deliverable 4) · `quantitative-validation-plan.md` (Stage J benchmark program) · `v3-purchasing-power-validation-plan.md` (v3.0 architecture-level plan). This document consolidates the index + purchasing-power methodology view without duplicating or competing with those files.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

## 1. The three measurements, restated (binding rule for this document)

**A. Monetary reference index** (the mathematical value of the adaptive currency-and-gold methodology) · **B. Purchasing-power performance** (whether the reference unit holds up against a defined basket of goods and services over time) · **C. Token market price** (what market participants actually trade MTQΣ at). No component of this methodology may conflate the three; a better index result does not imply better purchasing-power performance, and neither implies the token trades near the index (`mtqsigma-owner-objective-and-architecture.md` §1.3).

## 2. Published reference index — construction requirements (MANDATE-006 §6)

| Requirement | Current state | Status |
|---|---|---|
| Immutable, clearly defined base date and base fixings, subject to the approved correction process | `chain-index.ts` implements the chain-linked calculation with defined base fixings (incl. CHF 1.13, XAU $2,500 at `blueprint.ts:55-62`) and COO-17 base-relative basis; genesis seven-step `verifyIndexBase` | `IMPLEMENTED` + `TESTED` in the TS reference layer; base-date governance (immutability/correction process) `SPECIFIED` (PROPOSED) |
| Explicit price quotations and base normalization | Defined in `blueprint.ts` fixings + chain-index normalization | `IMPLEMENTED` (reference layer) |
| Deterministic calculation from a versioned weight vector and versioned price data | Deterministic engine; weight states (Prior/Target/Smooth/Execution) versioned in the reference layer | `IMPLEMENTED` (reference layer); full input-versioning/provenance publication `SPECIFIED` |
| Formal chain-link divisor adjustment at each approved weight or membership transition | Divisor algebra D_t implemented; zero-artificial-gain/loss proof designed (deliverable 5 §2.2) | `IMPLEMENTED` for weight rebalances; **membership transitions untestable — composition cannot change today** (static 7) |
| Transparent decomposition of index changes into currency and gold contributions | Designed (deliverable 5 §3 publication surface — the six separately published values) | `SPECIFIED` (PROPOSED) / `NOT IMPLEMENTED` |
| Reproducible historical recalculation | Backtest reproduces the index 2015–2025 (historical-backtest.ts, INV-1..INV-5) | `TESTED` (reference layer, static composition) |
| Defined treatment of revised source data | Revision policy + vintage discipline: `quantitative-validation-plan.md` §3.4 | `SPECIFIED` (PROPOSED) |
| Stale-price, missing-price, inconsistent-price, oracle-failure behavior | `oracle-and-emergency-state-spec.md` (five-state classification, fail-closed DEGRADED target D-13.15); no invented replacement prices; explicit stale-data or suspension policy | `SPECIFIED` (PROPOSED); pilot divergence (redeem fail-open on DEGRADED) recorded, to close under D-13.15 |
| Published record of each methodology version and index update | Publication surface design (deliverable 5 §3) | `SPECIFIED` (PROPOSED) / `NOT IMPLEMENTED` |

**The system must distinguish a genuine market movement from a methodology transition** — when a component enters or exits, no artificial increase or decrease may be introduced merely by changing basket composition (§6; the zero-artificial-return property, designed as the IDX-CONT-* acceptance set). If reliable inputs cannot be obtained, follow the explicit stale-data or suspension policy; **never invent a replacement price or let invalid data silently propagate.**

## 3. Global Purchasing Power (GPP) — formalization requirements (MANDATE-006 §5.2)

GPP continues from the existing blueprint as a **separate evaluation methodology** — it must not be quietly incorporated into the index formula (§5.1); incorporation would be a deliberate, documented, approved change. The ten mandated specification items and current coverage (options paper at `reference-index-and-gold-methodology.md` §5; decision **D-13.13 OPEN**: index leg / MASE objective / exclude-from-initial-composition):

| Mandated item (§5.2) | Coverage | Status |
|---|---|---|
| Included countries or regions | GPP options drafted with candidate country sets | `SPECIFIED` (draft options) |
| Consumer basket and category coverage | Drafted | `SPECIFIED` (draft options) |
| Consumption weights and their source | Drafted (consumption-share weighting to be sourced from a defined statistical authority) | `SPECIFIED` (draft options) |
| CPI or equivalent price-index sources | Drafted (CPI-family inputs; publication lags and revisions noted) | `SPECIFIED` (draft options) |
| Treatment of food, energy, housing, services, traded goods | Drafted category treatment | `SPECIFIED` (draft options) |
| Data frequency, publication lags, revisions, base periods | Drafted + vintage discipline (`quantitative-validation-plan.md` §3.4) | `SPECIFIED` (draft options) |
| Normalization, currency conversion, aggregation rules | Drafted | `SPECIFIED` (draft options) |
| Missing or discontinued data | Drafted (missing-data injection tests VAL-DATA planned) | `SPECIFIED` (PLANNED) |
| Geographic bias and consumption-pattern differences | Drafted as an explicit limitation | `SPECIFIED` (draft options) |
| Outlier detection and data-quality controls | Drafted | `SPECIFIED` (draft options) |

**Honesty rule (§5.2, verbatim effect):** GPP must never be described as a guaranteed measure of every person's purchasing power. It is an explicitly defined benchmark with documented coverage and limitations. Status: **no GPP dataset is onboarded; no GPP evaluation has been computed; zero runs.** All numeric parameters remain unapproved.

## 4. Required comparative validation (MANDATE-006 §5.3) — design, not results

Before any claim that the adaptive model is superior, it must be compared against **five arms** with consistent data periods, valid point-in-time data, and documented evaluation procedures:

1. A **fixed-weight currency basket**.
2. A **gold-inclusive static basket**.
3. An appropriate **established reference benchmark, such as the SDR**, with its differences clearly explained (SDR = IMF-defined fixed basket of 5 currencies with 5-yearly review weights, no gold leg, no adaptive mechanism, no purchasing-power objective — the comparison is illustrative of an external anchor, not an equivalence).
4. The **separately defined purchasing-power benchmark** (GPP per §3 above).
5. The **adaptive MTQΣ methodology**.

**At least eleven measured dimensions** (§5.3): real purchasing-power change · inflation-adjusted performance · index volatility and maximum drawdown · downside and tail behavior · currency and gold concentration · contribution from individual components · turnover in reference weights · sensitivity to input and coefficient changes · regime dependence · data-outage and manipulation tolerance · benchmark-relative performance.

**Method discipline:** in-sample, out-of-sample, walk-forward, sensitivity, and stress testing; guards against look-ahead bias, survivorship bias, and choosing parameters after observing favorable results; **pre-register the methodology and acceptance criteria before the principal validation campaign** (D-13.25). The benchmark arms, metric definitions, windows, and leakage-controlled protocol are specified in `quantitative-validation-plan.md` (Stage J) — **PLANNED, NOT RUN**.

**Prohibition (verbatim effect, §5.3):** the prior reserve-era S3 survival result, reserve ratio, or minimum reserve ratio may **not** be used as evidence that v3.0 preserves purchasing power — the earlier S3 run did not validate the no-reserve v3.0 architecture (full separation analysis: `layer7-economic-meaning-review.md`; `v3-purchasing-power-validation-plan.md` §1 non-substitution rule). **No purchasing-power superiority claim may be made until the evidence exists and has been independently reviewed.**

## 5. Data policy (index inputs)

Data handling must be designed and tested for: currency exchange rates · gold prices · purchasing-power benchmark data · eligibility-scoring inputs · any stablecoin valuation feeds · CBDC settlement confirmation sources (§10 of MANDATE-006; the oracle specification `oracle-and-emergency-state-spec.md` governs): source independence, quorum where appropriate, timestamp limits, staleness thresholds, confidence requirements, deviation tolerances, outlier treatment, fallback logic. Temporary data unavailability must be separated from genuine eligibility deterioration — the system must not drop a currency merely because one provider fails, nor keep using a materially unreliable price indefinitely because removal is inconvenient (states: normal · WATCH · retirement · emergency suspension · recovery · reinstatement). Multi-source independence must be **tested**, not assumed from provider names in a document (V3M-ORC-1; A-1…A-7 attack surface). **Current reality: single live upstream per pair with synthetic 3-source witnesses — independence NOT met** (disclosed; D-13.16 remediation required before any index-quality claim).

## 6. Honest status summary

| Capability | Specified | Implemented | Tested | Validated |
|---|---|---|---|---|
| Chain-linked reference index (static composition) | YES | YES (reference layer) | YES (Layers 1–6; backtest) | Reserve-era tests only — **not v3.0 validation** |
| Chain-link continuity at membership change | YES (design) | NO (composition static) | NO | NO |
| Decomposition + publication surface (six values) | YES (design) | NO | NO | NO |
| GPP benchmark | YES (draft options, D-13.13) | NO | NO | NO |
| Five-arm comparative campaign | YES (plan) | NO | NO — **zero runs** | NO |
| Data policy (independence, staleness, fail-closed) | YES (spec) | PARTIAL (pilot: staleness bounds; independence NOT met; DEGRADED redeem divergence open) | Partial | NO |

**Blocking approvals:** D-13.13 (GPP), D-13.14 (rounding/precision), D-13.15/16/17 (oracle/emergency), D-13.25 (pre-registration), D-13.26 (validator independence), plus Gate B for any model-binding choice.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
