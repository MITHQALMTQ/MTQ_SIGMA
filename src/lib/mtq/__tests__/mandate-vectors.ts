// MTQΣ — Mandate Vectors Test Suite (v5.0 + Ext-1/2/3)
// =============================================================================
// Runnable verification of the mandate reference layer:
//   bun src/lib/mtq/__tests__/mandate-vectors.ts
//   Exit 0 = all pass · Exit 1 = any failure
//
// Covers (with the mandate's own test IDs):
//   T-01..T-04  Listing C-1 signed deviation / improvement / direction gate
//   T-05..T-08  Listing C-2 checked token scaling (incl. dust rejection)
//   T-09..T-10  Listing C-3 gas conversion sanity ($13.50 / $45.00)
//   T-11        Listing C-4 dimensional net-benefit gate (per §3.6 FORMULA —
//               see discrepancy D-1 in docs/MANDATE-COMPLIANCE.md)
//   T-45        Ext-1 A.5 slippage in output-token native decimals
//   T-47        Ext-1 B.1 oracle health escalation WARNING→DEGRADED→HALTED
//   T-50        Ext-1 C.1 replay protection + version binding
//   T-51        Ext-1 C.2 keeper failover + separation of duties
//   T-53        Ext-1 D.2 formal invariants INV-1 (hard) / INV-8 (soft)
//   T-71        Ext-2 G commit-reveal timing + replay
//   T-81        Ext-3 A.1 MASE → MARP wiring + §7.6 softmax DIRECTION
//   T-85        Ext-3 A.3 genesis seven-step + verifyIndexBase
//   Part 2      Non-USD-peg constitutional guard (C-006)
//
// Label discipline: every assertion here is UNIT-TESTED reference evidence —
// not chain-deployed evidence, not shadow acceptance, not governance approval.

import {
  E18,
  signedImprovement,
  postTradeDeviation,
  isEligibleForNormalMode,
  to18Exact,
  from18Exact,
  gasCostEstimate,
  netBenefitIsEligible,
  computeMinOut,
  checkOracleHealth,
  DecisionReplayRegistry,
  validateDecisionVersions,
  authorizedSigners,
  validateKeeperConfig,
  checkInvariants,
  CommitRevealRegistry,
  assertIndexDerivedReferencePrice,
  MTQ_NOT_USD_PEGGED,
  grossBenefit,
  jsObjective,
  type JsState,
  type TradeDecision,
} from "../mandate";
import {
  adaptiveEnsembleWeights,
  evaluateMaseObjective,
  maseEnsembleAdaptive,
  updateOosScores,
  MASE_LAMBDA_PLACEHOLDER,
  type OosScoreState,
  type WeightVector,
} from "../mase";
import { executeGenesisSequence, verifyIndexBase, GENESIS_RESERVE_SAFE } from "../genesis";
import { marpDecision } from "../marp";
import { runMandateSelfTests } from "../mandate";
import { solidityPackedKeccak256, zeroPadValue } from "ethers";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(name);
  }
}
function e18(x: number): bigint {
  return BigInt(Math.round(x * 1e9)) * 10n ** 9n;
}

// --- T-01..T-04: Listing C-1 -------------------------------------------------
{
  const cases = [
    { o: 0.25, t: 0.30, d: 0.03, post: -0.02, imp: 0.03, elig: true },   // T-01 buy underweight
    { o: 0.35, t: 0.30, d: -0.03, post: 0.02, imp: 0.03, elig: true },   // T-02 sell overweight
    { o: 0.35, t: 0.30, d: 0.03, post: 0.08, imp: -0.03, elig: false },  // T-03 wrong direction
    { o: 0.25, t: 0.30, d: 0, post: -0.05, imp: 0, elig: false },        // T-04a no trade
    { o: 0.28, t: 0.30, d: 0.05, post: 0.03, imp: -0.01, elig: false },  // T-04b overshoot worsens
  ];
  for (const c of cases) {
    const post = Number(postTradeDeviation(e18(c.o), e18(c.t), e18(c.d))) / 1e18;
    const imp = Number(signedImprovement(e18(c.o), e18(c.t), e18(c.d))) / 1e18;
    const elig = isEligibleForNormalMode(e18(c.o), e18(c.t), e18(c.d) === 0n ? 0n : e18(c.d), e18(c.t));
    // recompute eligibility with the true signed improvement (isEligible takes imp explicitly)
    const impBig = signedImprovement(e18(c.o), e18(c.t), e18(c.d));
    const eligTrue = isEligibleForNormalMode(impBig, e18(c.o), e18(c.t), e18(c.d));
    void elig;
    assert(Math.abs(post - c.post) < 1e-9 && Math.abs(imp - c.imp) < 1e-9 && eligTrue === c.elig,
      `C-1 vector obs=${c.o} tgt=${c.t} Δ=${c.d}`);
  }
  // Negative improvement is preserved (never floored to zero).
  assert(signedImprovement(e18(0.35), e18(0.30), e18(0.03)) < 0n, "C-1 negative improvement preserved (T-03)");
}

// --- T-05..T-08: Listing C-2 -------------------------------------------------
{
  assert(from18Exact(to18Exact(1_000_000n * 10n ** 6n, 6), 6) === 1_000_000n * 10n ** 6n, "T-05 USDC 6d exact round-trip");
  assert(to18Exact(15n * 10n ** 17n, 18) === 15n * 10n ** 17n, "T-06 PAXG 18d unchanged");
  assert(from18Exact(to18Exact(100n * 10n ** 6n, 6), 6) === 100n * 10n ** 6n, "T-07 100 USDC round-trip");
  let dustRejected = false;
  try { from18Exact(e18(1) + 1n, 6); } catch { dustRejected = true; }
  assert(dustRejected, "T-08 precision-loss dust rejected");
  let highDecRejected = false;
  try { to18Exact(1n, 19); } catch { highDecRejected = true; }
  assert(highDecRejected, "T-08b >18 decimals rejected");
}

// --- T-09..T-10: Listing C-3 -------------------------------------------------
{
  const g1 = Number(gasCostEstimate(150_000n, 30n * 10n ** 9n, 3000n * E18)) / 1e18;
  const g2 = Number(gasCostEstimate(300_000n, 100n * 10n ** 9n, 1500n * E18)) / 1e18;
  assert(Math.abs(g1 - 13.5) < 1e-9, "T-09 gas $13.50");
  assert(Math.abs(g2 - 45.0) < 1e-9, "T-10 gas $45.00");
}

// --- T-11: Listing C-4 (per the §3.6 FORMULA — discrepancy D-1) --------------
{
  const a = netBenefitIsEligible(e18(0.12), e18(0.05), e18(0.02), e18(0.01));
  const b = netBenefitIsEligible(e18(0.12), e18(0.05), e18(0.02), e18(0.05));
  const c = netBenefitIsEligible(e18(0.05), e18(0.10), e18(0.02), e18(0));
  const d = netBenefitIsEligible(e18(-0.01), 0n, 0n, 0n);
  assert(a.eligible === true && Math.abs(Number(a.netBenefitE18) / 1e18 - 0.05) < 1e-9, "T-11a eligible vs $10 ε");
  assert(b.eligible === false, "T-11b strict inequality: 0.05 > 0.05 is false");
  assert(c.eligible === false && Math.abs(Number(c.netBenefitE18) / 1e18 + 0.07) < 1e-9, "T-11c negative net rejected");
  assert(d.eligible === false, "T-11d negative gross rejected");
}

// --- T-45: native-decimal slippage -------------------------------------------
{
  assert(computeMinOut(1_000_000n * 10n ** 6n, 6, e18(0.01)) === 990_000n * 10n ** 6n, "T-45a 1% on 1M USDC(6d) = 990,000");
  assert(computeMinOut(E18, 18, e18(0.01)) === 99n * 10n ** 16n, "T-45b 1% on 1 PAXG(18d) = 0.99");
  let zeroDecRejected = false;
  try { computeMinOut(5n, 0, BigInt(10n ** 15n)); } catch { zeroDecRejected = true; }
  assert(zeroDecRejected, "T-45c 0-decimal sub-unit tolerance rejected");
}

// --- T-47: oracle health escalation ------------------------------------------
{
  const h = (ages: (number | null)[]) => checkOracleHealth({
    sourceAgesMs: ages, stalenessThresholdMs: 60_000,
    deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3,
  });
  assert(h([5_000, 5_000, 5_000]).level === "HEALTHY", "T-47 all fresh → HEALTHY");
  const w = checkOracleHealth({ sourceAgesMs: [5_000, 70_000, 5_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1,  1], independentSourceFamilies: 3 });
  assert(w.level === "WARNING" && w.protectionMultiplier === 1.5, "T-47 one stale → WARNING ×1.5 protection");
  const d = checkOracleHealth({ sourceAgesMs: [70_000, 80_000, 5_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3 });
  assert(d.level === "DEGRADED" && d.newTradesSuspended, "T-47 two stale → DEGRADED suspend");
  const x = checkOracleHealth({ sourceAgesMs: [150_000, 160_000, 170_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3 });
  assert(x.level === "HALTED" && x.executionPaused, "T-47 all >2× stale → HALTED pause");
}

// --- T-50: EIP-712 decision replay + version binding -------------------------
{
  const reg = new DecisionReplayRegistry();
  assert(reg.consume("d1").ok && !reg.consume("d1").ok, "T-50 replay rejected");
  const base: TradeDecision = {
    decisionId: "0x" + "aa".repeat(32), keeper: "0x1234", assetIn: "0x" + "01".repeat(32), assetOut: "0x" + "02".repeat(32),
    amountIn: 100n, minAmountOut: 99n, quoteTimestamp: 1_000, deadline: 2_000,
    costModelVersion: "0x" + "c1".repeat(32), protectionModelVersion: "0x" + "c2".repeat(32),
    objectiveVersion: "0x" + "c3".repeat(32), parameterSetHash: "0x" + "c4".repeat(32),
    grossBenefitE18: 10n * E18, netBenefitE18: 5n * E18, thresholdE18: 1n * E18,
  };
  const approved = {
    costModelVersion: base.costModelVersion, protectionModelVersion: base.protectionModelVersion,
    objectiveVersion: base.objectiveVersion, parameterSetHash: base.parameterSetHash,
  };
  assert(validateDecisionVersions(base, approved).ok, "T-50 matching versions accepted");
  assert(!validateDecisionVersions({ ...base, parameterSetHash: "0x" + "ff".repeat(32) }, approved).ok, "T-50 stale parameter set rejected");
}

// --- T-51: keeper failover + anti-collusion ----------------------------------
{
  const kc = { primary: "0xA", backup: "0xB", submitter: "0xC", emergency: "0xD", primaryLastSeenMs: 0, emergencyModeActive: false };
  assert(validateKeeperConfig(kc).ok, "T-51 valid separation accepted");
  assert(!validateKeeperConfig({ ...kc, submitter: kc.primary }).ok, "T-51 keeper==submitter rejected");
  const now = Date.now();
  const failover = authorizedSigners({ ...kc, primaryLastSeenMs: now - 40 * 60_000 }, now);
  assert(failover.length === 1 && failover[0].role === "BACKUP" && failover[0].failover, "T-51 backup activates after 30 min");
  const normal = authorizedSigners({ ...kc, primaryLastSeenMs: now - 1_000, emergencyModeActive: false }, now);
  assert(normal.length === 1 && normal[0].role === "PRIMARY", "T-51 primary signs when responsive");
  const emergency = authorizedSigners({ ...kc, primaryLastSeenMs: now - 1_000, emergencyModeActive: true }, now);
  assert(emergency.some((s) => s.role === "EMERGENCY"), "T-51 emergency keeper only in emergency mode");
}

// --- T-53: formal invariants --------------------------------------------------
{
  const v = checkInvariants({
    rrE18: e18(0.98), totalSupply: 100n * E18, sumOfHolderBalances: 100n * E18,
    circulatingSupply: 90n * E18, reserveBalanceMtq: 10n * E18,
    grossNavE18: e18(120), netNavE18: e18(118), lcrE18: e18(0.9),
    targetWeightsSumE18: E18, activeOracleSources: 3,
    deviationFromOracleMedian: 0.001, quoteAgeMs: 10_000, quoteMaxAgeMs: 60_000,
  });
  assert(v.some((i) => i.id === "INV-1" && i.kind === "hard"), "T-53 RR 0.98 → INV-1 HARD violation");
  assert(v.some((i) => i.id === "INV-8" && i.kind === "soft"), "T-53 LCR 0.9 → INV-8 SOFT violation");
  const okState = checkInvariants({
    rrE18: e18(1.15), totalSupply: 100n * E18, sumOfHolderBalances: 100n * E18,
    circulatingSupply: 90n * E18, reserveBalanceMtq: 10n * E18,
    grossNavE18: e18(120), netNavE18: e18(118), lcrE18: e18(1.5),
    targetWeightsSumE18: E18, activeOracleSources: 3,
    deviationFromOracleMedian: 0.001, quoteAgeMs: 10_000, quoteMaxAgeMs: 60_000,
  });
  assert(okState.length === 0, "T-53 healthy state → no violations");
}

// --- T-71: commit-reveal ------------------------------------------------------
{
  const cr = new CommitRevealRegistry();
  const did = "0x" + "ab".repeat(32), nonce = "0x" + "11".repeat(32), salt = "0x" + "22".repeat(32);
  const hash = solidityPackedKeccak256(["bytes32", "bytes32", "bytes32"], [zeroPadValue(did, 32), zeroPadValue(nonce, 32), zeroPadValue(salt, 32)]);
  const t0 = 1_000_000;
  assert(!cr.commit(hash, t0, "DIRECT", 2_000).ok, "T-71 wrong mode rejected");
  assert(cr.commit(hash, t0, "COMMIT_REVEAL", 2_000).ok, "T-71 commit accepted");
  assert(!cr.commit(hash, t0 + 5, "COMMIT_REVEAL", 2_000).ok, "T-71 double commit rejected");
  assert(!cr.reveal(hash, did, nonce, salt, t0 + 1_000, 2_000).ok, "T-71 early reveal rejected");
  assert(cr.reveal(hash, did, nonce, salt, t0 + 3_000, 2_000).ok, "T-71 valid reveal accepted");
  assert(!cr.reveal(hash, did, nonce, salt, t0 + 4_000, 2_000).ok, "T-71 reveal replay rejected");
  assert(!cr.reveal(hash, "0x" + "cd".repeat(32), nonce, salt, t0 + 3_500, 2_000).ok, "T-71 mismatched reveal rejected");
}

// --- T-81: MASE §7.4 objective + §7.6 softmax direction + MARP wiring --------
{
  // 8-term objective: all eight terms present, total > 0.
  const w: WeightVector = { USD: 0.27, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 };
  const vols = { USD: 0.05, EUR: 0.10, JPY: 0.12, GBP: 0.11, CNY: 0.09, CHF: 0.10, Gold: 0.15 };
  const eval_ = evaluateMaseObjective(w, { vols, corr: null, prevWeights: w });
  const termIds = eval_.terms.map((t) => t.id);
  assert(
    ["Risk", "CVaR", "PPError", "CorrRisk", "Turnover", "StrategicDrift", "Concentration", "LiquidityRisk"]
      .every((id) => termIds.includes(id)),
    "T-81 §7.4 objective has all 8 terms",
  );
  assert(eval_.total > 0, "T-81 objective total > 0");
  assert(Math.abs(Object.values(MASE_LAMBDA_PLACEHOLDER).reduce((a, b) => a + b, 0) - 1) < 1e-9, "T-81 λ placeholder sums to 1");

  // Softmax DIRECTION (reconciliation gate): lower score → HIGHER α.
  const scores = { minvar: 0.010, erc: 0.020, maxdiv: 0.030, cvar: 0.040, ppp: 0.050, institutional: 0.060, regime: 0.070 };
  const { alphas, adaptive } = adaptiveEnsembleWeights(scores, Object.keys(scores));
  assert(adaptive, "T-81 softmax is adaptive when scores exist");
  assert(alphas.minvar > alphas.erc && alphas.erc > alphas.maxdiv, "T-81 e^(−η·Score): lower score = greater weight");
  assert(Math.abs(Object.values(alphas).reduce((a, b) => a + b, 0) - 1) < 1e-9, "T-81 α sums to 1");

  // Walk-forward OOS update is leakage-controlled: proposals stored BEFORE next returns.
  const st0: OosScoreState = { scores: {}, samples: 0, prevModelTargets: null, prevPriceLevels: null };
  const models = { minvar: w, erc: w, maxdiv: w, cvar: w, ppp: w, institutional: w, regime: w };
  const p0 = { USD: 1, EUR: 1.09, JPY: 0.0067, GBP: 1.27, CNY: 0.14, CHF: 1.13, Gold: 2600 } as unknown as Record<import("../mase").Component, number>;
  const st1 = updateOosScores(st0, Object.keys(models), models, p0);
  assert(st1.samples === 1 && st1.prevModelTargets != null, "T-81 OOS state stores proposals");
  const p1 = { USD: 1, EUR: 1.10, JPY: 0.0068, GBP: 1.27, CNY: 0.14, CHF: 1.13, Gold: 2650 } as unknown as Record<import("../mase").Component, number>;
  const st2 = updateOosScores(st1, Object.keys(models), models, p1);
  assert(st2.samples === 2 && Object.keys(st2.scores).length === 7, "T-81 OOS scores updated after realized returns");

  // MARP consumes MASE targets: underweight buy decision carries a shadow record.
  const observed: WeightVector = { USD: 0.30, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.23 };
  const target: WeightVector = { USD: 0.27, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 };
  const decisions = marpDecision(observed, target, 1_100_000, 1.10, vols, { poolDepth24hUsd: 4_000_000 });
  const gold = decisions.find((d) => d.component === "Gold");
  assert(gold != null && gold.mandate != null, "T-81 MARP decisions carry the mandate shadow record");
  assert(gold!.mandate!.signedImprovement > 0 && gold!.mandate!.directionEligible, "T-81 underweight-buy shadow: I(q)>0, direction eligible");
  assert(gold!.mandate!.shadowOnly === true, "T-81 shadow-only until OD-1/OD-2 approve");
  // C-036 separation: J(s) trade gate ≠ MASE 8-term objective version strings.
  assert(eval_.terms.length === 8, "T-81/C-036 MASE objective is the 8-term portfolio objective (mase.ts), distinct from J(s) (mandate.ts)");
}

// --- T-85: genesis seven-step + verifyIndexBase -------------------------------
{
  const good = executeGenesisSequence({ USD: 1, EUR: 1.09, JPY: 0.0067, GBP: 1.27, CNY: 0.14, CHF: 1.13, XAU: 2614 });
  assert(good.ok && good.steps.length === 7, "T-85 genesis sequence completes 7 steps");
  assert(good.indexBaseDenominator === 1.0, "T-85 INDEX_BASE_DENOMINATOR = 1.0000");
  assert(good.basketAllocations.length === 7, "T-85 seven-component basket");
  assert(good.genesisCompletedEvent?.safe === GENESIS_RESERVE_SAFE, "T-85 1M MTQ to the Genesis Reserve Safe");
  assert(good.steps.some((s) => s.event === "GenesisVerification") && good.steps.some((s) => s.event === "GenesisCompleted"), "T-85 both events emitted");
  assert(!verifyIndexBase({ USD: 1, EUR: 1.09, JPY: 0.0067, GBP: 1.27, CNY: 0.14, CHF: 1.13, XAU: 0 }).ok, "T-85 verifyIndexBase rejects a bad fixing (supersedes verifyGFBBase)");
  assert(!executeGenesisSequence({ USD: 1, EUR: 1.09, JPY: 0.0067, GBP: 1.27, CNY: 0.14, CHF: 0, XAU: 2614 }).ok, "T-85 genesis aborts on invalid fixings");
}

// --- Part 2: constitutional non-USD-peg guard --------------------------------
{
  assert(MTQ_NOT_USD_PEGGED === true, "Part 2: MTQΣ is not USD-pegged");
  let rejected = false;
  try { assertIndexDerivedReferencePrice(0n); } catch { rejected = true; }
  assert(rejected, "Part 2/C-006: zero reference price rejected (never a $1 peg)");
  // J(s) candidate: moving TOWARD the target strictly reduces J_tracking.
  const pre: JsState = { navE18: e18(1_100_000), observedW: { Gold: e18(0.23) }, targetW: { Gold: e18(0.26) } };
  const post: JsState = { navE18: e18(1_100_000), observedW: { Gold: e18(0.245) }, targetW: { Gold: e18(0.26) } };
  assert(grossBenefit(pre, post) > 0n, "§3.5 G(q;s) > 0 for a gap-closing trade");
  assert(jsObjective(post) < jsObjective(pre), "§3.5 J(s') < J(s) — tracking objective decreases");
}

// --- Module self-test suite (the same vectors the API/UI run live) -----------
{
  const results = runMandateSelfTests();
  const fails = results.filter((t) => !t.pass);
  assert(fails.length === 0, `runMandateSelfTests all pass (${results.length} vectors): ${fails.map((f) => f.id).join(",")}`);
}

// --- Summary -------------------------------------------------------------------
console.log(`\nMTQΣ Mandate Vectors — ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("FAILURES:");
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log("ALL MANDATE VECTORS PASS");
process.exit(0);
