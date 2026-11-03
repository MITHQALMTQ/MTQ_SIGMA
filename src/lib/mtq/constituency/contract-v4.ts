// ============================================================================
// MTQΣ — V4 DYNAMIC-MEMBERSHIP CONTRACT LAYER — TS REFERENCE VALIDATOR
//        (TASK 39 — mirrors contracts/MTQSigmaV4.sol submission semantics)
// ============================================================================
// The prior honest disclosure: "the contract layer remains STATIC — the V4
// dynamic-membership design plan is PROPOSED (Gate-C / Task-12-gated)". As of
// TASK-39 the plan EXISTS (audit-work/task13/v4-contract-dynamic-membership-
// design-plan.md — status IMPLEMENTED, testnet reference) and the contract
// EXISTS and COMPILES (contracts/MTQSigmaV4.sol — self-contained, solc
// 0.8.36, deployed bytecode 8,445 B < EIP-170; artifact
// contracts/out-v4/v4-result.json; reproducible via the out-v4 harness).
//
// THIS MODULE is the executable TS mirror of the V4 submitWeights validation
// pipeline (the same 8 rules, same error vocabulary, same evaluation order)
// so the Pilot Command Center can EXERCISE the dynamic-membership semantics
// in shadow mode without deploying. It is deliberately strict where the
// Solidity layer defers to the TS reference layer (see the documented
// deviation: CANDIDATE/ELIGIBLE weights are pinned at 0 here per spec §3's
// state matrix, while the contract permits ≥0 — design plan §4/§8).
//
// HONEST POSTURE: UNDEPLOYED · REFERENCE LAYER · TESTNET ONLY. No deployment
// exists, no audit exists, production deployment is Gate-C / Task-12-gated.
// Validation here is a shadow-mode demonstration, not on-chain enforcement.
// ============================================================================

import { DEFAULT_REGISTRY } from "./registry";

// ---------------------------------------------------------------------------
// §0 Contract-layer status metadata (surfaced by /api/constituency)
// ---------------------------------------------------------------------------

export const V4_CONTRACT_STATUS = {
  name: "MTQSigmaV4 (registry-based dynamic membership)",
  sourcePath: "contracts/MTQSigmaV4.sol",
  designPlanPath: "audit-work/task13/v4-contract-dynamic-membership-design-plan.md",
  designPlanStatus: "IMPLEMENTED (testnet reference layer — supersedes the prior PROPOSED status via owner directive 2026-11-03)",
  compileArtifact: "contracts/out-v4/v4-result.json",
  compiler: "solc 0.8.36+commit.8a079791.Emscripten.clang (solcjs standard-JSON harness)",
  compileSettings: "optimizer 200 runs · viaIR true · evmVersion shanghai",
  deployedBytecodeBytes: 8445,
  eip170: "WITHIN LIMIT (8,445 < 24,576 — 16,131 B headroom)",
  deterministicRepro: "byte-identical on re-compile (sha256 recorded in the design plan §7)",
  deployed: false,
  deploymentPosture:
    "UNDEPLOYED — testnet deployment is Gate-C / Task-12-gated (authority migration chain); the deployed v1.2 pilot estate is a different economic family and is untouched",
  staticLayerClosed:
    "the V2/V3 STATIC-layer findings are closed at the SOURCE level: bytes3[7] fixed shapes (V2:298 / V3:288) → dynamic registry (V4); positive-weights-only submissions (V2:526 / V3:1317) → 0 allowed exactly for non-ACTIVE slots; ±1e14 commit tolerance (V2:638 / V3:1388) → EXACT 1e18",
  reproductionCommand: "cd contracts/out-v4 && node compile-standard.mjs ../MTQSigmaV4.sol v4 200 true shanghai",
} as const;

// ---------------------------------------------------------------------------
// §1 Reference types (mirroring the V4 record surface)
// ---------------------------------------------------------------------------

export type V4LifecycleStatus =
  | "NONEXISTENT"
  | "CANDIDATE"
  | "ELIGIBLE"
  | "ACTIVE"
  | "WATCH"
  | "RETIRING"
  | "EXCLUDED"
  | "EMERGENCY_SUSPENDED";

export interface V4ComponentRecordRef {
  registryId: number;
  status: V4LifecycleStatus;
  envelopeMinBp: number;
  envelopeMaxBp: number;
  /** Stored committed weight (bp, 1e18-scale in bp quanta on-chain). */
  storedWeightBp: number;
}

export interface V4RuleViolation {
  rule: number;
  error: string; // Solidity custom-error name (V4 vocabulary)
  detail: string;
}

export interface V4ValidationResult {
  passed: boolean;
  violations: V4RuleViolation[];
  sumBp: number;
  checked: {
    submissionCount: number;
    activeCovered: number;
    activeTotal: number;
  };
}

const BP18_QUANTUM = 1e14;
const SUM_EXACT_18 = 1e18;

// ---------------------------------------------------------------------------
// §2 The validator — mirrors MTQSigmaV4.submitWeights rules 1–8 in order,
//    plus the documented STRICTER TS form (CANDIDATE/ELIGIBLE pinned at 0).
// ---------------------------------------------------------------------------

/**
 * @param ids registry ids in submission order
 * @param weightsBp18 weights in 1e18-scale bp quanta (multiples of 1e14)
 * @param records the registry record map (id → record)
 */
export function validateV4WeightSubmission(
  ids: number[],
  weightsBp18: number[],
  records: Map<number, V4ComponentRecordRef>,
): V4ValidationResult {
  const violations: V4RuleViolation[] = [];

  // Rule 1 — shape
  if (ids.length === 0) violations.push({ rule: 1, error: "EmptySubmission", detail: "submission array is empty" });
  if (ids.length !== weightsBp18.length) {
    violations.push({ rule: 1, error: "LengthMismatch", detail: `ids=${ids.length} weights=${weightsBp18.length}` });
  }

  // Rule 2 — membership precondition
  for (const id of ids) {
    if (!records.has(id)) {
      violations.push({ rule: 2, error: "NotRegistered", detail: `registryId ${id} is not registered` });
    }
  }

  const activeIds = [...records.values()].filter((r) => r.status === "ACTIVE").map((r) => r.registryId);

  // Rule 3 — ACTIVE-set coverage (no silent omission)
  for (const aid of activeIds) {
    if (!ids.includes(aid)) {
      violations.push({ rule: 3, error: "ActiveOmitted", detail: `ACTIVE component ${aid} missing from submission` });
    }
  }

  // Rules 4 + 5 — per-value semantics + envelopes
  let sum = 0;
  for (let i = 0; i < Math.min(ids.length, weightsBp18.length); i++) {
    const rid = ids[i];
    const w18 = weightsBp18[i];
    const rec = records.get(rid);
    if (w18 % BP18_QUANTUM !== 0) {
      violations.push({ rule: 4, error: "NotBpQuantum", detail: `registryId ${rid} weight ${w18} is not a 1e14 multiple (spec §5.3)` });
    }
    sum += w18;
    if (!rec) continue;
    if (rec.status === "ACTIVE") {
      if (w18 === 0) {
        violations.push({ rule: 4, error: "ZeroWeightForActive", detail: `ACTIVE ${rid} submitted at 0 (spec §8 item 3)` });
      }
      const lo = rec.envelopeMinBp * BP18_QUANTUM;
      const hi = rec.envelopeMaxBp * BP18_QUANTUM;
      if (w18 < lo) violations.push({ rule: 5, error: "WeightBelowEnvelope", detail: `${rid}: ${w18 / BP18_QUANTUM}bp < envelope min ${rec.envelopeMinBp}bp` });
      if (w18 > hi) violations.push({ rule: 5, error: "WeightAboveEnvelope", detail: `${rid}: ${w18 / BP18_QUANTUM}bp > envelope max ${rec.envelopeMaxBp}bp` });
    } else if (rec.status === "EXCLUDED") {
      if (w18 !== 0) violations.push({ rule: 4, error: "ExcludedMustBeZero", detail: `EXCLUDED ${rid} submitted at ${w18 / BP18_QUANTUM}bp (spec §5.4 exclusion-zero)` });
    } else if (rec.status === "CANDIDATE" || rec.status === "ELIGIBLE") {
      // STRICTER TS REFERENCE FORM (documented deviation — design plan §4/§8):
      // spec §3's state matrix pins queue states at exactly 0.
      if (w18 !== 0) {
        violations.push({ rule: 4, error: "QueueStateMustBeZero(TS-strict)", detail: `${rec.status} ${rid} submitted at ${w18 / BP18_QUANTUM}bp — spec §3 pins CANDIDATE/ELIGIBLE at 0 (TS reference form; the contract permits ≥0)` });
      }
    }
    // WATCH / RETIRING / EMERGENCY_SUSPENDED: ≥0 — 0 allowed exactly for
    // non-ACTIVE slots (spec §8 item 3); positive = glide/freeze semantics.
  }

  // Rule 6 — EXACT sum (±1e14 tolerance of V2/V3 TIGHTENED to exact)
  if (sum !== SUM_EXACT_18) {
    violations.push({ rule: 6, error: "SumNotExact", detail: `sum ${(sum / BP18_QUANTUM).toFixed(0)}bp ≠ 10000bp exactly (V2/V3 allowed ±1bp; V4 requires exact)` });
  }

  // Rule 7 — duplicates
  for (let i = 0; i < ids.length; i++) {
    for (let k = i + 1; k < ids.length; k++) {
      if (ids[i] === ids[k]) {
        violations.push({ rule: 7, error: "DuplicateId", detail: `registryId ${ids[i]} submitted twice` });
      }
    }
  }

  // Rule 8 — omitted components must carry no STORED weight (no unallocated
  // weight — the post-merge stored total must stay exactly 1e18)
  for (const rec of records.values()) {
    if (!ids.includes(rec.registryId) && rec.storedWeightBp !== 0) {
      violations.push({
        rule: 8,
        error: "OmittedPositiveWeight",
        detail: `omitted ${rec.registryId} still stores ${rec.storedWeightBp}bp — post-merge stored total would break the exact-1e18 invariant`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    sumBp: sum / BP18_QUANTUM,
    checked: {
      submissionCount: ids.length,
      activeCovered: activeIds.filter((a) => ids.includes(a)).length,
      activeTotal: activeIds.length,
    },
  };
}

// ---------------------------------------------------------------------------
// §3 Shadow-mode demonstration (exercised by /api/constituency — nothing is
//    deployed or mutated; the DEFAULT_REGISTRY is read-only input)
// ---------------------------------------------------------------------------

export interface V4DemoCase {
  caseId: string;
  title: string;
  description: string;
  scenario: Array<{ code: string; status: V4LifecycleStatus; weightBp: number }>;
  expected: "PASS" | "FAIL";
  result: V4ValidationResult;
  verified: boolean; // result matches expectation
}

function genesisRecords(): Map<number, V4ComponentRecordRef> {
  const m = new Map<number, V4ComponentRecordRef>();
  for (const e of DEFAULT_REGISTRY.entries()) {
    m.set(e.registryId, {
      registryId: e.registryId,
      status: "ACTIVE",
      envelopeMinBp: Math.round(e.envelope.min * 10000),
      envelopeMaxBp: Math.round(e.envelope.max * 10000),
      storedWeightBp: e.genesisWeightBp,
    });
  }
  return m;
}

/** Runs the V4 reference validation on four shadow-mode cases proving the
 *  dynamic-membership semantics that the STATIC V2/V3 layer could not
 *  express. Read-only over DEFAULT_REGISTRY; nothing persists. */
export function demonstrateV4ReferenceValidation(): {
  cases: V4DemoCase[];
  summary: string;
  allVerified: boolean;
} {
  const genesis = genesisRecords();
  const bp18 = (bp: number) => bp * BP18_QUANTUM;
  const cases: V4DemoCase[] = [];

  // CASE A — the genesis vector submits clean under V4 rules (7 ACTIVE, all
  // within envelopes, sum exactly 10000bp).
  {
    const records = genesisRecords();
    const ids = [...records.keys()];
    const weights = ids.map((id) => bp18(records.get(id)!.storedWeightBp));
    const result = validateV4WeightSubmission(ids, weights, records);
    cases.push({
      caseId: "A",
      title: "Genesis vector — dynamic-length submission of the 7-member genesis set",
      description:
        "All 7 ACTIVE components submitted with their genesis bp (2700/2000/900/800/500/500/2600), dynamic-length ids (no bytes3[7] fixed shape), envelopes respected, sum exact. Under V2/V3 the same vector needed fixed 7-slot arrays.",
      scenario: [...records.values()].map((r) => ({
        code: DEFAULT_REGISTRY.get(
          [...DEFAULT_REGISTRY.ids()].find((sid) => DEFAULT_REGISTRY.get(sid).registryId === r.registryId) ?? "",
        )?.displayCode ?? String(r.registryId),
        status: r.status,
        weightBp: r.storedWeightBp,
      })),
      expected: "PASS",
      result,
      verified: result.passed,
    });
  }

  // CASE B — a completed T6 retirement: CHF EXCLUDED at exactly 0 (the
  // exclusion-zero invariant V2/V3's positive-weights-only rule made
  // unreachable on-chain), its 500bp redistributed within envelopes.
  {
    const records = genesisRecords();
    const chf = records.get(6)!;
    chf.status = "EXCLUDED";
    chf.storedWeightBp = 0; // T6 completed — the glide already ended at exactly 0
    // Redistribute CHF's 500bp within envelopes (largest-remainder endstate):
    // USD 2700→2850, EUR 2000→2100, JPY 900→1000, GBP 800→875, CNY 500→575, XAU 2600 (unchanged)
    const adj: Record<number, number> = { 1: 150, 2: 100, 3: 100, 4: 75, 5: 75, 7: 0 };
    for (const [rid, add] of Object.entries(adj)) {
      const r = records.get(Number(rid))!;
      r.storedWeightBp += add;
    }
    const ids = [...records.keys()];
    const weights = ids.map((id) => bp18(records.get(id)!.storedWeightBp));
    const result = validateV4WeightSubmission(ids, weights, records);
    cases.push({
      caseId: "B",
      title: "T6 completed retirement — EXCLUDED slot at exactly 0 bp (dynamic membership endstate)",
      description:
        "CHF's 500bp redistributed to USD/EUR/JPY/GBP/CNY within envelopes; CHF submitted at EXACTLY 0 as an EXCLUDED slot — the endstate the V2/V3 positive-weights-only submission rule (V2:526 / V3:1317) could never reach on-chain. Sum stays exactly 10000bp.",
      scenario: [...records.values()].map((r) => ({
        code: DEFAULT_REGISTRY.get(
          [...DEFAULT_REGISTRY.ids()].find((sid) => DEFAULT_REGISTRY.get(sid).registryId === r.registryId) ?? "",
        )?.displayCode ?? String(r.registryId),
        status: r.status,
        weightBp: r.storedWeightBp,
      })),
      expected: "PASS",
      result,
      verified: result.passed,
    });
  }

  // CASE C — the violation the STATIC layer could not even express is caught:
  // an ACTIVE component submitted at 0 (ZeroWeightForActive).
  {
    const records = genesisRecords();
    const ids = [...records.keys()];
    const weights = ids.map((id) => {
      const r = records.get(id)!;
      return bp18(id === 6 ? 0 : r.storedWeightBp + (id === 1 ? 500 : 0)); // CHF zeroed, USD absorbs
    });
    const result = validateV4WeightSubmission(ids, weights, records);
    cases.push({
      caseId: "C",
      title: "Violation probe — ACTIVE component submitted at 0 (ZeroWeightForActive)",
      description:
        "CHF is still ACTIVE but submitted at exactly 0 (with USD absorbing its weight to keep the sum exact). The V4 rule set rejects the submission: 0 is allowed exactly for non-ACTIVE slots only (spec §8 item 3) — the inverse of V2/V3's blanket positive-weights-only rule.",
      scenario: [
        { code: "USD", status: "ACTIVE", weightBp: 3200 },
        { code: "CHF", status: "ACTIVE", weightBp: 0 },
      ],
      expected: "FAIL",
      result,
      verified: !result.passed && result.violations.some((v) => v.error === "ZeroWeightForActive"),
    });
  }

  // CASE D — the tolerance tightening: a 9999bp sum (V2/V3 would ACCEPT this
  // inside ±1bp; V4 requires EXACT 1e18).
  {
    const records = genesisRecords();
    const ids = [...records.keys()];
    const weights = ids.map((id) => {
      const r = records.get(id)!;
      return bp18(id === 7 ? r.storedWeightBp - 1 : r.storedWeightBp); // XAU short by 1bp
    });
    const result = validateV4WeightSubmission(ids, weights, records);
    cases.push({
      caseId: "D",
      title: "Tolerance tightening — 9999bp sum rejected (SumNotExact)",
      description:
        "XAU submitted 1bp short (2599bp): the vector sums to 9999bp. V2/V3's ±1e14 commit tolerance (V2:638 / V3:1388) ACCEPTED this deviation; V4 tightens to EXACT 1e18 because bp quantization + largest-remainder rounding makes exactness achievable (spec §8 item 4).",
      scenario: [{ code: "XAU", status: "ACTIVE", weightBp: 2599 }],
      expected: "FAIL",
      result,
      verified: !result.passed && result.violations.some((v) => v.error === "SumNotExact"),
    });
  }

  void genesis;
  const allVerified = cases.every((c) => c.verified);
  return {
    cases,
    allVerified,
    summary: allVerified
      ? "4/4 shadow-mode cases verified: the V4 dynamic-membership semantics (dynamic-length submissions, exclusion-zero endstates, 0-exactly-for-non-ACTIVE, exact-1e18) are executable and correctly enforced by the TS reference validator — mirroring the compiled, UNDEPLOYED MTQSigmaV4.sol."
      : "One or more shadow-mode cases did not match their expected outcome — see cases[].verified (this is a defect signal, not a deployment claim).",
  };
}
