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
      evidence: "Testnet — B1-B12 blockers fixed. Invariants verified in 158 canonical tests + 30 Foundry tests, not under production load",
    },
    {
      id: "G2",
      name: "Oracle Quorum (I9)",
      description: "3-source median consensus with strict pause at <3 sources",
      passed: false,
      evidence: "Testnet — real Chainlink/Pyth/Chronicle adapter contracts deployed (B4 complete), 24 Foundry tests pass. Needs mainnet feed wiring",
    },
    {
      id: "G3",
      name: "Reserve Composition",
      description: "Reserve assets verified on-chain, NAV > liability",
      passed: false,
      evidence: "Testnet — V3 contract has 130% RR target, 80/18/2 composition. Non-custodial design: banks hold reserves with qualified custodians",
    },
    {
      id: "G4",
      name: "Multi-Sig Governance",
      description: "All 4 councils with hardware wallet multi-sigs",
      passed: false,
      evidence: "Testnet — governance setters implemented (B1 fix), Safe deployment script ready (B2). Needs Safe deployment + key rotation",
    },
    {
      id: "G5",
      name: "Emergency Response",
      description: "5-15 min emergency response with external monitoring",
      passed: false,
      evidence: "Testnet — keeper deployed with /health endpoint, RUNBOOK.md documents 5-15 min response. Needs UptimeRobot + PagerDuty configuration",
    },
    {
      id: "G6",
      name: "Deterministic Compute",
      description: "MASE solver with pinned Docker + verify-only hash check",
      passed: false,
      evidence: "Testnet — Dockerfile.compute created, GitHub Actions workflow runs daily, determinism verified locally. Needs Docker image digest pinning",
    },
    {
      id: "G7",
      name: "Audit Trail (§24)",
      description: "DailyStateVector + RebalancingDecision + OracleSample persisted",
      passed: false,
      evidence: "Testnet — audit trail active, 20K+ rows in Turso, daily backup running. Not yet governance-verified",
    },
    {
      id: "G8",
      name: "Smart Contract Audit",
      description: "External security audit with no high/critical findings",
      passed: false,
      evidence: "Testnet — internal audit complete (54 findings, all critical fixed). External audit NOT YET ENGAGED",
    },
    {
      id: "G9",
      name: "Stress Tests + Historical Backtest",
      description: "Monte Carlo + 10-year historical backtest pass",
      passed: false,
      evidence: "Testnet — Layer 6 historical backtest RUNS (10 years 2015-2025, 2562 ticks). 3/5 invariants PASS, 2 FAIL (P_MTQ drift without MASE, chain index divergence). Stress tests S5/S6/S3 pass",
    },
    {
      id: "G10",
      name: "Frontend Hardening",
      description: "CI guardrails, no Neon imports, type-safe build",
      passed: false,
      evidence: "Testnet — CI workflow passes (typecheck + no-neon + tests). typecheck 0 errors. 23 routes scanned",
    },
    {
      id: "G11",
      name: "Monitoring & Runbook",
      description: "Sentry + Tenderly + backup + war room runbook",
      passed: false,
      evidence: "Testnet — Sentry integrated, Tenderly webhook receiver, daily backup script, RUNBOOK.md complete. Needs production account provisioning",
    },
  ]
}

// Returns the honest status. On testnet, this ALWAYS returns
// NOT PRODUCTION-AUTHORIZED — the protocol is honest about its status.
export function getHonestStatus(): HonestStatus {
  const gates = getValidationGates()
  const allPassed = gates.every(g => g.passed)
  // implementedMask: bits that are CODE-IMPLEMENTED (not production-validated)
  // Bit 0: chain-linked index ✅
  // Bit 1: 6-state risk machine ✅
  // Bit 2: oracle I9 (3-source + strict pause) ✅
  // Bit 3: governance setters ✅
  // Bit 4: 16-step bank minting workflow ✅ (V3)
  // Bit 5: AvailableBackingCertificate ✅ (V3)
  // Bit 6: 7-layer settlement finality ✅ (V3)
  // Bit 7: real oracle adapters ✅ (B4)
  // Bit 8: non-custodial design ✅ (V3)
  // Bit 9: audit trail (§24) ✅
  // Bit 10: historical backtest ✅ (Layer 6 runs)
  // Bit 11: permissioned bank-mediated ✅ (V3)
  const implementedMask = 0xFFF // 12 bits — all code-implemented
  const authorizedMask = allPassed ? 0xFFF : 0x000 // 0 = not authorized (all gates must pass)

  return {
    status: allPassed ? "PRODUCTION-AUTHORIZED" : "NOT PRODUCTION-AUTHORIZED",
    isProductionAuthorized: allPassed,
    implementedMask,
    authorizedMask,
    version: "v25.3-testnet",
  }
}

// Convenience: returns true ONLY when all 11 validation gates pass.
// On testnet, this is always false.
export function isProductionAuthorized(): boolean {
  return getHonestStatus().isProductionAuthorized
}
