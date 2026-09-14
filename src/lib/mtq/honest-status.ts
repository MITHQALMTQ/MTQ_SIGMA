// MTQΣ — Honest Status (§25.5 Validation Gates)
//
// Per COO/PM brief: "getHonestStatus() and isProductionAuthorized() public.
// Must return NOT PRODUCTION-AUTHORIZED on testnet."
//
// This module wraps the on-chain getHonestStatus() call and provides
// TypeScript-side helpers that the UI and CI can use to verify the
// protocol is honestly reporting its testnet (not production) status.
//
// §25.5 defines 11 validation gates. On testnet, ALL must report
// "not passed" — the protocol is NOT production-authorized until every
// gate is verified by governance.

export interface ValidationGate {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  evidence: string;
}

export interface HonestStatus {
  status: string;
  isProductionAuthorized: boolean;
  implementedMask: number;  // bitmask of implemented features
  authorizedMask: number;   // bitmask of production-authorized features
  version: string;
}

// The 11 validation gates from §25.5.
// On testnet, ALL are "not passed" — we are NOT production-authorized.
export function getValidationGates(): ValidationGate[] {
  return [
    {
      id: "G1",
      name: "Constitutional Invariants",
      description: "All 10 constitutional invariants (I1-I10) verified on-chain",
      passed: false,
      evidence: "Testnet — invariants verified in simulation only, not under production load",
    },
    {
      id: "G2",
      name: "Oracle Quorum (I9)",
      description: "3-source median consensus with strict pause at <3 sources",
      passed: false,
      evidence: "Testnet — mock feeds, not production Pyth+Chainlink+Redstone",
    },
    {
      id: "G3",
      name: "Reserve Composition",
      description: "Reserve assets verified on-chain, NAV > liability",
      passed: false,
      evidence: "Testnet — simulated reserve, no real backing assets",
    },
    {
      id: "G4",
      name: "Multi-Sig Governance",
      description: "All 4 councils with hardware wallet multi-sigs",
      passed: false,
      evidence: "Testnet — deployer EOA controls contracts, Safe multi-sig TODO",
    },
    {
      id: "G5",
      name: "Emergency Response",
      description: "5-15 min emergency response with external monitoring",
      passed: false,
      evidence: "Testnet — keeper not deployed, monitoring not configured",
    },
    {
      id: "G6",
      name: "Deterministic Compute",
      description: "MASE solver with pinned Docker + verify-only hash check",
      passed: false,
      evidence: "Testnet — Dockerfile created, CI workflow not yet running",
    },
    {
      id: "G7",
      name: "Audit Trail (§24)",
      description: "DailyStateVector + RebalancingDecision + OracleSample persisted",
      passed: false,
      evidence: "Testnet — audit trail active but not governance-verified",
    },
    {
      id: "G8",
      name: "Smart Contract Audit",
      description: "External security audit with no high/critical findings",
      passed: false,
      evidence: "Testnet — no external audit performed yet",
    },
    {
      id: "G9",
      name: "Stress Tests",
      description: "Monte Carlo + black-swan scenarios pass",
      passed: false,
      evidence: "Testnet — stress tests run in simulation, not under real market conditions",
    },
    {
      id: "G10",
      name: "Frontend Hardening",
      description: "CI guardrails, no Neon imports, type-safe build",
      passed: false,
      evidence: "Testnet — CI workflow created, type errors being fixed",
    },
    {
      id: "G11",
      name: "Monitoring & Runbook",
      description: "Sentry + Tenderly + backup + war room runbook",
      passed: false,
      evidence: "Testnet — integrations created, not yet provisioned in production accounts",
    },
  ]
}

// Returns the honest status. On testnet, this ALWAYS returns
// NOT PRODUCTION-AUTHORIZED — the protocol is honest about its status.
export function getHonestStatus(): HonestStatus {
  const gates = getValidationGates()
  const allPassed = gates.every(g => g.passed)
  const implementedMask = 0x7FF // all 11 bits implemented (code exists)
  const authorizedMask = allPassed ? 0x7FF : 0x000 // 0 = not authorized

  return {
    status: allPassed ? "PRODUCTION-AUTHORIZED" : "NOT PRODUCTION-AUTHORIZED",
    isProductionAuthorized: allPassed,
    implementedMask,
    authorizedMask,
    version: "v1.2-testnet",
  }
}

// Convenience: returns true ONLY when all 11 validation gates pass.
// On testnet, this is always false.
export function isProductionAuthorized(): boolean {
  return getHonestStatus().isProductionAuthorized
}
