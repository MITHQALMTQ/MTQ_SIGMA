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
// ALL parameters PILOT-APPROVED for TESTNET-PILOT shadow operation (owner
// directive 2026-11-03 — D-13.11/D-13.14 recorded with evidence + parameter
// digest in approvals.ts; PRODUCTION Gate-C ratification remains OPEN). LIVE
// scoring feeds are IMPLEMENTED (feeds.ts — BIS/Frankfurter/Yahoo/gold-api/
// COMEX/oracle-ledger/OFAC with per-input statuses; residuals honestly
// labeled). The V4 dynamic-membership contract layer is IMPLEMENTED at the
// source level (contracts/MTQSigmaV4.sol — compiled, UNDEPLOYED; TS reference
// validator contract-v4.ts; design plan status IMPLEMENTED). Posture:
// TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
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

// TASK-39 additions (SERVER-ONLY: approvals digests use node:crypto via
// serialization; feeds uses Prisma) — import directly from these modules in
// client-safe contexts ONLY for contract-v4.ts (pure TS, no node builtins).
export {
  PARAMETER_APPROVAL_LEDGER,
  LIFECYCLE_PARAMETER_CLASS_V2,
  approvalStatusSummary,
  lifecycleParameterDigest,
} from "./approvals";
export type {
  ApprovalAuthority,
  ApprovalScope,
  ApprovalStatusSummary,
  ParameterApprovalRecord,
} from "./approvals";
export {
  V4_CONTRACT_STATUS,
  demonstrateV4ReferenceValidation,
  validateV4WeightSubmission,
} from "./contract-v4";
export type {
  V4ComponentRecordRef,
  V4DemoCase,
  V4LifecycleStatus,
  V4RuleViolation,
  V4ValidationResult,
} from "./contract-v4";
export { buildLiveScoringDossier } from "./feeds";
export type {
  ComponentScoreRow,
  FeedStatus,
  InputFeedRow,
  LegWitness,
  LiveScoringDossier,
} from "./feeds";
