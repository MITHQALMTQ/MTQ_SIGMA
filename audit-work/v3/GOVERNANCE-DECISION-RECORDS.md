# MTQΣ Governance Decision Records — Reconciliation Gates RG-01..RG-15 + Open Conflicts

**Task ID:** 11 · **Agent:** audit-documentation agent · **Mode:** DOCUMENTATION-ONLY
**Fulfills:** equation-by-equation audit §7 item 11 ("governance decision records for every RG") and §8 (unresolved ambiguities).
**Inputs:** `EQUATION-BY-EQUATION-AUDIT-REPORT.md` §4 (gate verdicts) and §8; `blueprint-source-verification.md` (blueprint line quotes); the implemented code state of 2026-10-19 (every "Decision taken in code" below was re-verified against the working tree — file:line cited).
**Companion documents:** `NOMENCLATURE-MAP.md` (RG-02/RG-05 symbol disambiguation), `IMPLEMENTATION-LOG.md` (the change inventory this session).

**Governance layers (blueprint §14.2 / `GOVERNANCE_HIERARCHY`, blueprint.ts:445–450):**

| Layer | Authority | Timelock | Owns |
|---|---|---|---|
| Constitutional | Multi-Sig **7/7** | 90 days | Methodology, envelopes, immutable constants, the spec text itself |
| Monetary | DAO vote **51%** | 48 h | Fees, RR target within envelope |
| Risk | Risk Council **4/7** | 24 h | Haircuts, thresholds, validation-stage parameters within envelopes |
| Emergency | Multi-Sig **4/7** | Instant | Pause/eject actions |

**Status legend:** `RESOLVED-BY-CODE` (code implements a single consistent rule; ratification as noted) · `OPEN-GOVERNANCE-REQUIRED` (a governance body must still decide/ratify) · `DORMANT` (the conflict cannot materialize until a named subsystem lands).

**Record count: 18** — RG-01..RG-15 (15) + open items OI-1..OI-3 (3). Summary table at the end.

---

### RG-01 · Index recursion weight convention (form A vs form B)

- **Gate:** §9.2 prints both recursions — `I_t = I_{t-1}·Σ W_{i,t}(P_{i,t}/P_{i,t-1})` (line 2079) and the start-of-period form with `W_{i,t-1}` (line 2083) — and the alignment spec treats the choice as open.
- **Blueprint conflict/ambiguity:** Not actually open: line 2087 pins the operative convention ("period returns are computed with the weights in force at the start of the period … **Listing 3 implements exactly this convention**"); Listing 3's header (lines 2307–2309) labels the W_{i,t-1} form "Authoritative". The spec's "P596/P598" locator is unresolvable in the extraction (citation defect only). What remains open is the COO-17 reconciliation of the §9.1 value-aggregate form (G_t; B_t^± valuation basis) with the recursion — a documentation obligation, not a code fork.
- **Decision taken in code:** **Form B (prior-period weights)** — `advanceIndex` (chain-index.ts:149–171, `const w = state.prevWeights[i]`), rationale documented in the file header (kills the notional short-gold exposure of form A); divisor continuity via `commitWeights` (I_t unchanged across weight commits, self-tested to 1e-12); tested by canonical 1.1/1.2, the chain-index self-test, and the succession bit-identical swap check.
- **Rationale:** Matches the blueprint's own operative convention; continuity is enforced by the §9.3 divisor rather than by tolerating artificial returns.
- **Status:** **RESOLVED-BY-CODE.**
- **Ratification requirement:** **None** — the blueprint self-pins. Outstanding: promote the recursion↔value-aggregate equivalence test from the ad-hoc `audit-verify.ts` into the canonical suite (referred to Task 10, test agent), and complete the COO-17 reconciliation note in the next spec revision (Constitutional 7/7 owns the spec text).

### RG-02 · NAV symbol overloaded four ways

- **Gate:** "NAV_t" means (a) §2.5 index value I_t (line 902), (b) §14.1 reserve V_net (line 5177), (c) §19.3.2 per-token V_net/S_circ (lines 8667–8671) — and (d) Appendix A.1 glossary line 13054 defines NAV_t as *reserve* NAV **while citing §2.5** (a defect the alignment spec missed). Bonus glossary collisions: D_t (line 13058) and B_t^± (line 13060).
- **Blueprint conflict/ambiguity:** Three-way semantic overload plus a self-contradictory glossary; the same glossary also collides D_t (§9.3 divisor vs "weight deviation") and B_t^± (§9.3 basket values vs "buffer boundaries").
- **Decision taken in code:** Distinct symbols at every site — `I_t`/`mtqPrice`/`gfbIndex` (index level), `nav`/`navUsd`/V_net (`reserveAssetValues().nav`, engine.ts:641), `navPerMtq`/`indexNavDivergence.navPerMtq` (per-token, engine.ts:1636/2261). UI labels USD figures as *reporting numeraire* (BasketValueDisplay.tsx:15). Full disambiguation table: **`NOMENCLATURE-MAP.md` §1–§3** (this deliverable set).
- **Rationale:** The overload is the single largest source of cross-reading errors between the index chapter and the reserve chapter; distinct symbols cost nothing and make the I_t↔navPerMtq divergence itself a first-class monitored quantity.
- **Status:** **RESOLVED-BY-CODE — OPEN-DOC** (code clean; the glossary fix is outstanding).
- **Ratification requirement:** **Constitutional 7/7** — next spec revision must (i) fix glossary A.1's NAV_t entry, (ii) adopt the nomenclature map, (iii) resolve the D_t/B_t^± glossary collisions.

### RG-03 · Gross getter vs net reserve manager

- **Gate:** §2.7 Listing 1 returns gross `fiatValue + goldValue` (lines 1041–1043, 1123–1127) while §14.1/§14.6 Listing 5/6 require per-asset haircuts and net storage (lines 5175–5179, 5413–5523; fidelity note line 5723 acknowledges BP's gross storing as corrected).
- **Blueprint conflict/ambiguity:** Two NAV semantics in the source listings; the end-to-end trace the gate demands is genuinely required.
- **Decision taken in code:** **Single net source** — `reserveAssetValues()` (engine.ts:641) returns haircut-adjusted `nav` consumed by every monetary site (RR, LCR, redemption, PoR, concentration, waterfall, DailyStateVector); gross values exported for display only; canonical invariant "NAV < gross" guards it. One drift fixed this session: the historical backtest's `navFromHoldings` now applies the same gold min-rule `min(ref, ref×0.995)` (historical-backtest.ts:280–284) — the +0.13% test-only NAV drift is closed.
- **Rationale:** Blueprint §14.1 declares the haircut definition constitutional (Invariant I4); net-by-construction is the only reading that satisfies it everywhere.
- **Status:** **RESOLVED-BY-CODE (PASS).**
- **Ratification requirement:** **None** — I4 already decides it.

### RG-04 · Legacy five-currency GFB formula

- **Gate:** §9.7.1 line 2237 retains the legacy fixed-quantity five-term GFB (no CHF, no gold); lines 2241–2247 and line 2289 declare it superseded by the seven-component adaptive index ("getGFB() is superseded by getIndex() of Listing 3").
- **Blueprint conflict/ambiguity:** A deprecated formula coexisting with its replacement invites copy-paste reuse.
- **Decision taken in code:** Engine: legacy formula quarantined/deprecated (`computeGfbIndex` dead-labeled; snapshot `gfbIndex` mirrors I_t). **UI panel rewritten this session:** GfbBasket.tsx now renders the actual canonical chain-linked recursion (§9.2 form B) with the §9.3 divisor-continuity note, imports fixings from the engine constants (CHF = **1.1300** — the stale 0.88 is gone), and the deprecated Laspeyres fixed-quantity panel was removed (GfbBasket.tsx:12–13, 36, 100–113).
- **Rationale:** A superseded formula displayed under the title "Chain-Linked Index Formula" was the audit's top presentation-layer leak (F-1d); users must see the operative math.
- **Status:** **RESOLVED-BY-CODE** (engine quarantine + UI rewrite).
- **Ratification requirement:** **None** — conformance with the blueprint's own supersession.

### RG-05 · Q_min reused as threshold and observed statistic

- **Gate:** §4.2 line 1367 makes Q_i ≥ Q_min the eligibility threshold; §4.2.1 lines 1373–1377 uses Q_min/Q_max as the observed per-round min/max for normalization; line 1377 names the threshold a methodology parameter in the same breath.
- **Blueprint conflict/ambiguity:** One symbol, two roles (governance constant vs per-round statistic). Conflation would make eligibility self-referential.
- **Decision taken in code:** **None required — DORMANT.** Constituency scoring is not implemented (static 7-component set; succession is a read-only drill; disclosed at honest-status `D-constituency`). Disambiguation proposal adopted in documentation: **Q_threshold** vs **Q_min^obs** (`NOMENCLATURE-MAP.md` §2).
- **Rationale:** The collision cannot materialize in code that doesn't score constituencies; but any future §4 implementation would inherit the ambiguity silently, so the pin must precede it.
- **Status:** **DORMANT.**
- **Ratification requirement:** **Constitutional 7/7** — the constituency methodology version must adopt Q_threshold/Q_min^obs **before §4 lands** (audit §8 item 6).

### RG-06 · Softmax score orientation (exp(−η·Score))

- **Gate:** §7.6 lines 1693–1703: `α_m = e^(−η·Score_m)/Σ e^(−η·Score_k)` with prose "better models receive greater weight" — internally consistent only if Score is **lower-is-better**; η is numeric nowhere; Score_m = f(OOSRisk, CVaR, PPError, Turnover, Robustness) mixes plausibly higher-is-better inputs.
- **Blueprint conflict/ambiguity:** Orientation asserted as "chosen" but never fixed; sign error risk in the one component that decides model influence.
- **Decision taken in code:** **No softmax exists** (DORMANT-CLEAN). The pilot uses **equal α = 1/6 per §7.5 family**, disclosed in code (mase.ts:236–238 comment retained), in the UI, and now itemized at honest-status `D-ensemble-alpha`. No invented η or Score was introduced (RG-15 held).
- **Rationale:** The blueprint leaves Score/η symbolic (validation-stage); an untested sign convention in an adaptive controller is exactly the class of defect the audit exists to prevent.
- **Status:** **DORMANT-CLEAN.**
- **Ratification requirement:** Before §7.6 adaptive weights land: **Risk Council 4/7** ratifies η (a Risk-Council parameter within constitutional envelopes) **and** the score orientation must be pinned by a **known-vector test** (feed fixed Scores, assert the best model gets the largest α) — engineering gate recorded here.

### RG-07 · Gold purchasing-power signal sign convention

- **Gate:** §5.2 lines 1459–1465: GPR_{i,t} = P_{i,t-1}/P_{i,t} − 1 with P = price of one unit of gold in currency i; the blueprint itself defers ("the convention is fixed per methodology version to avoid sign errors", line 1465). As printed, gold getting more expensive in currency i yields a **negative** GPR.
- **Blueprint conflict/ambiguity:** Direction convention explicitly unfixed.
- **Decision taken in code:** **GPR is absent — no live risk.** The pilot's proxy `modelPurchasingPower` (mase.ts) uses the **opposite quote direction** (currency-in-USD, "buy depreciated") under the same "Purchasing-Power" name; it is labeled a simplified pilot substitute and carries a **must-not-seed** warning: it must NOT seed the §5.2 implementation (audit EQ-027 verdict).
- **Rationale:** Two opposite conventions under one name is a seeding hazard; the record exists so the future §5.2 implementer re-derives the direction from the methodology version, not from the proxy.
- **Status:** **DORMANT** (seeding-risk flagged).
- **Ratification requirement:** When §5.2 is implemented: **Constitutional 7/7** (methodology version fixes the direction convention, per blueprint line 1465).

### RG-08 · Oracle aggregate — median vs filtered mean (§17.2 vs §17.4 vs §17.5)

- **Gate:** §17.2 (lines 7027–7031): median of three / average of two / pause below two. §17.5 (lines 7139–7141): median is only the validity anchor, the **published aggregate is the outlier-filtered mean** ("agree in the normal case" — but mean-of-3 ≠ median-of-3 exactly in the outlier case the median exists for). §17.4 (line 7103): gold uses **Median(P₁..P_n)** — a second aggregation mode in the same chapter.
- **Blueprint conflict/ambiguity:** Blueprint-internal three-way conflict over what number the system publishes.
- **Decision taken in code (this session):**
  1. **The MEDIAN is the returned aggregate at ≥3 valid feeds** — consistent with §17.2 and §17.4-gold (oracle.ts `buildOracleConsensus`:331, 512–514). §17.5's filtered-mean is **NOT implemented**.
  2. **2 valid feeds:** average only under an explicit governance override (DEGRADED, `method="average"`, published as such); otherwise paused. **<3 valid without override → pause** (stricter than §17.2's "<2", per the standing strict-I9 COO/PM directive).
  3. **§17.9 correlation-warning counter implemented:** per-pair consecutive-update counters (oracle.ts:254–262, 474–495) — pairwise deviation > 1.5% for 3 consecutive updates ⇒ `SOURCE_CORRELATION_WARNING`; **the median stays the aggregate**; the counter resets when deviation returns inside threshold; the pilot tick holds rebalancing while a warning stands (pilot-state.ts:319–321).
  4. **§17.7 five-state feed enum implemented:** `FeedState = VALID | DEGRADED | STALE | OUTLIER | HALTED` (oracle.ts:49, 427–451) — **HALTED at 2× staleness per §17.8** (dead feed escalates; missed-heartbeat-but-fresh = DEGRADED, included with warning).
  5. **§17.7 aggregate state** `NORMAL | DEGRADED | FAILED` (oracle.ts:106, 569–578) + **`oracleDispute` flag** (all three deviate > 2.5% ⇒ dispute published, price stays PAUSED).
  6. **REJECTED VARIANT recorded:** the v1.2 table's **geometric-mean fallback** is rejected — superseded by the strict-I9 pause (oracle.ts:497–504, "documented decision record" in-code).
- **Rationale:** The median is the only aggregate consistent with both §17.2 and the gold chapter; the filtered mean exists in the blueprint only to tolerate asymmetric feeds, which is precisely the case where publishing a mean is unsafe; the correlation counter is the exact safeguard §17.8–9 demands for an architecture whose pilot witnesses share one upstream.
- **Status:** **OPEN→RECORDED** — the decision is now written down and implemented, but it is **normative pending ratification**, not ratified.
- **Ratification requirement:** **Risk Council 4/7** must ratify the full truth-table: 3/2/1/0 valid feeds × family-independence condition × outlier state → (aggregate, published state, pause-or-trade). Until ratified, median remains the provisional normative rule. (The Constitutional 7/7 owns the quorum constant itself — see OI-3.)

### RG-09 · MARP objective J(ΔW) — operator, λ's, and the ΔW-invariant urgency term

- **Gate:** The alignment spec claimed §10.9 "does not show an explicit argmin/argmax". **The premise is FALSE:** the blueprint prints `ΔW* = argmin_ΔW J(ΔW)` at line 2971 and pins λ₁..λ₄ = 0.40/0.30/0.20/0.10 (lines 2960–2966, repeated §11.8 and Listing 4). The *surviving* defect: λ₃·Urgency (Urgency = 1/RR_t if RR_t < 1.10 else 0, line 2952) is **independent of ΔW** — it shifts J uniformly, cannot "penalise deviation" as the prose claims, and has no effect on the argmin.
- **Blueprint conflict/ambiguity:** None on the operator (spec misrepresentation — corrected in this record); a real one on the urgency term's role/sign.
- **Decision taken in code:** The J(ΔW) optimizer is **not implemented** — compliant-by-omission (no invented minimizer, no invented sign). The only §10.9 trace is the λ₁(0.40)-weighted deviation-benefit proxy in `marpDecision`/`costBenefitGate` (marp.ts:106–116) and the legacy path's benefit term (engine.ts:950), both citing §10.9. **Residual item recorded:** when §10.9 is implemented, the urgency term must be reformulated to depend on ΔW (or explicitly re-scoped as a gate/urgency multiplier outside J) — noted for the §10.9 implementation task.
- **Rationale:** Implementing a "correction" to an objective the blueprint already states would be exactly the invented-formula defect RG-15 forbids; the ΔW-invariance is reported, not patched.
- **Status:** **RESOLVED-BY-CODE (compliant-by-omission)**; residual design note OPEN for §10.9.
- **Ratification requirement:** None now. When the J optimizer is built: **Risk Council 4/7** owns λ₁..λ₄ (blueprint line 2975: "governance-controlled default") and must ratify the reformed urgency term.

### RG-10 · Profitability threshold ε — one rule, fixed units

- **Gate:** §10.8 (line 2911): execute only when NetBenefit > ε. §12.5 prints **both** `> 0` (line 4257) and `> ε, ε > 0` (line 4263). The blueprint then fixes ε **twice with different units**: Listing 4 `BENEFIT_MARGIN = 1%` (relative; §11.8 line 3200, Listing 4 line 3307, gate `benefit > costTerm + BENEFIT_MARGIN` line 2933) vs Listing 5 `MIN_PROFITABILITY = $10` (absolute; §12.5 line 4265, Listing 5 line 4363, guard line 4745). The pre-fix code made it worse: the **active** legacy path used the bare `benefit > cost (>0)` form while the MARP advisory path used >$10 (audit F-2).
- **Blueprint conflict/ambiguity:** Three coexisting rules; the executing route used the weakest.
- **Decision taken in code (this session — audit P0-2):** **UNIFIED — every execution route uses `NetBenefit > ε = $10 absolute`** (Listing 5 §12.8): `MIN_PROFITABILITY_USD = 10` (blueprint.ts:274) enforced in `evaluateRebalance` (engine.ts:954–961, "One rule, one ε, fixed units, every route") and in `costBenefitGate` (marp.ts:101–116). Listing 4's 1% relative margin and §12.5's bare `>0` are recorded **in-code as REJECTED VARIANTS** pending ratification (blueprint.ts:262–273).
- **Rationale:** Listing 5 is the operative on-chain initialization the §10.8/§12.8 prose describes ("a candidate trade must clear the ε-threshold, not merely break even"); the $10 absolute form is scale-free with respect to trade size and matches the reference implementation; a relative margin silently grows with trade size and re-couples the gate to the deviation it is supposed to bound.
- **Status:** **RESOLVED-BY-CODE** (ratification pending).
- **Ratification requirement:** **Risk Council 4/7** — ratify $10 absolute as the normative ε (and the rejection of the 1% and >0 variants). ε is registered in the PARAMETER_REGISTRY at the RISK layer (blueprint.ts:420).

### RG-11 · Legacy core+buffer gold target vs adaptive v2.0 core gold

- **Gate:** §13.5.2/§16.2–16.3: v1.2 initialization `W_gold_total = 0.20 + 0.10 × B_gold(RR_t)` (62.5/85/100% buffer ratios → 26.25/28.5/30.0%), with fidelity notes marking it "v1.2 constant … under v2.0 the core reserve's gold share is an output of the reserve optimization (Section 14.4)" (lines 5133, 6333).
- **Blueprint conflict/ambiguity:** Historical-init formula vs adaptive output; pre-fix, the historical formula drove the **active** execution target (audit EQ-111/119/120 DEVIATION).
- **Decision taken in code (this session — audit P1-4):** **UNIFIED to the adaptive reading:** `USE_MARP_EXECUTION = true` (pilot-state.ts:128). The **MASE envelope output (Gold 20–32%) now drives the active execution target** — `executionTargetGoldWeight()` reads the MASE-smoothed gold weight (engine.ts:864–879) and the snapshot publishes `executionTargetSource = 'mase-envelope' | 'legacy-buffer'` (engine.ts:1963–1966, 2221). The legacy `0.20 + 0.10×B_gold` clamp[22,30]% formula is **RETIRED to the pre-MASE genesis fallback** (used only before MASE has committed weights; engine.ts:845–914). Live NAV was never decomposed core+buffer (accounting separation held throughout); the first-loss waterfall caps retain their historical values as disclosed v1.2 initialization.
- **Rationale:** The blueprint's own fidelity note says the v1.2 numbers are validation-stage initialization, not the reserve's definition; with the MARP path active, the target must come from the adaptive layer, else index math is adaptive while execution targets are frozen 2023 doctrine.
- **Status:** **RESOLVED-BY-CODE** (ratification pending).
- **Ratification requirement:** **Risk Council 4/7** — activation of the adaptive execution target and retirement of the legacy target (operational risk decision; v1.2 constants are validation-stage per the blueprint fidelity notes).

### RG-12 · De-peg liquidation ladder denominator

- **Gate:** §21.5.3 summary wording "cumulative 10% → 25% → 50% → 100%" vs Listing 14's per-stage increments. The blueprint answers itself three ways: "Each stage sells an additional fraction **of the original position**" (line 10047); the table's "Cumulative Sell %" column with "(total 25%)" parentheticals (lines 10052–10058); Listing 14 computing every stage off `totalValue` (lines 10617–10653). Line 10061: "The cumulative percentages (10% → 25% → 50% → 100%) are constitutional and immutable".
- **Blueprint conflict/ambiguity:** Apparent only — the two forms are arithmetically consistent in the source.
- **Decision taken in code:** **Cumulative-of-original:** `EJECT_STAGES = [0.10, 0.25, 0.50, 1.00]` → increments 10/15/25/50 of the ORIGINAL sleeve (Σ = 100%), matching Listing 14 exactly. **Runtime gaps closed this session (audit P2-10):** the ladder is now wired to the FULL §21.5.3 trigger set — duration OR **RR-coupled triggers (RR < 1.08/1.05/1.02)** — plus the **5% pause rule** (no next stage if price dropped >5% from the current stage's entry price; pause gates advancement only, never de-escalation) and stage-entry-price bookkeeping (engine.ts `updatePegHealth`:1295–1362). The phantom `evaluateEjectStage` reference (a comment citing a function that never existed) is removed and replaced with the truthful trigger table (engine.ts:1295–1298).
- **Rationale:** The blueprint pins the denominator itself; the audit's finding was the *unwired* RR-coupling and pause rule, both now enforced.
- **Status:** **RESOLVED-BY-CODE.**
- **Ratification requirement:** **None** — blueprint self-pins (the ladder itself is Constitutional-immutable; the wiring is conformance). Residual implementation risk noted by the source verifier: "(total X%)" assumes earlier stages executed — partial-fill accounting is a future §21.5.3 hardening item, not an ambiguity.

### RG-13 · Risk-state machine — six states, and the blueprint's second, conflicting table

- **Gate:** §21.2 (lines 9941–9957) defines the canonical six states S1–S6 (RR 1.10/1.05/1.02/1.00 bands; LCR 1.00/0.90/0.80/0.70; EMERGENCY only via the RR hard floor, LCR "Any"; RECOVERY the residual posture). **The alignment spec missed that the blueprint contains a second machine:** §14.2.2 (lines 5237–5249) has FIVE statuses (no STRESS; DEFENSIVE 1.00 ≤ RR < 1.05 with LCR "Any"; RECOVERY LCR ≥ **0.95**), implemented by Listing 6 (lines 5627–5631). **And a governance-class conflict:** §2.9 (line 1226) classes the 48h Recovery Confirmation Period as "DAO Vote (51%)" while Listing 13 declares it an immutable constant (line 10149) — the blueprint flags this itself at line 9973.
- **Blueprint conflict/ambiguity:** Two state machines and one contradictory governance class inside one spec.
- **Decision taken in code:** state-machine.ts implements **§21.2 row-for-row** (thresholds, worse-binds, immediate escalation, 48h per recovery rung, EMERGENCY only via RR hard floor, RECOVERY as residual else-branch); 17/17 self-tests. The doc-internal tension (earlier table's RECOVERY LCR 0.95 / DEFENSIVE "Any") was resolved to §21.2 — the constitutional chapter. The two blueprint-internal conflicts are **recorded here** and are NOT resolvable by code.
- **Rationale:** §21.2 is the constitutional chapter and the more conservative machine (STRESS exists; DEFENSIVE requires LCR ≥ 0.70); code must follow one table, and §21.2 is the defensible pick.
- **Status:** **RESOLVED-BY-CODE** for the machine; **OPEN-GOVERNANCE-REQUIRED** for the spec conflicts.
- **Ratification requirement:** **Constitutional 7/7** — reconcile §14.2.2/Listing 6 with §21.2/Listing 13 (one canonical table; the other marked superseded), and resolve the 48h governance class (DAO-vote-51% vs immutable constant; the blueprint's own conservative reading retains the immutable constant and flags the discrepancy "for resolution during deployment registration").

### RG-14 · Genesis normalization / reference-price scaling

- **Gate:** §3.4 (index starts at exactly 1.0000; genesis notionals Σ = 1.0000); §9.1 (`NAV₀ = 1`); §18.1 (`P_MTQ = I_t / I_base`, I_base fixed at genesis); §20.1.5 (seven-component I_base incl. CHF 1.1300 and gold $2,500 = 650.644103).
- **Blueprint conflict/ambiguity:** Whether the engine must divide by the 650.644103 genesis denominator to obtain P_MTQ.
- **Decision taken in code:** **I_base = 1.0 — no division.** I_t is the already-normalized ratio (I_0 = 1.0 by the §3.4 calibration invariant); the genesis denominator **value** (650.644103) is stored immutable **reference-only** and never divided at read — "dividing would give P ≈ 1/650 — clearly wrong" (chain-index.ts:91–95). P_MTQ = I_t × PAR; live P_MTQ = 1.195907 = independent recompute; restart-invariant (D3).
- **Rationale:** Dividing would double-normalize; the stored value is calibration evidence (Σ W^Prior × fixings over seven components), not a live operator.
- **Status:** **RESOLVED-BY-CODE (PASS).**
- **Ratification requirement:** **None.** (See `NOMENCLATURE-MAP.md` §3 for the G_t/D_t/denominator disambiguation this gate motivated.)

### RG-15 · Symbolic forms without fixed coefficients — labeling discipline

- **Gate:** §4.2 (Q_i coefficients), §5.5 (CrisisScore f, k, λ_CVaR,0), §8.2–8.3 (envelope f, velocity g), §10.5–10.6 (θ κ-vector, β coefficients), §13.5 (R_G, E_j) are symbolic; the blueprint defers calibration to the validation program ("no developer may fill gaps with undocumented constants"). (The alignment spec's §15.2 citation is imprecise — §15.2 is concrete pass/fail; the symbolic E_j lives in §14.3/§13.5.3.)
- **Blueprint conflict/ambiguity:** None resolvable — the rule is: symbolic stays symbolic, substitutes get labeled.
- **Decision taken in code:** **PASS held — no invented constant masquerades as canonical.** Every simplified substitute is labeled "Simplified pilot"/"Simplified"/"Pilot approximation". **This session labeled the previously-unlabeled set** (audit F-5/RG-15 actions): the invented 4-state regime classifier (VIX 15/22/30; DXY 88/115 — engine.ts:2323–2327 "INVENTED … disclosed SUBSTITUTE"); the 0.50 crisis-gold vector (mase.ts:231, "PILOT APPROXIMATION (RG-15 label, EQ-032)"); ε = 1e-9 z-score guard (engine.ts:793, "numerical-stability guard only"); the 12-iteration/1e-9 projection numerics (mase.ts:299, "PILOT NUMERICS (RG-15 label)"); U_min = 0.05 (blueprint.ts:284–290); and the **$4M pool depth is no longer a silent hard-code** — it is FEED-DRIVEN (live PAXG 24h volume via Yahoo Finance, fx.ts:353–402, `livePoolDepth` flag published) with `$4M` retained only as the clearly-labeled `POOL_DEPTH_FALLBACK_USD` degraded-mode fallback (blueprint.ts:292–301; honest-status `D-pool-depth`). All formerly ungoverned constants are now registered in the PARAMETER_REGISTRY at their owning layer (blueprint.ts:418–432).
- **Rationale:** The labeling rule is the only defense against symbolic gaps silently becoming "canonical" by repetition; the registry gives each label a governance owner.
- **Status:** **RESOLVED-BY-CODE (PASS with labeling — labeling completed this session).**
- **Ratification requirement:** **None retroactively.** Ongoing rule: any new pilot constant must be labeled AND registered in PARAMETER_REGISTRY at its governance layer (default Risk Council 4/7) in the same change that introduces it.

---

## Open-item records (not tied to a single gate)

### OI-1 · §23.8 gold-shock scenario ledger naming

- **Conflict:** §23.8's scenario table (blueprint lines 11784–11805) names Gold **+50% / +25% / −10% / −20% / −30%**. The code's stress suite implements: S5 = Gold **+50%**, S6 = Gold **−30%**, S10 = combined (gold **−20%** + liquidity + issuer), S7 = oracle disagreement, and the canonical suite adds a Gold **+20%** index-side case. The +25% and −10% variants do not exist as standalone scenarios; the code's −20% is inside a combined scenario, and the code has a +20% the spec table lacks.
- **Decision taken in code:** none yet — scenario semantics are correct per scenario; only the LEDGER NAMING diverges from §23.8.
- **Rationale:** A validation auditor reconciling §23.8 against evidence must be able to map every spec row to a code scenario ID (or a documented "not run").
- **Status:** **OPEN-GOVERNANCE-REQUIRED** (documentation/ledger alignment; no runtime risk).
- **Ratification requirement:** **Risk Council 4/7** (owns the §23 stress-scenario ledger as validation-stage parameters): adopt a naming alignment — either implement +25%/−10% as standalone scenarios or record them as covered-by-range (+50/−30 endpoints + intermediate cases), and add the spec's names as aliases in `audit-stress.ts` scenario metadata.

### OI-2 · EQ-155 reintegration score — feature normalization unspecified

- **Conflict:** §21.5.4 fixes the reintegration R_score weights (0.40 / 0.25 / 0.20 / 0.15, thresholds 0.80/0.85/0.90, reverse ladder) but gives **no normalization spec for the score's input features**; the pilot's reintegration liquidityDepth input is a labeled randomized simulation.
- **Decision taken in code:** pilot uses the labeled simulated liquidityDepth (disclosed; succession.ts reintegration note); no invented normalization formula was added (RG-15 discipline).
- **Rationale:** Filling the normalization with a guess would make the 0.80 gate meaningless — the gate operates on whatever f() produces.
- **Status:** **OPEN-GOVERNANCE-REQUIRED** (blocks live reintegration, not the drill).
- **Ratification requirement:** **Constitutional 7/7** (methodology: the feature-normalization f must be published in a methodology version) with Risk Council 4/7 calibration of constants within envelopes, before reintegration can execute outside drill mode.

### OI-3 · Pilot witness architecture cannot satisfy the ≥2-family independence quorum

- **Conflict:** §17.3.4 (lines 7091–7095) makes the oracle quorum `N_valid ≥ 2 AND |source families| ≥ 2` a **constitutional constant** (7/7 Multi-Sig, 90-day timelock). The pilot's three "sources" are synthetic witnesses over **ONE upstream feed** (disclosed oracle.ts:19–31; honest-status `D-oracle-witnesses`). Structural: no code change can conjure family independence from one feed.
- **Decision taken in code:** Disclosed everywhere; strict-I9 pause behavior is the compensating control (a single upstream failure halts rather than averages); the §17.9 correlation-warning counter (RG-08 item 3) now detects exactly the correlated-witness case; the geometric-mean fallback is REJECTED (recorded under RG-08).
- **Rationale:** Pretending the witnesses are independent would be the single most dangerous overclaim in the platform; the pause-first posture is the honest reading.
- **Status:** **OPEN-GOVERNANCE-REQUIRED (structural, disclosed).**
- **Ratification requirement:** The quorum constant is **Constitutional 7/7** (90-day timelock) and must NOT be relaxed to accommodate the pilot. The fix is operational, pre-production: deploy ≥2 genuinely independent source families (distinct data providers/transport), then re-evidence. Until then the platform remains, correctly, NOT production-authorized.

---

## Summary table

| Record | Subject | Status | Ratification |
|---|---|---|---|
| RG-01 | §9.2 recursion weights | RESOLVED-BY-CODE (form B) | None (blueprint self-pins); promote equivalence test (Task 10) |
| RG-02 | NAV_t four-way overload | RESOLVED-BY-CODE — OPEN-DOC | Constitutional 7/7 (glossary A.1 fix, next spec revision) |
| RG-03 | Gross vs net NAV | RESOLVED-BY-CODE (PASS) | None |
| RG-04 | Legacy GFB | RESOLVED-BY-CODE (engine + UI) | None |
| RG-05 | Q_min collision | DORMANT | Constitutional 7/7 — pin Q_threshold/Q_min^obs **before §4 lands** |
| RG-06 | Softmax orientation | DORMANT-CLEAN | Risk Council 4/7 (η) + known-vector orientation test, before §7.6 |
| RG-07 | GPR sign convention | DORMANT (must-not-seed flag) | Constitutional 7/7 (methodology version), when §5.2 lands |
| RG-08 | Oracle aggregate | OPEN→RECORDED (median; §17.9 counter + §17.7/17.8 states + oracleDispute implemented) | **Risk Council 4/7** — ratify full truth-table (3/2/1/0 × family-independence × outlier) |
| RG-09 | J(ΔW) operator/λ's | RESOLVED-BY-CODE (compliant-by-omission; spec premise false) | Risk Council 4/7 when optimizer built (λ's + reformed urgency term) |
| RG-10 | Profitability ε | RESOLVED-BY-CODE ($10 absolute everywhere; 1% and >0 = rejected variants) | **Risk Council 4/7** |
| RG-11 | Legacy gold target | RESOLVED-BY-CODE (MASE envelope drives execution; legacy = genesis fallback) | **Risk Council 4/7** |
| RG-12 | Eject-ladder denominator | RESOLVED-BY-CODE (cumulative-of-original; RR-coupling + 5% pause wired) | None (blueprint self-pins) |
| RG-13 | Six-state machine | RESOLVED-BY-CODE (§21.2 row-for-row); spec conflicts OPEN | **Constitutional 7/7** (§14.2.2 vs §21.2; 48h governance class) |
| RG-14 | Genesis scaling | RESOLVED-BY-CODE (PASS; denominator reference-only) | None |
| RG-15 | Symbolic-form labeling | RESOLVED-BY-CODE (PASS; all substitutes labeled + registered this session) | None retroactive; new constants → PARAMETER_REGISTRY (Risk Council 4/7 default) |
| OI-1 | §23.8 scenario naming | OPEN-GOVERNANCE-REQUIRED | Risk Council 4/7 (stress-ledger alignment) |
| OI-2 | EQ-155 reintegration normalization | OPEN-GOVERNANCE-REQUIRED | Constitutional 7/7 (+ Risk Council 4/7 calibration) |
| OI-3 | Witness family independence | OPEN-GOVERNANCE-REQUIRED (structural) | Constitutional 7/7 owns quorum constant (must NOT relax); operational fix pre-production |

**18 decision records written** (15 reconciliation gates + 3 open conflicts). Production authorization remains **DISABLED**; nothing in this record set changes that posture.
