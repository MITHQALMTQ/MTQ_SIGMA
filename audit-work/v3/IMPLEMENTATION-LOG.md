# MTQΣ Implementation Log — Audit §7 Recommendations (Items 1–11) → Implemented Changes

**Task ID:** 11 · **Agent:** audit-documentation agent · **Mode:** DOCUMENTATION-ONLY (this file records the implementation; it did not perform it)
**Maps:** `EQUATION-BY-EQUATION-AUDIT-REPORT.md` §7 (P0 items 1–3, P1 items 4–7, P2 items 8–11) → the concrete changes implemented by the orchestrator's engine/UI/test agents **this session** (working-tree state verified 2026-10-19 ~09:25–09:55 UTC).
**Verification method:** every row below was re-checked against the working tree (file:line cited); items owned by parallel agents are marked with their owner task. Engine-side changes were in the tree at verification time; UI-file changes landed during verification (mtimes 09:51–09:54) and were re-read before recording.

**Headline: ALL 11 items are implemented this session.** None of the implemented changes altered the monetary model, the basket method, or introduced any USD peg — item by item they are presentation relabeling, guard/fee enforcement, disclosure itemization, execution-route unification, oracle safeguard implementation, test hardening, and documentation. Production authorization remains **DISABLED**.

---

## P0 — before any further pilot exposure

### Item 1 (P0-1) · Presentation cluster — prior no longer presented as live/constitutional — **IMPLEMENTED**

| Surface (audit F-1 ref) | Change | Evidence |
|---|---|---|
| `/api/gfb` (F-1c) | Prior weights now explicitly labeled `weightLabel: "W^Prior (§3.2 — strategic prior, not live)"`; live weights published as `liveWeights` (= `chainIndex.prevWeights`, the operative §9.2 form-B weights) plus `smoothedWeights` and `executionWeights` | src/app/api/gfb/route.ts:9–41 |
| `page.tsx` (F-1a/b) | "7-Component Basket · **Live Weights**" header → "**Strategic Prior (§3.2)**"; each component card now shows live W^Smooth (falling back to the operative chain weights) **next to** the W^Prior anchor with a delta; the false "constitutional (§9 — immutable)" sentence removed (Invariant I3 wording: methodology fixed, **weights adaptive**) | src/app/page.tsx:175–200 |
| `GfbBasket.tsx` (F-1d) | Panel rewritten from the deprecated Laspeyres fixed-quantity formula to the **actual canonical chain-linked recursion (§9.2 form B)** with the §9.3 divisor-continuity note; fixings imported from engine constants — CHF now **1.1300** (stale 0.88 removed) | src/components/mtq/GfbBasket.tsx:10–13, 36, 94–113 |
| `PitchSection.tsx` (F-1e) | Fixed-composition rhetoric softened: "seeded by a strategic prior … with **ADAPTIVE weights** governed by admissibility envelopes (§8.1)" | src/components/mtq/sections/PitchSection.tsx (Solution card) |
| `ReserveDonut.tsx` (F-1f) | Honest caption added: "the segments above are the STRATEGIC PRIOR (§3.2), not the live reserve composition" (role=note, aria-labeled) | src/components/mtq/ReserveDonut.tsx (AUDIT-FIX F-1 caption) |
| `ReferenceChart.tsx` (F-8 synthetic data) | Chart now consumes the **REAL §9.4–§9.5 attribution** from `snapshot.attribution` instead of synthetic series | src/components/mtq/ReferenceChart.tsx:293–295, 486 |

### Item 2 (P0-2) · Unified RG-10 ε gate — **IMPLEMENTED**

- **One normative rule on every execution route:** `execute iff NetBenefit = Benefit − Cost > MIN_PROFITABILITY_USD ($10 absolute)` — Listing 5 §12.8 form.
- `blueprint.ts:258–274`: `MIN_PROFITABILITY_USD = 10` + the in-code **RG-10 GOVERNANCE DECISION RECORD** (Listing 4's `BENEFIT_MARGIN 1%` and §12.5's bare `>0` recorded as **REJECTED VARIANTS** pending Risk-Council ratification).
- `engine.ts:954–961` (`evaluateRebalance`): the ACTIVE path now enforces `netBenefit > $10` (was bare `benefit > cost`, i.e. >0) — "One rule, one ε, fixed units, every route"; rejection/exec reasons cite §10.8/§12.8.
- `marp.ts:101–116` (`costBenefitGate`): the same constant, same comparison (MARP Level 5).
- Registered in PARAMETER_REGISTRY at the RISK layer (blueprint.ts:420). Ratification requirement: Risk Council 4/7 (decision record RG-10).

### Item 3 (P0-3) · Honest-status itemization + overclaim corrections — **IMPLEMENTED**

- `honest-status.ts:156–242`: new `getPilotDisclosures()` — **12 itemized pilot-substitution disclosures** (IDs `D-marpa-active`, `D-ensemble-alpha`, `D-vol-estimator`, `D-regime-classifier`, `D-risk-estimators`, `D-oracle-witnesses`, `D-gold-separation`, `D-concentration`, `D-constituency`, `D-validation`, `D-pool-depth`, `D-production`), covering every audit F-5/F-2/F-4/F-7 subject: MARP route active + legacy retired, equal ensemble α, single-window vol, invented 4-state regime classifier, no VaR/CVaR/MDD/GPP/HHI/8-term optimizer, synthetic oracle witnesses + median-not-filtered-mean, accounting-only gold separation, concentration enforcement state, static constituency, walk-forward/purged-CV not run, feed-driven pool depth with labeled fallback, production still disabled.
- `/api/honest-status` route publishes `pilotDisclosures` (route.ts:54, 75).
- `blueprint.ts:476–483`: the two overclaiming HONEST_STATUS lines corrected — "VaR/CVaR + MASE ensemble" → "MASE/MARP are pilot substitutes (no VaR/CVaR/MDD/covariance estimators yet — §5–7 symbolic forms not filled with guesses)"; "confidence scoring" line corrected (§17.6 Confidence_G / C_min 0.60 is NOT computed).

---

## P1 — before MARP execution can be enabled

### Item 4 (P1-4) · MARP flip + MASE target + direction lock + thin-liquidity deferral + feed pool depth — **IMPLEMENTED**

- **Flag flip:** `USE_MARP_EXECUTION = true` (pilot-state.ts:128); `store.state.rebalancePath = 'marp'` (pilot-state.ts:349–350). The legacy §7 gold↔USDC auto-exec path is retired to advisory-only (§24.2 audit rows; honest-status `D-marpa-active`).
- **MASE envelope drives the execution target:** `executionTargetGoldWeight()` (engine.ts:864) reads the MASE-smoothed gold weight (envelope 20–32%); `executionTargetSource()` returns `'mase-envelope'` once MASE has committed weights, `'legacy-buffer'` only pre-MASE (engine.ts:878–879); snapshot publishes both + `targetGoldWeight` (engine.ts:2077–2080, 2221). The legacy `0.20 + 0.10×B_gold` clamp[22,30]% formula survives **only as the pre-MASE genesis fallback** (engine.ts:845–914) — RG-11 RESOLVED.
- **8-level MARP hierarchy** (was 6): Level 1 natural-flow netting (§10.7/C.3) → 2 no-trade zone (θ_base 0.75%/1.5%) → 3 urgency (U_min floor) → 4 partial correction (β=0.50) → 5 cost-benefit (unified ε=$10) → 6 **thin-liquidity deferral** (trade ≤ MAX_POOL_FRACTION × 24h pool depth; residual deferred, never forced) → 7 daily turnover cap (5% NAV) → 8 **direction lock** (§11.5.3 24h whipsaw guard) → EXECUTE (marp.ts:5–24, `MARP_EXECUTE_LEVEL = 8`:40, `marpDecision`:179).
- **Feed-driven pool depth:** live PAXG 24h traded volume via Yahoo Finance (`fetchPaxg24hVolumeUsd`, fx.ts:353–402), published as `xauPoolDepth24hUsd` + `livePoolDepth` flag (fx.ts:474); `$4M` retained only as the labeled `POOL_DEPTH_FALLBACK_USD` degraded-mode fallback (blueprint.ts:292–301); enforced again at execution (engine.ts:937–941, 1141–1143).
- Defense in depth: `applyMarpRebalance` re-enforces levels 5/6/7/8 constraints at execution time.

### Item 5 (P1-5) · Oracle decision record + §17.9 correlation counter + §17.7/17.8 feed states — **IMPLEMENTED**

- **Decision record:** RG-08 written in `GOVERNANCE-DECISION-RECORDS.md` (median normative pending Risk-Council 4/7 ratification of the full truth-table; §17.5 filtered-mean NOT implemented; **geometric-mean v1.2 fallback REJECTED** — superseded by the strict-I9 pause, recorded in-code at oracle.ts:497–504).
- **§17.9 correlation-warning counter:** per-pair persistent consecutive-update counters (oracle.ts:254–262, 474–495) — pairwise deviation **> 1.5%** for **3 consecutive** updates ⇒ `SOURCE_CORRELATION_WARNING`; **the median stays the aggregate**; counter resets when deviation returns inside threshold. Third consumer: the pilot tick holds rebalancing while a warning stands (pilot-state.ts:319–321).
- **§17.7 five-state feed enum:** `FeedState = VALID | DEGRADED | STALE | OUTLIER | HALTED` (oracle.ts:49, 427–451) — missed-heartbeat-but-fresh = DEGRADED (included, warning); **HALTED at 2× staleness per §17.8** (dead feed escalates).
- **Aggregate oracle state** `NORMAL | DEGRADED | FAILED` (oracle.ts:106, 569–578) + **`oracleDispute`** flag (all feeds deviate > 2.5% ⇒ dispute published; price stays PAUSED — not consumed as tradable).
- Stress harness updated for the new fields (audit-stress.ts: `aggregateState: "FAILED"`, correlation fields on the paused board).

### Item 6 (P1-6) · Transaction guards + rebalance fee + PARAMETER_REGISTRY — **IMPLEMENTED**

- **Mint slippage guard (EQ-146, §19.4.1):** `applyMint` enforces `minOut` with τ_user 0.5% default — reverts with a §19.4.1 reason if `minted < minOut` (engine.ts:1433–1441).
- **5-minute quote deadline (§19.7):** enforced inside `applyMint`/`applyRedeem` (`quoteExpiresAt`, engine.ts:1415, 1609).
- **Redemption slippage guard (EQ-147, §19.4.2):** `applyRedeem` reverts if net redemption value < declared `minOutUsd` (engine.ts:1683–1690).
- **API pass-through:** `/api/simulate/mint` accepts `minOutMtq` + `quoteExpiresAt`; `/api/simulate/redeem` accepts `minOutUsd` + `quoteExpiresAt` — forwarded into `applyTrial` (mint route.ts:20–24, redeem route.ts:20–24).
- **Rebalancing fee 0.20% (§20.4):** `chargeRebalanceFee` (engine.ts:1006–1030) charged before execution on both routes (engine.ts:1028, 1174–1177); included in the cost model of the unified gate (engine.ts:947–949); accrued to the Operational Wallet and recorded in the §9.5 execution-friction ledger (`execCostLedger`, engine.ts:291–296).
- **PARAMETER_REGISTRY registrations (audit F-6):** `MIN_PROFITABILITY_USD`, `MARP_BETA`, `MARP_URGENCY_MIN`, `LAMBDA_1_DEVIATION_VALUE`, `GAS_FALLBACK_USD`, `POOL_DEPTH_24H`, `REBALANCE_FEE_BPS`, `REDEEM_SLIPPAGE_TAU_USER`, `QUOTE_DEADLINE_MINUTES`, `ORACLE_CORRELATION_THRESHOLD`, `CONCENTRATION_WARN_PCT`, `CONCENTRATION_LIMIT_PCT` (constitutional), `CONCENTRATION_CRISIS_LIMIT_PCT` (blueprint.ts:418–432) — every formerly ungoverned constant now owned by exactly one layer.

### Item 7 (P1-7) · Concentration enforcement — **IMPLEMENTED**

- **Mint routing block (§15.6.1):** mint deposits route **only to issuers whose post-deposit share stays within the warn cap** — a deposit that would push an issuer over 25% is redirected to under-cap issuers (engine.ts:1462–1488, "enforcement happens BEFORE execution"); the **35% crisis exception** applies only in the EMERGENCY risk state per §15.6.1 (4/7 + 24h timelock + disclosure; engine.ts:1472–1473).
- **Breach publication:** `breachIssuers: { issuer, share }[]` on every snapshot (engine.ts:2778) — breaches are published, never silently absorbed (honest-status `D-concentration`).
- **Per-instrument C_max (§15.6.2):** single-token shares of NAV checked and reported on the snapshot (engine.ts:2779+).
- Constants registered: warn 25% (RISK), hard 30% (CONSTITUTIONAL), crisis 35% (RISK, 4/7) — blueprint.ts:430–432.

---

## P2 — hardening

### Item 8 (P2-8) · Canonical suite additions — **IMPLEMENTED (test agent, Task 10)**

- INV-5 label fixed in-tree: the Layer-6 invariant now reads "Chain-linked index diverges **<15%** from the Laspeyres basket value (audit F-8: threshold relabeled to match the asserted max 8.22%)" — canonical-invariants.ts:1195–1196 (the "<5%" wording printed an 8.22% max with zero failing ticks).
- Engine-side C.3 prerequisite: the §10.7 natural-flow ledger `naturalFlowUsd` (CF_{i,t}) is now MEASURED on every mint/redeem (engine.ts:281–289, 1515, 1802) and consumed by MARP Level 1 netting — the "C.3 ABSENT" gap's engine half is closed; netting decisions are recorded per §10.7.
- **Remaining suite additions (Appendix C promotion incl. C.3 assertion, velocity/ρ-ladder/urgency/equal-α tests, recursion↔value-aggregate equivalence promotion) are owned by the test agent — see Task 10's worklog record for the definitive list of new checks.** This log refers to Task 10 rather than duplicating its inventory.

### Item 9 (P2-9) · Attribution in engine + NAV/token surfacing + DailyStateVector note — **IMPLEMENTED**

- **§9.4 contributions + §9.5 attribution in the engine:** `chain-index.ts:41–74` (contribution/attribution types), contributions carried on every `advanceIndex` step (chain-index.ts:141–166), full effect decomposition `computeAttribution()` (chain-index.ts:187) — movement / allocation / rebalancing / cost effects, with the realized execution-friction ledger (`execCostLedger`: fees 0.20% + slippage 0.1% + gas $50) folded into `costEffectUsd` (engine.ts:291–296, 587–606).
- **Published on every snapshot:** `snapshot.attribution` (engine.ts:1970–1974, 2223) — published after the first advance (null before, engine.ts:460).
- **UI consumes REAL data:** ReferenceChart.tsx:293–295/486 renders `snapshot.attribution` (synthetic random series removed); attribution drawer surfaced in DashboardSection.
- **NAV/token surfacing:** per-token book value published as `navPerMtq` / `indexNavDivergence.navPerMtq` (engine.ts:2019, 2261); UI surfaces it via RedeemSimulator "NAV per token (§12.2 · informational)" (RedeemSimulator.tsx:227) and BasketValueDisplay's per-MTQ native-unit grid with Σ-live-NAV-shares reconciliation + reporting-numeraire footnote.
- **DailyStateVector note:** vector fields remain extended only as features land (audit F-10 discipline — no placeholder columns); attribution/oracle-warning fields are snapshot/API-first, DailyStateVector persistence to follow with the next schema version bump.

### Item 10 (P2-10) · Succession wiring + decay/label/DRY fixes — **IMPLEMENTED**

- **RR-coupled triggers + 5% pause rule WIRED (F-9/EQ-157):** `updatePegHealth` (engine.ts:1295–1362) now stages the eject ladder on duration OR **RR < 1.08/1.05/1.02** (stages 2/3/4; stage 4 also on issuer freeze ±10% break), and the **5% pause rule** blocks ADVANCEMENT when price dropped >5% from the current stage's entry price (stage-entry prices tracked; de-escalation never blocked).
- **Phantom comment removed:** the `evaluateEjectStage` reference (a comment citing a non-existent function) replaced with the truthful §21.5.3 trigger table (engine.ts:1295–1298).
- **Depeg-timer decay fixed to 2×:** in-band decay now `depegHours −= dt × 2` per the blueprint's "timer decays at 2× in-band" (engine.ts:1328–1332; was 0.5×).
- **Backtest NAV reuse fixed:** `navFromHoldings` applies the same §4.1 gold min-rule `min(ref, ref×0.995)` as the engine (historical-backtest.ts:271–284) — the +0.13% test-only NAV drift closed.
- **INV-5 label:** see Item 8.
- **DRY pilot-state (F-10):** the tick loop now calls the canonical `computeLiability` / `computeReserveRatio` / `computeLcr` / `getMtqPriceFromState` helpers instead of re-implementing the EQ-136 identity inline (pilot-state.ts, AUDIT-FIX F-10).

### Item 11 (P2-11) · Nomenclature map + governance decision records + RG-15 labels — **IMPLEMENTED (this task + labels)**

- **`NOMENCLATURE-MAP.md`** (this deliverable set): RG-02 NAV four-way overload → I_t / nav / navPerMtq; RG-05 Q_threshold vs Q_min^obs pin; G_t vs D_t vs GFB_BASE_DENOMINATOR (reference-only); four weight states; PAR (unit-of-account, not a peg); L_t/S_circ/genesis-reserve family — with normative reading rules.
- **`GOVERNANCE-DECISION-RECORDS.md`** (this deliverable set): 18 records — RG-01..RG-15 + OI-1 (§23.8 naming) + OI-2 (EQ-155 normalization) + OI-3 (witness independence) — each with conflict quote, code decision, rationale, status, and ratification layer.
- **RG-15 labels landed in code:** regime classifier (VIX 15/22/30, DXY 88/115) labeled INVENTED/disclosed SUBSTITUTE (engine.ts:2323–2327); crisis-gold 0.50 vector labeled PILOT APPROXIMATION (mase.ts:231); projection numerics labeled PILOT NUMERICS (mase.ts:299); ε=1e-9 labeled numerical-stability guard (engine.ts:793); U_min labeled pilot constant (blueprint.ts:284–290); pool-depth fallback labeled + feed-driven (blueprint.ts:292–301, fx.ts:353–402); all registered in PARAMETER_REGISTRY.

---

## What remains OPEN (unchanged posture)

1. **Production authorization is DISABLED** — correctly. Flipping `USE_MARP_EXECUTION` changed the decision route, not the authorization posture (honest-status `D-production`).
2. **All 11 §25.5 honest-status validation gates remain NOT CONDUCTED.**
3. **§23 validation program incomplete:** walk-forward (§23.3) and purged cross-validation (§23.4) documented **not run**; model-selection score (§23.7) absent with the MASE pilot substitute.
4. **Physical gold separation (EQ-104/F-4) is ACCOUNTING-ONLY** — one physical PAXG+XAUT pot backs both the 26% index gold weight and reserve obligations (index gold ≈ 13% of NAV); §14.1 requires enforced physical separation before production claims.
5. **Constituency (§4) remains STATIC** — 7-component set; succession is a read-only drill; Q_min disambiguation (RG-05) must be pinned before §4 lands.
6. **Governance ratifications pending** (see decision records): RG-08 truth-table (Risk Council 4/7), RG-10 ε ratification (Risk Council 4/7), RG-11 adaptive-target activation (Risk Council 4/7), RG-02 glossary + RG-13 spec conflicts + RG-05/RG-07 methodology pins (Constitutional 7/7), OI-1..OI-3.
7. **Engine-side changes are uncommitted working-tree state at documentation time** (verified 2026-10-19 09:25–09:55 UTC); the orchestrator's commit closes this.

**Explicit statement (audit §7 closing rule, re-verified item by item above): None of the implemented changes altered the monetary model, the basket method, or introduced any USD peg.** Items 1–3 and 11 are labeling/disclosure/documentation; items 4–7 are blueprint-mandated guards and route unification using blueprint-initialized constants; items 8–10 are test/hardening fixes. The live price remains the chain-linked index (P_MTQ = I_t × PAR, PAR = 1 basket-unit, unit-of-account; canonical invariant I5 no-peg; live P_MTQ ≈ $1.195907 ≠ $1.00).
