// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — barrel exports
// ============================================================================
// Task M8-3a (2026-10-23, owner-delegated): Phase 1 of the approved
// implementation plan (RESULTS.md §2.3) — the registry-based dynamic-membership
// reference layer in the PRODUCTION engine.
//
// QUIESCENT BY DEFAULT: DEFAULT_REGISTRY (registry.ts) initializes to the
// 7-component genesis set (USD/EUR/JPY/GBP/CNY/CHF/Gold at the STRATEGIC_PRIOR
// weights); NO governance directive has ever been applied ⇒ NO transition has
// run; out-of-the-box engine behavior is byte-identical to the pre-M8-3a
// engine. The machinery exists and is exercised only by evidence-checked
// directives supplied in a versioned input dataset.
//
// ALL parameters UNAPPROVED DRAFT (spec §13 — parameters.ts). NO live scoring
// feeds exist (types.ts SCORING_FEED_DISCLOSURE). The contract layer remains
// static (see audit-work/task13/v4-contract-dynamic-membership-design-plan.md,
// PROPOSED). Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// ============================================================================

export type {
  CandidateEvaluation,
  Dataset,
  DecisionRecord,
  DirectiveOutcomeRecord,
  DirectiveType,
  DivisorRecord,
  GlidePlanRecord,
  HardGateSpec,
  LifecycleParameters,
  LifecycleState,
  PeriodCommitRecord,
  PeriodData,
  ProvenanceTier,
  ScoreInputProvenanceRow,
  ScoreInputs,
  ThresholdComparison,
  TransitionRecord,
  UniverseEntry,
  UniverseEvaluationRecord,
} from "./types";
export {
  PROVENANCE_TIER_DEFINITIONS,
  SCORING_FEED_DISCLOSURE,
  SCORING_INPUT_KEYS,
  SCORING_INPUT_PROVENANCE,
} from "./types";

export {
  canonicalSerialize,
  computeDatasetHash,
  decisionRecordDigest,
  serializeDecisionRecord,
  sha256Base64Url,
} from "./serialization";

export * from "./parameters";
export * from "./scoring";
export * from "./weights";

export {
  ComponentRegistry,
  DEFAULT_REGISTRY,
  GENESIS_DOSSIER_REF,
  GENESIS_REGISTRY_ENTRIES,
  createGenesisConstituencyRegistry,
  defaultActiveBasketCount,
  defaultGenesisWeightsBp,
  genesisComponentsFromRegistry,
  lookupBaseFixing,
  lookupEnvelope,
  lookupGenesisWeightBp,
  lookupVelocityPerPeriod,
} from "./registry";
export type { ComponentRegistryEntry, ComponentType } from "./registry";

export { runLifecycleSimulation, glideRawPoint } from "./engine";
export type { RunOptions } from "./engine";
