// ============================================================================
// MTQΣ — MANDATE-007 §3 · END-TO-END ACCEPTANCE RUN (NON-PRODUCTION)
// run-dynamic-replacement-e2e.ts — the mandated dynamic-currency-replacement
// demonstration for inputs-v1.json + constituency-lifecycle.ts.
//
// Run:  bun run audit-work/task13/evidence/dynamic-replacement/run-dynamic-replacement-e2e.ts
//
// Assertions DR-01..DR-08 implement MANDATE-007 §3 behaviors (1)-(8);
// DR-09..DR-15 cover the additional mandated validation-doc §7 scenarios
// (DR-15 is the explicit id-mapping re-assertion of the zero-weight + sum
// rows onto DR-04/DR-05). Exit code 0 ONLY if every assertion passes.
// results-e2e.json is fully deterministic (no wall-clock) so two separate
// invocations must produce byte-identical files (verified externally with
// cmp and recorded in RESULTS.md); the human run-log appends with timestamps.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NON-PRODUCTION PROTOTYPE.
// ZERO on-chain actions, ZERO network calls, NO src/ imports. NOT ACCEPTED.
// ============================================================================

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import {
  runLifecycleSimulation,
  serializeDecisionRecord,
  decisionRecordDigest,
  computeDatasetHash,
  compositeScore,
  evaluateHardGates,
  type Dataset,
  type DecisionRecord,
  type TransitionRecord,
} from "./constituency-lifecycle";

const DIR = import.meta.dir;
const datasetPath = join(DIR, "inputs-v1.json");
const resultsPath = join(DIR, "results-e2e.json");
const logPath = join(DIR, "run-log.txt");

const LOG_LINES: string[] = [];
function log(s = ""): void {
  LOG_LINES.push(s);
  console.log(s);
}

interface AssertResult {
  id: string;
  name: string;
  pass: boolean;
  observed: string;
}
const RESULTS: AssertResult[] = [];
function record(id: string, name: string, pass: boolean, observed: string): void {
  RESULTS.push({ id, name, pass, observed });
  log(`  [${id}] ${pass ? "PASS" : "FAIL"} — ${name}`);
  log(`         observed: ${observed}`);
}

function transitionOf(rec: DecisionRecord, componentId: string, ruleId: string): TransitionRecord | undefined {
  return rec.transitions.find((t) => t.componentId === componentId && t.ruleId === ruleId);
}
function transitionsOf(rec: DecisionRecord, componentId: string): TransitionRecord[] {
  return rec.transitions.filter((t) => t.componentId === componentId);
}
function fmtBp(bp: number): string {
  return `${bp} bp (${(bp / 10000).toFixed(4)})`;
}

// ---------------------------------------------------------------------------
// Load + verify the versioned input dataset
// ---------------------------------------------------------------------------
const raw = readFileSync(datasetPath, "utf8");
const datasetA = JSON.parse(raw) as Dataset;
const datasetHashComputed = computeDatasetHash(datasetA);
if (datasetHashComputed !== datasetA.datasetHash) {
  throw new Error(`datasetHash verification FAILED: file ${datasetA.datasetHash} vs computed ${datasetHashComputed}`);
}
log(`dataset: ${datasetPath}`);
log(`datasetHash verified: ${datasetA.datasetHash} (sha256 of canonicalized content with the hash field omitted, base64url)`);
log(`methodology version: ${datasetA.methodology.version}`);
log(`data class: ${datasetA.dataClass}`);
log("");

// ---------------------------------------------------------------------------
// Run the simulation twice from two independent parses of the same file
// ---------------------------------------------------------------------------
const datasetB = JSON.parse(raw) as Dataset;
const runA = runLifecycleSimulation(datasetA);
const runB = runLifecycleSimulation(datasetB);
const rec = runA;
const P = datasetA.parameters;
log(`simulation: ${rec.summary.periodsRun} periods; final basket {${rec.summary.finalBasketIds.join(", ")}}; exclusions: ${rec.summary.exclusions.map((e) => `${e.componentId}@P${e.excludedAtPeriod}`).join(", ")}`);
log("");

// ---------------------------------------------------------------------------
// Weight trajectory table (evidence for the log)
// ---------------------------------------------------------------------------
log("committed weight vectors (bp) — registry order by ID:");
{
  const ids = Object.keys(rec.finalStates).sort();
  // unambiguous per-state initials (naive first letters would collide on "E"
  // for ELIGIBLE / EXCLUDED / EMERGENCY-SUSPENDED — the legend below is authoritative)
  const STATE_INITIAL: Record<string, string> = {
    CANDIDATE: "C",
    ELIGIBLE: "L",
    ACTIVE: "A",
    WATCH: "W",
    RETIRING: "R",
    EXCLUDED: "X",
    "EMERGENCY-SUSPENDED": "S",
  };
  log("period | " + ids.map((i) => i.replace("CCY-", "").padStart(4)).join(" | ") + " |  sum | glide");
  for (const c of rec.commits) {
    const cells = ids.map((i) => String(c.weightsBp[i]).padStart(4));
    const st = ids.map((i) => STATE_INITIAL[c.states[i]]).join("");
    log(
      String(c.period).padStart(6) + " | " + cells.join(" | ") +
        ` | ${c.sumBp} | ${c.glideApplied ? "GLIDE" : "     "} | ${st}` +
        (c.index.pinnedLegs.length ? ` | pinnedLegs=${c.index.pinnedLegs.join(",")}` : ""),
    );
  }
  log("(state initials per component in the last column: C=CANDIDATE L=eLIGIBLE A=ACTIVE W=WATCH R=RETIRING X=EXCLUDED S=EMERGENCY-SUSPENDED — unambiguous per-state letters, not naive first letters)");
}
log("");

// ===========================================================================
// DR-01 — incumbent deteriorates enough to qualify for retirement
// ===========================================================================
{
  const t4 = transitionOf(rec, "CCY-GBP", "T4");
  const t5 = transitionOf(rec, "CCY-GBP", "T5");
  const windowPeriods = [4, 5, 6, 7];
  const windowScores = windowPeriods.map((p) => compositeScore(datasetA.periods[p].scores["CCY-GBP"]));
  const belowThreshold = windowScores.every((s) => s < P.thetaOut);
  const consecutive = windowPeriods.length === P.exitPersistencePeriods;
  const pass =
    t4 !== undefined &&
    t5 !== undefined &&
    t5.fromState === "WATCH" &&
    t5.toState === "RETIRING" &&
    t5.thresholdComparisons[0].passed &&
    t5.thresholdComparisons[0].observed < P.thetaOut &&
    belowThreshold &&
    consecutive &&
    t5.persistenceEvidence.includes("4/4");
  record(
    "DR-01",
    "incumbent CCY-GBP deteriorates below the exit threshold for the full persistence window → RETIRING (T5)",
    pass,
    `T4→WATCH at P${t4?.period}, T5→RETIRING at P${t5?.period}; exit window [P4..P7] scores ${windowScores.map((s) => s.toFixed(5)).join(", ")} all < θ_out ${P.thetaOut} (${windowPeriods.length}/${P.exitPersistencePeriods} consecutive periods required); window-end composite ${t5?.thresholdComparisons[0].observed.toFixed(5)} ${t5?.thresholdComparisons[0].comparator} ${P.thetaOut}`,
  );
}

// ===========================================================================
// DR-02 — previously excluded candidate passes ALL eligibility conditions
// ===========================================================================
{
  const t9 = transitionOf(rec, "CCY-CHF", "T9");
  const t2 = transitionOf(rec, "CCY-CHF", "T2");
  const entryPeriods = [1, 2, 3, 4, 5, 6];
  const entryScores = entryPeriods.map((p) => compositeScore(datasetA.periods[p].scores["CCY-CHF"]));
  const scoresOk = entryScores.every((s) => s >= P.thetaIn);
  const gatesOk = entryPeriods.every((p) => evaluateHardGates(datasetA.periods[p].scores["CCY-CHF"], P.hardGates).every((g) => g.passed));
  const initialExcluded = datasetA.universe.find((u) => u.id === "CCY-CHF")!.initialStatus === "EXCLUDED";
  const hysteresisOk = Math.abs(P.thetaIn - P.thetaOut - P.hysteresisBandH) < 1e-12 && P.thetaIn > P.thetaOut;
  const pass =
    t9 !== undefined &&
    initialExcluded &&
    t9.fromState === "EXCLUDED" &&
    t9.toState === "CANDIDATE" &&
    t2 !== undefined &&
    t2.fromState === "CANDIDATE" &&
    t2.toState === "ELIGIBLE" &&
    t2.thresholdComparisons[0].passed &&
    t2.thresholdComparisons[0].observed >= P.thetaIn &&
    scoresOk &&
    gatesOk &&
    hysteresisOk &&
    entryScores.length === P.entryPersistencePeriods;
  record(
    "DR-02",
    "previously EXCLUDED candidate CCY-CHF passes composite ≥ θ_in, ALL hard gates, and the full entry persistence window (T9 → T2)",
    pass,
    `initial status EXCLUDED (prior synthetic exclusion), T9 re-nomination at P${t9?.period}; entry window [P1..P6] composites ${entryScores.map((s) => s.toFixed(5)).join(", ")} all ≥ θ_in ${P.thetaIn} (${entryScores.length}/${P.entryPersistencePeriods} periods); all 5 hard gates (L/QD/CV/JR/BA) pass in every window period; hysteresis θ_in−θ_out = ${(P.thetaIn - P.thetaOut).toFixed(2)} = H ${P.hysteresisBandH}; T2 at P${t2?.period} with composite ${t2?.thresholdComparisons[0].observed.toFixed(5)}`,
  );
}

// ===========================================================================
// DR-03 — candidate enters through the approved transition logic (ramp)
// ===========================================================================
{
  const t3 = transitionOf(rec, "CCY-CHF", "T3");
  const pass1 = t3 !== undefined && t3.fromState === "ELIGIBLE" && t3.toState === "ACTIVE" && t3.period === 7;
  const plan = rec.glidePlans.find((g) => g.reason.includes("T3-ENTRY"));
  let rampOk = false;
  let rampObs = "no glide plan found";
  if (plan && t3) {
    const chfEnd = plan.wEndBp["CCY-CHF"];
    const chfStart = plan.wStartBp["CCY-CHF"];
    const series: number[] = [chfStart];
    let rawOk = true;
    for (let k = 1; k <= plan.nPeriods; k++) {
      const period = plan.startPeriod + k - 1;
      const committed = rec.commits.find((c) => c.period === period)!.weightsBp["CCY-CHF"];
      const rawK = plan.perPeriodRawBp[k - 1]["CCY-CHF"];
      if (Math.abs(committed - rawK) > 1) rawOk = false;
      series.push(committed);
    }
    const steps: number[] = [];
    for (let i = 1; i < series.length; i++) steps.push(series[i] - series[i - 1]);
    const linear = steps.every((s) => Math.abs(s - steps[0]) <= 1);
    const velocityOk = steps.every((s) => Math.abs(s) <= P.velocityPerPeriod * 10000 + 1);
    const boundOk = plan.nPeriods >= P.glideBoundPeriods[0] && plan.nPeriods <= P.glideBoundPeriods[1];
    // T_ann = 1 period → ramp effective at confirm period + 1
    const tAnnOk = plan.startPeriod === t3.period + 1;
    const endReached = Math.abs(series[series.length - 1] - chfEnd) <= 1;
    rampOk = rawOk && linear && velocityOk && boundOk && tAnnOk && endReached;
    rampObs =
      `T3 confirmed at P${t3.period} (pre-announcement T_ann=${P.announcementLagPeriods} period), ramp effective P${plan.startPeriod}; ` +
      `joint-glide N=${plan.nPeriods} (${plan.derivation}); CCY-CHF committed ramp [${series.map((s) => `${s}bp`).join(" → ")}] — linear steps ${steps.map((s) => `${s}bp`).join(", ")} ≤ Δ ${P.velocityPerPeriod * 10000}bp; endpoint ${chfEnd}bp reached at completion P${plan.completedPeriod}; N∈[${P.glideBoundPeriods[0]},${P.glideBoundPeriods[1]}] honored; each committed step within 1 bp of the exact linear glide point`;
  }
  record(
    "DR-03",
    "candidate enters through the approved transition logic: T2→T3 with a derived deterministic linear ramp (spec §5.5)",
    Boolean(pass1 && rampOk),
    rampObs,
  );
}

// ===========================================================================
// DR-04 — retiring component reaches EXACTLY zero weight on exclusion
// ===========================================================================
{
  let pass = true;
  const obs: string[] = [];
  if (rec.summary.exclusions.length !== 2) pass = false;
  for (const ex of rec.summary.exclusions) {
    const atExclusion = rec.commits.find((c) => c.period === ex.excludedAtPeriod)!.weightsBp[ex.componentId];
    const later = rec.commits.filter((c) => c.period > ex.excludedAtPeriod).every((c) => c.weightsBp[ex.componentId] === 0);
    const floatZero = atExclusion / 10000 === 0;
    const finalZero = rec.finalStates[ex.componentId].weightBp === 0;
    const t6 = transitionOf(rec, ex.componentId, "T6");
    if (!(atExclusion === 0 && floatZero && finalZero && later && t6 !== undefined && t6.thresholdComparisons[0].observed === 0)) {
      pass = false;
    }
    obs.push(
      `${ex.componentId}: committed weight at exclusion commit P${ex.excludedAtPeriod} = ${atExclusion} bp — float ${(atExclusion / 10000).toPrecision(3)} (exactly 0, no 1e-18-style epsilon); stays 0 in all ${rec.commits.filter((c) => c.period > ex.excludedAtPeriod).length} later commits; T6 record observed=${t6?.thresholdComparisons[0].observed} comparator==0`,
    );
  }
  record("DR-04", "every retiring component reaches EXACTLY zero weight when excluded (spec §5.4 exclusion-zero)", pass, obs.join(" | "));
}

// ===========================================================================
// DR-05 — EVERY intermediate weight vector sums to 100% within tolerance
// ===========================================================================
{
  const badSums = rec.commits.filter((c) => c.sumBp !== 10000 || c.sumDeviation > P.sumTolerance);
  const maxDev = rec.summary.maxSumDeviation;
  const envV = rec.commits.flatMap((c) => c.envelopeViolations);
  const capV = rec.commits.flatMap((c) => c.capViolations);
  const hhiV = rec.commits.flatMap((c) => c.hhiViolations);
  const maxMove = Math.max(...rec.commits.map((c) => c.perComponentMaxMoveBp));
  const maxHhi = Math.max(...rec.commits.map((c) => c.hhi));
  const maxShare = Math.max(...rec.commits.map((c) => c.maxComponentShare));
  const nonGlide = rec.commits.filter((c) => c.period > 0 && !c.glideApplied);
  const maxNonGlideTurnover = Math.max(...nonGlide.map((c) => c.turnoverBp));
  const glidePeriods = rec.commits.filter((c) => c.glideApplied).map((c) => c.period);
  const pass =
    badSums.length === 0 &&
    envV.length === 0 &&
    capV.length === 0 &&
    hhiV.length === 0 &&
    maxDev <= P.sumTolerance &&
    maxHhi <= P.hhiCap + 1e-9 &&
    maxShare <= P.singleComponentCap + 1e-9 &&
    maxMove <= P.velocityPerPeriod * 10000 + 1 &&
    maxNonGlideTurnover <= P.weightTurnoverCapPerPeriod * 10000 + 8;
  record(
    "DR-05",
    "every intermediate weight vector sums to exactly 100% within the 1e-9 tolerance; bounds/caps/velocity/turnover hold at every commit",
    pass,
    `${rec.commits.length} commits (incl. every glide intermediate on glide periods ${glidePeriods.join(",")}): all sumBp === 10000 exactly (integer bp), max |Σw−1| = ${maxDev.toExponential(3)} ≤ ${P.sumTolerance}; envelope/cap/HHI violations: 0/0/0; max per-component move ${maxMove} bp ≤ Δ ${P.velocityPerPeriod * 10000}+1; max HHI ${maxHhi.toFixed(6)} ≤ ${P.hhiCap}; max share ${(maxShare * 100).toFixed(2)}% ≤ ${(P.singleComponentCap * 100).toFixed(0)}%; max non-glide turnover ${maxNonGlideTurnover} bp ≤ T_cap ${P.weightTurnoverCapPerPeriod * 10000}+8 (scheduled glides are T_cap-exempt per the documented PROTOTYPE-CHOICE); documented exemptions: retiring components carry no floor (§5.4 precedence), entry-ramp intermediates below the floor until completion (labeled PROTOTYPE-CHOICE)`,
  );
}

// ===========================================================================
// DR-06 — index continuous across the membership transition
// ===========================================================================
{
  // (a) in-dataset unchanged-price boundary: P8 relatives are all exactly 1.0
  const p8 = datasetA.periods.find((p) => p.period === 8)!;
  const allUnit = Object.keys(p8.priceRelative).every((id) => p8.priceRelative[id] === 1.0);
  const commit8 = rec.commits.find((c) => c.period === 8)!;
  const boundaryChange = Math.abs(commit8.index.relativeChange);
  // (b) deliverable-5 §2.2 zero-artificial-return identity: D_t × B^+ === B^-
  //     for every commit (the composition change contributes exactly zero)
  let maxIdentity = 0;
  for (const d of rec.divisorRecords) {
    maxIdentity = Math.max(maxIdentity, Math.abs(d.divisorD * d.bPlus - d.bMinus));
  }
  // (c) the §9.2 recursion is the published level; the residual vs the level
  //     form B^+/G is DISCLOSED (different mathematical objects — the repo
  //     publishes the same residual; honest-status.ts:251), not asserted
  const maxEquiv = Math.max(...rec.commits.map((c) => c.index.equivalenceDelta));
  const maxResidual = Math.max(...rec.commits.map((c) => c.index.valueFormResidual));
  // (d) fail-closed probe: ALL price relatives 1.0 everywhere → composition
  // changes alone must move the index by ≤ 1e-9 in EVERY period. The probe is
  // a DELIBERATELY MODIFIED in-memory copy — its content hash differs from the
  // embedded datasetHash by construction, so hash verification is disabled FOR
  // THE PROBE ONLY (the pristine file was hash-verified above). This does not
  // weaken any assertion: the probe tests index continuity, not input integrity.
  const probeDs = JSON.parse(raw) as Dataset;
  for (const p of probeDs.periods) for (const id of Object.keys(p.priceRelative)) p.priceRelative[id] = 1.0;
  const probeRun = runLifecycleSimulation(probeDs, { verifyHash: false });
  const maxProbeChange = Math.max(...probeRun.commits.map((c) => Math.abs(c.index.relativeChange)));
  const probeFinal = Math.abs(probeRun.summary.finalIndexLevel - 1);
  // (e) exactly one divisor record per mandated boundary event (IDX-CONT-4 style)
  const boundaryLabels = ["T3:CCY-CHF", "T5:CCY-GBP", "T6:CCY-GBP", "T7:CCY-EUR", "T8:CCY-EUR", "T5:CCY-JPY", "T6:CCY-JPY"];
  const labelCounts = boundaryLabels.map((lbl) => rec.divisorRecords.filter((d) => d.eventLabels.includes(lbl)).length);
  const labelsOk = labelCounts.every((n) => n === 1);
  // composition-only delta at the second exit-glide boundary (P17), measured
  // on the flat-price probe so it isolates the composition change from prices
  const glideStartChange = Math.abs(probeRun.commits.find((c) => c.period === 17)!.index.relativeChange);
  const pass =
    allUnit &&
    boundaryChange <= P.indexContinuityTolerance &&
    maxIdentity <= P.indexEquivalenceTolerance &&
    maxEquiv <= P.indexEquivalenceTolerance &&
    maxProbeChange <= P.indexContinuityTolerance &&
    probeFinal <= P.indexContinuityTolerance &&
    glideStartChange <= P.indexContinuityTolerance &&
    labelsOk;
  record(
    "DR-06",
    "index continuous across the membership transition: with unchanged prices the composition-only index change ≤ 1e-9 (chain-link adjustment factor applied)",
    pass,
    `P8 (membership-transition boundary commit, glide period 1) has all price relatives = 1.000000 by construction; observed |I_P8/I_P7 − 1| = ${boundaryChange.toExponential(3)} ≤ 1e-9; second exit-glide boundary P17 composition-only |ΔI| (flat-price probe) = ${glideStartChange.toExponential(3)}; §2.2 zero-artificial-return identity max |D_t·B^+ − B^−| = ${maxIdentity.toExponential(3)} over ${rec.divisorRecords.length} divisor records; applied-adjustment level vs §9.2 recursion max |Δ| = ${maxEquiv.toExponential(3)}; flat-price probe (all relatives 1.0, all ${probeRun.commits.length} periods): max |ΔI| = ${maxProbeChange.toExponential(3)}, |I_final − 1| = ${probeFinal.toExponential(3)} — the entire membership history (entry + two exclusions + suspension) produced zero composition-only index movement; exactly one divisor record per boundary label ${boundaryLabels.join(", ")}: counts ${labelCounts.join(",")}`,
  );
}

// ===========================================================================
// DR-07 — full decision reproducible from versioned inputs + methodology
// ===========================================================================
{
  const serA = serializeDecisionRecord(runA);
  const serB = serializeDecisionRecord(runB);
  const byteIdentical = serA === serB;
  const digestA = decisionRecordDigest(runA);
  // modified input → different dataset hash AND different decision record.
  // Deliberately modified in-memory copies: hash verification is disabled for
  // them (a different content hash is the EXPECTED outcome of the
  // modification, not an integrity failure); the pristine file was hash-
  // verified above and both pristine runs verify in-run.
  const modDs = JSON.parse(raw) as Dataset;
  modDs.periods[4].scores["CCY-GBP"].liquidity += 0.01;
  const modHash = computeDatasetHash(modDs);
  const modRun = runLifecycleSimulation(modDs, { verifyHash: false });
  const modDigest = decisionRecordDigest(modRun);
  const hashDiffers = modHash !== datasetA.datasetHash;
  const recordDiffers = modDigest !== digestA;
  const modStillRetires = modRun.transitions.some((t) => t.componentId === "CCY-GBP" && t.ruleId === "T5");
  // registry-dynamism probe: 6-member universe (drop CCY-XXX + CCY-SGD) —
  // no fixed-size arrays, no slot positions, shared-component paths identical
  const probeDs = JSON.parse(raw) as Dataset;
  probeDs.universe = probeDs.universe.filter((u) => u.id !== "CCY-XXX" && u.id !== "CCY-SGD");
  delete probeDs.genesis.weightsBp["CCY-XXX"];
  delete probeDs.genesis.weightsBp["CCY-SGD"];
  const probeRun6 = runLifecycleSimulation(probeDs, { verifyHash: false });
  const shared = ["CCY-USD", "CCY-EUR", "CCY-JPY", "CCY-GBP", "CCY-CHF", "CCY-AUD"];
  const seqOf = (r: DecisionRecord) =>
    shared.map((id) => transitionsOf(r, id).map((t) => `${t.period}:${t.ruleId}:${t.toState}`).join(";"));
  const seqIdentical = JSON.stringify(seqOf(probeRun6)) === JSON.stringify(seqOf(rec));
  const weightsIdentical = probeRun6.commits.every((c, i) =>
    shared.every((id) => c.weightsBp[id] === rec.commits[i].weightsBp[id]),
  );
  const pass =
    byteIdentical &&
    hashDiffers &&
    recordDiffers &&
    modStillRetires &&
    seqIdentical &&
    weightsIdentical &&
    probeRun6.summary.maxSumDeviation <= P.sumTolerance;
  record(
    "DR-07",
    "the full decision is reproducible from versioned input data + methodology (byte-identical double run; input change → different record; count-agnostic registry)",
    pass,
    `two in-process runs from two independent parses: decision records byte-identical (${serA.length} chars, digest ${digestA}); perturbed input (CCY-GBP P4 liquidity +0.01): datasetHash ${modHash !== datasetA.datasetHash ? "differs" : "SAME"} and decision digest ${modDigest !== digestA ? "differs" : "SAME"} (narrative robust: GBP still retires); 6-member-universe probe (CCY-XXX/CCY-SGD removed): runs clean, shared-component transition sequences identical, shared-component weight paths byte-identical across all ${probeRun6.commits.length} commits — no fixed array size, no slot position, no '!== 7'-style count assumption`,
  );
}

// ===========================================================================
// DR-08 — insufficiently qualified candidates are NOT admitted
// ===========================================================================
{
  const xxxAlwaysCandidate = rec.commits.every((c) => c.states["CCY-XXX"] === "CANDIDATE" && c.weightsBp["CCY-XXX"] === 0);
  const audNeverAdmitted = !rec.transitions.some((t) => t.componentId === "CCY-AUD" && (t.ruleId === "T2" || t.ruleId === "T3"));
  const xxxNeverAdmitted = !rec.transitions.some((t) => t.componentId === "CCY-XXX" && (t.ruleId === "T2" || t.ruleId === "T3"));
  const audWeightZero = rec.commits.every((c) => c.weightsBp["CCY-AUD"] === 0);
  const evalsFor = (trigger: string) => rec.universeEvaluations.filter((e) => e.triggerEvent.includes(trigger)).flatMap((e) => e.evaluations);
  const audRejections = evalsFor("T5:CCY-GBP").concat(evalsFor("T5:CCY-JPY")).filter((e) => e.componentId === "CCY-AUD");
  const xxxRejections = evalsFor("T5:CCY-GBP").concat(evalsFor("T5:CCY-JPY")).filter((e) => e.componentId === "CCY-XXX");
  const audReasonOk = audRejections.length >= 2 && audRejections.every((e) => e.verdict === "NOT-ADMITTED" && e.reasons.some((r) => r.includes("θ_in")));
  const xxxReasonOk = xxxRejections.length >= 2 && xxxRejections.every((e) => e.verdict === "NOT-ADMITTED" && e.reasons.some((r) => r.includes("hard gates failed")));
  // directive negative controls: engine rejected governance attempts that
  // lacked the required rule records
  const rejT3 = rec.directiveOutcomes.find((d) => d.type === "T3-CONFIRM" && d.componentId === "CCY-AUD");
  const rejT5 = rec.directiveOutcomes.find((d) => d.type === "T5-CONFIRM" && d.componentId === "CCY-USD");
  const rejOk =
    rejT3 !== undefined && rejT3.applied === false && rejT3.reasons.some((r) => r.includes("no T2 record")) &&
    rejT5 !== undefined && rejT5.applied === false && rejT5.reasons.some((r) => r.includes("no completed exit-window docket"));
  const pass = xxxAlwaysCandidate && xxxNeverAdmitted && audNeverAdmitted && audWeightZero && audReasonOk && xxxReasonOk && rejOk;
  record(
    "DR-08",
    "insufficiently qualified candidates are not admitted — rejections recorded with reasons; unsupported governance directives rejected",
    pass,
    `CCY-XXX: CANDIDATE and 0 bp in all ${rec.commits.length} commits; rejection reasons at the P7/P16 universe evaluations: "${xxxRejections[0]?.reasons.join(" + ")}"; CCY-AUD: never ELIGIBLE/ACTIVE, 0 bp always; rejections at P7/P16: composite ${audRejections[0]?.composite.toFixed(5)} < θ_in ${P.thetaIn}; directive negative controls: premature T3 for AUD at P7 REJECTED ("${rejT3?.reasons[0]}; ${rejT3?.reasons[1]}"), unsupported T5 for USD at P10 REJECTED ("${rejT5?.reasons[1] ?? rejT5?.reasons[0]}") — admission/retirement cannot be forced without the rule records`,
  );
}

// ===========================================================================
// DR-09 — temporary deterioration triggers WATCH, NOT retirement
// ===========================================================================
{
  const jpyT4s = transitionsOf(rec, "CCY-JPY").filter((t) => t.ruleId === "T4");
  const firstT4 = jpyT4s[0];
  const recovery = transitionsOf(rec, "CCY-JPY").find((t) => t.ruleId === "T4R-WATCH-RECOVERY" && t.period === 7);
  const earlyT5 = transitionsOf(rec, "CCY-JPY").find((t) => t.ruleId === "T5" && t.period < 13);
  const dipScores = [5, 6].map((p) => compositeScore(datasetA.periods[p].scores["CCY-JPY"]));
  const dipAboveExit = dipScores.every((s) => s >= P.thetaOut);
  const pass = firstT4 !== undefined && firstT4.period === 5 && recovery !== undefined && earlyT5 === undefined && dipAboveExit;
  record(
    "DR-09",
    "temporary deterioration triggers WATCH but NOT retirement (hysteresis: warning band ≠ exit window)",
    pass,
    `CCY-JPY dip P5-P6 composites ${dipScores.map((s) => s.toFixed(5)).join(", ")} < warning ${P.warningThreshold} but ≥ θ_out ${P.thetaOut} — T4→WATCH at P${firstT4?.period}, T4R recovery → ACTIVE at P${recovery?.period}; no T5 docket/confirmation for JPY before P13 (first JPY T5 is at ${transitionsOf(rec, "CCY-JPY").find((t) => t.ruleId === "T5")?.period}); JPY held weight throughout the WATCH episode (P5=${rec.commits.find((c) => c.period === 5)!.weightsBp["CCY-JPY"]} bp, P7=${rec.commits.find((c) => c.period === 7)!.weightsBp["CCY-JPY"]} bp)`,
  );
}

// ===========================================================================
// DR-10 — no substitution when no excluded candidate qualifies
// ===========================================================================
{
  const ev = rec.universeEvaluations.find((e) => e.triggerEvent.includes("T5:CCY-JPY"));
  const plan = rec.glidePlans.find((g) => g.retiringIds.includes("CCY-JPY"));
  const noAdmission = ev !== undefined && ev.evaluations.every((e) => e.verdict === "NOT-ADMITTED");
  const noT3 = !rec.transitions.some((t) => t.ruleId === "T3" && t.period >= 16);
  const basketShrinks =
    rec.commits.find((c) => c.period === 16) !== undefined &&
    rec.summary.finalBasketIds.length === 3 &&
    datasetA.universe.filter((u) => u.initialStatus === "ACTIVE").length === 4;
  const pass =
    ev !== undefined &&
    noAdmission &&
    noT3 &&
    plan !== undefined &&
    plan.entrantIds.length === 0 &&
    plan.redistributionRule.includes("§5.4") &&
    ev.substitutionDecision.startsWith("NO SUBSTITUTION") &&
    basketShrinks;
  const audEv = ev?.evaluations.find((e) => e.componentId === "CCY-AUD");
  record(
    "DR-10",
    "no substitution when no excluded candidate satisfies the entry conditions — retirement shrinks the basket, §5.4 pro-rata redistribution",
    pass,
    `at the CCY-JPY T5 boundary (P16) the whole candidate universe was evaluated: ${ev?.evaluations.map((e) => `${e.componentId} ${e.composite.toFixed(4)} ${e.verdict}`).join("; ")} → "${ev?.substitutionDecision}"; AUD reason: composite ${audEv?.composite.toFixed(5)} < θ_in ${P.thetaIn} (streak ${audEv?.qualifyingStreak}/${audEv?.entryPersistenceRequired}); no T3 transition at/after P16; exit glide has entrantIds=[] and redistributionRule "${plan?.redistributionRule}"; basket 4 → 3 members (final {${rec.summary.finalBasketIds.join(", ")}})`,
  );
}

// ===========================================================================
// DR-11 — both/all incumbents remain when they qualify
// ===========================================================================
{
  const c7 = rec.commits.find((c) => c.period === 7)!;
  const c10 = rec.commits.find((c) => c.period === 10)!;
  const c16 = rec.commits.find((c) => c.period === 16)!;
  const cLast = rec.commits[rec.commits.length - 1]!;
  const usd7ok = c7.states["CCY-USD"] === "ACTIVE" && c7.compositeScores["CCY-USD"] >= P.thetaIn && c7.weightsBp["CCY-USD"] > 0;
  const eur7ok = c7.states["CCY-EUR"] === "ACTIVE" && c7.compositeScores["CCY-EUR"] >= P.thetaIn && c7.weightsBp["CCY-EUR"] > 0;
  const retainedThroughGbpExit = c10.states["CCY-USD"] === "ACTIVE" && c10.weightsBp["CCY-USD"] > 0 && c10.states["CCY-EUR"] === "ACTIVE" && c10.weightsBp["CCY-EUR"] > 0;
  const usd16ok = c16.states["CCY-USD"] === "ACTIVE" && c16.compositeScores["CCY-USD"] >= P.thetaIn;
  const eur16ok = c16.states["CCY-EUR"] === "ACTIVE" && c16.compositeScores["CCY-EUR"] >= P.thetaIn;
  const chf16ok = c16.states["CCY-CHF"] === "ACTIVE" && c16.compositeScores["CCY-CHF"] >= P.thetaIn;
  const retainedThroughJpyExit = cLast.states["CCY-USD"] === "ACTIVE" && cLast.weightsBp["CCY-USD"] > 0 && cLast.states["CCY-EUR"] === "ACTIVE" && cLast.weightsBp["CCY-EUR"] > 0 && cLast.states["CCY-CHF"] === "ACTIVE" && cLast.weightsBp["CCY-CHF"] > 0;
  const retiredSet = rec.summary.exclusions.map((e) => e.componentId).sort().join(",");
  const onlyBreachersRetired = retiredSet === "CCY-GBP,CCY-JPY";
  const pass = usd7ok && eur7ok && retainedThroughGbpExit && usd16ok && eur16ok && chf16ok && retainedThroughJpyExit && onlyBreachersRetired;
  record(
    "DR-11",
    "all incumbents whose scores qualify remain in the basket at every membership decision",
    pass,
    `at the GBP retirement decision (P7): USD ${c7.compositeScores["CCY-USD"].toFixed(4)} and EUR ${c7.compositeScores["CCY-EUR"].toFixed(4)} both ≥ θ_in ${P.thetaIn} → both retained (ACTIVE with weight through P10); at the JPY retirement decision (P16): USD ${c16.compositeScores["CCY-USD"].toFixed(4)}, EUR ${c16.compositeScores["CCY-EUR"].toFixed(4)}, CHF ${c16.compositeScores["CCY-CHF"].toFixed(4)} all ≥ θ_in → all retained through P19 (the final commit); retired set = {${retiredSet}} — exactly the two components that completed exit windows, no healthy incumbent removed`,
  );
}

// ===========================================================================
// DR-12 — entrant deteriorates below eligibility during the ramp (handled, not silent)
// ===========================================================================
{
  const midT4 = transitionsOf(rec, "CCY-CHF").find((t) => t.ruleId === "T4" && t.period >= 8 && t.period <= 10);
  const plan = rec.glidePlans.find((g) => g.entrantIds.includes("CCY-CHF"));
  const completed = plan !== undefined && plan.completedPeriod !== null;
  const immutableNote = midT4 !== undefined && midT4.authorityNote.includes("ENTRY-RAMP-IMMUTABILITY");
  const c10 = rec.commits.find((c) => c.period === 10)!;
  const postCompletionWatch = c10.states["CCY-CHF"] === "WATCH";
  const recovery = transitionsOf(rec, "CCY-CHF").find((t) => t.ruleId === "T4R-WATCH-RECOVERY");
  const endpointReached = plan !== undefined && Math.abs(c10.weightsBp["CCY-CHF"] - plan.wEndBp["CCY-CHF"]) <= 1;
  const dipScores = [8, 9, 10].map((p) => rec.commits.find((c) => c.period === p)!.compositeScores["CCY-CHF"]);
  const pass = midT4 !== undefined && completed && immutableNote && postCompletionWatch && endpointReached && recovery !== undefined && dipScores.every((s) => s < P.thetaIn);
  record(
    "DR-12",
    "entrant falls below eligibility during the transition — transition handled explicitly (completion with post-completion WATCH), NOT silent, NOT aborted",
    pass,
    `CCY-CHF mid-ramp composites P8-P10 ${dipScores.map((s) => s.toFixed(5)).join(", ")} < warning ${P.warningThreshold} (and < θ_in ${P.thetaIn}) → T4→WATCH at P${midT4?.period} with the recorded rule "ENTRY-RAMP-IMMUTABILITY" (spec §5.6 in-flight immutability; §12 draft: WATCH is informational); ramp COMPLETED on schedule (N=${plan?.nPeriods}, endpoint ${plan?.wEndBp["CCY-CHF"]} bp reached at P${plan?.completedPeriod}); post-completion state WATCH at P10 (explicit, not silent); T4R recovery → ACTIVE at P${recovery?.period} after the score returned above the warning threshold`,
  );
}

// ===========================================================================
// DR-13 — emergency suspension on data-integrity risk (T7)
// ===========================================================================
{
  const t7 = transitionOf(rec, "CCY-EUR", "T7");
  const c11 = rec.commits.find((c) => c.period === 11)!;
  const c12 = rec.commits.find((c) => c.period === 12)!;
  const c13 = rec.commits.find((c) => c.period === 13)!;
  const healthyAtSuspension = c12.compositeScores["CCY-EUR"] >= P.thetaIn;
  // IMMEDIATE freeze: the pre-trigger committed value (P11) is held through the
  // suspension commits P12 AND P13 — no re-optimization, no zeroing.
  const frozenExact =
    c11.weightsBp["CCY-EUR"] === c12.weightsBp["CCY-EUR"] &&
    c12.weightsBp["CCY-EUR"] === c13.weightsBp["CCY-EUR"];
  const legPinned12 = c12.index.pinnedLegs.includes("CCY-EUR");
  const legPinned13 = c13.index.pinnedLegs.includes("CCY-EUR");
  const rec12 = rec.divisorRecords.find((d) => d.period === 12 && d.eventLabels.includes("T7:CCY-EUR"));
  const immediate = t7 !== undefined && t7.fromState === "ACTIVE" && t7.toState === "EMERGENCY-SUSPENDED" && !t7.thresholdComparisons.length;
  const summaryFrozen = rec.summary.suspensions.length === 1 && rec.summary.suspensions[0].frozenWeightBp === c12.weightsBp["CCY-EUR"];
  const pass = t7 !== undefined && immediate && healthyAtSuspension && frozenExact && legPinned12 && legPinned13 && summaryFrozen && rec12 !== undefined;
  record(
    "DR-13",
    "emergency suspension on data-integrity risk: immediate, NOT score-driven, weight frozen at the pre-trigger value, price leg pinned fail-closed, boundary recorded",
    pass,
    `T7 at P${t7?.period}: ACTIVE → EMERGENCY-SUSPENDED with cause "${t7?.hardGateEvidence}"; zero threshold comparisons evaluated (bypasses ordinary hysteresis by construction) and the component's composite at suspension was ${c12.compositeScores["CCY-EUR"].toFixed(5)} ≥ θ_in ${P.thetaIn} — healthy — proving the trigger is data-integrity-driven, not score-driven; weight FROZEN at the pre-trigger committed value and held EXACTLY through the suspension (P11 ${c11.weightsBp["CCY-EUR"]} bp === P12 ${c12.weightsBp["CCY-EUR"]} bp === P13 ${c13.weightsBp["CCY-EUR"]} bp); EUR price leg pinned to rel = 1.0 at BOTH suspension commits P12 and P13 (fail-closed non-VALID leg, deliverable-5 §8); summary suspension record frozenWeightBp ${rec.summary.suspensions[0]?.frozenWeightBp} bp matches; exactly one T7-labeled divisor record at P12 (kind "${rec12?.kind}")`,
  );
}

// ===========================================================================
// DR-14 — reinstatement after the required observation window (T8a)
// ===========================================================================
{
  const t8 = transitionOf(rec, "CCY-EUR", "T8a");
  const c13 = rec.commits.find((c) => c.period === 13)!;
  const c14 = rec.commits.find((c) => c.period === 14)!;
  const dur = t8?.thresholdComparisons[0];
  const rec13 = rec.divisorRecords.find((d) => d.period === 13 && d.eventLabels.includes("T8:CCY-EUR"));
  // continuity of MOVEMENT: the first post-reinstatement commit may move only
  // within the ordinary per-component velocity cap — a governed rebalance step,
  // never a discontinuity.
  const postReinstateMove = Math.abs(c14.weightsBp["CCY-EUR"] - c13.weightsBp["CCY-EUR"]);
  const velocityBp = P.velocityPerPeriod * 10000;
  const pass =
    t8 !== undefined &&
    t8.fromState === "EMERGENCY-SUSPENDED" &&
    t8.toState === "ACTIVE" &&
    dur !== undefined &&
    dur.passed &&
    dur.observed <= P.reinstatementWindowPeriods &&
    c14.states["CCY-EUR"] === "ACTIVE" &&
    postReinstateMove <= velocityBp &&
    rec13 !== undefined;
  record(
    "DR-14",
    "controlled reinstatement after the required observation window: T8(a) fast-track within T_rein, frozen weight carried through, governed (velocity-capped) resumption",
    pass,
    `T8(a) at P${t8?.period}: EMERGENCY-SUSPENDED → ACTIVE; suspension duration ${dur?.observed} period(s) ≤ T_rein ${P.reinstatementWindowPeriods} (PROTOTYPE-CHOICE: ≤ on a monthly grid; spec draft is strict < on days); cause-resolved evidence recorded ("${t8?.hardGateEvidence}"); state ACTIVE from P14 with the frozen value carried through the suspension (P13 ${c13.weightsBp["CCY-EUR"]} bp → P14 ${c14.weightsBp["CCY-EUR"]} bp — a governed move of ${postReinstateMove} bp within the velocity cap Δ ${velocityBp} bp, i.e. ordinary rebalancing resumes without any jump or glide); exactly one T8-labeled divisor record at P13`,
  );
}

// ===========================================================================
// DR-15 — explicit id mapping: zero-weight enforcement + sum preservation
//          (validation-doc §7 rows 9/10) are DR-04/DR-05 — re-asserted jointly
// ===========================================================================
{
  const zeroOk = rec.summary.exclusions.every((e) => rec.finalStates[e.componentId].weightBp === 0);
  const sumOk = rec.commits.every((c) => c.sumBp === 10000 && c.sumDeviation <= P.sumTolerance);
  const exclusionsAtBoundary = rec.summary.exclusions.map((e) => {
    const at = rec.commits.find((c) => c.period === e.excludedAtPeriod)!;
    return `${e.componentId}: weight at exclusion commit = ${at.weightsBp[e.componentId]} bp (exactly 0), vector sum at that commit = ${at.sumBp} bp (exactly 100%)`;
  });
  const pass = zeroOk && sumOk;
  record(
    "DR-15",
    "id mapping: validation-doc §7 'Zero-weight enforcement for an excluded component' == DR-04 and 'Exact weight-sum preservation throughout the entire transition' == DR-05 — both re-verified",
    pass,
    `mapping is explicit: DR-04 covers the exclusion-zero row, DR-05 covers the sum-preservation row; joint re-check at every exclusion boundary: ${exclusionsAtBoundary.join(" | ")}; all ${rec.commits.length} commits sum-exact, max deviation ${rec.summary.maxSumDeviation.toExponential(3)}`,
  );
}

// ---------------------------------------------------------------------------
// Write results + run log
// ---------------------------------------------------------------------------
const allPassed = RESULTS.every((r) => r.pass);
const failed = RESULTS.filter((r) => !r.pass);
const payload = {
  runClass: "NON-PRODUCTION prototype acceptance run — MANDATE-007 §3 (dynamic currency replacement). SIMULATED data only. NOT ACCEPTED.",
  datasetHash: datasetA.datasetHash,
  datasetHashVerified: datasetHashComputed === datasetA.datasetHash,
  methodologyVersion: datasetA.methodology.version,
  engineModule: "constituency-lifecycle.ts",
  decisionRecordDigest: decisionRecordDigest(rec),
  decisionRecordChars: serializeDecisionRecord(rec).length,
  assertions: RESULTS.map((r) => ({ id: r.id, name: r.name, pass: r.pass, observed: r.observed })),
  counts: { total: RESULTS.length, passed: RESULTS.filter((r) => r.pass).length, failed: failed.length },
  allPassed,
  exitCode: allPassed ? 0 : 1,
};
writeFileSync(resultsPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

const nowIso = new Date().toISOString();
log("");
log("================================================================================================");
log(`run complete — ${payload.counts.passed}/${payload.counts.total} assertions passed, ${payload.counts.failed} failed`);
log(`results: ${resultsPath}`);
log(`run-log: ${logPath} (appended)`);
log(`wall-clock (NOT part of results-e2e.json): ${nowIso}`);
log(`posture: TESTNET ONLY · SHADOW MODE ENFORCED · NON-PRODUCTION · parameters UNAPPROVED DRAFT · NOT ACCEPTED`);
appendFileSync(logPath, `# run ${nowIso} — exit ${payload.exitCode} — ${payload.counts.passed}/${payload.counts.total} PASS — datasetHash ${datasetA.datasetHash} — decisionDigest ${payload.decisionRecordDigest}\n` + LOG_LINES.join("\n") + "\n\n", "utf8");

process.exit(allPassed ? 0 : 1);
