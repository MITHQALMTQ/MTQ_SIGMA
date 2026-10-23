# MTQΣ Nomenclature Map — Symbol Disambiguation (RG-02 + RG-05, + Divisor / Weight-State / PAR / Liability Families)

**Task ID:** 11 · **Agent:** audit-documentation agent · **Mode:** DOCUMENTATION-ONLY
**Fulfills:** equation-by-equation audit §7 item 11 (nomenclature map) and §8 unresolved-ambiguity items 4 (glossary NAV_t) and 6 (Q_min collision).
**Sources:** `audit-work/v2/blueprint-full.txt` (*MTQ Σ Master Monetary Architecture & Quantitative Specification v1.0, Master Edition, 2026-09-08*; blueprint line numbers per `blueprint-source-verification.md`); `EQUATION-BY-EQUATION-AUDIT-REPORT.md` §4 (RG-02/RG-05/RG-14 verdicts); code state of 2026-10-19 (post-implementation pass — all file:line references verified against the working tree).
**Status of this document:** NORMATIVE for all future MTQΣ code, tests, UI copy, and documentation. Where the blueprint glossary contradicts it, THIS map governs until the next spec revision supersedes the glossary (see RG-02 decision record).

---

## 1. The NAV_t four-way overload (RG-02)

The blueprint reuses "NAV_t" in **four** different senses. The audit confirmed three (§2.5 / §14.1 / §19.3.2) and found a fourth, self-contradictory instance in the Appendix A.1 glossary that the alignment spec missed (`blueprint-source-verification.md` RG-02). The code already carries **three distinct symbols**; the glossary defect is documentation-only and requires a spec-revision fix (Constitutional edit).

| Symbol | Blueprint sense(s) + § refs | Code symbol + file | Unit / scale | Disambiguation note |
|---|---|---|---|---|
| **I_t** | **(a) Index value.** §2.5 (line 902): "`I_t (NAV_t)` — USD value of the chain-linked reference index … G_t · Σ_i W_{i,t} · (P_{i,t}/P_{i,0}) … Chain-linked; normalized to 1.00 at genesis"; §9.1 (lines 2061–2067, `NAV₀ = 1`); §18.1 (lines 8055–8059, P_MTQ = I_t / I_base) | `ChainIndexState.I_t` (chain-index.ts:33, genesis 1.0); `getMtqPriceFromState()` (engine.ts:631) → snapshot `mtqPrice`; snapshot `gfbIndex` mirrors I_t; `/api/gfb` field `mtqPrice` | Dimensionless index level (genesis = 1.0000). USD-equivalent per MTQ **only** via × PAR = 1.00 — a *reporting numeraire* figure, not a reserve quantity | The reference-basket level. NEVER a reserve measure. `gfbIndex` is a legacy API name that now carries I_t (documented mirror; the five-currency GFB formula itself is quarantined per RG-04). UI renders it as "MTQ Price" with the "reporting numeraire" footnote. At PAR = 1, I_t ≡ P_MTQ. |
| **nav / V_net** | **(b) Reserve net-asset value.** §14.1 (line 5177): `V_(net,t) = Σ_j Q_(j,t) × P_(j,t) × (1 − H_(j))` — "The net asset value of the reserve at time t"; Listing 5/6 store post-haircut net values (§14.6) | `reserveAssetValues().nav` (engine.ts:641 — single net source, RG-03) → snapshot `nav`; persisted as `navUsd` in the DailyStateVector (audit-trail.ts:97) | USD (reporting numeraire), haircut-adjusted (PAXG/XAUT 1.0% constitutional), **total** reserve | The reserve NAV. All 10+ monetary consumers (RR, LCR, redemption settlement, PoR, concentration, waterfall, DailyStateVector) read this one net source; gross values are exported for monitoring only (canonical test "NAV < gross"). UI label: "Reserve NAV". Never use "NAV" alone for this in new code — write `nav` / V_net. |
| **navPerMtq** | **(c) Per-token book value.** §19.3.2 Step 1 (lines 8667–8671): "The per-token net asset value is read from the reserve accounting: `NAV_(t) = V_(net,t) / S_(circ,t)`" | `navPerMtq` / `auditNavPerToken` in `applyRedeem` (engine.ts:1636–1641); published as `indexNavDivergence.navPerMtq` (engine.ts:2019, 2261) | USD-equivalent per 1 MTQΣ (haircut-adjusted) | The redemption settlement price basis. Distinct from I_t: the two diverge whenever the reserve trades above/below the index (the divergence is itself a monitored quantity). UI surfaces: RedeemSimulator "NAV per token (§12.2 · informational)" (RedeemSimulator.tsx:227) and BasketValueDisplay's per-MTQ native-unit grid (actual holdings per MTQΣ, gold-grams headline). |
| **(glossary "NAV_t")** | **(d) Glossary defect.** Appendix A.1 (line 13054): "`NAV_t` — Net asset value of the reserve (gross of nothing — see V_{net,t}); collateralizes the token. §2.5; Chapter 14" — defines NAV_t as *reserve* NAV **while citing §2.5**, which defines it as the *index* value | — (no code symbol; none may be created) | — | **BLUEPRINT-INTERNAL CONTRADICTION.** Until the next spec revision fixes the glossary, the reading rule is: the unqualified string "NAV_t" is BANNED in MTQΣ code, tests, UI copy and docs. Always write one of: `I_t` (index), `V_net`/`nav` (reserve total), `navPerMtq` (per-token). See decision record RG-02 (ratification: Constitutional 7/7, next spec revision). |

**UI labeling (implemented this session):** USD figures for the index are labeled *reporting numeraire* — BasketValueDisplay.tsx:15 ("the USD figure appears only as a small 'reporting numeraire' footnote … never a peg") and the closing footnote; page.tsx "MTQ Price · 1 MTQ = basket PAR".

---

## 2. The Q_min collision (RG-05) — DORMANT in code; pin before §4 lands

The blueprint uses the single symbol Q_min for two unrelated quantities — in one sentence (line 1377).

| Symbol | Blueprint sense(s) + § refs | Code symbol + file | Unit / scale | Disambiguation note |
|---|---|---|---|---|
| **Q_threshold** (proposed; blueprint writes "Q_min") | **Eligibility threshold.** §4.2 (line 1367): "A currency becomes eligible for the active basket only if `Q_(i) ≥ Q_(min)`"; line 1377: "The scoring coefficients a_k **and the threshold Q_{min}** are methodology parameters … fixed per published methodology version" | **Not implemented** — constituency scoring is static (7-component set; succession is a read-only drill; honest-status disclosure `D-constituency`) | Dimensionless composite score | A **governance constant**, fixed per published methodology version. Does not change between evaluation rounds. |
| **Q_min^obs** (proposed; blueprint also writes "Q_min") | **Observed round minimum.** §4.2.1 min–max normalization (lines 1373–1375): `Q̃_(i) = (Q_(i) − Q_(min)) / (Q_(max) − Q_(min))`, "where Q_{min} and Q_{max} are the minimum and maximum composite scores across the candidate universe **in the current evaluation round**" | **Not implemented** | Dimensionless composite score | A **per-round observed statistic** — recomputed every evaluation round from the candidate universe. Conflating it with the threshold would make eligibility self-referential (a currency could qualify itself by the composition of the round). |

**Status: DORMANT.** The collision cannot materialize today because constituency scoring (§4) is not implemented. **Requirement (audit §8 item 6):** the disambiguation Q_threshold vs Q_min^obs must be pinned in the constituency methodology document **before any §4 implementation lands**. Ratification: Constitutional 7/7 (Q_min is expressly a methodology parameter — blueprint line 1377). See decision record RG-05.

---

## 3. Divisor & denominator family — G_t vs D_t vs GFB_BASE_DENOMINATOR (RG-14 + glossary collisions)

| Symbol | Blueprint sense(s) + § refs | Code symbol + file | Unit / scale | Disambiguation note |
|---|---|---|---|---|
| **G_t** | Cumulative chain-link factor. §9.1/§9.3: `G_t = Π_s D_s` (product over every accepted weight update); §2.5 line 902 uses it in the value-aggregate form `I_t = G_t · Σ W (P_t/P_0)` | `ChainIndexState.G_t` (chain-index.ts:34; genesis 1.0; updated multiplicatively in `commitWeights`, chain-index.ts:223–233) | Dimensionless; never reset | The **cumulative** product. One number per index, monotone history of all divisor events. |
| **D_t** | **Per-update divisor.** §9.3 (lines 2091–2097): `D_t = B_t^− / B_t^+`, applied so `I_t^+ = D_t · B_t^+ = B_t^−` — index level unchanged across a weight commit (zero artificial return) | Computed locally inside `commitWeights` (chain-index.ts:223+); asserted by the chain-index self-test (1e-12) and the succession swap bit-identical check | Dimensionless ratio ≈ 1 per update | The **single-update** divisor. ⚠ **GLOSSARY COLLISION:** Appendix A.1 (line 13058) redefines `D_t` as "Weight deviation \|W^Target − W^Actual\|" — a third, unrelated use. Spec revision must reserve D_t for the §9.3 divisor and rename the weight-deviation term (e.g. ΔW_dev). |
| **B_t^±** | §9.3 pre-/post-rebalance basket values (valuation basis of the divisor) | Local variables in `commitWeights` (chain-index.ts) | USD-equivalent basket value at the update instant | ⚠ **GLOSSARY COLLISION:** A.1 (line 13060) redefines B_t^± as "dynamic-buffer boundaries" — the buffer ratios are already notated B_gold(RR_t) in §13.5.2/§16.2; the glossary should defer. |
| **GFB_BASE_DENOMINATOR** | Genesis denominator **value**: `I_base = Σ_i q_i × base fixings` over all seven components incl. CHF 1.1300 and gold $2,500 (§20.1.5, lines 9267–9269) = 650.644103 | `GFB_BASE_DENOMINATOR` (blueprint.ts:62–69, computed from `STRATEGIC_PRIOR` × `BASE_FIXINGS`, immutable) | USD-equivalent per basket-unit at genesis | **REFERENCE-ONLY — never divided in the TS engine.** I_0 = 1.0 by construction (§3.4: genesis notionals sum to exactly 1.0000 per MTQ), so I_t is *already* the normalized ratio; dividing again would double-normalize (P ≈ 1/650 — "clearly wrong", chain-index.ts:91–95). RG-14 verdict: PASS. Displayed in the UI (GfbBasket "GFB Base Denominator (chain-linked)") as the genesis calibration constant only. |

---

## 4. The four weight states (EQ-001; Constitutional Invariant I3 — "methodology fixed, weights adaptive")

| Symbol | Blueprint sense(s) + § refs | Code symbol + file | Unit / scale | Disambiguation note |
|---|---|---|---|---|
| **W^Prior** | §3.2 strategic prior (USD 27 · EUR 20 · JPY 9 · GBP 8 · CNY 5 · CHF 5 · Gold 26 %) — genesis-only **soft anchor**, "Strategic Prior — NOT Fixed Weight" | `STRATEGIC_PRIOR` / `STRATEGIC_PRIOR_TABLE` (blueprint.ts:22); snapshot `weightStates.prior` (engine.ts:1939, 2212) | Basket share, Σ = 100% | **NOT the live composition.** Presentation rule (audit F-1, fixed this session): every UI surface labels it "Strategic Prior (§3.2)" (page.tsx:175, GfbBasket, ReserveDonut caption, PitchSection "seeded by a strategic prior … ADAPTIVE weights"). |
| **W^Target** | §7 MASE output (ensemble → constraints → envelopes) | mase.ts ensemble target → snapshot `weightStates.target` (raw optimizer output also at `mase.ensembleTarget`) | Basket share | The unconstrained-then-projected optimizer target. Distinct from both the prior and the smoothed commit. |
| **W^Smooth** | §8.4 ρ-ladder smoothing (ρ = 0.50 normal / 0.75 stress) applied to W^Target | `smoothWeightsConstitutional` (mase.ts) → snapshot `weightStates.smoothed`; committed to the chain index via `commitChainIndexWeights` (engine.ts) | Basket share | **The live index weights.** After commit, `chainIndex.prevWeights` = the operative §9.2 form-B weights. `/api/gfb` publishes them as `liveWeights` (route.ts:34–36) alongside `smoothedWeights`. |
| **W^Execution** | §10/§11 MARP execution projection (trade intents after the 8-level decision hierarchy) | snapshot `weightStates.execution` (engine.ts:2212); per-component intents in `marp.decisions` (marp.ts:179 `marpDecision`) | Basket share | The execution route is now ACTIVE in the pilot (`USE_MARP_EXECUTION = true`, pilot-state.ts:128); `/api/gfb` also publishes `executionWeights` (route.ts:41). |

All four states are stored and published distinctly on every snapshot (`buildMaseSnapshot` → `/api/metrics`) and rendered as a 4-state table in MaseEngine.tsx. No surface may label any single state "the" weights without naming which state it is.

---

## 5. PAR, price, liability and supply family

| Symbol | Blueprint sense(s) + § refs | Code symbol + file | Unit / scale | Disambiguation note |
|---|---|---|---|---|
| **PAR** | §2.5/§18.1: unit of account; `P_(MTQ,t) = I_t / I_base`, I_base fixed at genesis → P_MTQ,genesis = 1.00 exactly | `PAR = 1.00 // The unit of account — immutable` (blueprint.ts:104) | 1 basket-unit | **NOT a USD peg.** P_MTQ = I_t × PAR is a USD-*equivalent reporting* figure (numeraire), not a commitment: live P_MTQ ≈ $1.195907 ≠ $1.00. Mint divides by P_MTQ; redemption settles at haircut `navPerMtq`. Canonical invariant I5 asserts no-peg. UI: "1 MTQ = basket PAR", "PAR-referenced to the basket and gold-anchored — never pegged to the US dollar" (BasketValueDisplay.tsx). |
| **P_MTQ** | §18.1 | `getMtqPriceFromState()` = I_t (engine.ts:631); snapshot `mtqPrice` | USD-equivalent per MTQ (reporting numeraire) | Same number as I_t while PAR = 1; kept as a separate symbol because the identity P = I_t × PAR is the no-peg statement. |
| **L_t** | §2.5/§18.2 liability: `L_t = S_circ,t × P_MTQ,t` | `computeLiability()` (engine.ts:702); the pilot tick now reuses this canonical helper (AUDIT-FIX F-10 DRY) | USD-equivalent | **Circulating-supply only.** The genesis-locked supply is excluded — canonical RR at pure genesis is ∞ (documented, engine genesis note). |
| **S_circ** | §2.5 circulating supply | `circulatingSupply()` (engine.ts:698) | MTQ tokens | Distinct from `totalSupply` (includes the 1,000,000 genesis-lock). Total supply appears only as a labeled display fallback at pure genesis — never in L_t, mint, redeem or LCR denominators (audit carry-over verified). |
| **Genesis reserve** | §3.4/§20.1: team deposits $1,100,000 → mints 1,000,000 MTQ to the **Genesis Reserve Account** (locked); RR_genesis = 1.10 | `initReserveState` (engine.ts) — fixed genesis holdings, 50/50 PAXG/XAUT gold split, 3-way USD issuer split | MTQ (locked) / USD | Locked: excluded from S_circ, L_t and per-token NAV denominators. Its existence is why per-token backing can exceed par while RR is computed on circulating liability only. |

---

## 6. Reading rules (normative summary)

1. **Never write "NAV" unqualified.** Use `I_t` (index level), `V_net`/`nav` (haircut-adjusted total reserve value), or `navPerMtq` (per-token book value). The blueprint's glossary entry for NAV_t is defective (RG-02) — do not propagate it.
2. **Q_min is banned as a bare symbol** the moment §4 work begins: write `Q_threshold` (governance constant) or `Q_min^obs` (per-round observed minimum). Pin in the methodology doc first (RG-05).
3. **D_t means the §9.3 chain-link divisor** (B_t^−/B_t^+ per weight commit). The glossary's "weight deviation" meaning is rejected. G_t is the cumulative product; never conflate.
4. **GFB_BASE_DENOMINATOR (650.644103) is reference-only** — the engine never divides by it (I_0 = 1.0; RG-14). Any code that divides by it is a defect.
5. **Name the weight state whenever weights are shown**: W^Prior (soft anchor, genesis-only), W^Target (MASE output), W^Smooth (live index weights), W^Execution (MARP projection). The prior is never "live"; the smoothed state is.
6. **PAR is a unit of account, not a price target.** Every USD figure attached to MTQΣ is explicitly a *reporting numeraire*; the no-peg invariant (I5) is constitutional.
7. **Liability is circulating-only**: L_t = S_circ × P_MTQ. Genesis-locked supply never enters liability, LCR, or per-token NAV.

*Cross-references: per-gate decisions and ratification requirements live in `GOVERNANCE-DECISION-RECORDS.md` (RG-02, RG-05, RG-14); the change inventory that produced the UI labels cited here lives in `IMPLEMENTATION-LOG.md` (P0-1, P2-11).*
