# MTQΣ — Adaptive Weighting & Gold Methodology — Review (MANDATE-006 §16.3)

**Document ID:** MTQSIGMA-T13-WEIGHT-GOLD-REV · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §4 (Adaptive weighting and gold treatment), §16.3
**Controlling specifications:** `reference-index-and-gold-methodology.md` (deliverable 5 — weighting/gold/index construction) · `currency-constituency-and-weight-transition-spec.md` (deliverable 4 — constraints, floors/ceilings, transitions). This review does not replace them; it audits coverage against MANDATE-006 §4 and states honest statuses.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

**Headline honest status:** the multi-model weighting framework is `SPECIFIED` (proposal) and only a **pilot substitute** is `IMPLEMENTED` (`mase.ts`: equal-α inverse-volatility, 21 disclosed NOT-IMPL-GAP items). The presence of model names in documentation is **not** evidence they are implemented, validated, or deployed (MANDATE-006 §4.1). **No effectiveness claim may be made.**

---

## 1. The retained methodology (SPECIFIED)

Per MANDATE-006 §4.1, the intended multi-model weighting framework is preserved where supported by the controlling specification. The seven model roles under review:

| Model role | Controlling-spec status | Implementation status |
|---|---|---|
| Minimum-variance | Referenced as a candidate in the MASE completion plan (`reference-index-and-gold-methodology.md` §6) | `NOT IMPLEMENTED` |
| Equal-risk-contribution (risk parity) | Referenced (§6) | `NOT IMPLEMENTED` |
| Diversification measure (e.g., diversification ratio) | Referenced (§6) | `NOT IMPLEMENTED` |
| Tail-risk control (VaR/CVaR) | Referenced (§6) | `NOT IMPLEMENTED` (pilot has no covariance/VaR/CVaR machinery) |
| Drawdown control | Referenced (§6) | `NOT IMPLEMENTED` |
| Purchasing-power signals | Referenced (§6; GPP options D-13.13) | `NOT IMPLEMENTED` (J(s) eligibility disabled in pilot) |
| Regime-based methods | Referenced (§6) | Partial pilot only — hard 4-state regime switch (disclosed as a pilot simplification) |

The current `mase.ts` is an honest **pilot substitute** (equal-α inverse-vol weighting, no covariance estimator, no ensemble); its 21 NOT-IMPL-GAP items are disclosed in `honest-status.ts` and the Stage A baseline (§4, MASE row). Ensemble weights, model disagreement handling, and the final constrained weight vector are therefore **wholly unimplemented** today.

## 2. The nine specification requirements (MANDATE-006 §4.1) — coverage check

| Required specification element | Coverage | Status |
|---|---|---|
| Each model's inputs and output | `reference-index-and-gold-methodology.md` §6 (MASE completion plan; model table) | `SPECIFIED` (PROPOSED) — per-model I/O table to be completed with the methodology ratification (D-13.13/GPP interaction) |
| Objective and constraints per model | §6 + constituency spec §5.2 (floors, ceilings, aggregate caps) | `SPECIFIED` (PROPOSED) |
| How ensemble weights are computed | §6 (ensemble design) | `SPECIFIED` (PROPOSED) / `NOT IMPLEMENTED` |
| How model disagreement is handled | §6 | `SPECIFIED` (PROPOSED) / `NOT IMPLEMENTED` |
| Input normalization | constituency spec §4.1 (per-input [0,1] normalization) | `SPECIFIED` (PROPOSED) |
| Risk and regime effects on weighting | §6 + regime method row above | `SPECIFIED` (PROPOSED) — pilot regime switch only |
| Sensitivity to coefficients and parameters | `quantitative-validation-plan.md` (sensitivity family, VAL-*); symbolic acceptance criteria | `SPECIFIED` (PLANNED) — zero sensitivity runs exist |
| How the final constrained weight vector is produced | constituency spec §5 (pipeline, floors/ceilings, normalization to exactly 100%, rounding, tie-breaking D-13.14) | `SPECIFIED` (PROPOSED) |
| Versioning and reproducibility of every intermediate and final result | constituency spec §4.3 (recording obligation) + reference-index spec §2.3 (publication cadence, revision policy) | `SPECIFIED` (PROPOSED) |

**Anti-chasing rules (restated as design constraints):** avoid overweighting currencies because of recent appreciation; avoid return-chasing that increases concentration or instability; differentiate economic performance, FX performance, structural suitability, and risk. `SPECIFIED` — enforced editorially in the specs; no implementation exists to test them against.

## 3. Gold treatment review (MANDATE-006 §4.2) — checklist against the controlling spec §4

Gold must be explicitly incorporated as a **distinct component**. The eight mandated treatment items:

| Mandated item (§4.2) | Coverage | Status |
|---|---|---|
| Gold price benchmark and quotation convention | Spec §4: XAU per troy ounce, USD quotation, defined conversion into index valuation currency | `SPECIFIED` (PROPOSED) |
| Currency conversion used for index valuation | Spec §4 | `SPECIFIED` (PROPOSED) |
| Data source independence, timestamps, stale-data handling, outlier detection | Spec §4 + `oracle-and-emergency-state-spec.md` §2 (independence standard D-13.16) | `SPECIFIED`; **current reality: one live upstream family (gold-api.com) — independence NOT met** (disclosed single-upstream gap); FRED London fix discontinued → Yahoo `GC=F` used for history only |
| Target-weight methodology and approved admissibility limits | Spec §4 (envelope treatment); current envelope **20–32%** | `SPECIFIED`; **the numerical envelope is an UNAPPROVED parameter** — no numerical gold weight is approved merely because a prior draft includes one |
| Diversification role and contribution to purchasing-power performance | Spec §4 + §5 (GPP arms) | `SPECIFIED` (PROPOSED) — contribution analysis is part of the NOT-RUN benchmark plan |
| Sensitivity to gold rallies and severe drawdowns | `quantitative-validation-plan.md` (gold-shock stress windows) | `SPECIFIED` (PLANNED) — the prior S5/S6 gold-shock simulations are **reserve-era results, inadmissible as v3.0 evidence** (`layer7-economic-meaning-review.md` §7) |
| Effect on index volatility, drawdowns, concentration, tracking error | Spec §7 (benchmark metric families) | `SPECIFIED` (PLANNED) — zero runs |
| Behavior when gold prices are unavailable or unreliable | Spec §4 + oracle spec §6 (fail-closed DEGRADED target D-13.15) | `SPECIFIED` (PROPOSED); pilot TS currently permits redeem-fail-open on DEGRADED (LKG) — the disclosed divergence to close under D-13.15 |

**Gold is not custody, collateral, or a reserve.** Its role in the reference calculation must be distinguished from physical gold custody, a gold-backed asset, tokenized gold held as collateral, or a reserve holding. In the selected-candidate v3.0 model (no conventional reserve), a gold reference component **does not itself constitute collateral and provides no redemption guarantee** (MANDATE-006 §4.2; D-13.7 proposed wording). Today the pilot's gold accounting (PAXG/XAUT reserve instruments + 50/50 index/reserve gold split) is **accounting-only separation** — a recorded Stage-D gap.

## 4. Index reweighting versus asset trading (MANDATE-006 §4.3)

- Mathematical index reweighting is **separate from buying or selling real reserve assets**. A currency's reference-index weight changing does not automatically imply assets must be bought, sold, or held in the same proportion. `SPECIFIED` — and structurally true in the v3.0 candidate model, where the index layer holds nothing.
- **Legacy MARP trading and reserve-management machinery** (TS `engine.ts` MARP gold↔stablecoin trades, `marp.ts` rebalancing; the rebalance fee 0.20%; the six-level trade ladder) is reviewed independently: it belongs to the reserve-era family. The v3.0 target architecture does not conduct that asset-management function; retaining a reserve-trading procedure merely to support reference-index changes is not required by it. **No removal from any deployed system occurs without an approved migration and security plan** (see `no-reserve-model-compatibility-and-migration.md` §5) — and the deployed v1.2 pilot's flows remain untouched pending D-13.22.
- Reference-layer reweighting remains subject to the invariants already enforced/tested in the reference engine (sum-to-one, envelopes, velocity caps; `blueprint.ts:78-96, 241-246`; mandate-vectors T-85) — all `IMPLEMENTED`+`TESTED` at the reference layer, `NOT DEPLOYED`.

## 5. Unresolved parameters (all OPEN — never presented as decided)

- Gold target-weight envelope (current draft 20–32%; prior anchor 26%±) — **UNAPPROVED** (spec §12 draft-parameter table).
- Max basket size N_max (D-13.11); rounding/tie-breaking/sum tolerance (D-13.14).
- MASE ensemble model set + coefficients (β₁/β₂ pilot instantiations are validation-stage values; Risk-Council publication pending); regime definitions.
- GPP treatment (D-13.13) and its interaction with weighting objectives.
- Oracle independence threshold set (D-13.16); emergency parameters (D-13.17).
- Sensitivity-acceptance bounds — symbolic until pre-registration (D-13.25).

## 6. Honest status summary

| Element | Specified | Implemented | Tested | Validated |
|---|---|---|---|---|
| Multi-model ensemble weighting | YES (proposal) | NO (pilot substitute only) | pilot-only unit tests | NO — zero ensemble validation runs |
| Constraints, smoothing, normalization pipeline | YES (proposal) | Partial (submission-time checks in reference layer + V2 source-ready) | Reference-layer tests PASS; transition tests NONE | NO |
| Gold component treatment | YES (proposal) | Partial (index leg 6, envelope, price ladder) | Reference-layer tests PASS | NO; independence NOT met |
| Sensitivity / regime / PP-signal analysis | YES (planned) | NO | NO | NO |

**No purchasing-power or effectiveness superiority claim may be made until the evidence exists and has been independently reviewed** (MANDATE-006 §4.1, §5.3). Validation runs to date: **zero** for any v3.0 weighting or gold methodology.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
