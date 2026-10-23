# MTQΣ — TASK 13 · Reference Index & Gold Methodology (deliverable 5)

**STATUS: PROPOSED (v0.1 draft, Stage D) — Gates B/C. NOT IMPLEMENTED. Nothing in this document is approved.**
**Mandate:** MTQSIGMA-COO-MANDATE-003 §5 (Stage D: MASE completion, gold methodology, index continuity) + §6 (specification-first) + §4 clauses D/E/F. This document is a **PROPOSAL with alternatives** where material choices exist — never a silent choice (mandate §16).
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence legend (per README): `VERIFIED` (reproduced this session, cited) · `DEVELOPER-REPORTED` (prior in-repo work, cited) · `SIMULATED` · `PROPOSED` (this document's design content) · `UNVERIFIED` · `NOT IMPLEMENTED`.
**No methodology coefficient, threshold, or weight below is approved. The adaptive model is NOT labeled optimal, stable, manipulation-resistant, or validated — no supporting evidence exists, and none is claimed.** All draft parameters are explicitly UNAPPROVED (§13).

---

## 0. Purpose & scope

Specify, before any production-oriented implementation: (1) the reference-index construction methodology (chain-linked recursion + divisor) and the composition-change procedure that makes rebalances introduce **no artificial gain or loss**; (2) the publication surface (six separately published values) and the revision policy; (3) how the gold component is priced, represented, and quality-controlled — with custody explicitly N/A for a pure index leg; (4) the global purchasing-power (GPP) methodology — presented **with the explicit alternative of excluding GPP from v3.0 initial composition** (new decision D-13.13); (5) the MASE completion plan (no effectiveness claims); (6) the benchmark-comparison plan that feeds deliverable 11 — **PLANNED, NOT RUN**; (7) the index-integrity invariant list with named acceptance tests.

Out of scope (cross-referenced): constituency lifecycle and weight transitions (deliverable 4 — its Stage C spec is the precondition for composition-change tests); oracle failure states and emergency states (deliverable 10); payment-instrument admissibility for gold-backed tokens (deliverable 6); the no-reserve economic model and the stability objective (deliverables 3/D-13.5).

Preconditions (owner decisions, all OPEN): D-13.3 (what MTQΣ is), D-13.4 (family selection), D-13.5 (stability objective — determines the benchmark set), D-13.11 (basket size/admission — determines whether composition can change at all), D-13.12 (gold disposition). **New decisions opened by this document: D-13.13** (GPP inclusion in v3.0 initial composition — §5) and shared **D-13.14** (rounding/precision conventions, opened in deliverable 4 §5.3).

## 1. Evidence & source references — existing implementation (VERIFIED unless noted)

Evidence-base limits (honest): all citations were re-read directly in the repo this session except where marked DEVELOPER-REPORTED (from the Stage A baseline or worklog, not re-executed); the deployed v1.2 bytecode was not re-probed; Foundry execution is UNVERIFIABLE in this sandbox (no forge — baseline §9).

| Item | Evidence (file:line) | Status |
|---|---|---|
| Chain-linked recursion `I_t = I_{t-1} × Σ W_{i,t-1}·(P_{i,t}/P_{i,t-1})`; contributions additivity; purity | `src/lib/mtq/chain-index.ts:1-4`, `:275-317` | VERIFIED |
| Divisor machinery: base-relative basis pinned (COO-17); `D_t = B_t^- / B_t^+`; `G_t = Π D_s`; **recorded-not-applied**; basis switch disclosed (raw-USD superseded) | `chain-index.ts:6-30`, `:32-37`, `:74-86`, `:360-378` | VERIFIED |
| `commitWeights` (TS): B^± = Σ W × (P_t/P_0); record only on change; bounded ledger (last 50) | `chain-index.ts:388-459`, `:83-86`, `:97-115` | VERIFIED |
| On-chain `commitWeights` (1e18 fixed point, ±1e14 sum tolerance, Err57/Err54) | `contracts/MTQSigmaV2.sol:623-665` (tolerance `:638`); `contracts/MTQSigmaV3.sol:1384-1408` (tolerance `:1388`) | VERIFIED |
| On-chain `advanceIndex` recursion | `MTQSigmaV2.sol:603-621`; `MTQSigmaV3.sol:1369-1382` | VERIFIED |
| Inline zero-artificial-return self-test (gold +50% scenario; no-op commit ⇒ divisor 1.0, I unchanged) | `chain-index.ts:850-894` (`runSelfTest:876`) | VERIFIED |
| Divisor-ledger consistency verifier; NAV-form reconciliation hook (G implied vs G recorded, residual published) | `chain-index.ts:799-832` (`verifyDivisorLedger:799`), `:731` (`getNavForm`) | VERIFIED |
| Succession/ejection: proportional re-normalization; zero-artificial-return swap; slot-fixing convention | `chain-index.ts:506-562` (`renormalizeExcluding:546`, `replaceComponent:562`); read-only drill `src/lib/mtq/succession.ts:211` | VERIFIED |
| Legacy fixed-base Laspeyres (GFB) failure mode: gold ~99.9% of notional → +50% gold shock moved the legacy index ~50% vs intended 13% | `chain-index.ts:48-62` | VERIFIED |
| `length !== 7` guard; init/advance/commit length checks | `chain-index.ts:236-241`, `:291-295`, `:406-415` | VERIFIED |
| Gold live price family: gold-api.com XAU spot; metalpriceapi demo fallback | `src/lib/mtq/fx.ts:201-221` (urls `:203-204`); `src/lib/mtq/oracle-feeds.ts:394-395` | VERIFIED |
| Gold history: FRED `GOLDAMGBD228NLBM` (London AM fix) **discontinued 2024** → Yahoo GC=F futures proxy → constant 2500 terminal default | `src/lib/mtq/fred.ts:36`; `src/lib/mtq/historical-data.ts:10-13`, `:129-136`, `:325-363`, `:371-374` | VERIFIED |
| PAXG/XAUT are reserve instruments + depth feeds, NOT the XAU price source; Yahoo PAXG-USD volume = pool-depth input only | `oracle-feeds.ts:400-401`, `:408`; `src/lib/mtq/registry.ts:102-113`; `fx.ts:353-361`; honest-status D-pool-depth `:260-263` | VERIFIED |
| Oracle single-live-upstream-per-pair + synthetic witnesses; §17.10 independence NOT met (pilot-accepted, disclosed) | `oracle-feeds.ts:942`; `src/lib/mtq/honest-status.ts:224-228` (D-oracle-witnesses) | VERIFIED |
| Five-state feed enum (VALID/DEGRADED/STALE/OUTLIER/HALTED); heartbeat table; GOLD class staleness 60s/conf 1.0%; C_MIN 0.60; aggregate states NORMAL/DEGRADED/FAILED; LKG on DEGRADED | `src/lib/mtq/oracle.ts:49`, `:54-59`, `:101-122`, `:126`; `src/lib/mtq/blueprint.ts:194-208` (GOLD `:198`, `:204`) | VERIFIED |
| Gold envelope 20–32% (index leg 6); base fixing XAU 2500 | `blueprint.ts:85`, `:61`; V2 `:301-302`, V3 `:291-292` (`LOWER/UPPER_BOUND`), V2 `:291` (`BASE_GOLD_USD 2500e18`) | VERIFIED |
| XAU representation (USD per troy ounce, decimals 4) | `src/lib/mtq/currency.ts:22` | VERIFIED |
| MASE: §5/§6 risk-estimator layer implemented on a DISCLOSED deterministic simulated 756d window; §7.5 uniform cold-start → §7.6 adaptive softmax; walk-forward OOS ledger; ppp family exists | `src/lib/mtq/mase.ts:45-100`, `:1616-1621`, `:1624-1681`; `src/lib/mtq/engine.ts:3133-3176`; `blueprint.ts:216-223` (MASE_MODELS incl. `ppp:221`) | VERIFIED |
| MASE disclosures: D-ensemble-alpha, D-vol-estimator, D-regime-classifier, D-risk-estimators (incl. §6.8 GPP/PPError proxy — NO GlobalCPI feeds exist), D-validation (walk-forward NOT RUN) | `honest-status.ts:199-222`, `:253-258` | VERIFIED |
| 21 NOT-IMPL-GAP disclosures in MASE | Stage A stub (this deliverable's placeholder); not re-counted this session | DEVELOPER-REPORTED |
| Index gold vs reserve gold separation ACCOUNTING-ONLY (one PAXG+XAUT pot backs both) | `honest-status.ts:229-234` (D-gold-separation) | VERIFIED |
| Divisor caveats: (a) no on-chain getNavForm; (b) divisor ledger in-memory pilot-only; (c) §9.3 reconciliation tests not run; (d) canonical Case C assertion stale (pre-dates basis switch) | `honest-status.ts:247-252` (D-chainlink-divisor); `test-matrix-and-results.md:26` | VERIFIED |
| 10y backtest (FRED VIXCLS/DTWEXBGS/GOLDAMGBD228NLBM/DGS10 + Frankfurter) and its <15%-vs-Laspeyres assertion; 11 fixed-seed stress scenarios | `src/lib/mtq/__tests__/historical-backtest.ts:122`; `stress-rerun.ts`; stub record | DEVELOPER-REPORTED |
| Composition-change continuity tests cannot exist yet (composition static) | baseline §5 Stage D row 3; `honest-status.ts:245` | VERIFIED |

## 2. Reference-index construction (PROPOSED; alternatives presented)

### 2.1 Methodology choice

- **Option A (draft recommendation): retain the chain-linked return-space index** — `I_t = I_{t-1} × Σ_i W_{i,t-1}·(P_{i,t}/P_{i,t-1})` with the base-relative divisor at every weight commit (`chain-index.ts:1-30`, `:365-378`; on-chain `MTQSigmaV3.sol:1369-1408`). Each link uses prior-period weights (a within-link Laspeyres form); weights are re-anchored each commit, so no component's raw USD notional can dominate the level — the documented failure mode of the alternative. IMPLEMENTED today for the static 7 (VERIFIED); **the v3.0 change is that the component set becomes registry-driven (deliverable 4), not that the recursion changes.**
- **Option B (rejected by the historical record, kept for completeness): fixed-base Laspeyres (GFB)** — weights each component by its raw USD notional share; the code's own header records that gold at $2,500/oz contributed ~99.9% of the legacy index by notional, so a +50% gold shock moved it ~50% instead of the intended 26%×50% = 13% (`chain-index.ts:48-62`). An assertion of <15% divergence between the two forms over the backtest window is DEVELOPER-REPORTED, not re-run.
- **Option C (not implemented; listed for completeness): chain-linked Paasche** (current-period weights inside each link) — different rebalancing-drift properties; no in-repo implementation exists; introducing it would be a new methodology version with its own validation burden. NOT IMPLEMENTED.

**Choice is owner's (Gate B/C); Option A is the draft because it is the implemented, historically-debugged form — not because it is claimed superior in any validated sense.**

### 2.2 Composition-change procedure and the zero-artificial-gain/loss proof

Procedure (all steps PROPOSED; steps 1–2 machinery VERIFIED as implemented for weight-only changes):

1. At the effective timestamp of a membership or weight change (deliverable 4 T3/T5/T6/T7 boundaries), compute price relatives `rel_i = P_{i,t}/P_{i,0}` against the **immutable genesis fixings** `P_{i,0}` (`chain-index.ts:416-427`; V3 `_basePrice18` `:1359-1367`).
2. `B_t^- = Σ W_{i,t-1}·rel_i` (old composition), `B_t^+ = Σ W_{i,t}·rel_i` (new composition) — both valued at the **same post-move prices**, so the difference isolates the compositional change (`chain-index.ts:417-431`).
3. `D_t = B_t^- / B_t^+`; `G_t = G_{t-1}·D_t`; publish the `(D_t, B^-, B^+, t, kind, basis)` record; `I_t` is **unchanged** by the commit itself (`chain-index.ts:365-378`, V3 `:1399-1404`).
4. The next `advanceIndex` uses the new weights and post-commit prices, so genuine post-effective-time price movements flow through with the new composition.

**Proof by construction (level form):** if the level were valued as `I^± = G·B^±`, then `I^+ = D_t·B_t^+ = (B_t^-/B_t^+)·B_t^+ = B_t^-` — the post-change valuation equals the pre-change valuation at the same prices, i.e., the rebalance contributes exactly zero return. In the recursion form actually used, the same fact appears as: the commit function never writes `I_t` (`chain-index.ts:444-445`; "recorded-not-applied" — applying D_t as well would double-count), and the ratio of consecutive one-step returns across the boundary equals the pure price-move return under the new weights. **Acceptance tests IDX-CONT-1..3 (§8) assert this mechanically at simulated rebalance boundaries — including an add-from-zero and a remove-to-zero, which are impossible on-chain today (positive-weights-only submit, V2:526/V3:1317) and impossible in composition in the current engine at all.**

Worked boundary illustration (arithmetic illustration only — uses the code's own scenario constants; no market data, no performance claim; PROPOSED): take the self-test scenario (`chain-index.ts:856-864`) — base prices `[1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 2500]`, prior `[0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26]`, gold shocked +50% to 3750 ⇒ `rel_Gold = 3750/2500 = 1.5`, all others `rel = 1.0` ⇒ `I_t = 1.13` (0.26×0.5 = +13%). Now commit `W_new = [0.25, 0.20, 0.09, 0.08, 0.05, 0.05, 0.28]` at the same prices: `B^- = 0.27+0.20+…+0.26×1.5 = 1.13`; `B^+ = 0.25+0.20+…+0.28×1.5 = 1.14`; `D_t = 1.13/1.14` and `I_t` stays 1.1300 — the commit itself printed zero return; only the *next* price move rides the new weights. This is exactly what IDX-CONT-1 asserts mechanically (and what IDX-CONT-2 asserts on the following step).

Succession precedent (VERIFIED, read-only drill): the ejected-then-replaced path keeps the slot's base fixing immutable and quotes the successor against it, with the ejected component's real loss having already accrued in `I_t` while its price fell (`chain-index.ts:506-562`; drill `succession.ts:211`; disclosed as not-live, `honest-status.ts:245`). v3.0 generalizes this from a slot swap to the full deliverable-4 lifecycle.

### 2.3 Publication cadence, revision policy, numerical precision

- **Cadence (PROPOSED, UNAPPROVED):** (a) intraday *indicative* level per tick (as today — the pilot ticks continuously; oracle heartbeats 15–60s, `oracle.ts:54-59`); (b) a *daily close-of-record* level at a fixed timestamp (draft 00:00 UTC) — the value that enters historical series and benchmark comparisons; (c) immediate publication of every commit/divisor record. Alternatives: fix-only cadence (cleaner, discards intraday information), or tick-only (no canonical close). Owner's call (D-13.5-adjacent).
- **Revision policy (PROPOSED):** **no silent revisions.** The publication ledger is append-only. A correction to a previously published value is a new timestamped record referencing the corrected record, with a reason code (data failure, vendor retraction, methodology-error, emergency) and the corrected series clearly forked; historical values are never rewritten in place. This extends the existing basis-switch precedent — when the TS divisor basis changed from raw-USD to base-relative, the switch was disclosed with labeled carry-forward records, not silently re-based (`chain-index.ts:32-37`, `:91-96`; honest-status `:251`).
- **Numerical precision:** on-chain = 18-decimal uint256 (1e18 scale) with integer floor division (each `advanceIndex`/`commitWeights` term loses <1 wei — V3:1394-1402); off-chain = float64. Declared reconciliation tolerance (draft, D-13.14): `|I_off − I_on| ≤ 1e-12` relative after the same bp-rounded inputs; weights are committed in bp units (deliverable 4 §5.3) so the two layers receive identical integers. Published levels rounded to a declared number of significant digits (draft 12); the rounding rule (round-half-even at publication only; never round before the divisor math) is part of D-13.14.
- **Known precision/correctness debts (VERIFIED):** the canonical-invariants Case C divisor assertion still asserts the superseded raw-USD basis and will FAIL if re-run until updated (honest-status `:251(d)`; test-matrix `:26`); the pilot's divisor ledger is in-memory, re-initialized at restart (`:251(b)`); V3 has no on-chain `getNavForm` (`:251(a)`); the blueprint-§9.3 reconciliation tests are not run (`:251(c)`).

## 3. Publication surface — the six separately published values (PROPOSED; NOT IMPLEMENTED)

Per mandate (and the Stage A stub), every publication record carries: (1) **reference index level** `I_t`; (2) **reference value per MTQΣ** under the approved denomination (`P_MTQ = I_t × PAR`, PAR = 1.00 — `chain-index.ts:223-229`, `blueprint.ts:109`); (3) **observed market price** where a reliable market exists (none exists today — NOT IMPLEMENTED; no market-price feed, baseline test-matrix row "Reference value vs market-price reporting: NONE"); (4) **market-vs-reference deviation** (computable only once (3) exists); (5) **data freshness + confidence** (per-pair oracle freshness, §17.6 confidence score, aggregate state — machinery exists, `oracle.ts:75-113`); (6) **current component/weight registry version** (from deliverable 4 §2). **Disclosure IDX-DISC-1 (mandatory language): index continuity never implies exchange-price continuity** — a continuous index level makes no claim about tradability, spread, or execution. None of the six values exists as a publication surface today (NOT IMPLEMENTED); the pilot publishes index state only via its UI/snapshot paths.

Draft publication-record schema (PROPOSED; the persisted, hash-chained form of §2.3's ledger):

| Field | Content |
|---|---|
| recordType | close-of-record / commit / correction / emergency-boundary |
| publishedAt, recordId, prevRecordHash | append-only chain linkage (hash-chain discipline of the §24-style audit rows) |
| indexLevel, pMtq | values (1) and (2) with the precision rule of §2.3 |
| marketPrice, deviation | values (3), (4); null + reason when no reliable market exists (honest-null, never omitted silently) |
| freshness/confidence | per-leg oracle state summary + aggregate state + §17.6 scores |
| registryVersion, methodologyVersion | value (6) + the governing methodology tag |
| divisorRecords[] | any ChainLinkRecords emitted in the period (with basis label) |
| corrections[] | links to records this one corrects (empty on originals) |

## 4. Gold component methodology (PROPOSED; D-13.12)

- **Representation (draft): keep XAU as a price leg** — USD per troy ounce (`currency.ts:22`; base fixing 2,500 at genesis, `blueprint.ts:61`; V2 `BASE_GOLD_USD = 2500e18` "USD per reference gold unit", V2:291). Index gold is **a price, not a holding** — the index leg owns no metal, needs no vault, and carries no counterparty.
- **Pricing conventions — alternatives (owner decision D-13.12):**
  - **(a) Spot (current implementation):** live family = gold-api.com XAU spot (`fx.ts:201-221`; `oracle-feeds.ts:394-395`), with a metalpriceapi *demo-key* fallback (`fx.ts:204`) — flagged: a demo-key fallback is not a production-grade source and must be replaced or removed in any approved configuration. History: FRED London AM fix (`GOLDAMGBD228NLBM`, `fred.ts:36`) is **discontinued (2024)** — the historical loader therefore uses Yahoo GC=F COMEX front-month futures as a spot proxy (`historical-data.ts:129-136`, `:355-363`), with the constant 2,500 as a degraded terminal default (`historical-data.ts:371-374`). A constant price inside a live index is a **DEGRADED state to publish, never a silent pass-through** (current behavior discloses `goldSource` — VERIFIED `:359-363`).
  - **(b) London PM fix as the canonical close-of-record convention** (spot retained for indicative intraday): a fixing convention matches the daily close-of-record cadence (§2.3) and benchmark practice; requires a fix feed that does not exist in the codebase (NOT IMPLEMENTED; FRED carried only the AM fix and is discontinued).
  - **(c) Fix-only:** simplest audit story; discards all intraday information; no implementation.
  - **All three require ≥2 independent price families before any validation claim — currently NOT MET even for the existing leg** (single live family + synthetic witnesses; `oracle-feeds.ts:942`; honest-status `:224-228`). Cross-ref deliverable 10.

Gold source fallback ladder as it exists (VERIFIED) and as proposed:

| Priority | Existing source | Status | v3.0 draft disposition (PROPOSED) |
|---|---|---|---|
| 1 (live) | gold-api.com XAU spot (`fx.ts:203`) | single live family | retain as one family of ≥2 (independence precondition) |
| 2 (live) | metalpriceapi demo key (`fx.ts:204`) | demo credential | REMOVE from any approved config or replace with a paid, independent family |
| 3 (history) | FRED `GOLDAMGBD228NLBM` London AM fix | discontinued 2024 (`fred.ts:36`) | retain for pre-2024 history, labeled by vintage |
| 4 (history) | Yahoo GC=F front-month futures proxy (`historical-data.ts:129-136`) | active fallback | retain only with documented roll convention + futures-vs-spot basis disclosure (basis currently UNDOCUMENTED/UNVERIFIED) |
| 5 (terminal) | constant 2,500 (`historical-data.ts:371-374`) | degraded terminal default | permitted only as an explicitly DEGRADED-published state; candidate for removal entirely |

- **PAXG/XAUT boundary rule (explicit):** gold-backed tokens are **reserve instruments** (`registry.ts:102-113`) and at most *depth* feeds (Yahoo PAXG-USD 24h volume, `fx.ts:353-361`); they are **NEVER the XAU price source** (`oracle-feeds.ts:408`). Under Stage E, their *instrument* admissibility belongs to the payment-instrument registry (deliverable 6), entirely outside the basket/index methodology.
- **Staleness/confidence rules (machinery VERIFIED; parameter usage PROPOSED):** GOLD feed class — staleness 60s, confidence ≤1.0%, heartbeat 15s (`blueprint.ts:198`, `:204`; `oracle.ts:54-59`); five feed states with DEGRADED (quorum met, weak) distinct from STALE/HALTED (`oracle.ts:49`); §17.6 confidence with C_MIN 0.60 (`oracle.ts:126`); DEGRADED ⇒ mint/rebalance paused + LKG values (`oracle.ts:101-122`). For a daily close-of-record, a fix-time freshness window (draft: the fix timestamp must fall within the close window ± a declared bound — value UNAPPROVED) replaces the 60s intraday bound.
- **Custody: N/A for a pure index leg** (mandate §4 E answered honestly). Custody, attestations, and physical-separation requirements attach only to *instruments* (reserve-era PAXG/XAUT pots; today's separation is accounting-only — `honest-status.ts:229-234`) and migrate to the payment-instrument registry (deliverable 6) in v3.0. If the owner's Stage B direction (no-conventional-reserve, D-13.4/D-13.12) holds, index-gold custody questions disappear from the core economics entirely.
- **Bounds:** envelope [0.20, 0.32] today (`blueprint.ts:85`; V2:301-302 / V3:291-292); deployed-ecosystem legacy clamps 26.25%±3% (DEVELOPER-REPORTED, baseline §7). v3.0 bounds, and whether gold remains a component at all, are the owner's (D-13.12). **Prohibited language (D-13.12, standing):** gold must never be described as a guaranteed price floor, a guaranteed backing, or an implied redemption right.

## 5. GPP (global purchasing-power) methodology (PROPOSED — with the explicit exclusion alternative)

**Purpose:** give the reference unit a defined purchasing-power objective (mandate §4 F; the D-13.5 stability objective option "global purchasing-power preservation"), measured against a transparent, published inflation aggregate rather than any single national basket.

**Input datasets (named candidates; nothing wired — NOT IMPLEMENTED; exact series IDs pinned at Stage J data onboarding):**

| Input | Candidate source(s) | Cadence / coverage | Publication lag (draft assumption — TO VERIFY per source) | Revision policy (draft assumption — TO VERIFY) |
|---|---|---|---|---|
| National headline CPI, per basket economy | US BLS CPI-U; Eurostat HICP; Japan national CPI; UK ONS CPI; China NBS CPI; Switzerland BFS CPI | monthly, national | ~4–6 weeks after reference month for advanced economies | headline CPI rarely revised; periodic rebasing must be handled as a methodology event, not a data patch |
| Aggregate alternatives | IMF IFS CPI; OECD MEI CPI | monthly, cross-country | longer; source-calendar-dependent | per-source policy to be documented at onboarding |
| Special-purpose series | World Bank annual aggregates | annual | ~1 year | annual vintages; not suitable for a monthly leg |

**Geographical coverage & aggregation weights (ALTERNATIVES — UNAPPROVED, D-13.13):** (a) basket-economies-only, GDP-PPP shares (draft recommendation — consistent with the basket's purpose; **draft example shape only**: weights ∝ each economy's share of the covered group's PPP-GDP; values not computed here); (b) nominal-GDP shares; (c) trade-weighted; (d) equal-weight. The aggregation weight vector is published with the methodology version and is itself an owner decision.

**Normalization:** each national index rebased to a common base date (100 at base); aggregate `GPP_t = GPP_{t-1} × Σ_j a_j·(CPI_{j,t}/CPI_{j,t-1})` — a chain-linked aggregate in the same multiplicative form as the main index (consistency requirement; geometric-mean alternative noted but not chosen as draft: geometric aggregation is the log-equivalent of the chain-link form and behaves differently under dispersion — owner's call).

Construction order (deterministic; PROPOSED): (1) at each period, collect each covered country's published CPI for reference period M; (2) any country with no published value for M (but with one within the carry-forward window defined below) is carried forward with a staleness flag; (3) rebase each national series to the common base; (4) compute the period relative per country and apply the published weight vector a_j over *reporting* countries; (5) chain the aggregate; (6) publish the coverage table (who reported, who carried, who dropped) with the aggregate. Each step is deterministic given the inputs; the only discretionary objects are the published a_j and the carry-forward rule (both D-13.13).

**Missing-data rules (fail-visible, PROPOSED):** a late country series is carried forward for ≤2 cycles (draft) with a published staleness flag; beyond that the aggregate is computed over reporting countries with the missing share disclosed (never interpolated silently); missing-country incidence feeds the data-failure metric of the benchmark plan (§7).

**Revisions:** per-source revision policies documented at onboarding; any vendor retraction flows through the §2.3 correction protocol (timestamped, reason-coded).

**Combination with the currency+gold legs — THREE ALTERNATIVES (new decision D-13.13):**

- **Option A — GPP as an index leg** (a pseudo-component whose "price" is the GPP aggregate; weight `w_GPP` with its own envelope). Pros: the objective becomes structurally visible; Cons: adds a non-market leg to the registry (scoring dimensions in deliverable 4 §4 do not apply to it — they would need a separate definition), interacts with D-13.11 basket size, and drags CPI publication lags into the index cadence.
- **Option B — GPP as a MASE objective** (extend the existing `ppp` family, `blueprint.ts:221`; the §6.8 PPError term — currently a disclosed proxy with **no GlobalCPI-family feeds in the pilot**, honest-status `:221`). Pros: no composition change; the ensemble already has the slot; Cons: the purchasing-power objective then competes inside the ensemble with no guarantee it dominates, and the OOS ledger segmentation issue (deliverable 4 §6) applies.
- **Option C (draft recommendation) — EXCLUDE GPP from v3.0 initial composition**; revisit at Stage J with data infrastructure, leakage-controlled validation, and a validated GPP series. Pros: honest about the current absence of feeds; keeps the initial registry all-market-priced; Cons: the reference unit then has no structural purchasing-power leg — the objective (if D-13.5 selects it) is pursued only via benchmark selection, not construction.
- The choice between A/B/C is the owner's (D-13.13); it also depends on D-13.5 (whether purchasing-power preservation is even the objective).

If Option A is adopted, leg mechanics would additionally require (all PROPOSED; none specified numerically): a pseudo-leg registry record with componentType GPP_LEG; a published publication calendar per source country; explicit **lag alignment** — CPI reference month M is published ~4–6 weeks later, so the leg's price path must be defined on *reference-month* timestamps with a documented publication-lag carry rule (the index must never use a CPI value dated before its publication date — no lookahead; leakage discipline shared with Stage J); a rebasing rule that treats national CPI rebases as methodology events (§2.3 correction protocol), not silent patches; and an envelope + velocity class for the leg (D-13.11/D-13.14 interaction). The §4.1 scoring dimensions of deliverable 4 do not apply to a GPP leg (it has no FX market) — a reduced dimension set (data quality, benchmark availability, coverage) would be defined separately. All of this is why Option C (exclude initially) is the draft: the machinery cost is honest and front-loaded.

## 6. MASE completion plan (retained as the research/optimization framework; NO effectiveness claim)

Current state (VERIFIED): the §5/§6 risk-estimator layer (multi-horizon vol 30/90/252/756d, six-regime probabilities, CrisisScore→λ_CVaR, correlation + shrinkage Σ_robust, minvar/ERC/maxdiv/CVaR solvers, §6.7 MDD surfacing) and the §7.5/§7.6 ensemble (uniform cold-start → adaptive softmax over walk-forward OOS EWMA scores) are implemented (`mase.ts:45-100`, `:1616-1681`; `engine.ts:3133-3176`) **on a disclosed deterministic simulated 756-day window** (SIMULATED — honest-status D-vol-estimator `:205-210`); walk-forward/purged CV are documented NOT RUN (D-validation `:253-258`); 21 NOT-IMPL-GAP disclosures are DEVELOPER-REPORTED.

Completion plan (PROPOSED; all calibration-stage; nothing run): (1) replace the simulated window with validated multi-source price history (gated on oracle source-independence, deliverable 10); (2) publish full mathematical definitions per family with units and constraints (multi-horizon covariances, ERC explicit objective, tail-risk level, purchasing-power tracking error, correlation/concentration limits, turnover & transition-cost penalties, liquidity/data-quality penalties, regime-detection evidence vector, strategic priors and their influence limits — priors enter as soft anchors with deviation penalties, never as weights — `blueprint.ts:19-21`); (3) perturbation/sensitivity study (ω_h, λ, η, prior-influence caps) under Stage J with leakage control; (4) Risk-Council publication of selected vectors with a methodology version. **No ensemble member or adaptive behavior may be described as effective, stable, or validated until Stage J produces evidence (mandate §6 opening rule).**

Completion-item table (each item = a Stage J work package; status NOT IMPLEMENTED unless noted):

| # | Completion item | Existing state (status) | Owner after approval |
|---|---|---|---|
| 1 | Validated multi-source price history (≥2 families/leg) | single family + synthetic witnesses (VERIFIED gap) | deliverable 10 → Stage J |
| 2 | Leakage-controlled walk-forward/purged-CV harness | design documented, NOT RUN (honest-status `:253-258`) | Stage J |
| 3 | Perturbation study: ω_h (vol horizons), λ (shrinkage), λ_CVaR, η (softmax), prior caps | pilot initializations DISCLOSED as non-canonical (`mase.ts:77-100`) | Stage J |
| 4 | §6.8 GPP/PPError true feeds (or Option B/C resolution, §5) | proxy only (honest-status `:221`) | D-13.13 → Stage J |
| 5 | Regime evidence feeds (liquidity-stress, inflation-surprise, geopolitical) | neutral placeholders (honest-status `:211-216`) | deliverable 10/Stage J |
| 6 | Tail-risk validation (VaR/CVaR backtesting at 95/99) | computed on SIMULATED window only | Stage J |
| 7 | Methodology-version publication (selected vectors + governance refs) | PARAMETER_REGISTRY exists in TS reference (`blueprint.ts` audit F-6 note) | Risk Council (Gate C) |

## 7. Benchmark comparison plan — **PLANNED — NOT RUN** (feeds deliverable 11)

**No results are claimed in this section or anywhere in this document. No historical statistic is asserted. This is the plan only.**

- **Arms:** (1) the v3.0 adaptive basket (registry + MASE as specified in deliverables 4/5); (2) **fixed-basket baseline** — the current 7-component Strategic Prior held static (27/20/9/8/5/5/26, `blueprint.ts:22-30`); (3) relevant benchmarks: a broad USD index (FRED `DTWEXBGS` is already in the backtest harness — `historical-backtest.ts:122`), an EUR-hedged basket variant, gold (XAU), a CPI purchasing-power benchmark (per §5, if D-13.5/D-13.13 adopt one), and USD cash.
- **Windows:** historical multi-window re-runs of the existing 10-year harness (2015–2025 armature, DEVELOPER-REPORTED; re-specified after D-13.4 family selection); stress periods including the existing 11 fixed-seed scenarios (`stress-rerun.ts`, DEVELOPER-REPORTED as internal evidence only — `honest-status.ts:253-258`); walk-forward out-of-sample with a leakage-controlled split (design exists, not run — D-validation).
- **Required metrics (mandate list, all mandatory):** performance; volatility; maximum drawdown; tracking behavior vs the declared objective (D-13.5); turnover; concentration (HHI over time); data-failure incidence (per leg: oracle outages, missing CPI rows, gold-source fallbacks); sensitivity to parameter changes (θ/H/T windows, envelope/velocity caps, ω_h/λ/η, rounding conventions D-13.14).
- **Discipline:** no arm is selected on calibration data; every result row carries its window, data vintage, and evidence status; environmental limits are reported as UNVERIFIED, never PASS (standing rule). Deliverable 11 owns execution; Gate J owns acceptance.

Metric definitions (conventions only — computing any of them is NOT RUN): performance = cumulative/simple chain-linked return of the arm's index path; volatility = annualized stdev of period returns; maximum drawdown = max peak-to-trough decline of the level path; tracking behavior = RMS and mean of the arm's deviation from the declared objective series (D-13.5), reported per window; turnover = Σ|Δw| per period summed over the window (weights) and realized execution turnover vs the 5%-NAV daily cap (`blueprint.ts:248`); concentration = HHI = Σ w_i² computed on every committed vector; data-failure incidence = count/duration of per-leg DEGRADED/STALE/HALTED/FAILED oracle states + missing CPI rows per §5; parameter sensitivity = re-run grid over the §12 parameter set with reported deltas (no "best" declared on calibration data).

## 8. Index-integrity invariants and named acceptance tests (required; NOT RUN)

- **IDX-SUM-1** — every committed weight vector sums to exactly 1e18 on-chain / 1.0 off-chain (bp-quantized inputs; joint with deliverable 4 CCY-SUM-1). Today's on-chain tolerance is ±1e14 (V2:638, V3:1388) — v3.0 draft tightens to exact (D-13.14).
- **IDX-ENV-1 / IDX-VEL-1** — envelopes and velocity hold at every commit and at every glide intermediate (joint CCY-BOUND-1/CCY-VEL-1).
- **IDX-CONT-1 (zero artificial return at a rebalance boundary):** construct a state, advance to t, commit a *different* weight vector at constant prices, assert `I_t` unchanged (|ΔI| ≤ 1e-12 off-chain; 0 wei on-chain) and `D_t = B^-/B^+`. Generalizes the existing no-op self-test (`chain-index.ts:888-894`) to changed weights. Mandate clause: "composition change by itself creates no artificial gain or loss."
- **IDX-CONT-2 (genuine post-boundary movements flow):** after the commit, move prices, advance, assert the one-step return equals the new-composition weighted return (not the old).
- **IDX-CONT-3 (add-from-zero / remove-to-zero):** continuity across an entry ramp start and a retirement completion, incl. the §2.2 succession form (ejection + successor against the immutable slot fixing). **Impossible today** (composition static; positive-weights-only submit) — becomes writable only after deliverable 4 lands.
- **IDX-CONT-4 (ledger consistency):** recorded `G_t` equals Π D_t over the divisor ledger (existing verifier: `chain-index.ts:799-832`); every T3/T5/T6/T7 boundary emits exactly one record.
- **IDX-CONT-5 (NAV-form reconciliation):** §9.1 aggregate form vs §9.2 recursion residual is computed and published every period (existing hook `getNavForm` `chain-index.ts:731`; the §9.3 reconciliation tests over full history are NOT RUN today — honest-status `:251(c)`).
- **IDX-PUB-1** — all six §3 values present in every close-of-record publication, each with provenance and registry version.
- **IDX-REV-1** — no silent revisions: append-only ledger; any correction is a new timestamped record with reason code; test mutates a published value and asserts the history is irreducible.
- **IDX-PREC-1** — on-chain (1e18) vs off-chain (float64) reconciliation within the declared tolerance (D-13.14) over a long randomized run (drift bound, not just single-step).
- **IDX-BASIS-1** — every divisor record carries its basis label ("base-relative"; legacy carry-forwards labeled "raw-usd" — `chain-index.ts:91-96`, `:108-111`).
- **IDX-DISC-1** — the "index continuity ≠ exchange-price continuity" disclosure is emitted with every publication surface (§3).
- **IDX-GOLD-1** — a gold-feed failure (STALE/HALTED/FAILED per deliverable 10) cannot advance the index on the stale leg: the boundary freezes/pauses per the oracle-emergency spec; the constant-fallback price (2,500) is published as DEGRADED if used at all (current loader labels its source — `historical-data.ts:359-363`).
- **IDX-SEP-1** — the index consumes no payment-instrument volume input (joint INV-SEP-1, deliverable 4 §8).

Oracle-independence cross-reference: the ≥2-independent-families requirement for every leg incl. gold is currently NOT MET (single live upstream/pair + synthetic witnesses — `oracle-feeds.ts:942`; honest-status `:224-228`); resolution is owned by deliverable 10 and is a precondition for any IDX-* result to be meaningful. Emergency cross-reference: all index-leg failure behavior (freeze vs LKG vs pause) is defined by the oracle/emergency spec (deliverable 10); this document only fixes that the index itself never advances on a non-VALID leg and that every emergency boundary emits a divisor record (joint CCY-EMER-1).

Test preconditions and environment honesty (PROPOSED): (i) IDX-CONT/PREC tests run FIRST in the TS reference layer with deterministic seeds and synthetic price paths (no live vendor calls inside tests); (ii) on-chain variants run under Foundry only where a runner exists — sandbox execution is UNVERIFIABLE (no forge; baseline §9) and is never reported as PASS without a runner; (iii) IDX-CONT-3-class tests are gated on the Stage C registry landing (they cannot be expressed over a static composition — baseline §5 Stage D row 3); (iv) long-horizon drift tests (IDX-PREC-1) must run ≥10⁶ steps in bounded memory (checkpointed state) — the sandbox's 600s tool ceiling makes them environmental-UNVERIFIED candidates (cf. the canonical-invariants three-attempt record, test-matrix `:22-26`); (v) every test asserts economic invariants (sum, bounds, continuity), never mere successful execution (README rule 3 / mandate §13).

## 9. Existing implementation vs v3.0 — breaking changes, migration

The index **math** is retained (not a breaking change): recursion, divisor, basis, ledger types all survive v3.0 as-is. Breaking/missing items:

1. **Component-count rigidity** — `length !== 7` (`chain-index.ts:236-241`), `[7]` calldata/loops everywhere in V2/V3, and the 6-leg oracle board (`oracle.ts:685-741`) must become registry-driven (breaking ABI change on the undeployed contracts; TS signature changes).
2. **Zero-weight exits impossible** — positive-weights-only submission (V2:526, V3:1317) blocks T5/T6 endpoints and therefore IDX-CONT-3 on-chain; must change with deliverable 4.
3. **Commit tolerance** ±1e14 → exact bp-sum (V2:638, V3:1388; D-13.14).
4. **No publication surface** — the six §3 values do not exist (NOT IMPLEMENTED); no market-price feed exists (baseline test-matrix: NONE).
5. **Durability gap** — the pilot divisor ledger is in-memory only (`honest-status.ts:251(b)`); v3.0 requires a persisted, hash-chained publication ledger (schema in deliverable 4 §2 family).
6. **On-chain gaps** — V3 has no `getNavForm` view; `ChainLinkAdjusted` fires only when deployed (`:251(a)`).
7. **Known-stale test** — canonical Case C raw-USD assertion must be updated to the pinned base-relative form before any Stage K run (test-matrix `:26`).

Breaking/missing item → test-family map:

| # | Item | Test family that gates it (§8 / deliverable 4 §10) |
|---|---|---|
| 1 | Component-count rigidity (guards, [7] arrays, 6-leg board) | CCY-LC-*, CCY-DET-1, IDX-CONT-3 |
| 2 | Zero-weight exits impossible (positive-only submit) | CCY-EXCL-1, IDX-CONT-3 |
| 3 | Commit tolerance ±1e14 → exact | IDX-SUM-1, CCY-SUM-1 |
| 4 | No publication surface (six values) | IDX-PUB-1, IDX-REV-1 |
| 5 | In-memory divisor ledger | IDX-CONT-4, IDX-REV-1 |
| 6 | No on-chain getNavForm / ChainLinkAdjusted undeployed | IDX-CONT-5 (off-chain hook exists; on-chain NOT IMPLEMENTED) |
| 7 | Case C stale assertion | precondition for every IDX-CONT run |

Migration: none of this touches the deployed v1.2 pilot (different family — C-INV-2; DEVELOPER-REPORTED); V2/V3 are source-only and are redesigned **in source before any deployment**; shadow-mode posture means all TS-reference changes run in the pilot without production claims; no gate advances by any of this work (README rule 3).

## 10. Risks (security & economic; none claimed mitigated)

1. **Divisor-path compromise** — whoever controls weight commits controls `G_t` (onlyKeeper today; keeper is release-controls-guarded but its key remains in the compromised-key authority estate — Task 12 carry). Any v3.0 deployment is blocked behind the Task 12 authority migration. Carried, blocking.
2. **Data-vendor dependence** — gold is a single live family (`fx.ts:201-221`); FX legs are single-upstream with synthetic witnesses; the GC=F history proxy carries futures-vs-spot basis and roll conventions that are UNDOCUMENTED in the code (UNVERIFIED basis behavior). Fallback ladders must be re-sourced before validation.
3. **Precision drift** — float64 vs 1e18 divergence over long horizons is bounded by IDX-PREC-1 but currently UNMEASURED (the §9.3 reconciliation was never run — honest-status `:251(c)`).
4. **Revision-policy abuse** — a mutable publication ledger would allow silent history edits; mitigated by IDX-REV-1 design; remains a governance-integrity risk, not a solved one.
5. **Transition-window arbitrage / publication front-running** — public commit records reveal intended composition before execution legs trade toward it (cross-ref deliverable 4 §11 risk 3); the index itself stays continuous (no artificial jump) but execution costs remain.
6. **Benchmark survivorship/selection** — the §7 comparison arms must include the static 7-component baseline (not a cherry-picked alternative); any window selection must be pre-registered. PROPOSED discipline, UNVERIFIED until Stage J runs.
7. **CPI vintage/lookahead risk (only if a GPP leg or benchmark is adopted)** — using a CPI value dated to its reference month but published weeks later would inject lookahead into backtests; the §5 publication-lag carry rule and Stage J's vintage discipline must use *publication-date* timestamps in any historical evaluation. PROPOSED; UNVERIFIED until the data onboarding documents per-source publication calendars.

## 11. Assumptions & unresolved questions

- **Blocking dependency:** deliverable 4 (Stage C) must land before any IDX-CONT-3-class test or composition change exists at all; conversely this document's continuity machinery is what makes deliverable 4's transitions safe. The two specs are a pair.
- The gold pricing convention (§4 alternatives) and the GPP choice (§5, D-13.13) are both open; each interacts with D-13.5 (objective), D-13.11 (basket size — a GPP leg would consume a slot), D-13.12 (gold disposition).
- The daily close-of-record timestamp and fix-time freshness bounds are draft; timezone/day-boundary conventions must align with the CPI publication calendar if a GPP leg is adopted. UNRESOLVED.
- Whether the GC=F proxy is retained for history or replaced by a fix-based vendor is UNRESOLVED (basis-risk documentation first).
- On-chain vs off-chain authority for the publication ledger (who signs close-of-record records) is UNRESOLVED and intersects the Task 12 authority migration.

## 12. UNAPPROVED DRAFT PARAMETERS (single table — every value requires owner approval)

| Symbol | Meaning | Draft value | Decision ID |
|---|---|---|---|
| Index form | chain-linked recursion (Option A) vs fixed-base Laspeyres (B) vs Paasche (C) | A (retained) | Gate B/C (with D-13.4) |
| close-of-record time | daily canonical close | 00:00 UTC | D-13.5-adjacent (Gate B) |
| pub. rounding | significant digits at publication | 12 (round-half-even, publication only) | **D-13.14 (NEW)** |
| reconciliation tolerance | \|I_off − I_on\| relative | 1e-12 | **D-13.14 (NEW)** |
| weight quantum | bp quantization of committed weights | 1e-4 | D-13.14 |
| commit sum rule | on-chain sum check | exact 1e18 (vs today ±1e14) | D-13.14 |
| gold convention | spot / PM-fix-close / fix-only | (a) spot retained as draft; (b) hybrid candidate | D-13.12 |
| gold staleness (intraday) | GOLD class bounds | 60s / conf 1.0% / heartbeat 15s (existing) | re-ratify at Gate C (Risk-Council path) |
| gold fix freshness | fix-time window for close-of-record | fix timestamp within close window (value TBD) | D-13.12 |
| gold envelope | XAU index-leg bounds | today 20–32% as starting point | D-13.12 |
| GPP inclusion | Option A leg / B MASE-objective / C exclude | C (exclude from initial composition) | **D-13.13 (NEW)** |
| GPP weights a_j | aggregation shares | GDP-PPP shares (values not computed) | D-13.13 |
| GPP carry-forward | missing-country tolerance | ≤2 cycles | D-13.13 |
| GPP normalization | arithmetic chain-link vs geometric | chain-link (arithmetic in relatives) | D-13.13 |
| fallback ladder | gold source fallback order | live → fix vendor (TBD) → DEGRADED-flagged constant? (to be REMOVED in approved config) | D-13.12 |
| divisor ledger | persistence | persisted hash-chained (replaces in-memory) | Gate C implementation approval |
| benchmark set | §7 arms | static-7, USD index, EUR-hedged, gold, CPI, cash | D-13.5 |

**New decision IDs opened here: D-13.13** (GPP inclusion choice + its parameters). D-13.14 was opened by deliverable 4 (shared rounding/precision conventions — the index consumes the same bp-quantized vectors).

## 13. Owner approvals required (all OPEN — none may be inferred from this document)

- [ ] **D-13.12** — gold disposition: representation, pricing convention (§4 alternatives), bounds, fallback ladder; prohibition of guaranteed-floor language. Gates B/C.
- [ ] **D-13.13 (NEW)** — GPP: Option A/B/C, aggregation weights, missing-data rules. Gate B/C (depends on D-13.5).
- [ ] **D-13.14 (NEW, shared with deliverable 4)** — rounding, tie-breaking, sum tolerance, publication precision/reconciliation tolerance. Gate C.
- [ ] **D-13.5** — stability objective (determines the benchmark set of §7 and the tracking metric). Gate B.
- [ ] **D-13.11** — basket size/admission (composition changes are the premise of IDX-CONT-3). Gate C.
- [ ] **Gate C/B ratification** of the index publication cadence, revision protocol, and the six-value publication surface as methodology version v3.0-index-1.
- [ ] Cross-gated: oracle source-independence (deliverable 10) before any validation claim; Task 12 authority migration before any on-chain ledger deployment; Stage J execution before any effectiveness statement about the adaptive model or gold's role in it.

## 14. What has NOT been tested / implemented (explicit)

NOT IMPLEMENTED: the publication surface (all six §3 values); any market-price feed and deviation metric; a gold fix-based feed; any GPP feed (honest-status `:221` — the §6.8 PPError is a disclosed proxy); the persisted divisor/publication ledger; on-chain getNavForm; the IDX-* test suite (none of the §8 tests exist). NOT RUN: the §7 benchmark comparison in its entirety (PLANNED — NOT RUN); the blueprint-§9.3 NAV-form reconciliation over full history (the §8 IDX-CONT-5 hook exists but the test does not); walk-forward/purged CV; any IDX-CONT-3-class composition-change test (blocked until deliverable 4 lands — baseline §5 Stage D row 3). KNOWN-STALE: canonical Case C divisor assertion (must be updated before Stage K runs). UNVERIFIED: GC=F basis behavior; Foundry suite behavior in any registry-era rewrite; CI-runner execution. The existing inline self-test (`chain-index.ts:876-894`) covers only a no-op commit under the static composition and is NOT claimed as validation of composition-change continuity.

## 15. Mandate §6 compliance map (self-check; for orchestrator review)

| Mandate clause (§6/§4 verbatim topic) | Section |
|---|---|
| Index continuity: no artificial gain/loss at rebalance boundaries (§6; §4 D) | §2.2 (algebra), §8 IDX-CONT-1..3 |
| Chain-linked methodology with divisor; alternatives | §2.1 |
| Publication cadence / revision policy (no silent revisions) | §2.3, IDX-REV-1 |
| Numerical precision + rounding rules (on-chain 18-dec vs off-chain float64) | §2.3, IDX-PREC-1 (D-13.14) |
| Gold priced and represented (§4 E) | §4 |
| Custody assumptions N/A for a pure index leg; instrument admissibility → registry | §4 (explicit) |
| GPP methodology, coverage, publication lags, revisions, normalization, missing data (§4 F) | §5 (Option C = explicit exclusion alternative) |
| Adaptive vs fixed-basket + benchmark comparison on historical + stress data | §7 (PLANNED — NOT RUN) |
| Performance/vol/drawdown/tracking/turnover/concentration/data-failures/sensitivity reporting | §7 metrics list (plan only) |
| MASE fully specified before implementation; no effectiveness claims | §6 |
| No optimality/stability/manipulation-resistance/validation labels; parameters unapproved | throughout; §12 |

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
