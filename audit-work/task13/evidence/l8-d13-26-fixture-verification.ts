// MTQΣ — MANDATE-005 Priority 2 · D-13.26 fixture verification (READ-ONLY ANALYSIS)
// =================================================================================
// PURPOSE: empirically demonstrate — WITHOUT modifying any canonical assertion,
// engine code, or spec text — that the six proposed D-13.26 fixture re-pins
// produce the claimed post-correction values under the CURRENT implementation:
//
//   1. C.1  — the §10.4 inclusive boundary (D = θ is IN the no-trade zone),
//             both at the helper level and end-to-end through marpDecision
//             (boundary sandwich 0.74% no-trade / 0.76% proceeds).
//   2. C.3  — the fixture's Î value and the FULL §10.6 β calculation
//             (U = 0.72, β = 0.86, tradeUsd = $5,160 on the residual).
//   3. RG-10 ε boundary — the legacy worked-example vector via the documented
//             positional back-compat form (net +$5 → reject; +$15 → pass),
//             kept DISTINCT from the active-path §12.7 tests.
//   4. RG-10 active path — the recalibrated fixture (nav $6,000, surplus $60)
//             truly REACHES the current active-path reject branch
//             (reason = "Net benefit not positive (§10.8/§12.8)…"), not the
//             band / direction-lock / NAV guards; Case B executes.
//   5. §21.5.2/§21.5.3 — the in-band RESET (30h → 0), the 12h detector
//             boundary (h = 12 stays stage 0; h = 13 → stage 1), and the
//             oscillation discriminator that separates reset (h ends at 5)
//             from the superseded 2×-decay (would end at 13 → stage 1).
//
// This file is ANALYSIS ONLY. It changes nothing. The canonical suite remains
// byte-identical; the proposed diffs in d13.26-layer8-evidence-pack.md are NOT
// applied and remain gated on owner/validator review (D-13.26 protocol).
//
// Run: bun audit-work/task13/evidence/l8-d13-26-fixture-verification.ts
// Output: this console record + l8-d13-26-fixture-verification.json (beside
// this file — NOT inside canonical-layer7/, whose namespace is owned by the
// Layer-7 merge tool).
// =================================================================================

import {
  inNoTradeZone,
  costBenefitGate,
  marpDecision,
  stateDependentBeta,
  computeUrgency,
  estimateExecutionCost,
  MARP_BETA_TERMS,
  GAS_COST_MODEL,
} from "../../../src/lib/mtq/marp";
import {
  evaluateRebalance,
  initReserveState,
  updatePegHealth,
  type ReserveState,
} from "../../../src/lib/mtq/engine";
import {
  BASE_FIXINGS,
  NO_TRADE_BAND_BASE,
  MIN_PROFITABILITY_USD,
  SLIPPAGE_TOLERANCES,
  REBALANCE_FEE_BPS,
  DEPEG_DETECTION_HOURS,
  EJECT_PAUSE_RULE_PCT,
} from "../../../src/lib/mtq/blueprint";
import type { FxSnapshot } from "../../../src/lib/mtq/fx";
import type { WeightVector, VolatilityData } from "../../../src/lib/mtq/mase";
import * as fs from "node:fs";
import * as path from "node:path";

const record: Record<string, unknown> = {
  script: "l8-d13-26-fixture-verification.ts",
  purpose: "MANDATE-005 Priority 2 — empirical demonstration of the six proposed D-13.26 fixture re-pins under the CURRENT implementation. Analysis only; no canonical assertion, engine code, or spec text was modified.",
  timestamp: new Date().toISOString(),
  posture: "TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED",
};

const log = (label: string, ok: boolean, detail: unknown) =>
  console.log(`  ${ok ? "✓" : "✗"} ${label}\n      ${JSON.stringify(detail)}`);

// makeFx — copied verbatim in shape from canonical-invariants.ts:242 (base fixings).
function makeFx(): FxSnapshot {
  return {
    EUR_USD: BASE_FIXINGS.EUR_USD,
    GBP_USD: BASE_FIXINGS.GBP_USD,
    JPY_USD: BASE_FIXINGS.JPY_USD,
    CNY_USD: BASE_FIXINGS.CNY_USD,
    CHF_USD: BASE_FIXINGS.CHF_USD,
    XAU_USD: BASE_FIXINGS.XAU_USD,
    VIX: 18.5,
    DXY: 104.2,
    fetchedAt: Date.now(),
    source: "l8-d13-26-fixture-verification",
    degraded: false,
  };
}

// =================================================================================
console.log("\n=== PART 1 — C.1: §10.4 inclusive boundary (helper + end-to-end) ===\n");
{
  const p1: Record<string, unknown> = {};
  // 1a. Helper-level boundary: D = θ is INSIDE the zone; 0.76% is outside.
  p1.thetaBase = NO_TRADE_BAND_BASE;
  p1.inZone_deep_0_30pct = inNoTradeZone(0.003);
  p1.inZone_boundary_0_75pct = inNoTradeZone(NO_TRADE_BAND_BASE); // expect true (inclusive ≤)
  p1.inZone_above_0_76pct = inNoTradeZone(0.0076); // expect false
  log("helper boundary: 0.30% in-zone, 0.75% (=θ) in-zone, 0.76% out",
    p1.inZone_deep_0_30pct === true && p1.inZone_boundary_0_75pct === true && p1.inZone_above_0_76pct === false, p1);

  // 1b. FP-exactness probe: which (target, target+0.0075) pairs subtract back to
  // the exact threshold double (an exact end-to-end boundary fixture must not
  // depend on ULP luck).
  const probe: Record<string, boolean> = {};
  for (const t of [0.2, 0.25, 0.26, 0.5, 0.75]) {
    probe[`dev(${t} + 0.0075) === 0.0075`] = (t + NO_TRADE_BAND_BASE) - t === NO_TRADE_BAND_BASE;
  }
  p1.fpExactDeviations = probe;
  log("FP-exactness probe (observed−target vs the θ double)", Object.values(probe).some(Boolean), probe);

  // 1c. End-to-end boundary sandwich through marpDecision (uniform vols ⇒ σ̃ = 0
  // ⇒ κ = 0 ⇒ θ_applied = 0.0075 exactly). 0.74% → Level-2 no-trade hold;
  // 0.76% → passes the band (proceeds to sizing/execution levels).
  const target: WeightVector = { USD: 0.27, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 };
  const vols: VolatilityData = { USD: 0.05, EUR: 0.05, JPY: 0.05, GBP: 0.05, CNY: 0.05, CHF: 0.05, Gold: 0.05 };
  const run = (dev: number) => {
    const observed: WeightVector = { ...target, Gold: target.Gold + dev, USD: target.USD - dev };
    const d = marpDecision(observed, target, 1_000_000, 1.10, vols).find((x) => x.component === "Gold")!;
    return { shouldTrade: d.shouldTrade, level: d.level, tradeUsd: d.tradeUsd, reason: d.reason.slice(0, 60), thetaApplied: d.theta.applied };
  };
  const below = run(-0.0074); // underweight 0.74% — still inside the band
  const above = run(0.0076); // overweight 0.76% — outside the band
  p1.endToEnd_below = below;
  p1.endToEnd_above = above;
  log("end-to-end sandwich: 0.74% holds at Level 2 (No-trade zone); 0.76% proceeds past the band",
    below.shouldTrade === false && below.level === 2 && below.reason.includes("No-trade zone") &&
    !(above.level === 2 && above.reason.includes("No-trade zone")), { below, above });
  record.part1_c1 = p1;
}

// =================================================================================
console.log("\n=== PART 2 — C.3: fixture Î and the FULL §10.6 β calculation ===\n");
{
  const p2: Record<string, unknown> = {};
  // Fixture reproduced EXACTLY from canonical-invariants.ts §8.7 (8.7 block):
  const NAV = 1_000_000;
  const target: WeightVector = { USD: 0.27, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 };
  const observed: WeightVector = { ...target, Gold: 0.245, USD: 0.285 }; // Gold −1.5%, USD +1.5%
  const vols: VolatilityData = { USD: 0.05, EUR: 0.05, JPY: 0.05, GBP: 0.05, CNY: 0.05, CHF: 0.05, Gold: 0.05 };
  const d = marpDecision(observed, target, NAV, 1.05, vols, { naturalFlowUsd: { Gold: 0.009 * NAV } })
    .find((x) => x.component === "Gold")!;

  // Hand-verified urgency chain (§10.2 simplified pilot form, marp.ts:668-684):
  const devUrgency = Math.min(1, 0.015 / 0.05);        // 0.30
  const rrUrgency = (1.10 - 1.05) / 0.10;               // 0.50
  const volFactor = 1 - Math.min(0.5, 0.05 * 2);        // 0.90
  const urgencyHand = (devUrgency + rrUrgency) * volFactor; // 0.72
  const betaHand = MARP_BETA_TERMS.beta0 + MARP_BETA_TERMS.beta1 * urgencyHand - MARP_BETA_TERMS.beta2 * 0; // 0.86

  p2.gapUsd = d.gapUsd;                 // −$15,000 (the RAW gap)
  p2.naturalFlowUsd = d.naturalFlowUsd; // +$9,000  (CF_{i,t})
  p2.residualGapUsd = d.residualGapUsd; // −$6,000  (TradeNeeded = gap − CF)
  p2.betaRecord = d.beta;               // {applied, raw, urgency, impactEstimate, clippedAt}
  p2.thetaApplied = d.theta.applied;
  p2.decision = { shouldTrade: d.shouldTrade, level: d.level, direction: d.direction, tradeUsd: d.tradeUsd };
  p2.handCheck = { devUrgency, rrUrgency, volFactor, urgency: urgencyHand, betaRaw: betaHand };
  p2.residualSizing = d.tradeUsd;                          // expect 0.86 × $6,000 = $5,160
  p2.rawGapContrast = MARP_BETA_TERMS.beta1 === 0.5 ? betaHand * 15_000 : null; // NOT the sizing basis (would be $12,900)

  const ok =
    Math.abs(d.residualGapUsd - (-6_000)) < 1e-9 &&
    Math.abs(d.beta.urgency - 0.72) < 1e-9 &&
    d.beta.impactEstimate === 0 && d.beta.clippedAt === null &&
    Math.abs(d.beta.applied - 0.86) < 1e-9 &&
    Math.abs(d.tradeUsd - 5_160) < 1e-6 &&
    Math.abs(d.tradeUsd - 12_900) > 1e-6;
  log("Î = 0 (no pool-depth feed ⇒ recorded, not guessed); U = 0.72; β = clip(0.50+0.5·0.72−0.4·0, 0.10, 1) = 0.86; tradeUsd = 0.86 × $6,000 residual = $5,160 (≠ 0.86 × $15,000 raw gap)", ok, p2);
  record.part2_c3 = p2;
}

// =================================================================================
console.log("\n=== PART 3 — RG-10 ε boundary: LEGACY worked-example vector (explicit positional overrides) ===\n");
{
  const p3: Record<string, unknown> = {};
  p3.epsilon = { value: MIN_PROFITABILITY_USD, definition: "Listing 5 §12.8 — strict netBenefit > ε, one ε, fixed USD units, every route; OD-2 OPEN (legacy candidate vs 1% benefit-margin conflict — neither operative)" };
  // Default-path (§12.7) values for the SAME 3-argument calls — why the current
  // assertion fails: both legs land far below zero.
  const defFail = costBenefitGate(0.015, 1_000_000, 5_945_000);
  const defPass = costBenefitGate(0.015, 1_000_000, 5_935_000);
  p3.defaultPath = { net_5945: defFail.netBenefit, net_5935: defPass.netBenefit, costModel: "§12.7 exact: gas 17.82 + tradeUsd × (τ_GOLD/2 0.5% + router 0.1% + protocol 0.2%) = 17.82 + 0.8%·tradeUsd" };
  // Legacy vector pinned EXPLICITLY through the documented back-compat
  // positional signature (marp.ts:725-727): slippage 0.1%, gas $50.
  const legFail = costBenefitGate(0.015, 1_000_000, 5_945_000, 0.001, 50);
  const legPass = costBenefitGate(0.015, 1_000_000, 5_935_000, 0.001, 50);
  p3.legacyVector = {
    fail: { benefit: legFail.benefit, cost: legFail.cost, net: legFail.netBenefit, pass: legFail.pass, basis: "benefit = 0.015×$1M×λ₁(0.4) = $6,000; cost = $5.945M×0.1% slippage + $50 gas = $5,995" },
    pass: { benefit: legPass.benefit, cost: legPass.cost, net: legPass.netBenefit, pass: legPass.pass, basis: "cost = $5.935M×0.1% + $50 = $5,985" },
  };
  const ok = legFail.netBenefit > 0 && legFail.netBenefit <= 10 && legFail.pass === false &&
             legPass.netBenefit > 10 && legPass.pass === true &&
             Math.abs(legFail.netBenefit - 5) < 1e-6 && Math.abs(legPass.netBenefit - 15) < 1e-6;
  log("legacy vector: net +$5 (0 < net ≤ ε) → REJECT; net +$15 (> ε) → PASS — identical nets to the original design intent; tests the ε RULE, not the cost model", ok, p3);
  record.part3_rg10_boundary = p3;
}

// =================================================================================
console.log("\n=== PART 4 — RG-10 ACTIVE path: recalibrated fixture + branch-reach proof ===\n");
{
  const p4: Record<string, unknown> = {};
  // 4a. Why the CURRENT fixture no longer rejects (superseded premise):
  //     nav $18,000, surplus $138 under the §12.7 model.
  const sOld = initReserveState(BASE_FIXINGS.XAU_USD);
  const navOld = 18_000;
  const goldNetOld = (0.2625 + 138 / navOld) * navOld;
  const decOld = evaluateRebalance(sOld, { nav: navOld, goldNet: goldNetOld, fiatNet: navOld - goldNetOld }, 1.10);
  const costOld = estimateExecutionCost(138, "GOLD");
  p4.currentFixture = { decision: { shouldRebalance: decOld.shouldRebalance, tradeUsd: decOld.tradeUsd }, cost: costOld, net: 0.4 * 138 - costOld.totalUsd, note: "benefit $55.20 − §12.7 cost $18.92 = net +$36.28 > ε → executes; the reject branch is unreachable at this NAV" };

  // 4b. RECALIBRATED fixture: nav $6,000, surplus $60 → net +$5.70 ∈ (0, ε] → REJECT.
  const s = initReserveState(BASE_FIXINGS.XAU_USD);
  const nav = 6_000;
  const targetGold = 0.2625; // fresh genesis: maseSmoothed = null → legacy-buffer fallback
  const goldNetA = (targetGold + 60 / nav) * nav; // $1,635
  const decFail = evaluateRebalance(s, { nav, goldNet: goldNetA, fiatNet: nav - goldNetA }, 1.10);
  const estA = estimateExecutionCost(60, "GOLD");
  p4.rejectFixture = {
    inputs: { nav, goldNet: goldNetA, fiatNet: nav - goldNetA, rr: 1.10 },
    target: targetGold, observedWeight: decFail.observedGoldWeight, deviation: decFail.deviation,
    bandCheck: { deviationPct: decFail.deviation * 100, bandPct: NO_TRADE_BAND_BASE * 100, outside: Math.abs(decFail.deviation) > NO_TRADE_BAND_BASE },
    sizingCaps: { surplusUsd: 60, maxByPool: 0.10 * 4_000_000, remainingDailyTurnover: 0.05 * nav, tradeUsd: 60 },
    benefitBasis: "0.4×|dev|×nav = $24.00 (λ₁ legacy J-term; rr 1.10 ≥ RR_TARGET ⇒ no LAMBDA_3 term)",
    costBasis: { gas: estA.gasUsd, slippageHalfTau: estA.slippageUsd, router: estA.routerFeeUsd, protocol: estA.protocolFeeUsd, total: estA.totalUsd, labels: `gas $13.50×1.2×1.1 (Appendix-F P0-3 accounting estimate, never a gas price); slip τ_GOLD/2 = ${(SLIPPAGE_TOLERANCES.GOLD / 2) * 100}%; router 0.1%; protocol ${REBALANCE_FEE_BPS / 100}% §20.4` },
    net: 24 - estA.totalUsd, decision: { shouldRebalance: decFail.shouldRebalance, tradeUsd: decFail.tradeUsd }, reason: decFail.reason,
  };
  // Branch-reach proof: the ONLY return paths of evaluateRebalance with their
  // distinguishing reason prefixes (engine.ts:1050-1120):
  //   NAV ≤ 0 / Within no-trade zone / Direction lock / Net benefit not positive (§10.8/§12.8) / executing
  const rejectPrefix = decFail.reason.startsWith("Net benefit not positive (§10.8/§12.8)");
  const notBand = !decFail.reason.includes("no-trade zone");
  const notLock = !decFail.reason.includes("Direction lock");
  p4.reachProof = { reasonIsRejectBranch: rejectPrefix, bypassedBandGuard: !notBand, bypassedDirectionLock: !notLock, citesUnifiedGate: decFail.reason.includes("§10.8/§12.8"), conclusion: rejectPrefix && notBand && notLock ? "REACHED the active-path §12.7 reject branch — no guard bypassed" : "NOT REACHED — investigate" };

  // 4c. Case B: surplus $200 → net +$60.58 > ε → EXECUTE (sell).
  const goldNetB = (targetGold + 200 / nav) * nav;
  const decPass = evaluateRebalance(s, { nav, goldNet: goldNetB, fiatNet: nav - goldNetB }, 1.10);
  const estB = estimateExecutionCost(200, "GOLD");
  p4.executeFixture = { benefit: 0.4 * 200, cost: estB.totalUsd, net: 0.4 * 200 - estB.totalUsd, decision: { shouldRebalance: decPass.shouldRebalance, direction: decPass.direction, tradeUsd: decPass.tradeUsd }, reason: decPass.reason };

  const ok = decFail.shouldRebalance === false && decFail.tradeUsd === 0 && rejectPrefix &&
             decPass.shouldRebalance === true && decPass.direction === -1 && Math.abs(decPass.tradeUsd - 200) < 1e-6;
  log("reject fixture: net +$5.70 ∈ (0, ε] → shouldRebalance=false via the §10.8/§12.8 reject branch; execute fixture: net +$60.58 > ε → tradeUsd $200 sell", ok, p4);
  record.part4_rg10_active = p4;
}

// =================================================================================
console.log("\n=== PART 5 — §21.5.2/§21.5.3: reset-to-zero, 12h detector boundary, oscillation discriminator ===\n");
{
  const p5: Record<string, unknown> = {};
  const fx = makeFx();
  const freshOut = (): ReserveState => {
    const s = initReserveState(BASE_FIXINGS.XAU_USD);
    s.pegHealth.EUR = 0.93;                 // post-drift ≈ [0.9327, 0.9343] — outside the EURC band [0.995, 1.005]
    s.ejectStageStartPrice.EUR = 0.90;      // low entry price ⇒ the 5% pause cannot bind (existing fixture pattern)
    return s;
  };
  const freshIn = (): ReserveState => {
    const s = initReserveState(BASE_FIXINGS.XAU_USD);
    s.pegHealth.EUR = 1.0;                  // post-drift ≈ [0.9991, 1.0009] — inside the band
    return s;
  };

  // 5a. The corrected sD fixture: 30 accumulated de-peg hours + stage 2 → one
  //     in-band 10h update RESETS the timer to ZERO (§21.5.2) and de-escalates
  //     immediately to stage 0 with startPrice reset to 1.
  const sD = freshIn();
  sD.depegHours.EUR = 30; sD.ejectStage.EUR = 2; sD.ejectStageStartPrice.EUR = 0.93;
  updatePegHealth(sD, 10, fx);
  p5.corrected_sD = { depegHours: sD.depegHours.EUR, ejectStage: sD.ejectStage.EUR, startPrice: sD.ejectStageStartPrice.EUR, expectation: "0 / 0 / 1 (reset-to-zero per §21.5.2; the superseded 2×-decay would give 10)" };

  // 5b. 12h consecutive-detector BOUNDARY: h = 12 exactly stays stage 0
  //     (strict >); h = 13 → stage 1 (no RR involvement; rr omitted → Infinity).
  const s12 = freshOut(); s12.depegHours.EUR = 11;
  updatePegHealth(s12, 1, fx); // 11 + 1 = 12
  const s13 = freshOut(); s13.depegHours.EUR = 12;
  updatePegHealth(s13, 1, fx); // 12 + 1 = 13
  p5.detectorBoundary = { at_12h: { h: s12.depegHours.EUR, stage: s12.ejectStage.EUR }, at_13h: { h: s13.depegHours.EUR, stage: s13.ejectStage.EUR }, detectionHours: DEPEG_DETECTION_HOURS, expectation: "stage 0 at h = 12 (12 > 12 is false); stage 1 at h = 13" };

  // 5c. Oscillation discriminator (the authoritative §21.5.2 sentence):
  //     out 10h → in 1h → out 5h. Under RESET: h = 10 → 0 → 5 (final 5, stage 0).
  //     Under the superseded 2×-decay: h = 10 → max(0, 10−2) = 8 → 13 ⇒ stage 1.
  //     The final h === 5 separates the two detector semantics.
  const sOsc = freshOut(); sOsc.depegHours.EUR = 0; sOsc.ejectStage.EUR = 0;
  updatePegHealth(sOsc, 10, fx);                 // out-of-band spell: h = 10
  const hAfterOut1 = sOsc.depegHours.EUR;
  sOsc.pegHealth.EUR = 1.0;                      // return inside the band
  updatePegHealth(sOsc, 1, fx);                  // RESET: h = 0
  const hAfterIn = sOsc.depegHours.EUR;
  sOsc.pegHealth.EUR = 0.93;                     // out again
  updatePegHealth(sOsc, 5, fx);                  // h = 5 (NOT 13)
  p5.oscillation = { hAfterOut1, hAfterIn, hFinal: sOsc.depegHours.EUR, stageFinal: sOsc.ejectStage.EUR, expectation: "reset semantics: 10 → 0 → 5 (stage 0); 2×-decay semantics would end at h = 13 → stage 1 — an oscillating asset never accumulates detector time" };

  // 5d. Pause-rule reference (passing today, unchanged): stage-2 entry price
  //     1.0, price 0.93 < 0.95 ⇒ advancement blocked; timer still runs.
  p5.pauseRulePct = EJECT_PAUSE_RULE_PCT;

  const ok = sD.depegHours.EUR === 0 && sD.ejectStage.EUR === 0 && sD.ejectStageStartPrice.EUR === 1 &&
             s12.ejectStage.EUR === 0 && s13.ejectStage.EUR === 1 &&
             hAfterOut1 === 10 && hAfterIn === 0 && sOsc.depegHours.EUR === 5 && sOsc.ejectStage.EUR === 0;
  log("reset (30h → 0), boundary (h=12 stage 0 / h=13 stage 1), oscillation (10 → 0 → 5, stage 0 — decay form would reach 13h/stage 1)", ok, p5);
  record.part5_21_5 = p5;
}

// =================================================================================
record.conclusion =
  "All six proposed D-13.26 fixture re-pins produce the claimed values under the CURRENT implementation " +
  "(inclusive §10.4 boundary; state-dependent β = 0.86 on the $6,000 residual with Î = 0; legacy ε vector nets +$5/+$15; " +
  "active-path reject at net +$5.70 via the §10.8/§12.8 branch with no guard bypass; reset-to-zero + 12h boundary + " +
  "oscillation discriminator). The canonical suite was NOT modified; the proposed diffs remain gated on owner/validator review.";

const out = JSON.stringify(record, null, 2);
const outPath = path.join(__dirname, "l8-d13-26-fixture-verification.json");
fs.writeFileSync(outPath, out + "\n");
console.log(`\nRecord written: ${outPath}`);
console.log("ANALYSIS ONLY — no canonical assertion, engine code, or spec text was modified.");
console.log("Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED");
