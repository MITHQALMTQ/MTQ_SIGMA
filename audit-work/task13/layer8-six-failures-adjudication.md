# MTQΣ — Task 13 · Layer 8 Six-Failure Adjudication (MANDATE-004 §3 + closeout Priority 2)

**Date:** 2026-10-22 (investigation window 18:06–18:20 UTC) · **Authoritative baseline:** v2.0 Consolidated Master Blueprint (2026-10-19), verified by pandoc conversion (read-only) against the exact §-cited text.
**Verdict discipline:** the canonical suite verdict on the current tree remains **FAIL** until the six assertions are remediated under the D-13.26 adjudication protocol with owner approval. **No assertion was modified in this investigation; no code was modified; nothing was weakened.**

**Reproduction (verbatim, fresh this cycle):**
```
bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8
→ 2026-10-22 18:06:40 UTC — Layer 8: 85/91 pass, 6 fail; exit 1
→ 18:19 UTC re-run: exit 1 (identical failure set — deterministic, order-independent)
```
Environment: worktree at HEAD `7b4c680140c6bf6244a4d3f51677ccbe91415b3c`; the only harness delta vs HEAD remains the MANDATE-004 §3 isolation edit (selection/chunking only; no assertion/scenario/seed/threshold change — re-verified by diff this cycle).

---

## Common root-cause finding (applies to all six)

All six failures are **assertion-vs-code mismatches in which the code matches the current authoritative v2.0 text and the assertions encode superseded parameterization** (pre-v2.0 engine forms / pre-§12.7 cost assembly / pre-§21.5.2 detector semantics). In every case the **underlying security/economic invariant remains intact in the code** and is re-provable with a re-pinned fixture. No code defect was found in any of the six; no invariant requires weakening.

**Evidence pattern (identical to the Stage A record, §2.3 of `test-matrix-and-results.md`):** the failure set reproduced byte-identically in (i) the Stage-A full Layers-1–6+8 run (16:09 UTC), (ii) the Stage-A `--layers=8` run (16:31 UTC), and (iii) two fresh runs this cycle (18:06, 18:19 UTC) → deterministic and order-independent; the isolation edit is not causal.

---

## Failure 1 — C.1 no-trade-band boundary (inclusive `≤` vs strict `<`)

- **Test expectation (verbatim):** `"C.1: θ_base = 0.75% (NO_TRADE_BAND_BASE) and the band boundary is strict (<)"` — requires `NO_TRADE_BAND_BASE === 0.0075 && inNoTradeZone(0.003) === true && inNoTradeZone(0.0075) === false` (`canonical-invariants.ts:1870-1872`).
- **Observed:** `θ_base=0.0075, inNoTradeZone(0.003)=true, inNoTradeZone(0.0075)=true` — the boundary point D = θ is treated as **in-zone (no trade)**.
- **Intended invariant:** θ_base = 0.75% (§11.8 / Listing 4) is the no-trade band; the contested point is only the boundary *strictness*.
- **Authoritative source (v2.0):** §10.4, operative equation (pandoc line 4296–4297): **"Trade_i = 0 if D_{i,t} ≤ θ_{i,t}"** — the boundary itself is inside the zone. Corroborated by the §10.3 six-level table (pandoc line 4207): *"Level 2 — Drift trigger: D_{i,t} > θ_{i,t}"* — Level-2 trading fires only strictly above θ; at D = θ the component stays at Level 0 (Monitor, no trade).
- **Current code behavior:** `inNoTradeZone` returns `Math.abs(deviation) <= threshold` (`marp.ts:699`), with the comment *"v2.0-FIX: the former strict `<` traded at exactly D = θ; `≤` restores the Listing 4 contract-level check."* The code matches v2.0 §10.4 exactly.
- **Classification:** **Obsolete test expectation** (encodes the pre-v2.0 strict-`<` form that v2.0 explicitly corrected).
- **Proposed correction (D-13.26 gate):** re-pin the expectation to the authoritative form — `inNoTradeZone(0.0075) === true` with the title re-citing §10.4: *"the band boundary is inclusive (≤): Trade_i = 0 if D_{i,t} ≤ θ_{i,t} (§10.4)"*. The two companion C.1 assertions (deviation 0.3% → Level-2 no-trade with reason "No-trade zone") remain unchanged and passing.
- **Consequences:** strictly **more conservative** — at exactly D = θ the protocol never trades (one fewer trade-triggering point). No weakening of any invariant; the corrected assertion is *stronger* (it forbids trading at the boundary). Residual honest note: if a future governing document reverts to strict `<`, both code and test must change together under a new decision entry.

## Failure 2 — C.3 trade sizing (state-dependent β_{i,t} vs legacy fixed β=0.50)

- **Test expectation (verbatim):** `"C.3: tradeUsd ≈ β × 0.6%×NAV = 0.50 × $6,000 = $3,000 (partial correction on the RESIDUAL, §10.6+§10.7)"` — requires `tradeUsd ≈ 0.003 × NAV` (`canonical-invariants.ts:1929-1932`), i.e. sizing the $6,000 residual at the fixed pilot β = 0.50.
- **Observed:** `shouldTrade=true, level=8, direction=buy, tradeUsd=5160.000000000014`.
- **Intended invariant:** the external trade is sized **on the residual after §10.7 natural-flow netting** (TradeNeeded_i = TargetGap_i − CF_{i,t}), by a §10.6 partial-correction fraction < 1.
- **Authoritative source (v2.0):** §10.6 (pandoc lines 4373–4391): *"Trade_i = β_{i,t}(W_Target − W_Actual), 0 < β_{i,t} ≤ 1"* and *"The correction fraction is itself state-dependent. The validated instantiation takes the form β_{i,t} = clip(β₀ + β₁·U_i − β₂·Î_i, β_min, 1)"*. Appendix C.3 (Example 3) states only the residual: *"TradeNeeded = 1.5% − 0.9% = 0.6%"* — the appendix fixes **no** $3,000 trade value and no fixed β.
- **Current code behavior:** `stateDependentBeta` (`marp.ts:445-458`) applies β = clip(0.50 + 0.5·U − 0.4·Î, 0.10, 1) exactly per §10.6. For this fixture: devUrgency = min(1, 0.015/0.05) = 0.30; rrUrgency = (1.10−1.05)/0.10 = 0.50; volFactor = 1−min(0.5, 0.05×2) = 0.90 → U = 0.72; Î = 0 (no pool-depth feed in fixture) → β_applied = 0.50 + 0.5×0.72 = **0.86** → tradeUsd = 0.86 × $6,000 = **$5,160** — matches the observed value to the last digit. Sizing is on the residual (not the $15,000 raw gap — that would give $12,900).
- **Classification:** **Obsolete test expectation** (encodes the legacy fixed-β=0.50 sizing superseded by §10.6 v2.0).
- **Proposed correction (D-13.26 gate):** assert the §10.6 form end-to-end — `tradeUsd ≈ β_record.applied × 0.006 × NAV` with `β_record.applied ≈ 0.86`, `urgency ≈ 0.72`, `impactEstimate === 0`, `clippedAt === null`, plus the residual-only property (`tradeUsd ≈ 0.86×$6,000` and `≠ 0.86×$15,000`). Title re-cited: *"C.3: tradeUsd = β_{i,t} × 0.6%×NAV residual (§10.6 state-dependent β; §10.7 netting; β=0.86 for this fixture)"*.
- **Consequences:** **stronger** test — it now verifies the full state-dependent β form (urgency raising, impact-lowering, constitutional floor) instead of a scalar. Honest labeling required: β₁=0.5, β₂=0.4 are **validation-stage pilot instantiations** (Risk-Council publication pending per §11.10 / `MARP_BETA_TERMS.status`) — the corrected assertion pins the *form*, not policy approval of the coefficients. The companion C.2 assertions (legacy `partialCorrection` helper, fixed β=0.50) remain valid as back-compat checks and keep passing.

## Failure 3 — RG-10 ε-boundary fixture (default cost assembly changed)

- **Test expectation (verbatim):** `"RG-10 ε boundary: net ≈ +$5 (positive but ≤ ε $10) → pass=false; net ≈ +$15 → pass=true"` (`canonical-invariants.ts:1962-1964`), built by `costBenefitGate(0.015, 1_000_000, 5_945_000)` / `costBenefitGate(0.015, 1_000_000, 5_935_000)` — **default-path** cost assembly.
- **Observed:** `net(fail)=-41577.8200, net(pass)=-41497.8200` — both deeply negative → both reject → the `pass=true` leg of the assertion fails.
- **Intended invariant:** the profitability gate is a **strict** `netBenefit > ε` with ε = MIN_PROFITABILITY_USD = $10 (one rule, one ε, fixed units, every route): a positive net within ε of zero still rejects; a net above ε passes.
- **Authoritative source (v2.0):** §10.8/§12.8 + Listing 4: *"BP's bare benefit > costTerm test is tightened to benefit > costTerm + BENEFIT_MARGIN… the skip reason string records the margin failure"* (pandoc 5917–5921). **§12.8 honesty clause:** *"The legacy MIN_PROFITABILITY value of $10 and the baseline 1% benefit-margin setting conflict; this conflict is OD-2 and remains open"* (pandoc 6215–6219) — ε=$10 is the **legacy candidate**, not an approved production policy; normal-mode economic eligibility stays disabled.
- **Current code behavior:** `costBenefitGate` implements `pass: netBenefit > MIN_PROFITABILITY_USD` — the boundary invariant is **intact** (the companion assertion at 1965 asserting ε=$10 passes). What changed is the **default cost assembly** (Task 8-b / §12.7): a 3-positional-argument call now uses the §12.7 exact model — cost = $17.82 recorded gas basis (Appendix-F P0-3; flat $50 withdrawn) + tradeUsd×(τ_class/2 + 0.1% router + 0.2% §20.4) = $17.82 + 0.8%·tradeUsd → for tradeUsd $5.945M: cost ≈ $47,595 → net ≈ −$41,578. The fixture was crafted for the superseded "0.1% slippage + flat $50 gas" assembly (5,945,000×0.001 + $50 = $5,995 → net +$5; 5,935,000×0.001 + $50 = $5,985 → net +$15).
- **Classification:** **Obsolete test expectation** (fixture premise; the boundary rule itself is unchanged and intact in code).
- **Proposed correction (D-13.26 gate):** pin the legacy worked-example vector **explicitly** through the documented back-compat positional signature (`marp.ts:713-714`: *"positional slippage/gas overrides still pin explicit values (worked-example vectors)"*): `costBenefitGate(0.015, 1_000_000, 5_945_000, 0.001, 50)` → net = +$5 → `pass=false`; `costBenefitGate(0.015, 1_000_000, 5_935_000, 0.001, 50)` → net = +$15 → `pass=true`. This restores the intended boundary test **exactly** (identical nets to the original design intent), keeps it pure (tests the ε rule, not the cost model), and changes no threshold. Title gains an honest label: *"legacy-candidate ε (OD-2 OPEN — §12.8)"*.
- **Consequences:** none on behavior (test-only re-pin); the §12.7 cost model is separately covered by passing assertions elsewhere in the suite. OD-2 remains open and is now labeled in the test itself — a passing assertion still confers **no policy approval**.

## Failures 4 & 5 — RG-10 active-path rejection (`evaluateRebalance`, Case A premise + reason branch)

- **Test expectations (verbatim):**
  - 4: `"RG-10: net benefit $4.79 (positive but ≤ ε $10) → shouldRebalance=false — the ACTIVE path no longer trades on the bare >0 form"` (`canonical-invariants.ts:2117-2119`).
  - 5: `"RG-10: the rejection reason cites the unified §10.8/§12.8 gate (one rule, one ε, every route)"` — `reason.includes("§10.8/§12.8")` (`:2120-2121`).
- **Observed:** `shouldRebalance=true`, reason = `"Benefit − cost > ε ($10); executing (§12.8 unified gate; §12.7 cost 19)"`.
- **Intended invariant:** the **active** rebalance route must use the unified profitability gate (never the bare benefit > 0 form): trade only when net > ε = $10; when rejecting, the skip reason must record the margin failure citing the unified gate (§10.8/§12.8; Listing-4 skip-reason contract; §11.7 canonical reason "Net benefit not positive").
- **Authoritative source (v2.0):** §10.8/§12.8 + Listing 4 ("the skip reason string records the margin failure"); §11.7 canonical skip-reason set ('Net benefit not positive').
- **Current code behavior:** the gate is **intact** — `engine.ts:1116-1118`: `if (netBenefit <= MIN_PROFITABILITY_USD) return { shouldRebalance: false, …, reason: "Net benefit not positive (§10.8/§12.8): …" }`. The REJECT branch (a) exists, (b) never trades, and (c) cites `§10.8/§12.8` exactly as asserted. What fails is the **fixture's premise**: Case A was calibrated for the superseded cost assembly (comment in the test: "benefit $55.20, cost $50.414 → net $4.786" — i.e. 138×0.3% + $50 flat gas). Under the §12.7 exact model the same $138 trade costs 17.82 + 138×0.008 = $18.92 → net = 55.20 − 18.92 = **+$36.28 > ε** → the path *correctly executes*, so the reject branch is never reached and the reason-form assertion sees the execute-string.
- **Classification:** **Obsolete test expectations** (fixture premise; one root cause producing both failures).
- **Proposed correction (D-13.26 gate):** recalibrate the fixture so the reject region is reachable **without touching the band**: with NAV $18,000 the no-trade zone (0.75%) starts at $135, and every surplus > $135 yields net = 0.392·surplus − 17.82 ≥ +$35 — the (0, ε] window is unreachable at that NAV. Set **nav = $6,000** (band boundary $45) and **Case A surplus = $60**: deviation = 60/6,000 = 1.0% > 0.75% (outside band, gate reached); benefit = 0.4×60 = $24.00; §12.7 cost = 17.82 + 60×0.008 = $18.30; **net = +$5.70 ∈ (0, $10] → REJECT** → `shouldRebalance=false, tradeUsd=0`, reason = `"Net benefit not positive (§10.8/§12.8): …"` → both assertions pass in their original meaning. Case B (surplus $200): benefit $80, cost $19.42, net +$60.58 > ε → EXECUTE, direction −1, tradeUsd $200 — unchanged shape (title's "$29.40" → "$60.58"). Fixture arithmetic: goldNet = (0.2625×6,000 + 60) = $1,635; fiatNet = $4,365 ≥ 0.
- **Consequences:** none on engine behavior (test-only re-pin); the corrected pair re-proves (i) no trade on nets in (0, ε] on the ACTIVE route and (ii) the unified-gate skip-reason contract, under the current authoritative cost model. Honest labels: ε=$10 is the legacy candidate (OD-2 OPEN); the §12.7 gas term ($17.82) is a recorded accounting-cost estimate (Appendix-F P0-3), not a gas price — if the Risk Council publishes different coefficients, this fixture recalibrates again under a new decision.

## Failure 6 — §21.5.3 in-band timer (reset-to-zero vs 2× decay)

- **Test expectation (verbatim):** `"§21.5.3: in-band decay 2×dtHours (30h → 10h) → stage 0 → IMMEDIATE de-escalation (the pause never blocks standing down)"` — requires `stage === 0 && depegHours === 10 && startPrice === 1` (`canonical-invariants.ts:2349-2351`), from a fixture with 30 accumulated de-peg hours, stage 2, then 10 in-band hours.
- **Observed:** `stage=0, depegHours=0, startPrice=1` — the in-band return **resets the timer to zero** instead of decaying it to 10.
- **Intended invariant:** de-escalation is **immediate** — the 5% pause rule never blocks standing *down* the ladder; on in-band return the de-peg accounting must follow the authoritative detector rule.
- **Authoritative source (v2.0):** §21.5.2 (pandoc lines 13944–13947): *"The consecutive-hours requirement is equally deliberate: **the timer resets to zero the moment the price returns inside the band**, so an asset oscillating in and out of the band never accumulates detector time"* (12-consecutive-hours detector, `isDepegged` Listing 13: "timer reset on return"). §21.5.3: the pause gates **advancement** only.
- **Current code behavior:** `engine.ts:1787-1793` — in-band → `s.depegHours[c] = 0` with the comment *"v2.0 §21.5.2 … the former 2×-decay let an oscillating asset accumulate detector time across in-band spells; the reset makes the detector strictly consecutive."* Stage recomputed from h=0 → 0 → immediate de-escalation (`engine.ts:1815-1822`, unconditional on the way down; `startPrice` reset to 1 at stage 0). The engine matches v2.0 §21.5.2 exactly; the *de-escalation immediacy* half of the assertion passes today (stage=0, startPrice=1).
- **Classification:** **Obsolete test expectation** (encodes the pre-v2.0 2×-decay timer superseded by the §21.5.2 reset rule).
- **Proposed correction (D-13.26 gate):** expect `sD.depegHours.EUR === 0` (immediate reset per §21.5.2) while keeping `ejectStage === 0` and `ejectStageStartPrice === 1`; title re-cited: *"§21.5.2/§21.5.3: in-band return RESETS the timer to zero (30h → 0) → stage 0 → IMMEDIATE de-escalation (the pause never blocks standing down)"*.
- **Consequences:** **more conservative detector** — reset-on-return makes escalation strictly harder (an oscillating asset can never accumulate toward the 48h/96h stage triggers across in-band spells). No weakening; the pause-never-blocks-standing-down invariant is still asserted.

---

## Summary table

| # | Assertion | Root cause | Classification | Invariant state in code | Correction direction | Weakening? |
|---|---|---|---|---|---|---|
| 1 | C.1 band boundary strict (<) | superseded spec semantics | obsolete test expectation | INTACT (§10.4 `≤` inclusive) | flip expectation to inclusive; cite §10.4 | No — strictly more conservative |
| 2 | C.3 tradeUsd = 0.50×$6,000 | superseded sizing form (fixed β) | obsolete test expectation | INTACT (§10.6 state-dependent β = 0.86) | assert β-form on residual + β record | No — stronger (full §10.6 form) |
| 3 | RG-10 ε-boundary (+$5/+$15) | superseded default cost assembly | obsolete test expectation (fixture) | INTACT (`net > ε`, strict) | pin explicit legacy worked-example vector (0.001, 50) | No — identical intended nets |
| 4 | RG-10 active reject (net $4.79) | superseded cost assembly (fixture premise) | obsolete test expectation (fixture) | INTACT (reject branch `netBenefit ≤ ε`) | recalibrate: nav $6,000, surplus $60 → net +$5.70 → REJECT | No — original meaning restored |
| 5 | RG-10 rejection-reason cites §10.8/§12.8 | branch unreachable via #4 | obsolete test expectation (same root cause) | INTACT (reason contains `§10.8/§12.8`) | resolved by #4's recalibration | No |
| 6 | §21.5.3 in-band decay 2×dtHours | superseded detector semantics | obsolete test expectation | INTACT (§21.5.2 reset-to-zero) | expect reset (0h); keep immediacy assertions | No — strictly more conservative detector |

**Open items carried (not closed by this adjudication):** OD-2 (ε $10 vs 1% — legacy candidate, do-not-activate clause stands); β₁/β₂ Risk-Council publication (§11.10); §12.7 gas basis is a recorded accounting estimate (Appendix-F P0-3). Passing any corrected assertion remains **code-quality evidence only** — not economic, legal, security, or release approval of any kind.

**Remediation gate:** the six corrections above are PROPOSED. Per the closeout mandate ("do not modify assertions merely to match current code… after approved remediation, run the relevant focused tests and the complete applicable suite"), the edit requires owner approval via the D-13.26 protocol (assertion re-pins citing the v2.0 authoritative text above; no threshold or assertion logic weakened — each correction is either identical-intent, stronger, or more conservative). Until applied, the canonical-suite verdict on this tree stays **FAIL (244/250)**.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

## APPLICATION RECORD (2026-10-23)

**Owner authorization:** the owner directive of 23 October 2026 (recorded verbatim in `owner-directive-2026-10-23-delegated-execution.md`) — *"2-based on our model and your understanding to it, make all fixing an recommended modifications and fixing needed. 3-make all in honest way that gives and aligns our model for our vision."* — is recorded as the owner approval of the D-13.26 review gate for these six re-pins (directive §2 item 1).

**Application:** the six corrections were applied **2026-10-23** to `src/lib/mtq/__tests__/canonical-invariants.ts` VERBATIM from the machine-verified consolidated diff (`evidence/layer8-d13-26-consolidated-proposed-diff-mandate007.md`). Pre-application exactness was re-verified fresh the same day: `bun audit-work/task13/evidence/extract-and-verify-layer8-diffs.ts` → **exit 0** (all 30/30 removed and 23/23 context lines byte-exact against the current tree; the six findings are carried by five blocks, F4+5 combined). Application was mechanical (a parser script applied the `+` lines and removed the `-` lines directly from the artifact — zero manual transcription): **30 lines removed, 108 lines added, 23 context lines kept; no other line of the file touched.**

**Fresh post-application evidence (2026-10-23):**

| Run | Command | Result | Exit | Log |
|---|---|---|---|---|
| Focused Layer 8 | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **94/94 pass, 0 fail** (was 85/91, 6 fail) | **0** | `evidence/l8-focused-mandate008-2026-10-23.txt` |
| Deterministic Layers 1-6+8 | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L8 94/94 → **246/246 pass, 0 fail** (was 237/243, 6 fail) | **0** | `evidence/l-deterministic-mandate008-2026-10-23.txt` |
| Fixture verification (read-only) | `bun audit-work/task13/evidence/l8-d13-26-fixture-verification.ts` | **exit 0** — Parts 1-5 empirical values re-confirmed fresh (C.1 inclusive boundary + end-to-end sandwich; C.3 β=0.86 → $5,160; RG-10 legacy vector +$5/+$15; active-path reject net +$5.70 with branch-reach proof; §21.5.2 reset-to-zero + 12h boundary + oscillation); JSON record identical to the MANDATE-005 record modulo timestamp. One informational FP-exactness probe line prints ✗ (5/5 probed pairs are not FP-exact) — pre-existing and identical to the MANDATE-005/007 records; it is a probe, not an assertion, and the applied C.1 sandwich avoids FP luck by design (0.74%/0.76%) | **0** | `evidence/l8-fixture-verification-mandate008-2026-10-23.txt` |

**Canonical verdict after application:** deterministic Layers 1-6+8 = **246/246 PASS (0 fail, exit 0)** + Layer 7 = **7/7 PASS (carried from the recorded chunked evidence — Layer-7 assertion/scenario bodies and all engine code untouched by this application)** → **full canonical suite 253/253 PASS**. The suite total grew 250 → 253 with the three NEW invariant-coverage assertions now live: **(1) the C.1 end-to-end boundary sandwich** (D = 0.74% < θ → Level-2 hold; D = 0.76% > θ → passes the band, through `marpDecision`), **(2) the §21.5.2 12h detector boundary** (h = 12 → stage 0 strict; h = 13 → stage 1), and **(3) the §21.5.2 oscillation-reset discriminator** (out 10h → in 1h → reset 0 → out 5h ⇒ h = 5, stage 0 — never accumulates across in-band spells).

**No weakening, statement:** no assertion was weakened, no threshold was adjusted, no assertion was removed; each of the six corrections is identical-intent, stronger, or strictly more conservative per the adjudication table above, and three net-new assertions were ADDED (+3). This is **code-quality evidence only** — not economic, legal, security, or release approval of any kind. Carried-open items unchanged: OD-2 (ε $10 vs 1% benefit-margin — neither operative), β₁/β₂ Risk-Council publication (§11.10), §12.7 gas basis $17.82 is a recorded accounting-cost estimate (Appendix-F P0-3). The economic/validation-claims chain (D-13.25 pre-registration, validator independence, RELEASE-GRANTS) remains owner/validation-program governed.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
