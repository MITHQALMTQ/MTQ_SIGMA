# MTQΣ — Owner Objective & Architecture (MANDATE-006 §16.1)

**Document ID:** MTQSIGMA-T13-OBJARCH · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 (Comprehensive Owner Mandate, v1.0) §1–§2, §16.1
**Status: PRODUCED (v1).** This document consolidates the owner's monetary objective and the conceptual architecture. It executes no code, approves no parameter, advances no gate, and selects no model.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence labels per `README.md`: `SPECIFIED` (defined in an approved or proposed document) · `IMPLEMENTED` (present in actual source code) · `TESTED` (a reproducible test has passed) · `DEPLOYED` (source identity and deployed instance verified) · `INDEPENDENTLY VALIDATED` · `APPROVED` · `UNVERIFIED / OPEN / FAIL`. Where prior Task 13 statuses are cited (`VERIFIED / DEVELOPER-REPORTED / SIMULATED / PROPOSED / NOT IMPLEMENTED`), the MANDATE-006 label is shown alongside.

---

## 1. The owner's monetary objective

### 1.1 The concept being preserved (SPECIFIED — owner direction, MANDATE-006 §1.1)

MTQΣ's monetary core is the owner's proposed **adaptive currency-weighting and gold-inclusive reference methodology**. The objective is to seek greater **long-term purchasing-power resilience** and reduce excessive dependence on the performance of any single currency.

The methodology may consider individual currency performance, relative currency strength, monetary conditions, inflation and purchasing-power measures, liquidity, convertibility, economic relevance, diversification, volatility, geopolitical risk, and capital-control risk when determining eligibility and weights.

**Gold remains a core component of the reference methodology.** Its weight is determined under explicit rules and validation — not by assuming gold is always stable or that a gold component automatically guarantees the token's value.

The intended property is **relative resilience** — not a fixed price, not a conventional fiat peg, not guaranteed preservation of purchasing power, not guaranteed returns, and not a promise that the token's market price will equal the reference index.

### 1.2 The controlling objective statement (SPECIFIED — MANDATE-006 §1.2)

The following statement is the objective language to be used **consistently** across the technical specifications, validation plan, executive brief, user-facing claims, and developer documentation:

> **MTQΣ is designed around an adaptive, gold-inclusive monetary reference index intended to seek greater long-term purchasing-power resilience through diversified currency exposure, rule-governed eligibility, and adaptive component weights. Its effectiveness must be evaluated against a separately defined and independently reproducible purchasing-power benchmark. The methodology does not guarantee purchasing-power preservation, a stable token market price, redemption, or investment returns.**

Per MANDATE-006 §18: the owner has **stated** this monetary objective; it must not be reopened as if it were a new product idea. What remains open is its **precise technical implementation, economic implications, and required approvals** (D-13.3–D-13.7, §5 below). The principal objective must never be re-described as maintaining a fixed token price or engineering a conventional stablecoin peg.

### 1.3 The three measurements — kept separate (SPECIFIED — MANDATE-006 §1.3)

| Measurement | Definition | Where it lives today | Honest status |
|---|---|---|---|
| **A. Monetary reference index** | The mathematical value of the adaptive currency-and-gold reference methodology | TS reference layer `chain-index.ts` (chain-linked, divisor D_t, COO-17 base-relative basis); construction spec `reference-index-and-gold-methodology.md` | `IMPLEMENTED` in the reference (non-deployed) engine for the fixed 7-component set; `SPECIFIED` PROPOSED for the dynamic-constituency v3.0 form; **not `DEPLOYED`** (weights machinery not on-chain) |
| **B. Purchasing-power performance** | Whether the reference unit holds up against a defined basket of goods and services over time | GPP methodology options (`reference-index-and-gold-methodology.md` §5, decision **D-13.13 OPEN**); benchmark arms (`quantitative-validation-plan.md` §4, Stage J; `v3-purchasing-power-validation-plan.md`) | `SPECIFIED` (PROPOSED) only — **zero evaluation runs**; no benchmark dataset onboarded; `NOT TESTED` |
| **C. Token market price** | The price at which market participants actually trade MTQΣ | No market exists; no price feed; no anchoring mechanism exists or is proposed under the M1+M4 candidate model | `UNVERIFIED` by construction — no live market; **no mechanism connects A to C** (D-13.5 proposed wording) |

**No component of the specification may conflate these three measurements.** A better index result does not imply better purchasing-power performance; neither ensures the token trades near the index value.

---

## 2. The eight conceptual layers (SPECIFIED — MANDATE-006 §2; current-state mapping)

M1 + M4 are used as **structure**, not as a replacement for the adaptive monetary methodology. Layer-by-layer mapping to the current estate (facts from `baseline-and-change-matrix.md`, cited there with file:line evidence):

| Layer | Mandate role | Current artifacts | Honest status |
|---|---|---|---|
| **1 — Currency Constituency Engine** | Determines eligible basket currencies from an expandable candidate universe | `currency-constituency-and-weight-transition-spec.md` (PROPOSED lifecycle, scoring, hysteresis); code attests "Constituency is STATIC" (`honest-status.ts:245`); basket fixed at 7 by construction (V2 `bytes3[7]`, `chain-index.ts:236-241` `!==7` guard); deployed v1.2 = fixed 5 | `SPECIFIED` (proposal) / **`NOT IMPLEMENTED`** / dynamic replacement `NOT TESTED` — see `currency-constituency-and-dynamic-replacement-validation.md` |
| **2 — Adaptive Weighting & Gold Methodology** | Validated weighting methodology, portfolio-model ensemble, constraints, smoothing, independent gold treatment | `mase.ts` = **pilot substitute** (equal-α inverse-vol; 21 disclosed NOT-IMPL-GAP items); gold leg 6 with 20–32% envelope (UNAPPROVED parameter); `reference-index-and-gold-methodology.md` §4–§6 PROPOSED | `IMPLEMENTED` as pilot only — full ensemble `NOT IMPLEMENTED`; effectiveness `NOT TESTED`, zero validation runs — see `adaptive-weighting-and-gold-methodology-review.md` |
| **3 — Purchasing-Power Evaluation** | Evaluates the index against a separately specified benchmark | `quantitative-validation-plan.md` (Stage J) + `v3-purchasing-power-validation-plan.md` — both `SPECIFIED`/PLANNED with symbolic acceptance criteria | **`NOT TESTED` — no purchasing-power evaluation has been run** (pre-registration D-13.25 and validator independence D-13.26 both OPEN) |
| **4 — Published Reference Index** | Calculates, versions, publishes reference value, weights, provenance, rebalance decisions, chain-link adjustments | `chain-index.ts` implements the chain-linked calculation (reference layer); publication surface (six values) PROPOSED in `reference-index-and-gold-methodology.md` §3 | `IMPLEMENTED`+`TESTED` for the static composition in the reference layer; publication surface `NOT IMPLEMENTED`; composition-change continuity `NOT TESTED` (composition cannot change today) |
| **5 — Token & Supply Architecture** | Holder rights, transfer rules, issuance authorization, supply limits, accounting — never assuming the index guarantees token value | `issuance-burn-and-market-mechanism-spec.md` (PROPOSED); holder rights/supply/redemption all gated on **D-13.3 / D-13.6 / D-13.7 — OPEN** | `SPECIFIED` (proposals with alternatives) / v3.0 token `NOT IMPLEMENTED`; deployed v1.2 pilot diverges from all spec families; no supply cap on-chain |
| **6 — Payment & Issuance Infrastructure** | Accepts approved stablecoins and eligible CBDCs plus specifically approved rails through separate instrument adapters | `payment-instrument-registry-and-settlement-spec.md` (PROPOSED); today: no instrument registry; 1 SIMULATED pilot bank; MockUSDC test tokens; CBDCs **SIMULATED / NOT CONNECTED** | `SPECIFIED` (proposal) / **`NOT IMPLEMENTED`** — no real stablecoin or CBDC settlement exists or is claimed |
| **7 — Governance, Security & Audit** | Methodology versions, approvals, authorities, emergency states, release gates, reproducibility | `oracle-and-emergency-state-spec.md` (PROPOSED); Task 12 release controls (8/8 NOT_GRANTED, live-verified default-deny), 11 §25.5 gates all NOT CONDUCTED; authority migration unsigned, approval-gated (Task 12 D8 chain) | Fail-closed posture `IMPLEMENTED`+`TESTED`+`DEPLOYED`-as-controls; **all on-chain authorities still resolve to the compromised EOA R-1** — remediation `OPEN` |
| **8 — Sustainable Commercial Business** | Transparent, real services generating revenue without requiring guaranteed price stability or undisclosed influence over basket composition | `revenue-and-unit-economics.md` + `fee-and-commercial-revenue-model.md` (PROPOSED); commercial–methodology separation D-13.24 OPEN | `SPECIFIED` (model with zero baseline) / revenue **= 0 — the only evidence-backed commercial baseline**; no customers exist |

### M1 + M4 interpretation (SPECIFIED — MANDATE-006 §2)

- **M1** = a candidate **floating-market-price token model** with a separately published adaptive index.
- **M4** = **structural separation** between index publication, token operations, and payment services.
- These are **architectural candidates**, not a replacement for the monetary engine, and **not a final owner approval** of token rights, supply policy, or redemption.
- The four-model comparison and the advisory recommendation live in `economic-model-options.md`; **exact adoptable wording** for the Gate-B decisions is in `d13.3-d13.7-owner-decision-brief.md` (v2).
- **Gate B decisions D-13.3 through D-13.7 remain OPEN** until the owner explicitly resolves them (MANDATE-006 §2, §18).

---

## 3. Consistency obligations across the deliverable set (acceptance criteria, MANDATE-006 §19)

1. **One consistent monetary objective** across all specifications — the §1.2 statement above. Every Stage B–K document must cite it and must not re-describe the objective as a price peg. `TESTED`-class verification of this consistency is editorial and recorded per document in `claims-and-honest-status.md`.
2. **The three measurements distinguished** (index / purchasing-power performance / token market price) — the separation table in §1.3 is the canonical mapping; no deliverable may conflate them.
3. The published status must distinguish **specification progress, implementation progress, successful tests, deployment evidence, independent validation, and owner approval** — the six-way distinction is enforced in `claims-and-honest-status.md` (v2) and `test-matrix-and-results.md`.

---

## 4. What remains OPEN (nothing silently decided)

| Decision | Question | Gate |
|---|---|---|
| **D-13.3** | Definition of MTQΣ (precise relationship between the reference index and the token) — proposed three-layer separation wording exists | Gate B |
| **D-13.4** | Architecture family (proposed: clean-slate v3.0 + structural separation) | Gate B |
| **D-13.5** | Stability objective (proposed: index and purchasing-power resilience; no market-price guarantee) | Gate B |
| **D-13.6** | Supply policy (proposed: fixed max supply, governed issuance; numbers deferred) | Gates B/E |
| **D-13.7** | Redemption policy (proposed: no redemption promise) | Gates B/E |
| **D-13.27** (new this cycle) | Reconciliation of payment-funded primary issuance with the no-automatic-minting supply policy (MANDATE-006 §7.7) — precise alternatives in `payment-instrument-registry-and-settlement-spec.md` §14.6 and `issuance-burn-and-supply-policy-options.md` §4 | Gates B/E |
| **D-13.11 / D-13.12 / D-13.13** | Max basket size; gold disposition; GPP treatment | Gates B/C |
| Carried | Task 12 recovery approvals (authority migration, rotation, RELEASE-GRANTS) — prerequisites for **any** on-chain action | Task 12 D8 chain |

**Full registers:** `unresolved-decisions-and-owner-approvals.md` (all decisions) · `owner-decisions-and-open-questions.md` (the prioritized minimum set, MANDATE-006 §18).

---

## 5. Standing restrictions (unchanged)

No production authorization; no signing or broadcasting; no live issuance/burning; no transfers or authority changes; no live migration or contract upgrade; no live reserve transactions; no suppression of security findings or weakening of tests; no claim of independent economic validation until completed; no claim that dynamic replacement, CBDC support, or stablecoin-funded issuance is operational without specific evidence.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
