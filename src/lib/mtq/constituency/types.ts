// ============================================================================
// MTQΣ — Dynamic currency-constituency engine (TS reference layer) — TYPES
// ============================================================================
// Task M8-3a (2026-10-23, owner-delegated per
//   audit-work/task13/owner-directive-2026-10-23-delegated-execution.md):
//   Phase 1 of the project's own approved implementation plan
//   (audit-work/task13/evidence/dynamic-replacement/RESULTS.md §2.3) — port the
//   ALREADY-VALIDATED prototype semantics (constituency-lifecycle.ts, 15/15
//   MANDATE-007 §3 assertions, double-run deterministic, MANDATE-007) into the
//   production engine under src/lib/mtq/.
//
// Semantics source: audit-work/task13/currency-constituency-and-weight-
//   transition-spec.md (v0.1 PROPOSED — Gate C; §13 parameters UNAPPROVED
//   DRAFT) and currency-constituency-and-dynamic-replacement-validation.md
//   §4/§7. Provenance comments cite the validated prototype file and the spec
//   § for every rule.
//
// HONEST SCOPE (read before citing):
//   * ALL parameters are UNAPPROVED DRAFT (spec §13) — see parameters.ts.
//   * The lifecycle is QUIESCENT BY DEFAULT: no governance directive ⇒ no
//     membership transition ever fires; the default registry initializes to
//     the 7-component genesis set (registry.ts).
//   * §4 eligibility scoring has NO live data feeds (BIS/AREAER/vendor
//     ingestion does not exist; the ≥2-independent-family oracle precondition
//     is unmet). Scoring inputs exist only as deterministic test fixtures.
//   * The CONTRACT layer remains static (positive-weights-only submissions —
//     an exit cannot reach 0 on-chain; bytes3[7] fixed shapes). The V4
//     contract design plan is
//     audit-work/task13/v4-contract-dynamic-membership-design-plan.md (PROPOSED).
//   * Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE
//     TRANSACTIONS FORBIDDEN · NOT ACCEPTED. No economic parameter is
//     production-approved; no ratification gate is advanced by this module.
// ============================================================================

// ---------------------------------------------------------------------------
// §1 Versioned input dataset types
// Provenance: port of audit-work/task13/evidence/dynamic-replacement/
//   constituency-lifecycle.ts:97-238 (validated prototype; 15/15 MANDATE-007
//   §3 assertions on both official runs) — field-for-field identical so the
//   production engine reproduces the validated decision records byte-for-byte
//   (asserted by __tests__/dynamic-membership.ts PORT-01).
// ---------------------------------------------------------------------------

/** Lifecycle states per spec §3: CANDIDATE → ELIGIBLE → ACTIVE → WATCH →
 *  RETIRING → EXCLUDED, with EMERGENCY-SUSPENDED as a distinct overlay path
 *  (not a normal-retirement state) and ELIGIBLE as a queue state.
 *  Prototype: constituency-lifecycle.ts:97-104. */
export type LifecycleState =
  | "CANDIDATE"
  | "ELIGIBLE"
  | "ACTIVE"
  | "WATCH"
  | "RETIRING"
  | "EXCLUDED"
  | "EMERGENCY-SUSPENDED";

/** The nine normalized [0,1] scoring inputs (spec §4.1). The spec's RR_i
 *  ("reserve/trade relevance") is defined "as L_i" (same raw measurement and
 *  normalization as liquidity) — RR is therefore MERGED into the liquidity term
 *  so the uniform draft γ = 1/9 (spec §4.2) sums to 1 exactly.
 *  PROTOTYPE-CHOICE carried over from the validated prototype
 *  (constituency-lifecycle.ts:106-122; labeled in inputs-v1.json
 *  methodology.prototypeChoices). RR is EXOGENOUS economy-wide FX-use only —
 *  MTQΣ-internal payment volume is FORBIDDEN as an input (spec §8 INV-SEP-1). */
export interface ScoreInputs {
  liquidity: number; // L_i (merged with RR_i per above)
  dataQuality: number; // QD_i
  convertibility: number; // CV_i
  jurisdictionalRestrictions: number; // JR_i (min over binary gates)
  currencyControl: number; // CC_i
  benchmarkAvailability: number; // BA_i
  volatility: number; // V_i
  diversification: number; // D_i
  geopoliticalExposure: number; // GE_i
}

export const SCORING_INPUT_KEYS: Array<keyof ScoreInputs> = [
  "liquidity",
  "dataQuality",
  "convertibility",
  "jurisdictionalRestrictions",
  "currencyControl",
  "benchmarkAvailability",
  "volatility",
  "diversification",
  "geopoliticalExposure",
];

/** Hard-gate minima (spec §4.2 draft — UNAPPROVED §13): a composite cannot
 *  rescue a failed gate. Prototype: constituency-lifecycle.ts:136-142. */
export interface HardGateSpec {
  liquidityMin: number; // draft 0.30 (spec §4.2)
  dataQualityMin: number; // draft 0.50
  convertibilityMin: number; // draft 0.50
  jurisdictionalRestrictionsExact: number; // draft 1.0 (all gates)
  benchmarkAvailabilityMin: number; // draft 0.60
}

/** Lifecycle parameter block (values: UNAPPROVED DRAFT — spec §13; the named
 *  constants + provenance labels live in parameters.ts).
 *  Prototype: constituency-lifecycle.ts:144-175. */
export interface LifecycleParameters {
  parameterClass: string;
  nMax: number; // draft 7 (spec §7/§13 D-13.11)
  thetaIn: number; // draft 0.75 (§13)
  thetaOut: number; // draft 0.65
  hysteresisBandH: number; // draft 0.10
  warningThreshold: number; // θ_out + H/2 = 0.70
  hardGates: HardGateSpec;
  compositeWeightMode: string;
  entryPersistencePeriods: number; // 6 (T_obs_entry 180d ÷ 30d — conversion PROTOTYPE-CHOICE)
  exitPersistencePeriods: number; // 4 (T_obs_exit 120d ÷ 30d)
  watchPersistencePeriods: number; // 1 (T_watch 30d)
  watchRecoveryPeriods: number; // 1 (PROTOTYPE-CHOICE: WATCH→ACTIVE rule is not T-numbered in spec §3)
  announcementLagPeriods: number; // 1 (T_ann 30d)
  reinstatementWindowPeriods: number; // 1 (T_rein 30d; fast-track uses ≤ — PROTOTYPE-CHOICE)
  emergencyGlideMaxPeriods: number; // 3 (N_em draft)
  velocityPerPeriod: number; // 0.10 PROTOTYPE-CHOICE (see parameters.ts)
  glideBoundPeriods: [number, number]; // [1,10] (§13 N_ret draft)
  envelopeMin: number; // 0.10 PROTOTYPE-CHOICE (see parameters.ts)
  envelopeMax: number; // 0.40 PROTOTYPE-CHOICE (see parameters.ts)
  singleComponentCap: number; // 0.40 PROTOTYPE-CHOICE
  hhiCap: number; // 0.40 (PROTOTYPE-CHOICE over the §13 0.35 draft — N-dependence flagged D-13.14)
  weightTurnoverCapPerPeriod: number; // 0.02 (§13 T_cap draft)
  smoothingRho: number; // 0.50 (carried constitutional ρ)
  sumTolerance: number; // 1e-9 (§13)
  indexEquivalenceTolerance: number; // 1e-12 (deliverable-5 §2.3 draft reconciliation tolerance)
  indexContinuityTolerance: number; // 1e-9 (MANDATE-007 §3)
  bpQuantum: number; // 1e-4 (§5.3)
  periodLengthDays: number; // 30
  fixedEpochIso: string;
  targetFunction: string;
}

export type DirectiveType =
  | "T3-CONFIRM"
  | "T5-CONFIRM"
  | "T7-EMERGENCY-SUSPENSION"
  | "T8-RESOLUTION"
  | "T9-RENOMINATION";

/** Governance directives are evidence-checked: the engine ENFORCES their rule
 *  preconditions (T2 record for T3; completed exit window for T5; documented
 *  cause for T7; fast-track window for T8; fresh dossier for T9) and REJECTS
 *  directives whose preconditions are not met — every rejection is recorded
 *  (spec §3 evidence rows; prototype constituency-lifecycle.ts:184-195). */
export interface GovernanceDirective {
  index: number;
  period: number;
  type: DirectiveType;
  componentId: string;
  effectivePeriod: number;
  authority: string;
  cause?: string;
  causeResolved?: boolean;
  dossierRef?: string;
  note?: string;
}

export interface PeriodData {
  period: number;
  timestampIso: string;
  narrative: string;
  scores: Record<string, ScoreInputs>;
  priceRelative: Record<string, number>;
  integrityRiskFlags: string[];
  integrityRiskResolved: string[];
  governanceDirectives: GovernanceDirective[];
}

/** Universe entry = a registry record at dataset load time (spec §2 schema:
 *  stable identifier + type + envelope + velocity class + lifecycle status +
 *  dossier reference). Prototype: constituency-lifecycle.ts:208-219. */
export interface UniverseEntry {
  registryId: number;
  id: string;
  displayCode: string;
  name: string;
  componentType: string;
  initialStatus: LifecycleState;
  priorHistoryNote: string;
  dossierRef: string | null;
  envelope: { min: number; max: number };
  velocityPerPeriod: number;
}

export interface Dataset {
  datasetId: string;
  dataClass: string;
  datasetHash: string;
  datasetHashNote: string;
  methodology: {
    version: string;
    provenance: string;
    posture: string;
    dataLabel: string;
    specCitations: string[];
    prototypeChoices: string[];
  };
  parameters: LifecycleParameters;
  universe: UniverseEntry[];
  genesis: { weightsBp: Record<string, number>; note: string };
  periods: PeriodData[];
}

// ---------------------------------------------------------------------------
// §2 Decision-record types (the reproducible output — spec §4.3 recording
//    obligation: every transition records period, timestamp, from/to state,
//    rule id, exact threshold values compared, inputs snapshot hash, and
//    methodology version; the ledger is append-only).
// Prototype: constituency-lifecycle.ts:244-396.
// ---------------------------------------------------------------------------

export interface ThresholdComparison {
  symbol: string;
  observed: number;
  threshold: number;
  comparator: string;
  passed: boolean;
}

/** Spec §4.3 recording obligation — one append-only ledger row per transition.
 *  Prototype: constituency-lifecycle.ts:252-269. */
export interface TransitionRecord {
  recordId: string;
  period: number;
  timestampIso: string;
  componentId: string;
  fromState: LifecycleState;
  toState: LifecycleState;
  ruleId: string;
  thresholdComparisons: ThresholdComparison[];
  persistenceEvidence: string;
  hardGateEvidence: string;
  inputsSnapshotHash: string;
  methodologyVersion: string;
  authorityNote: string;
}

/** Rejected directives are recorded (spec §3 evidence rows). */
export interface DirectiveOutcomeRecord {
  directiveIndex: number;
  period: number;
  type: DirectiveType;
  componentId: string;
  applied: boolean;
  reasons: string[];
}

export interface CandidateEvaluation {
  componentId: string;
  state: LifecycleState;
  composite: number;
  qualifyingStreak: number;
  entryPersistenceRequired: number;
  hardGatesAllPass: boolean;
  failedGates: string[];
  verdict: "ADMITTED" | "NOT-ADMITTED";
  reasons: string[];
}

/** Validation doc §4 behavior 3: the entire admissible universe (including
 *  eligible currencies outside the basket) is evaluated at every membership
 *  event. Prototype: constituency-lifecycle.ts:292-299. */
export interface UniverseEvaluationRecord {
  period: number;
  triggerEvent: string;
  evaluations: CandidateEvaluation[];
  substitutionDecision: string;
}

/** Chain-linked index-continuity record (deliverable-5 §2.2 composition-change
 *  procedure: rel vs genesis fixings; B^-; B^+; D_t = B^-/B^+).
 *  Prototype: constituency-lifecycle.ts:301-311. */
export interface DivisorRecord {
  period: number;
  kind: string;
  eventLabels: string[];
  weightVectorChanged: boolean;
  bMinus: number; // B_t^- = Σ W_{t-1}·rel — old composition (chain-index.ts:417-431 convention)
  bPlus: number; // B_t^+ = Σ W_t·rel — new composition
  divisorD: number; // D_t = B^-/B^+ (recorded, repo convention chain-index.ts:432-434)
  cumulativeAdjustment: number; // G applied form (multiplied by B^+/B^- per commit)
  level: number; // I_t = B^+/G (weights × price-relatives with adjustment factor)
}

/** Linear deterministic glide plan (spec §5.5: w^(k) = w^0 + (k/N)·(w^final −
 *  w^0); N derived = ceil(max move / Δ), clamped to the §13 bound).
 *  Prototype: constituency-lifecycle.ts:313-329. */
export interface GlidePlanRecord {
  planId: string;
  scheduledPeriod: number;
  startPeriod: number;
  nPeriods: number;
  derivation: string;
  reason: string;
  redistributionRule: string;
  entrantIds: string[];
  retiringIds: string[];
  wStartBp: Record<string, number>;
  wEndBp: Record<string, number>;
  perPeriodRawBp: Array<Record<string, number>>;
  completedPeriod: number | null;
  eventLabels: string[];
  endpointCapRepairApplied: boolean;
}

export interface PeriodCommitRecord {
  period: number;
  timestampIso: string;
  compositeScores: Record<string, number>;
  states: Record<string, LifecycleState>;
  weightsBp: Record<string, number>;
  sumBp: number;
  sumDeviation: number;
  glideApplied: boolean;
  perComponentMaxMoveBp: number;
  turnoverBp: number;
  hhi: number;
  maxComponentShare: number;
  envelopeViolations: string[];
  capViolations: string[];
  hhiViolations: string[];
  turnoverClampApplied: boolean;
  index: {
    bMinus: number;
    bPlus: number;
    divisorD: number;
    cumulativeAdjustment: number;
    level: number;
    previousLevel: number;
    relativeChange: number;
    recursionLevel: number;
    /** |D_t·B^+ − B^-| — the asserted zero-artificial-return identity (≤ 1e-12). */
    equivalenceDelta: number;
    /** Disclosed, NOT asserted: |I_recursion − B^+/G| — the residual between the
     *  recursion form and the level form (different mathematical objects; the
     *  repo publishes the same residual — honest-status.ts D-chainlink-divisor). */
    valueFormResidual: number;
    pinnedLegs: string[];
  };
  registryVersion: string;
  boundaryEventLabels: string[];
}

export interface DecisionRecord {
  methodologyVersion: string;
  datasetHash: string;
  parameterDigest: string;
  transitions: TransitionRecord[];
  directiveOutcomes: DirectiveOutcomeRecord[];
  universeEvaluations: UniverseEvaluationRecord[];
  glidePlans: GlidePlanRecord[];
  divisorRecords: DivisorRecord[];
  commits: PeriodCommitRecord[];
  finalStates: Record<string, { state: LifecycleState; weightBp: number; registryId: number }>;
  summary: {
    periodsRun: number;
    exclusions: Array<{ componentId: string; excludedAtPeriod: number; finalWeightBp: number }>;
    admissions: Array<{ componentId: string; activeFromPeriod: number }>;
    watchEpisodes: Array<{ componentId: string; watchFromPeriod: number; resolvedPeriod: number | null }>;
    suspensions: Array<{
      componentId: string;
      suspendedPeriod: number;
      reinstatedPeriod: number | null;
      suspensionDurationPeriods: number;
      frozenWeightBp: number;
    }>;
    finalBasketIds: string[];
    maxSumDeviation: number;
    finalIndexLevel: number;
  };
}

// ---------------------------------------------------------------------------
// §3 Scoring-input provenance tiers (spec §2 "Provenance tiers for scoring
//    inputs", applied to §4.1): tier 1 = primary official statistics; tier 2 =
//    regulated market data (≥2 independent families); tier 3 = protocol-
//    internal oracle ledger (data-quality dimension only — tier-3 inputs may
//    never measure market relevance). A dimension whose inputs fall below its
//    required tier scores 0 (fail-closed), never a neutral default.
//
// HONEST FEED STATUS (no live ingestion exists): BIS/AREAER/vendor ingestion is
// NOT implemented anywhere in the codebase — every scoring input used by this
// engine is a deterministic test fixture carrying a declared tier label. The
// ≥2-independent-family oracle precondition remains UNMET for the tier-2 rows
// (honest-status D-oracle-witnesses).
// ---------------------------------------------------------------------------

export type ProvenanceTier = 1 | 2 | 3;

export interface ScoreInputProvenanceRow {
  input: keyof ScoreInputs;
  tier: ProvenanceTier;
  tierDefinition: string;
  declaredSource: string;
  feedStatus: "NO-LIVE-FEED (test fixtures only)" | string;
}

export const PROVENANCE_TIER_DEFINITIONS: Record<ProvenanceTier, string> = {
  1: "Tier 1 — primary official statistics (statistical offices, BIS, IMF AREAER; counsel review where applicable) per spec §2",
  2: "Tier 2 — regulated market data (published fixings, data vendors with ≥2 independent families — the independence precondition is NOT MET today) per spec §2",
  3: "Tier 3 — protocol-internal oracle ledger (data-quality dimension only; tier-3 inputs may never measure market relevance per spec §2)",
};

/** The per-input tier map (spec §2/§4.1 candidate sources, declared).
 *  Diversification is assigned tier 3 because the spec routes D_i to the
 *  §6.1 covariance layer (mase.ts) — a protocol-internal measure of structural
 *  risk, not a market-relevance score; the tier-3 market-relevance prohibition
 *  applies to the relevance dimensions (L/RR), which stay tier 1. */
export const SCORING_INPUT_PROVENANCE: Record<keyof ScoreInputs, ScoreInputProvenanceRow> = {
  liquidity: {
    input: "liquidity",
    tier: 1,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[1],
    declaredSource: "BIS Triennial Central Bank Survey (FX turnover share); RR_i defined 'as L_i' per spec §4.1 (EXOGENOUS economy-wide FX-use only — INV-SEP-1)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  dataQuality: {
    input: "dataQuality",
    tier: 3,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[3],
    declaredSource: "The protocol's own oracle ledger (spec §4.1 QD row) — the designed tier-3 data-quality dimension",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  convertibility: {
    input: "convertibility",
    tier: 1,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[1],
    declaredSource: "IMF AREAER currency-restriction indicators + onshore/offshore basis cross-check (spec §4.1 CV row)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  jurisdictionalRestrictions: {
    input: "jurisdictionalRestrictions",
    tier: 1,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[1],
    declaredSource: "Sanctions-screening provider + counsel review (spec §4.1 JR row — Gate-relevant, D-13.3 context)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  currencyControl: {
    input: "currencyControl",
    tier: 2,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[2],
    declaredSource: "FX data vendors (onshore/offshore basis spread, trailing median — spec §4.1 CC row)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  benchmarkAvailability: {
    input: "benchmarkAvailability",
    tier: 2,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[2],
    declaredSource: "Published fixings (ECB ref rates; WM/Reuters-type fixes; LBMA gold fix — spec §4.1 BA row)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  volatility: {
    input: "volatility",
    tier: 2,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[2],
    declaredSource: "The same validated multi-source prices as the index (spec §4.1 V row; consistency requirement)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  diversification: {
    input: "diversification",
    tier: 3,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[3],
    declaredSource: "§6.1 covariance layer (mase.ts — protocol-internal structural-risk measure, not market relevance)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
  geopoliticalExposure: {
    input: "geopoliticalExposure",
    tier: 1,
    tierDefinition: PROVENANCE_TIER_DEFINITIONS[1],
    declaredSource: "Sanctions-screening provider + counsel review; history-desk dossier per record (spec §4.1 GE row)",
    feedStatus: "NO-LIVE-FEED (test fixtures only)",
  },
};

export const SCORING_FEED_DISCLOSURE =
  "§4 eligibility-scoring inputs have NO live data feeds: BIS/AREAER/vendor ingestion does not exist in the codebase; " +
  "every scoring input consumed by this engine is a deterministic test fixture carrying a declared provenance tier " +
  "(types.ts SCORING_INPUT_PROVENANCE); the ≥2-independent-family oracle precondition remains UNMET; no score computed " +
  "by this engine is evidence about any real currency.";
