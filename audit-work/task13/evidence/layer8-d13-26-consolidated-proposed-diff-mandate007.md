# MTQΣ — Layer-8 Six-Failure D-13.26 Consolidated Proposed Diff (MANDATE-007 §5 presentation)

**Generated:** 2026-10-23 08:26:04 UTC · by `extract-and-verify-layer8-diffs.ts` (verbatim extraction; no manual transcription)
**Status: PROPOSED — NOT APPLIED.** Application requires owner/validator review and approval under the D-13.26 protocol (assertion re-pins citing the v2.0 authoritative text; no threshold or assertion logic weakened — three corrections strictly more conservative, one stronger form, two identical-intent).
**Current honest verdict on the tree (fresh this cycle):** canonical --layers=8 → **85/91 pass, 6 fail, exit 1** (identical canonical six) · --layers=1,2,3,4,5,6,8 → **237/243, 6 fail, exit 1**. Logs: `l8-focused-mandate007-2026-10-22.txt`, `l-deterministic-mandate007-2026-10-22.txt`.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

## Verification of exactness

Every removed (`-`) and context line of every block below was checked byte-for-byte against the current `src/lib/mtq/__tests__/canonical-invariants.ts`:

| Block | Removed lines verified | Context lines verified | Added lines | Verdict |
|---|---|---|---|---|
| F1 Finding 1 | 3/3 | 3/3 | 17 | EXACT FOR CURRENT TREE |
| F2 Finding 2 | 4/4 | 0/0 | 17 | EXACT FOR CURRENT TREE |
| F3 Finding 3 | 8/8 | 0/0 | 17 | EXACT FOR CURRENT TREE |
| F4+5 Findings 4 & 5 | 12/12 | 13/13 | 21 | EXACT FOR CURRENT TREE |
| F6 Finding 6 | 3/3 | 7/7 | 36 | EXACT FOR CURRENT TREE |

Empirical post-correction values were previously proven by `l8-d13-26-fixture-verification.ts` (MANDATE-005, Parts 1–5, JSON record beside it) — re-verifiable any cycle; zero source changes since.

---

## F1 — Finding 1 — C.1 · §10.4 no-trade-band boundary (inclusive ≤)

**Authoritative source:** v2.0 §10.4 operative equation: "Trade_i = 0 if D_{i,t} ≤ θ_{i,t}" (pandoc 4296–4297); §10.3 Level 2: "Drift trigger: D_{i,t} > θ_{i,t}" (pandoc 4207). Code: marp.ts:692-700 inclusive.

**Anchor (current tree):** canonical-invariants.ts:1870-1872 (verified fresh this cycle)

**Correction direction / no-weakening note:** More conservative (never trades at D = θ). Adds 1 new end-to-end sandwich assertion.

**Removed/context lines verified against the current tree: 3/3 removed · 3/3 context.**

**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**

```diff
     assert(L, LNAME, "C.1: the Level-2 reason names the no-trade zone (§10.4/§11.8)",
       (gold?.reason ?? "").includes("No-trade zone"), `reason="${gold?.reason}"`);
-    assert(L, LNAME, "C.1: θ_base = 0.75% (NO_TRADE_BAND_BASE) and the band boundary is strict (<)",
-      NO_TRADE_BAND_BASE === 0.0075 && inNoTradeZone(0.003) === true && inNoTradeZone(0.0075) === false,
-      `θ_base=${NO_TRADE_BAND_BASE}, inNoTradeZone(0.003)=${inNoTradeZone(0.003)}, inNoTradeZone(0.0075)=${inNoTradeZone(0.0075)}`);
+    // D-13.26 re-pin (MANDATE-005 evidence pack, Finding 1): v2.0 §10.4 makes the
+    // boundary INCLUSIVE — "Trade_i = 0 if D_{i,t} ≤ θ_{i,t}" — so D = θ is inside
+    // the no-trade zone (the pre-v2.0 strict-< form traded at exactly D = θ).
+    assert(L, LNAME, "C.1: θ_base = 0.75% and the band boundary is INCLUSIVE (≤): Trade_i = 0 if D_{i,t} ≤ θ_{i,t} (§10.4)",
+      NO_TRADE_BAND_BASE === 0.0075 && inNoTradeZone(0.003) === true && inNoTradeZone(NO_TRADE_BAND_BASE) === true && inNoTradeZone(0.0076) === false,
+      `θ_base=${NO_TRADE_BAND_BASE}, inNoTradeZone(0.003)=${inNoTradeZone(0.003)}, inNoTradeZone(0.0075)=${inNoTradeZone(NO_TRADE_BAND_BASE)}, inNoTradeZone(0.0076)=${inNoTradeZone(0.0076)}`);
+    // C.1 end-to-end boundary sandwich (through the decision pipeline — the
+    // actual invariant, both sides of the boundary; uniform vols ⇒ σ̃ = 0
+    // (degenerate normalization) ⇒ κ = 0 ⇒ θ_applied = θ_base exactly).
+    const c1Target: WeightVector = { USD: 0.27, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 };
+    const c1Vols: VolatilityData = { USD: 0.05, EUR: 0.05, JPY: 0.05, GBP: 0.05, CNY: 0.05, CHF: 0.05, Gold: 0.05 };
+    const c1Below = marpDecision({ ...c1Target, Gold: c1Target.Gold - 0.0074, USD: c1Target.USD + 0.0074 }, c1Target, 1_000_000, 1.10, c1Vols).find((d) => d.component === "Gold");
+    const c1Above = marpDecision({ ...c1Target, Gold: c1Target.Gold + 0.0076, USD: c1Target.USD - 0.0076 }, c1Target, 1_000_000, 1.10, c1Vols).find((d) => d.component === "Gold");
+    assert(L, LNAME, "C.1 end-to-end: D = 0.74% < θ → Level-2 hold (No-trade zone); D = 0.76% > θ → passes the band (§10.4 pipeline check, not an incidental internal value)",
+      c1Below?.shouldTrade === false && c1Below?.level === 2 && (c1Below?.reason ?? "").includes("No-trade zone") &&
+        !((c1Above?.level === 2) && (c1Above?.reason ?? "").includes("No-trade zone")) && c1Above?.theta.applied === NO_TRADE_BAND_BASE,
+      `below: level=${c1Below?.level}, reason="${c1Below?.reason?.slice(0, 40)}"; above: level=${c1Above?.level}, shouldTrade=${c1Above?.shouldTrade}, θ_applied=${c1Above?.theta.applied}`);
   }
```

---

## F2 — Finding 2 — C.3 · §10.6 state-dependent trade sizing (β-form)

**Authoritative source:** v2.0 §10.6: "Trade_i = β_{i,t}(W_Target − W_Actual), 0 < β_{i,t} ≤ 1", "β_{i,t} = clip(β₀ + β₁·U_i − β₂·Î_i, β_min, 1)" (pandoc 4373–4391). Code: marp.ts:445-458.

**Anchor (current tree):** canonical-invariants.ts:1929-1932 (verified fresh this cycle)

**Correction direction / no-weakening note:** Stronger (verifies the full β-form: U = 0.72, β = 0.86, Î = 0, residual-only sizing).

**Removed/context lines verified against the current tree: 4/4 removed · 0/0 context.**

**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**

```diff
-    assert(L, LNAME, "C.3: tradeUsd ≈ β × 0.6%×NAV = 0.50 × $6,000 = $3,000 (partial correction on the RESIDUAL, §10.6+§10.7)",
-      gold?.shouldTrade === true && gold?.level === MARP_EXECUTE_LEVEL && gold?.direction === "buy" &&
-        approx(gold?.tradeUsd ?? NaN, 0.003 * NAV, 1e-6),
-      `shouldTrade=${gold?.shouldTrade}, level=${gold?.level}, direction=${gold?.direction}, tradeUsd=${gold?.tradeUsd}`);
+    // D-13.26 re-pin (MANDATE-005 evidence pack, Finding 2): §10.6 v2.0 sizes the
+    // trade with the STATE-DEPENDENT β_{i,t} = clip(β₀+β₁·U−β₂·Î, β_min, 1), not
+    // the legacy fixed β=0.50 (which remains covered by the C.2 back-compat
+    // assertions above). For THIS fixture: devUrgency 0.30 + rrUrgency 0.50,
+    // ×volFactor 0.90 ⇒ U = 0.72; no pool-depth feed ⇒ Î = 0 (recorded, not
+    // guessed) ⇒ β = clip(0.50+0.5·0.72−0.4·0, 0.10, 1) = 0.86 ⇒ tradeUsd =
+    // 0.86 × $6,000 residual = $5,160 (never the $15,000 raw gap ⇒ $12,900).
+    // β₁/β₂ are validation-stage pilot instantiations (Risk-Council publication
+    // pending, §11.10) — this pins the FORM, not policy approval of coefficients.
+    assert(L, LNAME, "C.3: tradeUsd = β_{i,t} × 0.6%×NAV residual (§10.6 state-dependent β = 0.86 for this fixture; §10.7 netting)",
+      gold?.shouldTrade === true && gold?.level === MARP_EXECUTE_LEVEL && gold?.direction === "buy" &&
+        approx(gold?.beta.applied ?? NaN, 0.86, 1e-9) &&
+        approx(gold?.beta.urgency ?? NaN, 0.72, 1e-9) &&
+        gold?.beta.impactEstimate === 0 && gold?.beta.clippedAt === null &&
+        approx(gold?.tradeUsd ?? NaN, (gold?.beta.applied ?? 0) * 0.006 * NAV, 1e-6) &&
+        approx(gold?.tradeUsd ?? NaN, 5160, 1e-6),
+      `shouldTrade=${gold?.shouldTrade}, level=${gold?.level}, direction=${gold?.direction}, tradeUsd=${gold?.tradeUsd}, β=${gold?.beta.applied}, U=${gold?.beta.urgency}, Î=${gold?.beta.impactEstimate}`);
```

---

## F3 — Finding 3 — RG-10 · ε-boundary fixture (legacy worked-example vector)

**Authoritative source:** v2.0 §10.8/§12.8 + Listing 4: "BP's bare benefit > costTerm test is tightened to benefit > costTerm + BENEFIT_MARGIN… the skip reason string records the margin failure" (pandoc 5917–5921); ε = $10 is the OD-2 OPEN legacy candidate. Gate intact at marp.ts:735.

**Anchor (current tree):** canonical-invariants.ts:1957-1964 (verified fresh this cycle)

**Correction direction / no-weakening note:** Identical intended nets (+$5 reject / +$15 pass) via documented positional overrides (marp.ts:713-736).

**Removed/context lines verified against the current tree: 8/8 removed · 0/0 context.**

**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**

```diff
-    // ε boundary: a POSITIVE net benefit within ε of zero still fails (strictly
-    // greater required). benefit $6,000; cost $5,995 → net ≈ $5 (fail) vs cost
-    // $5,985 → net ≈ $15 (pass).
-    const gEdgeFail = costBenefitGate(0.015, 1_000_000, 5_945_000);
-    const gEdgePass = costBenefitGate(0.015, 1_000_000, 5_935_000);
-    assert(L, LNAME, "RG-10 ε boundary: net ≈ +$5 (positive but ≤ ε $10) → pass=false; net ≈ +$15 → pass=true",
-      gEdgeFail.pass === false && gEdgePass.pass === true,
-      `net(fail)=${gEdgeFail.netBenefit.toFixed(4)}, net(pass)=${gEdgePass.netBenefit.toFixed(4)}`);
+    // RG-10 ε boundary — LEGACY worked-example compatibility vector (D-13.26
+    // re-pin, MANDATE-005 evidence pack Finding 3). This vector pins the ε RULE
+    // ONLY (strict netBenefit > ε = $10, Listing 5 §12.8; OD-2 OPEN — ε $10 is
+    // the legacy candidate vs the 1% benefit-margin conflict; neither is
+    // operative, normal-mode economic execution stays disabled). It is kept
+    // DISTINCT from the active-path tests of the current cost model (8.14
+    // below) via the documented back-compat positional overrides (marp.ts:
+    // "positional slippage/gas overrides still pin explicit values"):
+    // slippage 0.1% + gas $50 — the superseded assembly, pinned EXPLICITLY so
+    // the §12.7 model is not what this boundary test measures. benefit $6,000;
+    // cost $5,995 → net +$5 (REJECT); cost $5,985 → net +$15 (PASS).
+    const gEdgeFail = costBenefitGate(0.015, 1_000_000, 5_945_000, 0.001, 50);
+    const gEdgePass = costBenefitGate(0.015, 1_000_000, 5_935_000, 0.001, 50);
+    assert(L, LNAME, "RG-10 ε boundary (legacy worked-example vector, OD-2 OPEN): net +$5 (0 < net ≤ ε $10) → pass=false; net +$15 > ε → pass=true",
+      approx(gEdgeFail.netBenefit, 5, 1e-6) && gEdgeFail.pass === false &&
+        approx(gEdgePass.netBenefit, 15, 1e-6) && gEdgePass.pass === true,
+      `net(fail)=${gEdgeFail.netBenefit.toFixed(4)}, net(pass)=${gEdgePass.netBenefit.toFixed(4)}`);
```

---

## F4+5 — Findings 4 & 5 — RG-10 · active-path rejection (reject branch + reason contract)

**Authoritative source:** §10.8/§12.8 + Listing 4 skip-reason contract; §11.7 canonical reason set. Reject branch intact at engine.ts:1116-1118; the fixture premise (nav $18,000) made (0, ε] unreachable under the §12.7 cost model.

**Anchor (current tree):** canonical-invariants.ts:2110-2127 (verified fresh this cycle)

**Correction direction / no-weakening note:** Recalibrated fixture only (nav $6,000, surplus $60 → net +$5.70 → REJECT). Case B label $29.40 → $60.58.

**Removed/context lines verified against the current tree: 12/12 removed · 13/13 context.**

**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**

```diff
   // --- 8.14 RG-10 unified gate on the ACTIVE legacy path (evaluateRebalance) ---
-  // Fixture: fresh genesis state → s.maseSmoothed = null → the gold target is
-  // the legacy-buffer fallback 0.2625 (= 0.20 + 0.10×0.625, clamp [22,30%]);
-  // documented choice — with MASE committed the target flips to the envelope
-  // output but the GATE is identical. Synthetic `vals` choose |dev|×nav so
-  // the net benefit lands inside (0, ε=$10] (reject) and above it (execute).
+  // Fixture: fresh genesis state → s.maseSmoothed = null → the gold target is
+  // the legacy-buffer fallback 0.2625 (= 0.20 + 0.10×0.625, clamp [22,30%]);
+  // documented choice — with MASE committed the target flips to the envelope
+  // output but the GATE is identical. D-13.26 re-pin (MANDATE-005 evidence
+  // pack, Findings 4–5): the ACTIVE path runs the §12.7 EXACT cost model
+  // (gas $17.82 recorded accounting basis + tradeUsd × (τ_GOLD/2 0.5% + router
+  // 0.1% + protocol 0.20% §20.4)). At the old NAV $18,000 the (0, ε] reject
+  // window is unreachable (band $135; every larger surplus nets ≥ +$35), so
+  // the fixture is recalibrated WITHOUT touching the band or the gate:
+  // nav $6,000 (band $45) — Case A surplus $60 → net +$5.70 ∈ (0, $10] →
+  // REJECT via the unified gate; Case B surplus $200 → net +$60.58 > ε →
+  // EXECUTE. ε = $10 is the OD-2 OPEN legacy candidate; the §12.7 gas term is
+  // a recorded accounting-cost estimate (Appendix-F P0-3), never a gas price.
   {
     const s = initReserveState(BASE_FIXINGS.XAU_USD);
-    const nav = 18_000;
+    const nav = 6_000;
     const targetGold = 0.2625;
-    // Case A: |dev|×nav = $138 → benefit $55.20, cost $50.414 → net $4.786 ∈ (0, $10] → REJECT.
-    const goldNetA = (targetGold + 138 / nav) * nav;
+    // Case A: surplus $60 → deviation 1.0% > 0.75% band; benefit $24.00,
+    // §12.7 cost $18.30 → net +$5.70 ∈ (0, ε] → REJECT.
+    const goldNetA = (targetGold + 60 / nav) * nav; // $1,635
     const decFail = evaluateRebalance(s, { nav, goldNet: goldNetA, fiatNet: nav - goldNetA }, 1.10);
-    assert(L, LNAME, "RG-10: net benefit $4.79 (positive but ≤ ε $10) → shouldRebalance=false — the ACTIVE path no longer trades on the bare >0 form",
-      decFail.shouldRebalance === false && decFail.tradeUsd === 0,
+    assert(L, LNAME, "RG-10: net benefit +$5.70 (positive but ≤ ε $10) → shouldRebalance=false — the ACTIVE path never trades on the bare >0 form (§12.7 cost model)",
+      decFail.shouldRebalance === false && decFail.tradeUsd === 0 && decFail.reason.startsWith("Net benefit not positive"),
       `shouldRebalance=${decFail.shouldRebalance}, reason="${decFail.reason}"`);
     assert(L, LNAME, "RG-10: the rejection reason cites the unified §10.8/§12.8 gate (one rule, one ε, every route)",
       decFail.reason.includes("§10.8/§12.8"), `reason="${decFail.reason}"`);
-    // Case B: |dev|×nav = $200 → benefit $80, cost $50.60 → net $29.40 > $10 → EXECUTE.
+    // Case B: surplus $200 → benefit $80.00, §12.7 cost $19.42 → net +$60.58 > ε → EXECUTE.
     const goldNetB = (targetGold + 200 / nav) * nav;
     const decPass = evaluateRebalance(s, { nav, goldNet: goldNetB, fiatNet: nav - goldNetB }, 1.10);
-    assert(L, LNAME, "RG-10: net benefit $29.40 > ε $10 → shouldRebalance=true (sell; tradeUsd $200)",
+    assert(L, LNAME, "RG-10: net benefit $60.58 > ε $10 → shouldRebalance=true (sell; tradeUsd $200) — same gate, same ε, execute side",
       decPass.shouldRebalance === true && decPass.direction === -1 && approx(decPass.tradeUsd, 200, 1e-6),
       `shouldRebalance=${decPass.shouldRebalance}, direction=${decPass.direction}, tradeUsd=${decPass.tradeUsd}`);
   }
```

---

## F6 — Finding 6 — §21.5.3 · in-band timer (§21.5.2 reset-to-zero vs 2× decay)

**Authoritative source:** v2.0 §21.5.2: "the timer resets to zero the moment the price returns inside the band" (pandoc 13944–13947; Listing 13 "timer reset on return"). Code: engine.ts:1787-1793 reset; §21.5.3 pause gates advancement only.

**Anchor (current tree):** canonical-invariants.ts:2338-2351 (verified fresh this cycle)

**Correction direction / no-weakening note:** More conservative detector (oscillation can never accumulate). Adds the 12h-boundary + oscillation suite.

**Removed/context lines verified against the current tree: 3/3 removed · 7/7 context.**

**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**

```diff
-    // (d) De-escalation is immediate + in-band decay is 2× dtHours: 30h − 2×10h = 10h.
+    // (d) D-13.26 re-pin (MANDATE-005 evidence pack, Finding 6): v2.0 §21.5.2 —
+    // "the timer resets to zero the moment the price returns inside the band"
+    // (12-consecutive-hours detector; Listing 13 "timer reset on return").
+    // In-band return RESETS the accumulated 30h to 0 (the superseded 2×-decay
+    // would have left 10h); the stage recomputes from h = 0 → IMMEDIATE
+    // de-escalation to stage 0 with the stage-entry price reset to 1.
     const sD = initReserveState(BASE_FIXINGS.XAU_USD);
     sD.pegHealth.EUR = 1.0; // inside the band after drift
     sD.depegHours.EUR = 30;
     sD.ejectStage.EUR = 2;
     sD.ejectStageStartPrice.EUR = 0.93;
     updatePegHealth(sD, 10, fx); // rr defaults to Infinity → no RR triggers
-    assert(L, LNAME, "§21.5.3: in-band decay 2×dtHours (30h → 10h) → stage 0 → IMMEDIATE de-escalation (the pause never blocks standing down)",
-      sD.ejectStage.EUR === 0 && sD.depegHours.EUR === 10 && sD.ejectStageStartPrice.EUR === 1,
+    assert(L, LNAME, "§21.5.2/§21.5.3: in-band return RESETS the timer to zero (30h → 0) → stage 0 → IMMEDIATE de-escalation (the pause never blocks standing down)",
+      sD.ejectStage.EUR === 0 && sD.depegHours.EUR === 0 && sD.ejectStageStartPrice.EUR === 1,
       `stage=${sD.ejectStage.EUR}, depegHours=${sD.depegHours.EUR}, startPrice=${sD.ejectStageStartPrice.EUR}`);
+    // (e) NEW — 12h detector BOUNDARY (the consecutive-hours invariant itself):
+    // h = 12 exactly stays stage 0 (stage 1 requires h > 12 — strict); the next
+    // consecutive hour crosses to stage 1. rr omitted → Infinity (no RR
+    // coupling); the 5% pause cannot bind at the 0.90 stage-entry price.
+    const s12 = freshState();
+    s12.ejectStageStartPrice.EUR = 0.90; // low entry price → the 5% pause cannot bind
+    s12.depegHours.EUR = 11;
+    updatePegHealth(s12, 1, fx); // 11 + 1 = 12 → NOT past the detector
+    const s13 = freshState();
+    s13.ejectStageStartPrice.EUR = 0.90;
+    s13.depegHours.EUR = 12;
+    updatePegHealth(s13, 1, fx); // 12 + 1 = 13 > 12 → stage 1
+    assert(L, LNAME, "§21.5.2 detector boundary: h = 12 → stage 0 (strict >); h = 13 → stage 1 (consecutive-hours detector)",
+      s12.ejectStage.EUR === 0 && s12.depegHours.EUR === 12 && s13.ejectStage.EUR === 1 && s13.depegHours.EUR === 13,
+      `h=12: stage=${s12.ejectStage.EUR}; h=13: stage=${s13.ejectStage.EUR}`);
+    // (f) NEW — oscillation RESET discriminator (the authoritative §21.5.2
+    // sentence: "an asset oscillating in and out of the band never accumulates
+    // detector time"): out 10h → in 1h (RESET to 0) → out 5h ⇒ h ends at 5.
+    // Under the superseded 2×-decay the same sequence ends at 13h ⇒ stage 1.
+    const sOsc = freshState();
+    updatePegHealth(sOsc, 10, fx);   // out-of-band spell (0.93 → post-drift outside): h = 10
+    sOsc.pegHealth.EUR = 1.0;        // return inside the band
+    updatePegHealth(sOsc, 1, fx);    // RESET: h = 0
+    sOsc.pegHealth.EUR = 0.93;       // out again
+    updatePegHealth(sOsc, 5, fx);    // h = 5 (NOT 13)
+    assert(L, LNAME, "§21.5.2 oscillation: out 10h → in 1h (reset to 0) → out 5h ⇒ h = 5, stage 0 — the timer never accumulates across in-band spells",
+      sOsc.depegHours.EUR === 5 && sOsc.ejectStage.EUR === 0,
+      `hAfterOut=10, hAfterIn=0, hFinal=${sOsc.depegHours.EUR}, stage=${sOsc.ejectStage.EUR}`);
```

---

## Post-approval procedure (MANDATE-007 §5)

1. Owner/validator review of the six blocks above (D-13.26 gate; do-not-weaken table in the pack §11).
2. On approval: apply the re-pins to `canonical-invariants.ts`, then run the focused Layer-8 suite and the complete applicable canonical suite (L1–6+8); expected per the pack: Layer 8 91→94 assertions, suite 250→253, 0 fail. Any unexpected failure stops the gate and is reported honestly.
3. Without approval: the tree verdict stays FAIL (237/243) and this artifact records exactly why.

**Open items carried (unchanged):** OD-2 (ε $10 vs 1% benefit-margin — neither operative); β₁/β₂ Risk-Council publication (§11.10); §12.7 gas basis is a recorded accounting estimate (Appendix-F P0-3). Passing any corrected assertion is code-quality evidence only — not economic, legal, security, or release approval.
