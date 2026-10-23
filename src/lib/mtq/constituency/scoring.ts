// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — eligibility scoring (spec §4)
// ============================================================================
// Provenance: port of audit-work/task13/evidence/dynamic-replacement/
//   constituency-lifecycle.ts:406-433 (validated prototype — composite γ and
//   hard gates exercised by DR-01/DR-02/DR-08/DR-09/DR-12 on both official
//   runs). Semantics per spec §4.2: composite S_i = Σ γ_k·s_{i,k} (uniform
//  draft γ = 1/9), five hard gates where a composite cannot rescue a failed
//  gate, and tier-labeled provenance inputs (spec §2 — see types.ts
//  SCORING_INPUT_PROVENANCE; NO live feeds exist, fixtures only).
// ============================================================================

import type { HardGateSpec, ScoreInputs } from "./types";
import { SCORING_INPUT_KEYS } from "./types";

/** Composite S_i = Σ_k γ_k·s_{i,k} with uniform γ = 1/9 (spec §4.2 draft —
 *  UNAPPROVED §13). Prototype: constituency-lifecycle.ts:410-415. */
export function compositeScore(inputs: ScoreInputs): number {
  let sum = 0;
  for (const k of SCORING_INPUT_KEYS) sum += inputs[k];
  return sum / SCORING_INPUT_KEYS.length;
}

export interface HardGateResult {
  gate: string;
  value: number;
  threshold: number;
  comparator: string;
  passed: boolean;
}

/** The five hard gates (spec §4.2 draft): L ≥ 0.30, QD ≥ 0.50, CV ≥ 0.50,
 *  JR = 1.0 (all binary gates), BA ≥ 0.60 — UNAPPROVED DRAFT (§13). A failed
 *  gate blocks T2/T3 and forces WATCH if ACTIVE; the composite can NEVER
 *  rescue it. Prototype: constituency-lifecycle.ts:417-433. */
export function evaluateHardGates(inputs: ScoreInputs, gates: HardGateSpec): HardGateResult[] {
  return [
    { gate: "L", value: inputs.liquidity, threshold: gates.liquidityMin, comparator: ">=", passed: inputs.liquidity >= gates.liquidityMin },
    { gate: "QD", value: inputs.dataQuality, threshold: gates.dataQualityMin, comparator: ">=", passed: inputs.dataQuality >= gates.dataQualityMin },
    { gate: "CV", value: inputs.convertibility, threshold: gates.convertibilityMin, comparator: ">=", passed: inputs.convertibility >= gates.convertibilityMin },
    { gate: "JR", value: inputs.jurisdictionalRestrictions, threshold: gates.jurisdictionalRestrictionsExact, comparator: "==", passed: inputs.jurisdictionalRestrictions === gates.jurisdictionalRestrictionsExact },
    { gate: "BA", value: inputs.benchmarkAvailability, threshold: gates.benchmarkAvailabilityMin, comparator: ">=", passed: inputs.benchmarkAvailability >= gates.benchmarkAvailabilityMin },
  ];
}
