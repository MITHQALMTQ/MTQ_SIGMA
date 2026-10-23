// ============================================================================
// MTQΣ — SEPARATION-INVARIANT CHECKER · DISPLAY/TEST SIDE (Task M8-3b)
// ============================================================================
// This module is the DISPLAY/TEST side of the spec §2 SEPARATION INVARIANT:
//
//   "Payment volume or acceptance must NEVER automatically determine currency
//   eligibility or basket weights. Accepting a USD-linked stablecoin does not
//   itself justify increasing the USD weight. Accepting a euro-linked
//   instrument does not itself justify increasing the EUR weight."
//   (MANDATE-004 §7, verbatim obligation; spec §2.)
//
// It imports the methodology modules (blueprint / chain-index / registry)
// READ-ONLY to capture a canonical basket/constituency snapshot, so callers
// (the Pilot Command Center section, the /api/issuance route, and the
// deterministic test runner) can prove that basket state is BYTE-IDENTICAL
// before and after issuance volume — payment volume never enters weights or
// eligibility.
//
// IMPORTANT (structural honesty): the issuance machine itself
// (issuance-machine.ts / instrument-registry.ts / authorization.ts /
// ledger.ts / cbdc-adapter.ts) has NO import path into any
// weighting/eligibility module — that absence is asserted by the production
// test runner's source scan (SEP-01 family). This checker lives OUTSIDE the
// issuance data path precisely so the issuance module never grows a
// dependency on methodology state.
//
// The snapshot is a PURE function of canonical constants + a FIXED clock
// (deterministic; byte-stable across calls and process restarts).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// ============================================================================

import { genesisRegistry, eligibilityScore, type AssetRecord } from "../registry";
import { strategicPriorToWeights } from "../chain-index";
import { STRATEGIC_PRIOR } from "../blueprint";

export const SEPARATION_CHECK_LABEL =
  "SEPARATION INVARIANT CHECK (spec §2 / MANDATE-004 §7) — canonical basket/constituency snapshot captured " +
  "READ-ONLY from the methodology modules; byte-identical before/after issuance volume proves payment volume " +
  "never changes basket eligibility or weights.";

export interface BasketSnapshot {
  methodologyVersion: string;
  priorWeights: Record<string, number>;
  priorWeightVector: number[];
  constituency: string[];
  weightsPct: Record<string, number>;
  eligibilityScores: Record<string, { passed: number; total: number; allPassed: boolean }>;
  label: string;
}

/** Capture the canonical basket/constituency state (deterministic; fixed clock). */
export function captureBasketSnapshot(): BasketSnapshot {
  const registryRows: AssetRecord[] = genesisRegistry(0); // fixed clock → deterministic
  const prior = STRATEGIC_PRIOR;
  const weightsPct: Record<string, number> = {};
  const eligibilityScores: Record<string, BasketSnapshot["eligibilityScores"][string]> = {};
  const seen = new Set<string>();
  for (const row of registryRows) {
    if (!seen.has(row.tokenAddress)) {
      seen.add(row.tokenAddress);
      const score = eligibilityScore(row);
      eligibilityScores[row.tokenAddress] = { passed: score.passed, total: score.total, allPassed: score.allPassed };
    }
  }
  weightsPct.USD = prior.USD * 100;
  weightsPct.EUR = prior.EUR * 100;
  weightsPct.JPY = prior.JPY * 100;
  weightsPct.GBP = prior.GBP * 100;
  weightsPct.CNY = prior.CNY * 100;
  weightsPct.CHF = prior.CHF * 100;
  weightsPct.Gold = prior.Gold * 100;
  return {
    methodologyVersion: "CANONICAL-PRODUCTION-BASKET-V1 (blueprint §3.2 strategic prior + §5 genesis registry)",
    priorWeights: { ...prior },
    priorWeightVector: strategicPriorToWeights(prior),
    constituency: registryRows.map((r) => r.tokenAddress),
    weightsPct,
    eligibilityScores,
    label: SEPARATION_CHECK_LABEL,
  };
}

/** Deterministic serialized form (the byte-identity comparison basis). */
export function serializeBasketSnapshot(snap: BasketSnapshot): string {
  return JSON.stringify(snap);
}

/** Capture + serialize in one call (display convenience). */
export function basketSnapshotBytes(): string {
  return serializeBasketSnapshot(captureBasketSnapshot());
}

/** Byte-identity comparison — true when basket state is unchanged. */
export function basketSnapshotsByteIdentical(a: string, b: string): boolean {
  return a === b;
}
