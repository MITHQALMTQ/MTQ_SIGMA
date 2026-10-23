// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — the LIFECYCLE SIMULATION
//        (spec §3 T1–T9 + emergency overlay, §5 weight pipeline, deliverable-5
//        §2.2 chain-link continuity, §4.3 append-only ledger)
// ============================================================================
// FAITHFUL PRODUCTION PORT of the ALREADY-VALIDATED prototype:
//   audit-work/task13/evidence/dynamic-replacement/constituency-lifecycle.ts
//   (MANDATE-007 §3: 15/15 assertions DR-01..DR-15 on both official runs,
//   exit 0, double-run deterministic, 6-member-universe probe byte-identical).
//   The production runner (src/lib/mtq/__tests__/dynamic-membership.ts
//   PORT-01) asserts this port reproduces the prototype's decision-record
//   digest byte-for-byte on the same versioned dataset — semantic fidelity is
//   thereby PROVEN, not asserted rhetorically. Per-rule provenance comments
//   cite the prototype line range + the spec §.
//
// RULES PORTED (unchanged semantics — every §13 parameter is an UNAPPROVED
// DRAFT named constant in parameters.ts):
//   * Map-keyed runtime components (NO fixed-size arrays, NO slot positions,
//     NO identifier reuse — prototype:552-579);
//   * score-driven transitions T2 (entry persistence window + hard gates +
//     hysteresis θ_in > θ_out), T2-EXPIRY, T4 (warning band), T4R recovery,
//     T5 docketing (exit persistence window) — prototype:874-989;
//   * evidence-checked governance directives T3/T5/T7/T8/T9 with REJECTED
//     directives recorded (spec §3 evidence rows — prototype:991-1141);
//   * whole-universe evaluation at every membership event (validation doc §4
//     behavior 3 — prototype:670-710);
//   * §5.1 pipeline: domain target → envelope clamp + renormalize → ρ-smooth
//     → velocity + turnover clamps → §5.3 bp largest-remainder rounding →
//     commit (prototype:1173-1283);
//   * §5.4 pro-rata exit endpoints with cap repair + the EXCLUSION-ZERO
//     guarantee (excluded ⇒ exactly 0 bp; no positive floor ever applies —
//     prototype:786-811, 1327-1352);
//   * §5.5 linear deterministic glides with derived N = ceil(maxMove/Δ)
//     (prototype:813-855, 1184-1198);
//   * T7 IMMEDIATE freeze + fail-closed leg-pin (spec §3 T7; §5.6 freeze
//     alternative) and T8(a) fast-track reinstatement (prototype:1069-1138);
//   * deliverable-5 §2.2 chain-link continuity: D_t = B^-/B^+ divisor records,
//     the zero-artificial-return identity |D·B^+ − B^-| ≤ 1e-12, and the
//     disclosed (not asserted) recursion-vs-level-form residual
//     (prototype:1354-1420);
//   * registry content-hash versioning + append-only commit records with
//     deterministic serialization + digests (prototype:1422-1476).
//
// QUIESCENCE: this engine is a PURE FUNCTION of (dataset). The production
// default state (DEFAULT_REGISTRY) has NO directives and NO scoring feeds —
// nothing here can fire in the default engine path. The machinery exists;
// transitions occur only when a governance directive with valid evidence is
// supplied in the input dataset.
// ============================================================================

import { canonicalSerialize, computeDatasetHash, sha256Base64Url } from "./serialization";
import { compositeScore, evaluateHardGates, type HardGateResult } from "./scoring";
import { hhiOf, roundToBp, sumRecord, TOTAL_BP } from "./weights";
import type {
  CandidateEvaluation,
  Dataset,
  DecisionRecord,
  DirectiveOutcomeRecord,
  DivisorRecord,
  GlidePlanRecord,
  LifecycleState,
  PeriodCommitRecord,
  ScoreInputs,
  ThresholdComparison,
  TransitionRecord,
  UniverseEvaluationRecord,
} from "./types";

// ---------------------------------------------------------------------------
// Engine internals — runtime component model
// Prototype: constituency-lifecycle.ts:439-474.
// ---------------------------------------------------------------------------

interface ComponentRuntime {
  registryId: number;
  id: string;
  displayCode: string;
  name: string;
  status: LifecycleState;
  statusSincePeriod: number;
  envelope: { min: number; max: number };
  velocityPerPeriod: number;
  committedBp: number;
  entryQualifyingStreak: number;
  exitBreachStreak: number;
  warningBreachStreak: number;
  watchRecoveryStreak: number;
  t2CompletedPeriod: number | null;
  docket: { completedPeriod: number; windowPeriods: number[]; windowScores: number[] } | null;
  suspension: { cause: string; frozenBp: number; triggerPeriod: number; firstFrozenCommitPeriod: number; authority: string } | null;
  freezeWindow: { fromPeriod: number; toPeriodInclusive: number; frozenBp: number } | null;
  reinstatedAtPeriod: number | null;
  glideRole: "ENTRANT" | "RETIRING" | null;
  dossierRef: string | null;
}

interface PendingGlide {
  retiringIds: string[];
  entrantIds: string[];
  scheduledPeriod: number;
  startPeriod: number;
  reason: string;
  eventLabels: string[];
}

interface GlideRuntime extends GlidePlanRecord {
  endPeriod: number;
  frozenIds: string[];
}

export interface RunOptions {
  /** Hash verification is enforced by default. It is disabled ONLY for
   *  deliberately modified in-memory probe copies (flat-price probe,
   *  perturbed input, 6-member universe) whose content hash differs by
   *  construction — the pristine dataset is always hash-verified at load. */
  verifyHash?: boolean;
}

// ---------------------------------------------------------------------------
// The simulation — pure function of dataset (+ methodology version).
// Prototype: constituency-lifecycle.ts:537-1553 (verified 15/15 twice).
// ---------------------------------------------------------------------------
export function runLifecycleSimulation(dataset: Dataset, opts: RunOptions = {}): DecisionRecord {
  if (opts.verifyHash !== false) {
    const h = computeDatasetHash(dataset);
    if (h !== dataset.datasetHash) {
      throw new Error(`datasetHash mismatch: file says ${dataset.datasetHash}, content hashes to ${h}`);
    }
  }
  const P = dataset.parameters;
  const METHODOLOGY = dataset.methodology.version;
  const epochMs = Date.parse(P.fixedEpochIso);
  const periodMs = P.periodLengthDays * 24 * 3600 * 1000;
  const velocityBp = Math.round(P.velocityPerPeriod * TOTAL_BP);
  const turnoverCapBp = Math.round(P.weightTurnoverCapPerPeriod * TOTAL_BP);
  const singleCapBp = Math.round(P.singleComponentCap * TOTAL_BP);

  // Registry construction — Map keyed by stable ID; registry IDs never
  // recycled (prototype:552-579; spec §2 uniqueness invariants).
  const usedRegistryIds = new Set<number>();
  const comps = new Map<string, ComponentRuntime>();
  for (const u of dataset.universe) {
    if (usedRegistryIds.has(u.registryId)) throw new Error(`registryId ${u.registryId} reused — component IDs are never recycled`);
    usedRegistryIds.add(u.registryId);
    comps.set(u.id, {
      registryId: u.registryId,
      id: u.id,
      displayCode: u.displayCode,
      name: u.name,
      status: u.initialStatus,
      statusSincePeriod: 0,
      envelope: u.envelope,
      velocityPerPeriod: u.velocityPerPeriod,
      committedBp: 0,
      entryQualifyingStreak: 0,
      exitBreachStreak: 0,
      warningBreachStreak: 0,
      watchRecoveryStreak: 0,
      t2CompletedPeriod: null,
      docket: null,
      suspension: null,
      freezeWindow: null,
      reinstatedAtPeriod: null,
      glideRole: null,
      dossierRef: u.dossierRef,
    });
  }
  const allIds = [...comps.keys()].sort();

  function currentWeightsBp(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of allIds) out[id] = comps.get(id)!.committedBp;
    return out;
  }

  // --- genesis commit -------------------------------------------------------
  // Genesis validation: weights sum to exactly 10000 bp and only ACTIVE
  // components may carry weight (spec §3 state matrix — every non-ACTIVE
  // state is exactly 0). Prototype:588-600.
  for (const id of Object.keys(dataset.genesis.weightsBp)) {
    const c = comps.get(id);
    if (!c) throw new Error(`genesis weight for unknown component ${id}`);
    c.committedBp = dataset.genesis.weightsBp[id];
  }
  const genesisSum = sumRecord(currentWeightsBp());
  if (genesisSum !== TOTAL_BP) throw new Error(`genesis weights sum to ${genesisSum} bp, not ${TOTAL_BP}`);
  for (const c of comps.values()) {
    if (c.status !== "ACTIVE" && c.committedBp !== 0) {
      throw new Error(`non-ACTIVE component ${c.id} carries genesis weight ${c.committedBp}`);
    }
  }

  // --- engine state ----------------------------------------------------------
  const transitions: TransitionRecord[] = [];
  const directiveOutcomes: DirectiveOutcomeRecord[] = [];
  const universeEvaluations: UniverseEvaluationRecord[] = [];
  const glidePlans: GlidePlanRecord[] = [];
  const divisorRecords: DivisorRecord[] = [];
  const commits: PeriodCommitRecord[] = [];
  // frozen-weight snapshots taken AT T7 time (the summary must report the
  // suspension-time frozen value, not the end-of-run committed weight — the
  // component is normally reinstated long before the run ends). Prototype:609-612.
  const suspensionSnapshots: Array<{ componentId: string; period: number; frozenBp: number }> = [];
  let activeGlide: GlideRuntime | null = null;
  let pendingGlide: PendingGlide | null = null;
  // TS control-flow note: `activeGlide` is only ever assigned a non-null plan
  // inside the `schedulePendingGlide` closure below, so the compiler cannot
  // see that assignment at the main-loop read sites and narrows the variable
  // to `null` (then `never`). All main-loop reads therefore go through this
  // getter, which returns the DECLARED union type. Pure read — no behavior
  // change; every mutation still happens through the closure / `= null`.
  // (Same read-getter pattern as the validated prototype:613-623.)
  function currentGlide(): GlideRuntime | null {
    return activeGlide;
  }
  const cumRel: Record<string, number> = {};
  for (const id of allIds) cumRel[id] = 1;
  let cumulativeAdjustment = 1; // G = Π D_t (recorded series, repo convention)
  let recursionLevel = 1; // I_t — the published §9.2 chain-linked level (chain-index.ts:296-316)
  let prevCommittedAll: Record<string, number> = currentWeightsBp();
  let transitionCounter = 0;

  function periodIso(period: number): string {
    return new Date(epochMs + period * periodMs).toISOString();
  }
  function snapHash(componentId: string, period: number, inputs: ScoreInputs): string {
    return sha256Base64Url(
      canonicalSerialize({ componentId, period, scoreInputs: inputs, composite: compositeScore(inputs) }),
    );
  }

  /** Spec §4.3 recording obligation: every transition lands in the append-only
   *  ledger with period, timestamp, from/to state, rule id, the exact
   *  threshold values compared, persistence + hard-gate evidence, the inputs
   *  snapshot hash, and the methodology version. Prototype:639-668. */
  function emitTransition(
    period: number,
    c: ComponentRuntime,
    toState: LifecycleState,
    ruleId: string,
    thresholdComparisons: ThresholdComparison[],
    persistenceEvidence: string,
    hardGateEvidence: string,
    authorityNote: string,
    scoreInputs: ScoreInputs | null,
  ) {
    transitionCounter += 1;
    transitions.push({
      recordId: `TR-${String(transitionCounter).padStart(3, "0")}`,
      period,
      timestampIso: periodIso(period),
      componentId: c.id,
      fromState: c.status,
      toState,
      ruleId,
      thresholdComparisons,
      persistenceEvidence,
      hardGateEvidence,
      inputsSnapshotHash: scoreInputs ? snapHash(c.id, period, scoreInputs) : "n/a (non-score-driven transition)",
      methodologyVersion: METHODOLOGY,
      authorityNote,
    });
    c.status = toState;
    c.statusSincePeriod = period;
  }

  /** Whole-universe evaluation at every membership event (validation doc §4
   *  behavior 3: the entire admissible universe, including eligible currencies
   *  outside the basket, is evaluated). Prototype:670-710. */
  function evaluateUniverse(period: number, triggerEvent: string, admittedIds: string[]): UniverseEvaluationRecord {
    const pd = dataset.periods.find((p) => p.period === period)!;
    const evaluations: CandidateEvaluation[] = [];
    for (const id of allIds) {
      const c = comps.get(id)!;
      if (c.status === "ACTIVE" || c.status === "WATCH" || c.status === "RETIRING" || c.status === "EMERGENCY-SUSPENDED") continue; // basket members are not candidates
      const inputs = pd.scores[id];
      const comp = compositeScore(inputs);
      const gates = evaluateHardGates(inputs, P.hardGates);
      const failedGates = gates.filter((g) => !g.passed).map((g) => `${g.gate}=${g.value.toFixed(2)} (needs ${g.comparator} ${g.threshold})`);
      const allPass = gates.every((g) => g.passed);
      const admitted = admittedIds.includes(id);
      const reasons: string[] = [];
      if (!allPass) reasons.push(`hard gates failed: ${failedGates.join("; ")}`);
      if (comp < P.thetaIn) reasons.push(`composite ${comp.toFixed(4)} < θ_in ${P.thetaIn}`);
      if (allPass && comp >= P.thetaIn && !admitted) {
        reasons.push(`entry persistence incomplete: qualifying streak ${c.entryQualifyingStreak}/${P.entryPersistencePeriods} (T_obs_entry hysteresis window)`);
      }
      evaluations.push({
        componentId: id,
        state: c.status,
        composite: comp,
        qualifyingStreak: c.entryQualifyingStreak,
        entryPersistenceRequired: P.entryPersistencePeriods,
        hardGatesAllPass: allPass,
        failedGates,
        verdict: admitted ? "ADMITTED" : "NOT-ADMITTED",
        reasons,
      });
    }
    const rec: UniverseEvaluationRecord = {
      period,
      triggerEvent,
      evaluations,
      substitutionDecision: admittedIds.length
        ? `SUBSTITUTION: ${admittedIds.join(", ")} admitted through T2→T3`
        : "NO SUBSTITUTION: no excluded candidate satisfies all entry conditions",
    };
    universeEvaluations.push(rec);
    return rec;
  }

  // Deterministic MASE-stand-in target: t_i ∝ S_i² over the domain
  // (PROTOTYPE-CHOICE carried from the validated prototype — the MASE ensemble
  // is NOT part of this module; no effectiveness claim; parameters.ts
  // TARGET_FUNCTION_DRAFT). Prototype:712-727.
  function targetShares(domain: string[], period: number): Record<string, number> {
    const pd = dataset.periods.find((p) => p.period === period)!;
    const raw: Record<string, number> = {};
    let rawSum = 0;
    for (const id of domain) {
      const s = compositeScore(pd.scores[id]);
      const v = s * s;
      raw[id] = v;
      rawSum += v;
    }
    const out: Record<string, number> = {};
    for (const id of domain) out[id] = (raw[id] / rawSum) * TOTAL_BP;
    return out;
  }

  /** Envelope clamp + renormalization to `mass` (spec §5.1 step 2 / §5.2 —
   *  deterministic, iterative; the slack distribution is proportional to
   *  headroom by ID). Prototype:729-762. */
  function clampAndNormalize(
    t: Record<string, number>,
    mass: number,
    envs: Record<string, { min: number; max: number }>,
  ): { out: Record<string, number>; clamped: boolean } {
    const ids = Object.keys(t).sort();
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = t[id];
    let clamped = false;
    for (let iter = 0; iter < 10; iter++) {
      let sum = 0;
      for (const id of ids) {
        const e = envs[id];
        if (out[id] < e.min) { out[id] = e.min; clamped = true; }
        if (out[id] > e.max) { out[id] = e.max; clamped = true; }
        sum += out[id];
      }
      const slack = mass - sum;
      if (Math.abs(slack) < 1e-9) break;
      let headroomTotal = 0;
      const headroom: Record<string, number> = {};
      for (const id of ids) {
        const e = envs[id];
        const h = slack > 0 ? Math.max(0, e.max - out[id]) : Math.max(0, out[id] - e.min);
        headroom[id] = h;
        headroomTotal += h;
      }
      if (headroomTotal <= 0) break;
      for (const id of ids) out[id] += (headroom[id] / headroomTotal) * slack;
    }
    return { out, clamped };
  }

  /** §5.5 glide scheduling: exit endpoints by §5.4 pro-rata redistribution
   *  (renormalizeExcluding convention, chain-index.ts:546-556) with cap
   *  repair, entry endpoints by the post-admission target over the enlarged
   *  ACTIVE set; N derived = ceil(max per-component move / Δ) and clamped to
   *  the §13 bound. Prototype:764-855. */
  function schedulePendingGlide(period: number, pending: PendingGlide) {
    const wStartBp = currentWeightsBp();
    const survivors = allIds.filter((id) => {
      const c = comps.get(id)!;
      return (c.status === "ACTIVE" || c.status === "WATCH") && !pending.retiringIds.includes(id) && !pending.entrantIds.includes(id);
    });
    const wEndBp: Record<string, number> = {};
    for (const id of allIds) wEndBp[id] = 0;
    let repair = false;

    if (pending.entrantIds.length > 0) {
      // §5.5 entry endpoint: post-admission MASE-stand-in target over the
      // enlarged ACTIVE set (entrants in-domain, retiree pinned to 0). The
      // endpoint vector sums to TOTAL_BP exactly — the retiree's end weight is
      // 0 (§5.4 exclusion-zero) and the domain fills the full weight space.
      const domain = [...survivors, ...pending.entrantIds].sort();
      const envs: Record<string, { min: number; max: number }> = {};
      for (const id of domain) envs[id] = { min: comps.get(id)!.envelope.min * TOTAL_BP, max: Math.min(comps.get(id)!.envelope.max * TOTAL_BP, singleCapBp) };
      const shares = targetShares(domain, period);
      const { out, clamped } = clampAndNormalize(shares, TOTAL_BP, envs);
      repair = clamped;
      for (const id of domain) wEndBp[id] = out[id];
    } else {
      // §5.4 exit endpoint: freed weight redistributed pro-rata to surviving
      // ACTIVE components' pre-exit weights (renormalizeExcluding convention,
      // chain-index.ts:546-556): each survivor scales by 1/(1 − Σ retiring) so
      // the endpoint sums to TOTAL_BP exactly. Cap repair per spec §12 draft
      // rule (proportional shave of top offenders, deterministic by ID).
      let acc = 0;
      for (const id of survivors) acc += wStartBp[id];
      if (acc <= 0) throw new Error("glide scheduling: no weight-bearing survivors");
      for (const id of survivors) wEndBp[id] = (wStartBp[id] / acc) * TOTAL_BP;
      for (let iter = 0; iter < 20; iter++) {
        let excess = 0;
        let room = 0;
        for (const id of survivors) {
          const cap = Math.min(comps.get(id)!.envelope.max * TOTAL_BP, singleCapBp);
          if (wEndBp[id] > cap + 1e-9) { excess += wEndBp[id] - cap; wEndBp[id] = cap; repair = true; }
          else room += cap - wEndBp[id];
        }
        if (excess <= 1e-9 || room <= 1e-9) break;
        for (const id of survivors) {
          const cap = Math.min(comps.get(id)!.envelope.max * TOTAL_BP, singleCapBp);
          const r = cap - wEndBp[id];
          if (r > 0) wEndBp[id] += (r / room) * excess;
        }
      }
    }

    // derive N: ceil(max per-component move / Δ), clamped to the bound (spec §5.5)
    let maxMoveBp = 0;
    let maxMoveId = "";
    for (const id of allIds) {
      const mv = Math.abs(wEndBp[id] - wStartBp[id]);
      if (mv > maxMoveBp) { maxMoveBp = mv; maxMoveId = id; }
    }
    const nDerived = Math.ceil(maxMoveBp / velocityBp);
    const n = Math.max(P.glideBoundPeriods[0], Math.min(P.glideBoundPeriods[1], nDerived));
    for (const id of allIds) {
      const perPeriod = Math.abs(wEndBp[id] - wStartBp[id]) / n;
      if (perPeriod > velocityBp + 1e-9) {
        throw new Error(`glide derivation failed: ${id} moves ${perPeriod.toFixed(1)} bp/period > Δ ${velocityBp}`);
      }
    }

    const plan: GlideRuntime = {
      planId: `GLIDE-P${period}`,
      scheduledPeriod: period,
      startPeriod: pending.startPeriod,
      nPeriods: n,
      derivation: `N = ceil(max per-component move ${maxMoveBp.toFixed(0)} bp (component ${maxMoveId}) / Δ ${velocityBp} bp) = ${nDerived}; clamped to bound [${P.glideBoundPeriods[0]}, ${P.glideBoundPeriods[1]}]`,
      reason: pending.reason,
      redistributionRule:
        pending.entrantIds.length > 0
          ? "joint T3-entry + T5-exit glide: single affine interpolation of the whole vector to the post-transition target over the enlarged ACTIVE set (§5.5 entry endpoint; retiree endpoint pinned to 0 per §5.4 exclusion-zero)"
          : "pure exit glide: freed weight redistributed pro-rata to surviving ACTIVE components' pre-exit weights (§5.4 renormalizeExcluding convention); no qualified candidate — no substitution",
      entrantIds: [...pending.entrantIds].sort(),
      retiringIds: [...pending.retiringIds].sort(),
      wStartBp: { ...wStartBp },
      wEndBp: { ...wEndBp },
      perPeriodRawBp: [],
      completedPeriod: null,
      eventLabels: pending.eventLabels,
      endpointCapRepairApplied: repair,
      endPeriod: pending.startPeriod + n - 1,
      frozenIds: [],
    };
    activeGlide = plan;
    glidePlans.push(plan);
    for (const id of pending.retiringIds) comps.get(id)!.glideRole = "RETIRING";
    for (const id of pending.entrantIds) comps.get(id)!.glideRole = "ENTRANT";
  }

  // =========================================================================
  // Main loop over periods
  // Prototype:860-1484.
  // =========================================================================
  for (const pd of dataset.periods) {
    const period = pd.period;
    const boundaryEventLabels: string[] = [];

    // ---- 1. composites + hard gates for the WHOLE universe (behavior 3) ----
    const compNow: Record<string, number> = {};
    const gatesBy: Record<string, HardGateResult[]> = {};
    for (const id of allIds) {
      const inputs = pd.scores[id];
      if (!inputs) throw new Error(`period ${period}: missing scores for ${id}`);
      compNow[id] = compositeScore(inputs);
      gatesBy[id] = evaluateHardGates(inputs, P.hardGates);
    }

    // ---- 2. rule-driven state machine (score-driven transitions only) ------
    // T2 (entry persistence + hard gates + hysteresis θ_in > θ_out), T2-EXPIRY
    // (ELIGIBLE-decay — PROTOTYPE-CHOICE carried over), T4 (warning band),
    // T4R (WATCH recovery — PROTOTYPE-CHOICE carried over), T5 docketing
    // (exit persistence). Prototype:874-989.
    for (const id of allIds) {
      const c = comps.get(id)!;
      const s = compNow[id];
      const gates = gatesBy[id];
      const allPass = gates.every((g) => g.passed);
      const failedGateList = gates.filter((g) => !g.passed).map((g) => `${g.gate} ${g.value} vs ${g.threshold}`).join("; ");

      if (c.status === "CANDIDATE" || c.status === "ELIGIBLE") {
        const qualifies = s >= P.thetaIn && allPass;
        c.entryQualifyingStreak = qualifies ? c.entryQualifyingStreak + 1 : 0;
        c.exitBreachStreak = s < P.thetaOut ? c.exitBreachStreak + 1 : 0;
        if (c.status === "CANDIDATE" && c.entryQualifyingStreak >= P.entryPersistencePeriods) {
          const window: number[] = [];
          const scores: number[] = [];
          for (let k = period - P.entryPersistencePeriods + 1; k <= period; k++) {
            window.push(k);
            const kpd = dataset.periods.find((p) => p.period === k)!;
            scores.push(compositeScore(kpd.scores[id]));
          }
          emitTransition(
            period,
            c,
            "ELIGIBLE",
            "T2",
            [
              { symbol: "S_i", observed: s, threshold: P.thetaIn, comparator: ">=", passed: s >= P.thetaIn },
              { symbol: "H = θ_in − θ_out", observed: P.thetaIn - P.thetaOut, threshold: P.hysteresisBandH, comparator: "==", passed: Math.abs(P.thetaIn - P.thetaOut - P.hysteresisBandH) < 1e-12 },
            ],
            `entry window complete: qualifying streak ${c.entryQualifyingStreak}/${P.entryPersistencePeriods} consecutive periods [${window[0]}..${period}], scores [${scores.map((x) => x.toFixed(4)).join(", ")}] ≥ θ_in ${P.thetaIn} with no hard-gate failure`,
            `hard gates: ${gates.map((g) => `${g.gate} ${g.value.toFixed(2)} ${g.comparator} ${g.threshold} ${g.passed ? "PASS" : "FAIL"}`).join("; ")}`,
            "rule-driven per spec §3 T2 (Risk Council confirms a completed rule window); admission is NOT yet weight-bearing",
            pd.scores[id],
          );
          c.t2CompletedPeriod = period;
          boundaryEventLabels.push(`T2:${id}`);
          evaluateUniverse(period, `T2:${id}`, []);
        }
        // T2-EXPIRY (ELIGIBLE → CANDIDATE when the exit threshold is breached
        // for the full entry window — PROTOTYPE-CHOICE: the ELIGIBLE-decay rule
        // is not T-numbered in spec §3; implemented, not exercised by the
        // validated dataset)
        if (c.status === "ELIGIBLE" && c.exitBreachStreak >= P.entryPersistencePeriods) {
          emitTransition(
            period,
            c,
            "CANDIDATE",
            "T2-EXPIRY",
            [{ symbol: "S_i", observed: s, threshold: P.thetaOut, comparator: "<", passed: s < P.thetaOut }],
            `exit breach streak ${c.exitBreachStreak}/${P.entryPersistencePeriods} while ELIGIBLE — queue entry expired (oscillation guard)`,
            `hard gates: ${failedGateList || "all pass"}`,
            "rule-driven (PROTOTYPE-CHOICE: ELIGIBLE-decay rule not T-numbered in spec §3)",
            pd.scores[id],
          );
          c.t2CompletedPeriod = null;
        }
        continue;
      }

      if (c.status === "ACTIVE" || c.status === "WATCH") {
        const warningBreach = s < P.warningThreshold || !allPass;
        const exitBreach = s < P.thetaOut;
        c.warningBreachStreak = warningBreach ? c.warningBreachStreak + 1 : 0;
        c.exitBreachStreak = exitBreach ? c.exitBreachStreak + 1 : 0;
        if (c.status === "ACTIVE" && c.warningBreachStreak >= P.watchPersistencePeriods) {
          emitTransition(
            period,
            c,
            "WATCH",
            "T4",
            [{ symbol: "S_i", observed: s, threshold: P.warningThreshold, comparator: "<", passed: s < P.warningThreshold }],
            `warning-band breach sustained ${c.warningBreachStreak}/${P.watchPersistencePeriods} period(s) (T_watch); band strictly inside [θ_out, θ_in]`,
            `hard gates: ${failedGateList || "all pass"}`,
            "automatic per spec §3 T4" +
              (c.glideRole === "ENTRANT"
                ? " — ENTRY-RAMP-IMMUTABILITY: the in-flight entry ramp continues unchanged (spec §5.6 in-flight immutability; §12 draft: WATCH is informational for weights); post-completion state re-evaluated by ordinary T4/T4R rules (NOT silent)"
                : ""),
            pd.scores[id],
          );
          boundaryEventLabels.push(`T4:${id}`);
        }
        if (c.status === "WATCH" && !warningBreach) {
          c.watchRecoveryStreak += 1;
          if (c.watchRecoveryStreak >= P.watchRecoveryPeriods) {
            emitTransition(
              period,
              c,
              "ACTIVE",
              "T4R-WATCH-RECOVERY",
              [{ symbol: "S_i", observed: s, threshold: P.warningThreshold, comparator: ">=", passed: s >= P.warningThreshold }],
              `recovery streak ${c.watchRecoveryStreak}/${P.watchRecoveryPeriods} period(s) above the warning threshold — temporary deterioration did NOT escalate (no retirement)`,
              `hard gates: ${failedGateList || "all pass"}`,
              "rule-driven (PROTOTYPE-CHOICE: the WATCH→ACTIVE recovery rule is not T-numbered in spec §3; draft: WATCH is informational per §12)",
              pd.scores[id],
            );
            c.watchRecoveryStreak = 0;
            boundaryEventLabels.push(`T4R:${id}`);
          }
        } else {
          c.watchRecoveryStreak = 0;
        }
        // T5 docketing: exit threshold breached for the full observation window
        if (c.status === "WATCH" && c.exitBreachStreak >= P.exitPersistencePeriods && !c.docket) {
          const window: number[] = [];
          const scores: number[] = [];
          for (let k = period - P.exitPersistencePeriods + 1; k <= period; k++) {
            window.push(k);
            const kpd = dataset.periods.find((p) => p.period === k)!;
            scores.push(compositeScore(kpd.scores[id]));
          }
          c.docket = { completedPeriod: period, windowPeriods: window, windowScores: scores };
        }
        continue;
      }
      // RETIRING / EXCLUDED / EMERGENCY-SUSPENDED: no score-driven transitions
      // (decision made / dossier only / emergency path — spec §3 state matrix)
    }

    // ---- 3. governance directives (SIMULATED, evidence-checked) ------------
    // Every directive's rule preconditions are ENFORCED; rejections are
    // recorded (spec §3 evidence rows). Prototype:991-1141.
    const directives = [...pd.governanceDirectives].sort(
      (a, b) => a.componentId.localeCompare(b.componentId) || a.index - b.index,
    );
    const admittedThisPeriod: string[] = [];
    const retiringConfirmed: string[] = [];
    for (const d of directives) {
      const c = comps.get(d.componentId);
      const reasons: string[] = [];
      let applied = false;
      if (!c) {
        reasons.push(`unknown component ${d.componentId}`);
      } else if (d.type === "T9-RENOMINATION") {
        if (c.status !== "EXCLUDED") reasons.push(`T9 requires EXCLUDED, found ${c.status}`);
        else if (!d.dossierRef) reasons.push("T9 requires a fresh provenance dossier (spec §3 T9)");
        if (reasons.length === 0) {
          emitTransition(
            period,
            c,
            "CANDIDATE",
            "T9",
            [],
            "re-nomination after prior exclusion; a full fresh T1→T2→T3 cycle is required (no automatic re-admission — oscillation guard, spec §3 T9)",
            `dossier ref: ${d.dossierRef}`,
            d.authority,
            null,
          );
          c.docket = null;
          c.t2CompletedPeriod = null;
          c.entryQualifyingStreak = 0;
          applied = true;
          boundaryEventLabels.push(`T9:${d.componentId}`);
        }
      } else if (d.type === "T3-CONFIRM") {
        if (c.status !== "ELIGIBLE") reasons.push(`T3 requires ELIGIBLE (a completed T2 record), found ${c.status} (spec §3 T3 evidence row)`);
        if (c.t2CompletedPeriod === null) reasons.push("no T2 record — admission blocked (spec §4.2: a composite cannot rescue an unevaluated candidate)");
        if (d.effectivePeriod < d.period + 1) reasons.push(`effective period ${d.effectivePeriod} violates the T_ann pre-announcement (≥ ${P.announcementLagPeriods} period(s))`);
        const activeCount = [...comps.values()].filter((x) => x.status === "ACTIVE" || x.status === "WATCH" || x.status === "RETIRING").length;
        if (activeCount + 1 > P.nMax) reasons.push(`N_active ${activeCount} + 1 > N_max ${P.nMax} (spec §5.2/§7)`);
        if (reasons.length === 0) {
          emitTransition(
            period,
            c,
            "ACTIVE",
            "T3",
            [{ symbol: "N_active+1", observed: activeCount + 1, threshold: P.nMax, comparator: "<=", passed: activeCount + 1 <= P.nMax }],
            `pre-announcement recorded at period ${period}; ramp effective period ${d.effectivePeriod} (T_ann ${P.announcementLagPeriods} period(s)); deterministic ramp schedule derived from the glide endpoint and Δ (spec §5.5)`,
            `hard gates at T2 period ${c.t2CompletedPeriod}: all passed`,
            `${d.authority} — membership is governed; individual live weights are never set by discretion (I8, blueprint.ts:128)`,
            null,
          );
          applied = true;
          admittedThisPeriod.push(d.componentId);
          boundaryEventLabels.push(`T3:${d.componentId}`);
        }
      } else if (d.type === "T5-CONFIRM") {
        if (c.status !== "WATCH") reasons.push(`T5 requires WATCH with a completed observation record, found ${c.status}`);
        if (!c.docket) reasons.push(`no completed exit-window docket: exit-breach streak ${c.exitBreachStreak}/${P.exitPersistencePeriods} < required ${P.exitPersistencePeriods} (spec §3 T5 evidence row)`);
        if (reasons.length === 0) {
          const docket = c.docket!;
          emitTransition(
            period,
            c,
            "RETIRING",
            "T5",
            [
              { symbol: "S_i(window end)", observed: compNow[d.componentId], threshold: P.thetaOut, comparator: "<", passed: compNow[d.componentId] < P.thetaOut },
              { symbol: "persistence", observed: docket.windowPeriods.length, threshold: P.exitPersistencePeriods, comparator: ">=", passed: docket.windowPeriods.length >= P.exitPersistencePeriods },
            ],
            `retirement qualified: S_i < θ_out sustained ${docket.windowPeriods.length}/${P.exitPersistencePeriods} consecutive periods [${docket.windowPeriods.join(", ")}], scores [${docket.windowScores.map((x) => x.toFixed(4)).join(", ")}]; WATCH record complete since period ${c.statusSincePeriod}; hysteresis H = ${P.hysteresisBandH} (θ_in ${P.thetaIn} strictly above θ_out ${P.thetaOut})`,
            `hard gates at window end: ${gatesBy[d.componentId].map((g) => `${g.gate} ${g.passed ? "PASS" : "FAIL"}`).join("; ")}`,
            `${d.authority} — governance confirms a rule-completed docket; pre-announcement ≥ T_ann with glide schedule per §5.5/§5.6`,
            null,
          );
          applied = true;
          retiringConfirmed.push(d.componentId);
          boundaryEventLabels.push(`T5:${d.componentId}`);
        }
      } else if (d.type === "T7-EMERGENCY-SUSPENSION") {
        if (c.status !== "ACTIVE" && c.status !== "WATCH" && c.status !== "RETIRING") {
          reasons.push(`T7 path covers ACTIVE/WATCH (and mid-glide RETIRING per the §5.6 interruption clause), found ${c.status}`);
        }
        if (!d.cause) reasons.push("T7 requires a documented trigger event (spec §3 T7)");
        if (reasons.length === 0) {
          const frozenBp = c.committedBp;
          emitTransition(
            period,
            c,
            "EMERGENCY-SUSPENDED",
            "T7",
            [],
            `IMMEDIATE suspension — bypasses ordinary hysteresis (no score condition evaluated or required); composite at suspension ${compNow[d.componentId].toFixed(4)} is irrelevant to the trigger (data-integrity risk, NOT score-driven); weight FROZEN at ${frozenBp} bp (the pre-trigger committed value) from commit period ${period} onward (T7 carries no pre-announcement by definition — spec §3 T7; §5.6 freeze alternative)`,
            `cause: ${d.cause}`,
            `${d.authority} — the emergency path is SEPARATE from normal retirement in trigger authority, evidence standard, notice (none — post-hoc disclosure within 24h), and speed (spec §3 T7, §5.6)`,
            null,
          );
          c.suspension = {
            cause: d.cause ?? "unspecified",
            frozenBp,
            triggerPeriod: period,
            firstFrozenCommitPeriod: period,
            authority: d.authority,
          };
          c.freezeWindow = {
            fromPeriod: period,
            toPeriodInclusive: Number.MAX_SAFE_INTEGER,
            frozenBp,
          };
          suspensionSnapshots.push({ componentId: d.componentId, period, frozenBp });
          // §5.6 interruption clause: a suspended component mid-glide freezes;
          // the remaining glide re-normalizes over the survivors (implemented;
          // the v1 dataset exercises T7 outside a glide — disclosed in the
          // validated prototype's RESULTS.md)
          const glT7 = currentGlide();
          if (glT7 && glT7.endPeriod >= period) {
            if (!glT7.frozenIds.includes(d.componentId)) glT7.frozenIds.push(d.componentId);
          }
          applied = true;
          boundaryEventLabels.push(`T7:${d.componentId}`);
        }
      } else if (d.type === "T8-RESOLUTION") {
        if (c.status !== "EMERGENCY-SUSPENDED") reasons.push(`T8 requires EMERGENCY-SUSPENDED, found ${c.status}`);
        if (!d.causeResolved) reasons.push("T8 requires causeResolved evidence");
        if (c.suspension) {
          const duration = d.period - c.suspension.triggerPeriod;
          if (duration > P.reinstatementWindowPeriods) {
            reasons.push(`fast-track expired: suspension ${duration} period(s) > T_rein ${P.reinstatementWindowPeriods} (spec §3 T8a — after T_rein only a fresh T1→T3 pass may re-admit)`);
          }
        }
        if (reasons.length === 0) {
          const duration = c.suspension ? d.period - c.suspension.triggerPeriod : 0;
          const frozenBp = c.suspension ? c.suspension.frozenBp : c.committedBp;
          emitTransition(
            period,
            c,
            "ACTIVE",
            "T8a",
            [{ symbol: "suspension duration (periods)", observed: duration, threshold: P.reinstatementWindowPeriods, comparator: "<=", passed: duration <= P.reinstatementWindowPeriods }],
            `cause resolved; suspension duration ${duration} period(s) ≤ T_rein ${P.reinstatementWindowPeriods} (PROTOTYPE-CHOICE: ≤ on a monthly grid; the spec draft is strict < on days) — fast-track reinstatement to ACTIVE; the weight carried through the suspension is the pre-trigger frozen value (${frozenBp} bp), resumed with no glide and no jump; from period ${d.effectivePeriod} the component re-enters ordinary velocity/turnover-capped rebalancing`,
            `cause-resolution evidence: ${d.note ?? "recorded in directive"}`,
            `${d.authority} — joint Emergency Council + Risk Council resolution (spec §3 T8)`,
            null,
          );
          if (c.freezeWindow) c.freezeWindow.toPeriodInclusive = d.effectivePeriod - 1;
          c.reinstatedAtPeriod = d.effectivePeriod;
          c.suspension = null;
          applied = true;
          boundaryEventLabels.push(`T8:${d.componentId}`);
        }
      }
      directiveOutcomes.push({ directiveIndex: d.index, period, type: d.type, componentId: d.componentId, applied, reasons });
    }

    // universe evaluation at substitution-relevant events (validation doc §4 behavior 3)
    if (admittedThisPeriod.length > 0 || retiringConfirmed.length > 0) {
      evaluateUniverse(
        period,
        retiringConfirmed.length ? `T5:${retiringConfirmed.join(",")}` : `T3:${admittedThisPeriod.join(",")}`,
        admittedThisPeriod,
      );
    }

    // schedule the glide for transitions confirmed this period
    if (admittedThisPeriod.length > 0 || retiringConfirmed.length > 0) {
      if (pendingGlide) throw new Error(`period ${period}: a glide is already pending (${pendingGlide.reason}) — overlapping transitions are not supported by this engine`);
      pendingGlide = {
        retiringIds: retiringConfirmed,
        entrantIds: admittedThisPeriod,
        scheduledPeriod: period,
        startPeriod: period + 1,
        reason:
          retiringConfirmed.length > 0 && admittedThisPeriod.length > 0
            ? "T3-ENTRY+T5-EXIT-JOINT (substitution: incumbent retires while a previously excluded candidate enters)"
            : retiringConfirmed.length > 0
              ? "T5-EXIT (retirement without substitution: no excluded candidate qualifies)"
              : "T3-ENTRY (admission without a concurrent retirement)",
        eventLabels: [
          ...retiringConfirmed.map((id) => `T5:${id}`),
          ...admittedThisPeriod.map((id) => `T3:${id}`),
        ],
      };
    }

    // ---- 4. weight pipeline (spec §5.1 + §6 retained mechanics) ------------
    // domain target (∝ S²) → envelope clamp + renormalize → ρ-smooth →
    // per-component velocity + aggregate-turnover clamps → bp rounding.
    // Prototype:1173-1276.
    const prevCommitted = { ...prevCommittedAll };
    const glideNow = currentGlide();
    let rawNext: Record<string, number> = {};
    let glideAppliedNow = false;
    let turnoverClampApplied = false;

    if (period === 0) {
      // genesis/base period: commit the genesis vector as-is (no rebalance at
      // the base date — the index anchors here)
      rawNext = { ...prevCommitted };
    } else if (glideNow && period >= glideNow.startPeriod && period <= glideNow.endPeriod) {
      glideAppliedNow = true;
      const k = period - glideNow.startPeriod + 1;
      const N = glideNow.nPeriods;
      const rawCapture: Record<string, number> = {};
      for (const id of allIds) {
        let w = glideNow.wStartBp[id] + (k / N) * (glideNow.wEndBp[id] - glideNow.wStartBp[id]);
        if (glideNow.frozenIds.includes(id)) {
          const cc = comps.get(id)!;
          if (cc.suspension) w = cc.suspension.frozenBp;
        }
        rawNext[id] = w;
        rawCapture[id] = w;
      }
      glideNow.perPeriodRawBp.push(rawCapture);
    } else {
      // normal pipeline: domain target → envelope clamp + renormalize →
      // ρ-smooth → velocity + turnover clamps → bp rounding (§5.1).
      const domain: string[] = [];
      const pinned: Record<string, number> = {};
      let pinnedMass = 0;
      for (const id of allIds) {
        const c = comps.get(id)!;
        if (c.status === "ACTIVE" || c.status === "WATCH") {
          const fz = c.freezeWindow;
          if (fz && period >= fz.fromPeriod && period <= fz.toPeriodInclusive) {
            pinned[id] = fz.frozenBp; // weight frozen at the T7 suspension value
            pinnedMass += fz.frozenBp;
            continue;
          }
          if (pendingGlide && pendingGlide.entrantIds.includes(id)) {
            pinned[id] = 0; // admitted but the ramp is not yet effective — entrant stays at exactly 0
            continue;
          }
          domain.push(id);
        } else if (c.status === "EMERGENCY-SUSPENDED") {
          // spec §3 state matrix: EMERGENCY-SUSPENDED holds its weight FROZEN at
          // the suspension value (the §5.6 freeze alternative) — it is never
          // re-optimized and never zeroed while suspended.
          const fb = c.suspension ? c.suspension.frozenBp : c.committedBp;
          pinned[id] = fb;
          pinnedMass += fb;
        } else if (c.status === "RETIRING") {
          // a confirmed retiree is pinned at its current committed weight
          // until its glide starts (pre-announcement quiescence)
          pinned[id] = c.committedBp;
          pinnedMass += c.committedBp;
        } else if (c.glideRole === "ENTRANT") {
          // an admitted-but-not-yet-ramped entrant stays at exactly 0
          pinned[id] = 0;
        } else {
          pinned[id] = 0;
        }
      }
      const mass = TOTAL_BP - pinnedMass;
      if (domain.length === 0) throw new Error(`period ${period}: empty target-optimization domain`);
      const shares = targetShares(domain, period);
      const envs: Record<string, { min: number; max: number }> = {};
      for (const id of domain) {
        const c = comps.get(id)!;
        // floor exemption for an entrant inside its entry ramp (documented
        // precedence: an entry ramp necessarily starts at 0, below any positive
        // floor — spec §5.2/§5.5 interaction left OPEN; the EXCLUSION side is
        // NOT exempt: exclusion-zero wins over floors per §5.4)
        const inRamp = c.glideRole === "ENTRANT";
        envs[id] = { min: inRamp ? 0 : c.envelope.min * TOTAL_BP, max: Math.min(c.envelope.max * TOTAL_BP, singleCapBp) };
      }
      const { out: targets } = clampAndNormalize(shares, mass, envs);
      const rho = P.smoothingRho;
      const delta: Record<string, number> = {};
      for (const id of domain) {
        const prev = comps.get(id)!.committedBp;
        const smoothed = rho * prev + (1 - rho) * targets[id];
        delta[id] = smoothed - prev;
      }
      for (const id of domain) {
        const d = delta[id];
        if (Math.abs(d) > velocityBp) delta[id] = Math.sign(d) * velocityBp;
      }
      let absDeltaSum = 0;
      for (const id of domain) absDeltaSum += Math.abs(delta[id]);
      // aggregate weight-turnover clamp T_cap (§13 D-13.14 draft) — enforced
      // on normal rebalances; SCHEDULED GLIDES ARE EXEMPT (PROTOTYPE-CHOICE:
      // the spec leaves the T_cap × glide interaction OPEN — a glide moves the
      // retiring component by construction more than 2%/period).
      if (absDeltaSum > turnoverCapBp) {
        const scale = turnoverCapBp / absDeltaSum;
        for (const id of domain) delta[id] *= scale;
        turnoverClampApplied = true;
      }
      rawNext = { ...pinned };
      for (const id of domain) rawNext[id] = comps.get(id)!.committedBp + delta[id];
    }

    // ---- 5. bp rounding + commit (spec §5.3) --------------------------------
    const nextBp = roundToBp(rawNext);
    for (const id of allIds) comps.get(id)!.committedBp = nextBp[id];
    const sumBp = sumRecord(nextBp);
    if (sumBp !== TOTAL_BP) throw new Error(`period ${period}: committed vector sums to ${sumBp} bp, not ${TOTAL_BP}`);
    const floatSum = allIds.reduce((a, id) => a + nextBp[id] / TOTAL_BP, 0);
    const sumDeviation = Math.abs(floatSum - 1);

    // per-commit invariants (bounds, velocity, turnover, aggregate caps)
    const envelopeViolations: string[] = [];
    const capViolations: string[] = [];
    const hhiViolations: string[] = [];
    let maxMove = 0;
    let turnoverBp = 0;
    for (const id of allIds) {
      const c = comps.get(id)!;
      const w = nextBp[id];
      const move = Math.abs(w - prevCommitted[id]);
      if (move > maxMove) maxMove = move;
      turnoverBp += move;
      const inRamp = glideNow && glideAppliedNow && c.glideRole === "ENTRANT" && period < glideNow.endPeriod;
      const floorApplies = (c.status === "ACTIVE" || c.status === "WATCH" || c.status === "EMERGENCY-SUSPENDED") && !inRamp;
      const capBp = Math.min(c.envelope.max * TOTAL_BP, singleCapBp);
      if (w > 0) {
        if (floorApplies && w < c.envelope.min * TOTAL_BP - 1e-9) {
          envelopeViolations.push(`${id} bp ${w} < floor ${c.envelope.min * TOTAL_BP} (state ${c.status}${inRamp ? " mid-ramp" : ""})`);
        }
        if (w > capBp + 1e-9) capViolations.push(`${id} bp ${w} > cap ${capBp}`);
      } else if (
        (c.status === "ACTIVE" || c.status === "WATCH") &&
        !(c.glideRole === "ENTRANT") &&
        !(pendingGlide && pendingGlide.entrantIds.includes(id))
      ) {
        // a pre-ramp entrant legitimately holds exactly 0 until its ramp is
        // effective — that is the ramp schedule, not a violation
        envelopeViolations.push(`${id} zero weight while ${c.status}`);
      }
      if (move > velocityBp + 1) {
        envelopeViolations.push(`${id} move ${move} bp > Δ ${velocityBp} (+1 bp rounding slack)`);
      }
    }
    if (!glideAppliedNow && turnoverBp > turnoverCapBp + allIds.length) {
      capViolations.push(`aggregate turnover ${turnoverBp} bp > T_cap ${turnoverCapBp} (+${allIds.length} bp rounding slack) on a non-glide period`);
    }
    const hhi = hhiOf(nextBp);
    if (hhi > P.hhiCap + 1e-9) hhiViolations.push(`HHI ${hhi.toFixed(6)} > cap ${P.hhiCap}`);
    let maxShare = 0;
    for (const id of allIds) maxShare = Math.max(maxShare, nextBp[id] / TOTAL_BP);

    // ---- 6. glide completion → T6 (exclusion at exactly zero) ----------------
    // §5.4 EXCLUSION-ZERO GUARANTEE: at glide completion the retiring
    // component's committed weight is EXACTLY 0 bp (integer bp — no residual
    // epsilon; no positive floor ever applies to the excluded component).
    // Prototype:1327-1352.
    const glDone = currentGlide();
    if (glDone && glideAppliedNow && period === glDone.endPeriod) {
      glDone.completedPeriod = period;
      for (const id of glDone.retiringIds) {
        const c = comps.get(id)!;
        if (c.committedBp !== 0) {
          throw new Error(`T6 failed: retiring ${id} holds ${c.committedBp} bp at glide completion (exclusion-zero violated)`);
        }
        emitTransition(
          period,
          c,
          "EXCLUDED",
          "T6",
          [{ symbol: "w_final", observed: c.committedBp / TOTAL_BP, threshold: 0, comparator: "==", passed: c.committedBp === 0 }],
          `glide completed after ${glDone.nPeriods} periods; committed weight reached EXACTLY 0 bp (integer bp — no residual epsilon; §5.4 exclusion-zero: no positive floor ever applies to the excluded component)`,
          "n/a — exclusion is not score-driven (the decision was recorded at T5)",
          "automatic on deterministic glide completion (spec §3 T6)",
          null,
        );
        c.glideRole = null;
        boundaryEventLabels.push(`T6:${id}`);
      }
      for (const id of glDone.entrantIds) comps.get(id)!.glideRole = null;
      activeGlide = null;
    }

    // ---- 7. index advance (deliverable-5 §2.2 chain-link procedure) ---------
    // Fail-closed leg-pin: a suspended component's price relative is pinned at
    // 1.0 for the suspension commits (a non-VALID leg never advances the
    // index). Prototype:1354-1420.
    const pinnedLegs: string[] = [];
    const relNow: Record<string, number> = {};
    for (const id of allIds) {
      const c = comps.get(id)!;
      const fz = c.freezeWindow;
      const legPinnedNow = fz !== null && period >= fz.fromPeriod && period <= fz.toPeriodInclusive;
      if (legPinnedNow) {
        relNow[id] = 1.0; // fail-closed: a non-VALID leg never advances the index (deliverable-5 §8)
        pinnedLegs.push(id);
      } else {
        const r = pd.priceRelative[id];
        if (!(r > 0)) throw new Error(`period ${period}: invalid price relative for ${id}: ${r}`);
        relNow[id] = r;
      }
      cumRel[id] = cumRel[id] * relNow[id];
    }
    let bMinus = 0;
    let bPlus = 0;
    let weightVectorChanged = false;
    for (const id of allIds) {
      bMinus += (prevCommitted[id] / TOTAL_BP) * cumRel[id];
      bPlus += (nextBp[id] / TOTAL_BP) * cumRel[id];
      if (nextBp[id] !== prevCommitted[id]) weightVectorChanged = true;
    }
    const divisorD = bPlus > 0 ? bMinus / bPlus : 1.0;
    // G_t = G_{t−1} × D_t — the recorded cumulative divisor, repo/spec convention
    // (deliverable-5 §2.2 step 3; chain-index.ts:432-434 — recorded-not-applied).
    cumulativeAdjustment *= divisorD;
    const previousLevel = recursionLevel;
    // §9.2 recursion IS the published index level (chain-index.ts:296-316
    // advanceIndex convention: prior-period weights × period price ratios).
    let linkReturn = 0;
    for (const id of allIds) linkReturn += (prevCommitted[id] / TOTAL_BP) * relNow[id];
    recursionLevel = recursionLevel * linkReturn;
    if (!(recursionLevel > 0) || !Number.isFinite(recursionLevel)) {
      throw new Error(`period ${period}: index level degenerate (${recursionLevel})`);
    }
    // Zero-artificial-return identity (deliverable-5 §2.2 level form): the
    // chain-link adjustment factor applied to the new valuation reproduces the
    // old valuation at the same prices: D_t × B^+ === B^- — the composition
    // change contributes exactly zero. This is the asserted identity.
    const adjustedLevel = divisorD * bPlus;
    const equivalenceDelta = Math.abs(adjustedLevel - bMinus);
    if (equivalenceDelta > P.indexEquivalenceTolerance) {
      throw new Error(`period ${period}: zero-artificial-return identity broken: D·B+ = ${adjustedLevel} vs B- = ${bMinus} (Δ ${equivalenceDelta})`);
    }
    // Disclosed (NOT asserted): the residual between the two published forms —
    // the §9.2 recursion level vs the level-form valuation B^+/G. The repo
    // itself discloses that "the recursion and the aggregate form are different
    // mathematical objects and the residual is published, not absorbed"
    // (honest-status.ts D-chainlink-divisor). Same honesty here.
    const valueFormResidual = Math.abs(recursionLevel - bPlus / cumulativeAdjustment);
    if (weightVectorChanged || boundaryEventLabels.length > 0) {
      divisorRecords.push({
        period,
        kind: boundaryEventLabels.length ? boundaryEventLabels.join("+") : "REBALANCE",
        eventLabels: [...boundaryEventLabels],
        weightVectorChanged,
        bMinus,
        bPlus,
        divisorD,
        cumulativeAdjustment,
        level: recursionLevel,
      });
    }
    const relativeChange = previousLevel > 0 ? recursionLevel / previousLevel - 1 : 0;

    // ---- 8. registry version (content hash of the record set, spec §2) ------
    const registrySnapshot: Record<string, unknown> = {};
    for (const id of allIds) {
      const c = comps.get(id)!;
      registrySnapshot[id] = {
        registryId: c.registryId,
        status: c.status,
        committedBp: c.committedBp,
        envelope: c.envelope,
        t2: c.t2CompletedPeriod,
        glideRole: c.glideRole,
      };
    }
    const registryVersion = sha256Base64Url(canonicalSerialize(registrySnapshot));

    // ---- 9. commit record -----------------------------------------------------
    const states: Record<string, LifecycleState> = {};
    const scoresOut: Record<string, number> = {};
    for (const id of allIds) {
      states[id] = comps.get(id)!.status;
      scoresOut[id] = compNow[id];
    }
    commits.push({
      period,
      timestampIso: periodIso(period),
      compositeScores: scoresOut,
      states,
      weightsBp: { ...nextBp },
      sumBp,
      sumDeviation,
      glideApplied: glideAppliedNow,
      perComponentMaxMoveBp: maxMove,
      turnoverBp,
      hhi,
      maxComponentShare: maxShare,
      envelopeViolations,
      capViolations,
      hhiViolations,
      turnoverClampApplied,
      index: {
        bMinus,
        bPlus,
        divisorD,
        cumulativeAdjustment,
        level: recursionLevel,
        previousLevel,
        relativeChange,
        recursionLevel,
        equivalenceDelta,
        valueFormResidual,
        pinnedLegs,
      },
      registryVersion,
      boundaryEventLabels: [...boundaryEventLabels],
    });
    prevCommittedAll = { ...nextBp };

    // ---- 10. finalize a glide scheduled this period ---------------------------
    if (pendingGlide && pendingGlide.startPeriod === period + 1) {
      schedulePendingGlide(period, pendingGlide);
      pendingGlide = null;
    }
  }

  // a glide scheduled in the final period never runs — data error
  if (pendingGlide) throw new Error(`glide scheduled at the final period never runs (start ${pendingGlide.startPeriod} > last period)`);
  const glLeft = currentGlide();
  if (glLeft) throw new Error(`glide ${glLeft.planId} did not complete (end ${glLeft.endPeriod} > last period)`);

  // ---- summary ----------------------------------------------------------------
  const exclusions = transitions
    .filter((t) => t.ruleId === "T6")
    .map((t) => ({ componentId: t.componentId, excludedAtPeriod: t.period, finalWeightBp: comps.get(t.componentId)!.committedBp }));
  const admissions = transitions
    .filter((t) => t.ruleId === "T3")
    .map((t) => ({ componentId: t.componentId, activeFromPeriod: t.period + 1 }));
  const watchEpisodes: Array<{ componentId: string; watchFromPeriod: number; resolvedPeriod: number | null }> = [];
  for (const t of transitions) {
    if (t.ruleId === "T4") {
      const resolved = transitions.find(
        (r) => r.componentId === t.componentId && (r.ruleId === "T4R-WATCH-RECOVERY" || r.ruleId === "T5") && r.period >= t.period,
      );
      watchEpisodes.push({ componentId: t.componentId, watchFromPeriod: t.period, resolvedPeriod: resolved ? resolved.period : null });
    }
  }
  const suspensions = transitions
    .filter((t) => t.ruleId === "T7")
    .map((t) => {
      const resolution = transitions.find((r) => r.componentId === t.componentId && r.ruleId.startsWith("T8"));
      const snap = suspensionSnapshots.find((s) => s.componentId === t.componentId && s.period === t.period);
      return {
        componentId: t.componentId,
        suspendedPeriod: t.period,
        reinstatedPeriod: resolution ? resolution.period : null,
        suspensionDurationPeriods: resolution ? resolution.period - t.period : -1,
        frozenWeightBp: snap ? snap.frozenBp : comps.get(t.componentId)!.committedBp,
      };
    });
  const finalBasketIds = allIds.filter((id) => {
    const c = comps.get(id)!;
    return c.status === "ACTIVE" || c.status === "WATCH";
  });
  const finalStates: Record<string, { state: LifecycleState; weightBp: number; registryId: number }> = {};
  for (const id of allIds) {
    const c = comps.get(id)!;
    finalStates[id] = { state: c.status, weightBp: c.committedBp, registryId: c.registryId };
  }
  const maxSumDeviation = commits.reduce((a, cm) => Math.max(a, cm.sumDeviation), 0);

  return {
    methodologyVersion: METHODOLOGY,
    datasetHash: dataset.datasetHash,
    parameterDigest: sha256Base64Url(canonicalSerialize(dataset.parameters)),
    transitions,
    directiveOutcomes,
    universeEvaluations,
    glidePlans,
    divisorRecords,
    commits,
    finalStates,
    summary: {
      periodsRun: commits.length,
      exclusions,
      admissions,
      watchEpisodes,
      suspensions,
      finalBasketIds,
      maxSumDeviation,
      finalIndexLevel: recursionLevel,
    },
  };
}

// Convenience re-export for runners that need glide raw points.
// Prototype: constituency-lifecycle.ts:1555-1558.
export function glideRawPoint(plan: GlidePlanRecord, k: number): Record<string, number> {
  return plan.perPeriodRawBp[k - 1];
}
