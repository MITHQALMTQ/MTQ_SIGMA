// MTQΣ — Consolidated Mandate Register (v5.0 + Ext-1 + Ext-2 + Ext-3)
// =============================================================================
// Machine-readable register of:
//   • Open Decisions OD-1 … OD-38 (v5.0 Part 8.1, Ext-1 Part G, Ext-2 Part K,
//     Ext-3 Part D) with owner, blocking gate, and CURRENT honest status.
//   • Conflict Register C-001 … C-043 with resolutions (C-001..C-040 are the
//     document-defined set; C-041/C-042/C-043 are post-Ext-3 on-chain verification
//     findings recorded 2026-10-19 from audit-work/v5/SAFE-VERIFICATION.md).
//   • Test Matrix T-01 … T-88 with expected results and status labels.
//
// LABEL DISCIPLINE (v5.0 Part 10.2): statuses are NOT interchangeable.
//   implemented        — code exists at the mapped location
//   unit-tested        — vector asserted by runMandateSelfTests() / canonical suite
//   not-demonstrated   — requires live chain / Committee / evidence not yet produced
//   deferred-G5/G7     — out of current gate scope by the documents' own terms
//
// This register is the single compliance source consumed by /api/mandate and
// the Validation section of the Pilot Command Center.

export interface OpenDecision {
  id: string;
  decision: string;
  owner: string;
  blocks: string;
  status: "OPEN" | "IMPLEMENTED-PENDING-APPROVAL" | "SATISFIED-BY-DOCUMENT" | "VERIFICATION-PENDING" | "VERIFIED-FAILED" | "implemented" | "deferred-G5" | "deferred-G7";
  note: string;
  codeRef?: string;
}

export interface ConflictEntry {
  id: string;
  conflict: string;
  resolution: string;
  codeRef?: string;
}

export interface TestEntry {
  id: string;
  test: string;
  expected: string;
  status: "implemented+unit-tested" | "implemented" | "not-demonstrated" | "demonstrated-failed" | "deferred-G5" | "deferred-G7" | "shadow-observed" | "satisfied-by-document";
  codeRef?: string;
}

// =============================================================================
// Open decisions OD-1 … OD-38
// =============================================================================

export const OPEN_DECISIONS: OpenDecision[] = [
  { id: "OD-1", decision: "Full definition of J(s) (tracking coefficients κ, reserve-risk term)", owner: "Quantitative Committee", blocks: "Gate 1; live eligibility", status: "OPEN", note: "Candidate J(s) implemented in mandate.ts (JS_OBJECTIVE_VERSION candidate-v1) with uniform κ placeholder; economic eligibility DISABLED until approval.", codeRef: "mandate.ts §3.5" },
  { id: "OD-2", decision: "Threshold policy: $10 absolute vs 1% relative", owner: "Quantitative Committee", blocks: "Gate 1; live eligibility", status: "OPEN", note: "Both candidates computed on every shadow decision; never combined (THRESHOLD_POLICY.committeeDecision = OPEN).", codeRef: "mandate.ts THRESHOLD_POLICY" },
  { id: "OD-3", decision: "Committee constitution, authority, quorum, escalation", owner: "Project owner + governance", blocks: "Gate 1", status: "OPEN", note: "Governance layer modeled in blueprint.ts GOVERNANCE_LAYERS; human committee not constituted." },
  { id: "OD-4", decision: "Protection-margin calibration / fallback", owner: "Quantitative Committee", blocks: "Gate 3, Gate 5", status: "IMPLEMENTED-PENDING-APPROVAL", note: "Conservative fallback B_time implemented with hard 5% cap; labeled NOT calibrated.", codeRef: "mandate.ts protectionMargin" },
  { id: "OD-5", decision: "Reserve-risk term and methodology for J(s)", owner: "Quantitative Committee", blocks: "Gate 1; live eligibility", status: "OPEN", note: "Registered zero placeholder in jsObjective() — never invented.", codeRef: "mandate.ts jsObjective" },
  { id: "OD-6", decision: "Emergency execution policy", owner: "Committee, Risk Council, Emergency Council", blocks: "Gate 5", status: "implemented", note: "Emergency mode separated (§3.9): only pre-approved risk-reducing actions; EMERGENCY pauses mint+redeem (state-machine.ts).", codeRef: "state-machine.ts" },
  { id: "OD-7", decision: "Keeper accountability mechanism", owner: "Committee + governance", blocks: "Gate 5, Gate 6", status: "implemented", note: "Keeper trust boundary, failover, anti-collusion implemented; bonding/slashing deliberately NOT added (v5.0 §9.1).", codeRef: "mandate.ts C.2" },
  { id: "OD-8", decision: "Initial chain and scope (Monad recommended)", owner: "Project owner + Committee", blocks: "Gate 2", status: "implemented", note: "Monad Testnet 10143 primary; Arc 5042002 separate deployment (results do not transfer).", codeRef: "contracts.ts" },
  { id: "OD-9", decision: "Solana adapter and precision compatibility", owner: "Committee", blocks: "Gate 7", status: "deferred-G7", note: "Solana devnet mint exists; 18-decimal compatibility test deferred to Gate 7." },
  { id: "OD-10", decision: "Multichain accounting and governance", owner: "Committee, legal, governance", blocks: "Gate 7", status: "deferred-G7", note: "Out of current scope per Ext-2 Part A.2." },
  { id: "OD-11", decision: "Commercial evidence", owner: "Product lead + Committee", blocks: "Gate 6", status: "OPEN", note: "No commercial evidence package produced." },
  { id: "OD-12", decision: "Index chain-linking and purchasing-power benchmark", owner: "Quantitative Committee", blocks: "Gate 3", status: "IMPLEMENTED-PENDING-APPROVAL", note: "Canonical chain-linked index implemented (P0-FIX-1) with zero-artificial-return divisor; approval pending.", codeRef: "chain-index.ts" },
  { id: "OD-13", decision: "Reference price vs redemption NAV", owner: "Committee + governance", blocks: "Gate 5", status: "IMPLEMENTED-PENDING-APPROVAL", note: "Resolved in code: redemption settles at NAV_t (P0-FIX-2); divergence surfaced as an audit metric.", codeRef: "engine.ts applyRedeem" },
  { id: "OD-14", decision: "Minimum trade notional and dust threshold policy", owner: "Committee", blocks: "Gate 2", status: "IMPLEMENTED-PENDING-APPROVAL", note: "$100 min notional + dust flags + 0.1%-of-NAV escalation implemented.", codeRef: "mandate.ts minNotionalCheck" },
  { id: "OD-15", decision: "Keeper compensation model", owner: "Governance + Committee", blocks: "Gate 5", status: "deferred-G5", note: "Not required at Gate 2; keeper is protocol-side in the pilot." },
  { id: "OD-16", decision: "Upgradeability strategy (immutable vs proxy)", owner: "Governance + Committee", blocks: "Gate 1", status: "SATISFIED-BY-DOCUMENT", note: "UPGRADEABILITY.md written: Option A (immutable + migration) recommended for token/reserve; UUPS option for MARP logic.", codeRef: "UPGRADEABILITY.md" },
  { id: "OD-17", decision: "Aggregator allowlist and failover policy", owner: "Risk Council", blocks: "Gate 2", status: "implemented", note: "Failover spec implemented (one failover per decision, both quotes logged, better-quote policy, AggregatorUnavailable rejection).", codeRef: "mandate.ts (Ext1 B.2 spec)" },
  { id: "OD-18", decision: "Market-hours registry and settlement windows", owner: "Risk Council + Committee", blocks: "Gate 2", status: "IMPLEMENTED-PENDING-APPROVAL", note: "Registry implemented: PAXG/XAUT London window; outside hours → protection ×2, size ×0.5; blackout → reject.", codeRef: "mandate.ts marketHoursAdjustment" },
  { id: "OD-19", decision: "Oracle health thresholds (WARNING/DEGRADED/HALTED)", owner: "Risk Council + Committee", blocks: "Gate 2", status: "IMPLEMENTED-PENDING-APPROVAL", note: "Ext1 B.1 trigger table implemented verbatim.", codeRef: "mandate.ts checkOracleHealth" },
  { id: "OD-20", decision: "Emergency token rescue parameters", owner: "Governance", blocks: "Gate 5", status: "implemented", note: "rescueToken spec: Safe-only + timelock, reserve assets excluded, reason required; testnet rehearsal deferred to Gate 5.", codeRef: "Ext1 A.6 (contract-side)" },
  { id: "OD-21", decision: "Log retention and legal compliance", owner: "Legal + Governance", blocks: "Gate 5", status: "implemented", note: "Retention table implemented in audit-trail + audit-retention-test.ts (10y decisions, 7y vectors, 3y oracles); legal review pending.", codeRef: "__tests__/audit-retention-test.ts" },
  { id: "OD-22", decision: "Emergency response playbook and communication plan", owner: "Emergency Council + Operations", blocks: "Gate 5", status: "implemented", note: "P1–P4 classifications, escalation matrix, 7 runbooks produced in audit-work (Ext-2 Part J).", codeRef: "audit-work/DELIVERABLE-E-governance-enforcement.md" },
  { id: "OD-23", decision: "Reserve yield strategy", owner: "Committee + Risk Council", blocks: "Gate 5", status: "deferred-G5", note: "Idle reserves in pilot." },
  { id: "OD-24", decision: "MEV protection strategy per chain", owner: "Risk Council + Committee", blocks: "Gate 2", status: "IMPLEMENTED-PENDING-APPROVAL", note: "SubmissionMode DIRECT/PRIVATE_MEMPOOL/COMMIT_REVEAL + commit-reveal state machine implemented.", codeRef: "mandate.ts CommitRevealRegistry" },
  { id: "OD-25", decision: "Native token handling per chain (Arc native USDC)", owner: "Committee + Risk Council", blocks: "Gate 2", status: "implemented", note: "Arc native-USDC convention documented; USDC/USD = 1.0 by construction on Arc, never used as an MTQ peg.", codeRef: "contracts.ts" },
  { id: "OD-26", decision: "Anti-DoS rate limiting on mint/redeem", owner: "Risk Council", blocks: "Gate 2", status: "implemented", note: "rate-limit.ts implements per-address trial throttling + state-dependent mint throttle.", codeRef: "rate-limit.ts, state-machine.ts mintThrottle" },
  { id: "OD-27", decision: "Upgradeable token monitoring (implementation codehash check)", owner: "Risk Council + Committee", blocks: "Gate 2", status: "implemented", note: "Registry records implementation hash; change → WATCH (Ext-2 H.4 pattern in registry review loop).", codeRef: "registry.ts" },
  { id: "OD-28", decision: "Pausable/blacklistable token policy", owner: "Risk Council + Legal", blocks: "Gate 2", status: "implemented", note: "Paused → excluded from LCR, kept in NAV at discount, trades rejected (Ext-2 H.1); blacklist → auto-pause + escalate.", codeRef: "mandate.ts marketHoursAdjustment blackout + engine pegHealth" },
  { id: "OD-29", decision: "Supply cap (maximum total supply? who changes it?)", owner: "Governance (7/7)", blocks: "Gate 5", status: "OPEN", note: "No fixed cap in pilot; supply controlled by mint/burn at reference price; cap policy itself remains OD-29 OPEN (Ext-3 A.7 baseline: no cap initially).", codeRef: "Ext3 A.7" },
  { id: "OD-30", decision: "Frontend / wallet security requirements", owner: "Product + Security", blocks: "Gate 6", status: "OPEN", note: "Out of Gate 2 scope." },
  { id: "OD-31", decision: "MASE per Blueprint Ch.5–7; J(s) §3.5 distinct from 8-term objective", owner: "Committee + Smart-contract lead", blocks: "Gate 2", status: "IMPLEMENTED-PENDING-APPROVAL", note: "8-term objective + 7-model ensemble + softmax α implemented; C-036 separation enforced in code comments + module split (mase.ts vs mandate.ts).", codeRef: "mase.ts §7.4/§7.6" },
  { id: "OD-32", decision: "Mint/redeem per Blueprint Ch.19 with risk-state fee schedule", owner: "Committee + Smart-contract lead", blocks: "Gate 2", status: "implemented", note: "X_net/P_MTQ mint (0.10%), Y×NAV redeem (0.15% N → 1.00% D), τ_user 0.5% slippage guard, MIN 1 MTQ, full-basket default, atomic revert, 6-state fees.", codeRef: "engine.ts applyMint/applyRedeem" },
  { id: "OD-33", decision: "Genesis per Ch.20.1 seven-step with seven-component basket", owner: "Smart-contract lead", blocks: "Gate 2", status: "implemented", note: "Seven-step sequence + verifyIndexBase (supersedes the v1.2 FIVE-currency verifyGFBBase — now checks ALL SEVEN fixings incl. CHF 1.13 + GOLD 2,500) implemented as reference (genesis.ts) AND as an ON-CHAIN public view in MTQSigmaV3.sol (compiles solcjs 0.8.36 zero errors; recomputes Σ Q_i == INDEX_BASE_DENOMINATOR = 1.0000 from the immutable constants + seven-fixing positivity; never reads mutable state so updateIndex()/updateWeights() cannot invalidate it). NOT yet redeployed on-chain — the live contracts predate this function.", codeRef: "genesis.ts + contracts/MTQSigmaV3.sol verifyIndexBase()" },
  { id: "OD-34", decision: "Oracle source addresses and feed configuration per chain", owner: "Smart-contract lead + Risk Council", blocks: "Gate 2", status: "implemented", note: "Per-chain feed-config registry implemented (oracle-feeds.ts): the 8 §17.10 pairs + USDC/USD construct, staleness 60s major-FX/gold + 120s minor-FX/VIX/DXY, ≥3 required families per pair; protocol-owner Oracle.sol code VERIFIED-PRESENT on Monad (5,273 B, block 72,421,819) + Arc (2,601 B, block 68,031,046) by live eth_getCode 2026-10-19 — Robinhood unprobed; ABI unpublished → real-vs-mock UNDETERMINED; adapters compiled not deployed; mock strategy accepted for Gate 2 shadow (Ext-3 A.4).", codeRef: "oracle-feeds.ts + oracle.ts" },
  { id: "OD-35", decision: "Verify Safe configuration (threshold, signers, modules, guard)", owner: "Governance + Security auditor", blocks: "Gate 5", status: "VERIFIED-FAILED", note: "READS PERFORMED 2026-10-19 (T-87 demonstrated, read-only eth_call): genuine Safe v1.4.1 proxy on BOTH chains (singleton 0x29fcB43b…C762, VERSION '1.4.1', nonce 0, 0 modules, guard = address(0)) — but threshold = 1 and owners = [deployer EOA 0x3C39…8d8c]: 1/1 deployer-controlled, NOT the mandated 4/7. CRITICAL security finding — v5.0 §1.4 'reported 4/7' disproven; Gate 5 blocked. Corrective action: constitute 7 signers, set threshold 4, re-run scripts/verify-safe.ts for the VERIFIED 4/7 milestone.", codeRef: "scripts/verify-safe.ts + audit-work/v5/SAFE-VERIFICATION.md" },
  { id: "OD-36", decision: "Repository access and deployment record (commit hash)", owner: "Project owner", blocks: "Gate 1", status: "SATISFIED-BY-DOCUMENT", note: "docs/DEPLOYMENT-RECORD.md written (2026-10-19): repo local (no remote hosting — recorded honestly), branch main, HEAD c6ec946 at record time; per-chain deployed-contract inventory with the live-verified reconciliation (three live MTQ tokens per chain; Ecosystem 'Safes' not Safes); toolchain configs (foundry.toml + solcjs 0.8.36); full test-suite status table (canonical 250/250, mandate-vectors 66/66, e2e 26/26, stress 11/11, backtest 5/5, retention PASS, tsc 0 errors); deployment-scripts inventory with testnet-rehearsal labels; CI/CD ABSENT (dormant workflow files noted); no third-party audit (Gate 5 req); v5.0 §1.4 correction notice included. On-chain deployments (2026-09-05/06) predate available git history — deployment JSONs + live reads are the authoritative record; remote hosting still absent.", codeRef: "docs/DEPLOYMENT-RECORD.md + contracts/deployments/*.json" },
  { id: "OD-37", decision: "MTQ token standard (Permits, Snapshots, restrictions, cap, upgradeability)", owner: "Committee + Legal", blocks: "Gate 5", status: "implemented", note: "Ext-3 A.7 baseline IMPLEMENTED IN THE CONTRACT (prior 'OZ compiled in foundry-out' overclaim eliminated): EIP-2612 permit + nonces + DOMAIN_SEPARATOR and ERC20Votes checkpoint delegation (delegate/delegateBySig/getVotes/getPastVotes/getPastTotalSupply; IERC-5805/IERC-6372 clock) inline in MTQSigmaV3.sol §1.b; no transfer restrictions, no fixed cap (OD-29 OPEN), NOT upgradeable (Option A). Compiled solcjs 0.8.36 zero errors; storage layout unchanged (4 appended slots); EIP-170 FLAG: runtime 40,500 B > 24,576 (V3 was already 36,706 B pre-edit; permit+votes added +3,705, Ext-3 A.3 on-chain verifyIndexBase() added +89 — both pre-deploy flags; committee must split modules before deploy).", codeRef: "contracts/MTQSigmaV3.sol §1.b + contracts/TOKEN-STANDARD.md" },
  { id: "OD-38", decision: "Publish vulnerability disclosure policy", owner: "Security lead + Legal", blocks: "Gate 5", status: "SATISFIED-BY-DOCUMENT", note: "SECURITY.md published: security@ channel, 24h ack / 72h triage SLA, 90-day coordinated disclosure, safe-harbor, severity×funds-at-risk bounty structure.", codeRef: "SECURITY.md" },
];

// =============================================================================
// Conflict register C-001 … C-040
// =============================================================================

export const CONFLICT_REGISTER: ConflictEntry[] = [
  { id: "C-001", conflict: "Direction-agnostic deviation arithmetic", resolution: "Signed post-trade arithmetic + signed improvement (Listing C-1)", codeRef: "mandate.ts signedImprovement" },
  { id: "C-002", conflict: "Dimensionless benefit vs monetary costs", resolution: "Approved J(s) + common numeraire + explicit 1e18 units (Listing C-4 + OD-1)", codeRef: "mandate.ts netBenefitCalculate" },
  { id: "C-003", conflict: "Gas units vs monetary units", resolution: "Validated gas conversion with full-precision mulDiv + recorded fallback policy (Listing C-3)", codeRef: "mandate.ts gasCostEstimate" },
  { id: "C-004", conflict: "Token-decimal precision and rounding", resolution: "Checked conversions + explicit dust rejection (Listing C-2)", codeRef: "mandate.ts to18Exact/from18Exact" },
  { id: "C-005", conflict: "Index chain-linking", resolution: "OD-12 — canonical chain-linked index P0-FIX-1", codeRef: "chain-index.ts" },
  { id: "C-006", conflict: "Reference index vs reserve/redemption NAV", resolution: "OD-13 — redemption settles at NAV; index is audit-only alternative", codeRef: "engine.ts applyRedeem" },
  { id: "C-007", conflict: "$10 vs 1% threshold conflict", resolution: "OD-2 — both computed, none combined, Committee decides", codeRef: "mandate.ts THRESHOLD_POLICY" },
  { id: "C-008", conflict: "Inconsistent historical ETH price assumptions", resolution: "Dimensional gas tests use explicit numeric vectors ($13.50/$45.00); assumed prices never reused as market data", codeRef: "mandate.ts GAS_VECTORS" },
  { id: "C-009", conflict: "Oracle freshness vs executable-quote freshness", resolution: "Five independent timing measurements with per-clock failure policies", codeRef: "mandate.ts buildFiveClocks" },
  { id: "C-010", conflict: "Single EOA holding privileged roles", resolution: "Safe rotation + production privilege separation (Listing C-6 + Part 5.2)", codeRef: "ROLE_ROTATION.md" },
  { id: "C-011", conflict: "Identical Governance/Safe addresses across EVM chains", resolution: "Per-chain independent verification of code, config, roles (common deployer + nonce ≠ CREATE2)", codeRef: "docs/MANDATE-COMPLIANCE.md" },
  { id: "C-012", conflict: "Overshoot example contradicted deviation arithmetic", resolution: "Corrected expected signed improvement; worsening overshoots rejected/resized (T-04b)", codeRef: "mandate.ts C1_TEST_VECTORS" },
  { id: "C-013", conflict: "Sample code accepted unverified gross benefit", resolution: "Benefit bound to approved objective + versioned signed decision record", codeRef: "mandate.ts validateDecisionVersions" },
  { id: "C-014", conflict: "Decimal conversion could silently truncate", resolution: "Reject unsupported precision or exact representation only (PrecisionLoss error)", codeRef: "mandate.ts from18Exact" },
  { id: "C-015", conflict: "Route quote can become stale after decision", resolution: "Quote-age, deadline, slippage and re-quote controls (T-12/T-22)", codeRef: "mandate.ts buildFiveClocks + pipeline step 7" },
  { id: "C-016", conflict: "Testnet status confused with corrected deployment status", resolution: "Deployment tracked by address + code hash + correction version", codeRef: "contracts/deployments + honest-status.ts" },
  { id: "C-017", conflict: "Reentrancy guards unspecified in v5.0", resolution: "Ext-1 A.1: nonReentrant on all external-facing swap paths + CEI ordering", codeRef: "contracts/MTQSigmaV3.sol" },
  { id: "C-018", conflict: "Approval hygiene unspecified", resolution: "Ext-1 A.2: exact approvals, forceApprove, received-amount verification, residual reset", codeRef: "contracts/MTQSigmaV3.sol" },
  { id: "C-019", conflict: "Multi-leg atomicity assumed, not specified", resolution: "Ext-1 A.3: single-tx atomic multi-hop preferred; in-flight intermediate flagged; no second multi-leg until settled", codeRef: "mandate.ts (pipeline contract spec)" },
  { id: "C-020", conflict: "minAmountOut computation decimals ambiguous", resolution: "Ext-1 A.5: slippage computed in OUTPUT token native decimals, floored once", codeRef: "mandate.ts computeMinOut" },
  { id: "C-021", conflict: "No oracle failure escalation levels", resolution: "Ext-1 B.1: WARNING/DEGRADED/HALTED trigger table", codeRef: "mandate.ts checkOracleHealth" },
  { id: "C-022", conflict: "No formal testable invariant set", resolution: "Ext-1 D.2: INV-1…INV-12 hard/soft invariants", codeRef: "mandate.ts checkInvariants" },
  { id: "C-023", conflict: "Reserve NAV computation unspecified in v5.0", resolution: "Ext-2 B.1: haircut NAV (Listing E-1)", codeRef: "engine.ts reserveAssetValues" },
  { id: "C-024", conflict: "RR floors referenced, not computed", resolution: "Ext-2 B.2: three-floor RR (Listing E-2)", codeRef: "engine.ts computeReserveRatio + state-machine" },
  { id: "C-025", conflict: "LCR definition ambiguous", resolution: "Ext-2 B.3: stablecoin-only liquid assets, 25% 30-day stress demand (Listing E-3)", codeRef: "engine.ts computeLcr" },
  { id: "C-026", conflict: "Buffer states referenced, not specified", resolution: "Ext-2 B.4: BASE/STRESS/EMERGENCY with 24h ramps (Listing E-4)", codeRef: "engine.ts updateBufferState" },
  { id: "C-027", conflict: "Daily state vector absent", resolution: "Ext-2 C: DailyStateVector persisted + hash (Listing E-6)", codeRef: "pilot-state.ts + audit-trail.ts" },
  { id: "C-028", conflict: "Asset admission criteria unspecified", resolution: "Ext-2 D: 8 criteria / 4 states registry (Listing E-7)", codeRef: "registry.ts" },
  { id: "C-029", conflict: "De-peg detection absent", resolution: "Ext-2 E: peg bands, 12h confirmation, staged ladder, 5% rule, reintegration score (Listing E-8)", codeRef: "engine.ts updatePegHealth/updateReintegration" },
  { id: "C-030", conflict: "Genesis Reserve/Cold Treasury mechanics absent", resolution: "Ext-2 F: 4/7 Safe, $10k sweep threshold, RR<1.05 replenishment (Listing E-9)", codeRef: "engine.ts maybeTreasurySweep + genesis.ts" },
  { id: "C-031", conflict: "MEV protection referenced, not specified", resolution: "Ext-2 G: per-chain private submission + commit-reveal fallback (Listing E-10)", codeRef: "mandate.ts CommitRevealRegistry" },
  { id: "C-032", conflict: "Pausable/blacklistable token handling absent", resolution: "Ext-2 H: paused → out of LCR, in NAV at discount; blacklist → auto-pause + escalate", codeRef: "engine.ts pegHealth + mandate.ts blackout" },
  { id: "C-033", conflict: "Log retention unspecified", resolution: "Ext-2 I: 10y/7y/3y/1y retention table + hash chain + daily anchor", codeRef: "__tests__/audit-retention-test.ts" },
  { id: "C-034", conflict: "Emergency response playbook absent", resolution: "Ext-2 J: P1–P4 + escalation matrix + 7 runbooks", codeRef: "audit-work deliverables" },
  { id: "C-035", conflict: "Supply cap undefined", resolution: "OD-29 — no fixed cap initially; policy remains open", codeRef: "Ext3 A.7" },
  { id: "C-036", conflict: "v5.0 J(s) confused with Blueprint MASE objective", resolution: "OD-31 — they are different: mase.ts §7.4 8-term portfolio objective ≠ mandate.ts §3.5 trade-gate J(s)", codeRef: "mase.ts + mandate.ts" },
  { id: "C-037", conflict: "Mint/redeem formulas not in extensions", resolution: "OD-32 — Blueprint Ch.19 implemented (formulas, state fees, guards, full basket)", codeRef: "engine.ts applyMint/applyRedeem" },
  { id: "C-038", conflict: "Genesis event not fully specified", resolution: "OD-33 — Blueprint Ch.20.1 seven-step + verifyIndexBase", codeRef: "genesis.ts" },
  { id: "C-039", conflict: "Oracle addresses not specified", resolution: "OD-34 — per-chain registry implemented (oracle-feeds.ts): Monad Oracle 0xDfcA…B713 + Arc Oracle 0xFd2B…861e code VERIFIED-PRESENT by live eth_getCode (2026-10-19); ABI unpublished → real-vs-mock feed contents UNDETERMINED; mock-oracle strategy accepted for Gate 2 shadow (Ext-3 A.4)", codeRef: "oracle-feeds.ts" },
  { id: "C-040", conflict: "Safe configuration assumed, not verified", resolution: "OD-35 — VERIFIED-AND-DISPROVED 2026-10-19: on-chain reads (both chains) show threshold=1, owners=[deployer EOA] — 1/1 deployer-controlled, not 4/7. CRITICAL finding recorded in audit-work/v5/SAFE-VERIFICATION.md; corrective action pending (constitute signers, reconfigure Safe, re-run scripts/verify-safe.ts)", codeRef: "audit-work/v5/SAFE-VERIFICATION.md" },
  { id: "C-041", conflict: "POST-EXT-3 FINDING (outside the document's C-001..C-040 set): three distinct live MTQ token contracts per chain", resolution: "Live ERC-20 reads 2026-10-19: v5.0 §5.1 record (0x9e6E…/0x237c…) is a live token named 'MITHQAL' (supplies 310.949 / 1,000); canonical-map + Ecosystem-JSON record (0x0Ac2…/0x2420…) is a live 'MTQΣ' token with IDENTICAL bytecode and supply 1,000,000.00000001998 cross-chain; deployment-JSON record (0x5D95…/0x826b…) is a live third token (supplies 1,012,987 / 1,005,889). Governance must declare the canonical MTQ contract before any role-rotation rehearsal (T-35/T-87 prerequisite).", codeRef: "audit-work/v5/SAFE-VERIFICATION.md §4" },
  { id: "C-042", conflict: "POST-EXT-3 FINDING (outside the document's C-001..C-040 set): address-book cross-chain contaminations + false Safe records", resolution: "Live probes 2026-10-19: 0xDfcA…B713 is Monad 'Oracle' (5,273 B) but also Arc Ecosystem-JSON 'Safe' (3,321 B — NOT a Safe, 0/7 Safe-interface reads); 0x7435…d316 (Monad Ecosystem-JSON 'Safe') is NOT a Safe; 0xE35a…Bd66 is 'Governance' on BOTH chains with DIFFERENT bytecode (25,819 B vs 13,129 B); Arc Oracle 0xFd2B…861e shares its hex with Robinhood MockUSDC (different chain). The only genuine Gnosis Safe in any record: 0xE718…A7D0 (see C-040).", codeRef: "audit-work/v5/SAFE-VERIFICATION.md §4" },
  { id: "C-043", conflict: "POST-VERIFICATION FINDING (Independent Post-Implementation Verification Mandate §2): the Genesis Reserve Safe has NEVER held any assets — the 1,000,000 genesis MTQ sits 100% in the deployer EOA", resolution: "Live read-only ERC-20 reads 2026-10-19 (scripts/verify-safe-balances.ts, Monad block 72,458,443 / Arc block 68,052,939): balanceOf(0xE718…A7D0) = 0 for ALL candidate MTQ tokens on BOTH chains + zero native balance; the cross-chain-identical 'MTQΣ' token (0x0Ac2…/0x2420…, supply 1,000,000.00000001998) is ~100% held by the deployer EOA 0x3C39…8d8c. Combined with Safe nonce=0 (C-040 evidence): the Safe has never received or executed anything — 'minted 1M MTQ to the Genesis Reserve Safe' (Ch. 20.1 step 5) is DISPROVED for the live testnet deployments. Custody remediation scope expands: declare canonical token (C-041) → constitute signers + 4/7 threshold → actually transfer genesis supply to the Safe → re-run scripts/verify-safe.ts + verify-safe-balances.ts. Gate 5 remains blocked.", codeRef: "audit-work/v5/CUSTODY-BALANCE-REVERIFICATION.md + safe-balance-probe.json" },
  { id: "C-044", conflict: "V6 EVIDENCE-RECONCILIATION FINDING: repository contains ZERO EIP-170-compliant deployable token source — the only 'deployable' size claim is non-reproducible", resolution: "Reproducible compiles at HEAD b68ccb8 (audit-work/v6/compile-repro-*.json, solcjs 0.8.36, standard-JSON): MTQSigmaV3 = 40,500 B runtime (+15,925 over the 24,576 B limit; keccak256(deployed) 0x6b5cf853…a03d — reported size REPRODUCED exactly); MTQSigmaV2 (protocol core, no permit/votes) = 24,894 B (shanghai/200/viaIR), 24,866 B (cancun), 28,714 B (no-viaIR), 24,745 B (runs=1 shanghai), 24,718 B (runs=1 cancun — BEST CASE, still +142 over). MTQSigmaV2-PENDING.json's '23,220 B within-limit' claim matches NO source revision in git history (claimed 1,390 lines; the only revision fb6bb6c has 1,622 lines). Size narrative adjudicated: 36,706 (c6ec946@shanghai) → +3,705 permit+votes (a56646b, 40,411) → +89 verifyIndexBase (HEAD, 40,500); the committed v3-baseline-result.json (38,152 B) is the c6ec946 source compiled with evmVersion=paris — reproduced byte-for-byte. Remediation options paper + mandatory execution-test matrix: audit-work/v6/D4-SIZE-AND-EXECUTION-TEST-PLAN.md; per-chain EIP-170 enforcement confirmation requires an authorized probe (R-14).", codeRef: "audit-work/v6/D4-SIZE-AND-EXECUTION-TEST-PLAN.md + audit-work/v6/compile-repro-*.json" },
  { id: "C-045", conflict: "V6 EVIDENCE-RECONCILIATION FINDING (CRITICAL SECURITY): the deployer EOA's plaintext secp256k1 private key is committed in the repository", resolution: "scripts/verify-key-and-audit-roles.ts:5 contains a plaintext private-key literal which the script itself verifies derives the deployer EOA 0x3C39…8d8c (the sole Safe owner (C-040), holder of ~100% of candidate-B genesis supply on both chains (C-043), owner of all admin roles, and holder of 100% of the MockUSDC genesis deposits (C-047)). The referenced upload/private_key.txt is absent from disk — the script literal IS the live exposure. P0 remediation R-01: purge the literal + audit history strategy + rotate the key BEFORE any asset movement, remote push (a remote would publish the key), or custody reconfiguration. NO on-chain action is authorized until rotation completes.", codeRef: "scripts/verify-key-and-audit-roles.ts + audit-work/v6/D5-REMEDIATION-REGISTER.md (R-01)" },
  { id: "C-046", conflict: "V6 EVIDENCE-RECONCILIATION FINDING: the deployment-JSON MTQSigma tokens' 1,000,000 genesis supply is self-custodied INSIDE the token contracts (genesisReserve() returns the token's own address on both chains)", resolution: "Read-only getter probes 2026-10-19 (scripts/verify-custody-inventory.ts, Monad block 72,486,899 / Arc block 68,070,028): candidate C (0x5D95…fd4a / 0x826b…63c1) genesisReserve() = the token contract itself, holding exactly 1,000,000 MTQ of its own supply on both chains; reserveVault() = owner() = deployer EOA. Supply fully reconciled: Monad 1,012,987 = 12,987 deployer + 1,000,000 self-held; Arc 1,005,889 = 5,888 deployer + 1,000,000 self-held. The mandated '1M to the Genesis Reserve Safe' was implemented as mint-to-self for this family — a design + custody defect requiring governance disposition after canonical declaration (C-041). Ch. 20.1 step-5 remains DISPROVED for the live deployments.", codeRef: "audit-work/v6/custody-inventory-probe.json + audit-work/v6/D2-CUSTODY-RECONCILIATION.md §3" },
  { id: "C-047", conflict: "V6 EVIDENCE-RECONCILIATION FINDING: the 1,100,000 USDC genesis deposit NEVER left the deployer EOA on either chain — no protocol contract and no Safe holds any USDC", resolution: "Read-only probes 2026-10-19 (scripts/verify-usdc-custody.ts, Monad block 72,488,308 / Arc block 68,070,826): MockUSDC (0x28a2…d6DE / 0x334D…0dEb, 6 decimals) totalSupply = 1,100,000 USDC on each chain and balanceOf(deployer EOA) = 100% on BOTH chains; balanceOf = 0 at the Genesis Safe, both Ecosystem MintContracts and ReserveVaults, contracts.ts Mint/Reserve records, and the MTQSigma contracts. Every recorded 'reserve funding' narrative (deployment JSONs reserveUsdc read-backs, Ecosystem funding notes) reflects the deployer's personal holdings, not protocol custody. Ch. 20.1 step-4 (reserve deposit) is DISPROVED for the live deployments alongside step-5 (C-043). Custody remediation R-04 scope expands to the USDC side.", codeRef: "audit-work/v6/usdc-custody-probe.json + audit-work/v6/D2-CUSTODY-RECONCILIATION.md §4" },
  { id: "C-048", conflict: "V6 EVIDENCE-RECONCILIATION (INFORMATIONAL, closes v5 limitation §6.7): full-bytecode identity of every probed contract is now keccak-proven (prior evidence was byte-length + 69-byte prefix only)", resolution: "eth_getCode full-code hashes 2026-10-19 (audit-work/v6/custody-inventory-probe.json): Genesis Safe proxy keccak 0xd7d408eb…31fb4c IDENTICAL on both chains (171 B); singleton 0x29fcB43b…C762 keccak 0xb1f92697…4f81ff IDENTICAL (24,421 B); candidate-B tokens (0x0Ac2…/0x2420…) keccak 0x31496b92…68c0180 IDENTICAL cross-chain (3,413 B) — the only provably cross-chain-identical token; the two false 'Safe' records (0x7435…d316 Monad / 0xDfcA…B713 Arc) are byte-identical TO EACH OTHER (3,321 B, keccak 0x3c6c7d25…be6c04e) — the same non-Safe contract deployed on both chains; candidates A and C and Oracle and Governance records are DIFFERENT contracts per chain (hashes recorded). Address-book identity claims now rest on full-code hashes, not length inferences.", codeRef: "audit-work/v6/custody-inventory-probe.json codeIdentity[] + audit-work/v6/D3-ADDRESS-BOOK-DRAFT.md" },
  { id: "C-049", conflict: "V6 EVIDENCE-RECONCILIATION FINDING: transfer-log history is INACCESSIBLE via the public RPCs, bounding every historical-custody conclusion", resolution: "Reproducible eth_getLogs probing 2026-10-19 (audit-work/v6/logs/log-window-threshold.log + custody-inventory-probe.json logAccess): Monad RPC refuses ALL tested windows — full-range, 100k, 50k, 10k, 2k AND 500 blocks (HTTP 413, verbatim errors recorded); Arc accepts windows ≤ 2,000 blocks (10k+ refused with -32012 'requested range too large') — enumerating Arc's 68M blocks needs ~34,000 requests (infeasible here). Consequence: locations of the 3-wei dust pattern (every candidate, both chains), the 1.000000000000000003 MTQ unlocated for candidate A, and any historical movements CANNOT be established without archive/explorer-grade access (remediation R-12). The v5 'never received' strong-form reading is preserved as recorded but re-classified: never-executed (nonce=0) is established; never-received is not provable without logs.", codeRef: "audit-work/v6/logs/log-window-threshold.log + audit-work/v6/D2-CUSTODY-RECONCILIATION.md §5" },
];

// =============================================================================
// Test matrix T-01 … T-88
// =============================================================================

export const TEST_MATRIX: TestEntry[] = [
  { id: "T-01", test: "Buy underweight asset", expected: "Correct direction; deviation improves; I(q) > 0", status: "implemented+unit-tested", codeRef: "mandate.ts C1_TEST_VECTORS" },
  { id: "T-02", test: "Sell overweight asset", expected: "Correct direction; deviation improves; I(q) > 0", status: "implemented+unit-tested", codeRef: "mandate.ts C1_TEST_VECTORS" },
  { id: "T-03", test: "Wrong-direction trade", expected: "Rejected in normal mode", status: "implemented+unit-tested", codeRef: "mandate.ts isEligibleForNormalMode" },
  { id: "T-04", test: "Overshoot that worsens deviation", expected: "Signed deterioration recorded; resized or rejected", status: "implemented+unit-tested", codeRef: "mandate.ts C1_TEST_VECTORS T-04b" },
  { id: "T-05", test: "Exact-input and exact-output routes", expected: "Correct minAmountOut / maxAmountIn units + enforcement", status: "implemented", codeRef: "engine.ts DEFAULT_SLIPPAGE guards" },
  { id: "T-06", test: "USDC 6-decimal round-trip", expected: "Exact round-trip for representable amounts", status: "implemented+unit-tested", codeRef: "mandate.ts TOKEN_SCALE_VECTORS" },
  { id: "T-07", test: "PAXG 18-decimal round-trip", expected: "Exact round-trip", status: "implemented+unit-tested", codeRef: "mandate.ts TOKEN_SCALE_VECTORS" },
  { id: "T-08", test: "Precision-loss conversion", expected: "Rejected or dust explicitly reported", status: "implemented+unit-tested", codeRef: "mandate.ts from18Exact" },
  { id: "T-09", test: "Gas: 150k × 30 gwei × $3,000", expected: "$13.50 within tolerance", status: "implemented+unit-tested", codeRef: "mandate.ts GAS_VECTORS" },
  { id: "T-10", test: "Gas: 300k × 100 gwei × $1,500", expected: "$45.00 within tolerance", status: "implemented+unit-tested", codeRef: "mandate.ts GAS_VECTORS" },
  { id: "T-11", test: "Fresh route quote + fresh oracle", expected: "Eligible only if every other gate passes", status: "implemented+unit-tested", codeRef: "mandate.ts runMarpPipeline" },
  { id: "T-12", test: "Stale executable quote", expected: "Rejected or requoted", status: "implemented", codeRef: "mandate.ts pipeline step 7" },
  { id: "T-13", test: "Fresh quote but stale oracle", expected: "Rejected", status: "implemented", codeRef: "mandate.ts pipeline step 9" },
  { id: "T-14", test: "Adverse movement between quote and inclusion", expected: "Hard bound enforced; unsafe execution reverts", status: "implemented", codeRef: "engine.ts slippage guards" },
  { id: "T-15", test: "Order exceeds pool depth or approved cap", expected: "Rejected or resized", status: "implemented", codeRef: "marp.ts Level 6" },
  { id: "T-16", test: "Quote-embedded fee", expected: "Not double-counted", status: "implemented", codeRef: "mandate.ts CostItem.quoteEmbedded" },
  { id: "T-17", test: "Fee outside quote", expected: "Added exactly once", status: "implemented", codeRef: "mandate.ts totalIncrementalCost" },
  { id: "T-18", test: "Partial fill", expected: "Residual re-evaluated before retry", status: "implemented", codeRef: "marp.ts deferredUsd residual" },
  { id: "T-19", test: "Reverted transaction", expected: "No false completion claim; costs recorded", status: "implemented", codeRef: "mandate.ts finalityState" },
  { id: "T-20", test: "Oracle-source disagreement", expected: "Approved guardrail, fallback, or pause", status: "implemented", codeRef: "oracle.ts consensus + mandate.ts health" },
  { id: "T-21", test: "Estimated vs realized costs", expected: "Reconciliation recorded", status: "implemented", codeRef: "engine.ts execCostLedger" },
  { id: "T-22", test: "Quote-age boundary", expected: "Reject at the exact approved boundary", status: "implemented", codeRef: "mandate.ts INV-12" },
  { id: "T-23", test: "Decision-to-submission delay", expected: "Reject/requote above approved limit", status: "implemented", codeRef: "mandate.ts clocks.decisionToSubmissionDelay" },
  { id: "T-24", test: "Submission-to-execution delay", expected: "Delay protection + hard bounds", status: "implemented", codeRef: "mandate.ts clocks.submissionToExecutionDelay" },
  { id: "T-25", test: "Settlement/finality delay", expected: "Correct pending/final/reverted handling", status: "implemented", codeRef: "mandate.ts clocks.settlementFinalityDelay" },
  { id: "T-26", test: "Wrong quote asset/side/amount semantics", expected: "Rejected", status: "implemented", codeRef: "mandate.ts TypedPrice.amountSemantics" },
  { id: "T-27", test: "Invalid or manipulated route response", expected: "Rejected by validation + authorization", status: "implemented", codeRef: "mandate.ts pipeline quote validation" },
  { id: "T-28", test: "Overflow and signed arithmetic boundaries", expected: "No wraparound; explicit rejection", status: "implemented+unit-tested", codeRef: "mandate.ts SignedOverflowError" },
  { id: "T-29", test: "Fee-on-transfer or nonstandard token", expected: "Safely rejected unless approved", status: "implemented", codeRef: "Ext1 A.2 pattern (contracts)" },
  { id: "T-30", test: "Emergency mode", expected: "Only pre-approved actions and bounds", status: "implemented", codeRef: "state-machine.ts EMERGENCY" },
  { id: "T-31", test: "Unauthorized keeper or invalid signature", expected: "Rejected", status: "implemented", codeRef: "mandate.ts authorizedSigners + digest" },
  { id: "T-32", test: "Parameter/model version mismatch", expected: "Rejected or quarantined", status: "implemented+unit-tested", codeRef: "mandate.ts validateDecisionVersions" },
  { id: "T-33", test: "Wrong target/parameter chain", expected: "Rejected", status: "implemented", codeRef: "mandate.ts EIP-712 chainId domain" },
  { id: "T-34", test: "Pause and kill switch", expected: "Prohibited executions prevented", status: "implemented", codeRef: "state-machine pausing + mandate HALTED" },
  { id: "T-35", test: "Role rotation", expected: "No privilege gap; final assignments verified", status: "implemented", codeRef: "ROLE_ROTATION.md + scripts/audit-fix-roles.ts" },
  { id: "T-36", test: "Residual after failed/partial execution", expected: "Recomputed with current state + fresh quotes", status: "implemented", codeRef: "marp.ts deferredUsd" },
  { id: "T-37", test: "Netting of opposing flows", expected: "No unnecessary duplicate execution", status: "implemented", codeRef: "marp.ts netNaturalFlow" },
  { id: "T-38", test: "Reserve-solvency boundary", expected: "No execution beyond approved limits", status: "implemented", codeRef: "mandate.ts INV-1" },
  { id: "T-39", test: "Oracle fallback", expected: "Approved policy; usage fully recorded", status: "implemented", codeRef: "mandate.ts gasCostWithFallback + oracle.ts" },
  { id: "T-40", test: "Decision replay", expected: "Duplicate decision cannot execute twice", status: "implemented+unit-tested", codeRef: "mandate.ts DecisionReplayRegistry" },
  { id: "T-41", test: "Reentrancy via malicious token", expected: "Rejected by nonReentrant guard", status: "implemented", codeRef: "contracts/MTQSigmaV3.sol" },
  { id: "T-42", test: "USDT-style approve, fee-on-transfer, residual allowance", expected: "Approve reset; FOT rejected; no residual", status: "implemented", codeRef: "contracts (Ext1 A.2 pattern)" },
  { id: "T-43", test: "Multi-leg swap: leg 1 ok, leg 2 fails", expected: "Rolled back or held with follow-up deadline", status: "implemented", codeRef: "Ext1 A.3 (in-flight policy)" },
  { id: "T-44", test: "Dust below minimum notional", expected: "Held in reserve, flagged, not lost", status: "implemented+unit-tested", codeRef: "mandate.ts minNotionalCheck" },
  { id: "T-45", test: "1% slippage on 6d and 18d tokens", expected: "minAmountOut correct in native decimals", status: "implemented+unit-tested", codeRef: "mandate.ts SLIPPAGE_VECTORS" },
  { id: "T-46", test: "Rescue stuck tokens", expected: "Airdrop rescue ok; reserve asset rejected; allowlist enforced", status: "implemented", codeRef: "Ext1 A.6 (contract-side spec)" },
  { id: "T-47", test: "Oracle health escalation", expected: "WARNING on 1 stale; DEGRADED on 2; HALTED on all; pause triggered", status: "implemented+unit-tested", codeRef: "mandate.ts checkOracleHealth" },
  { id: "T-48", test: "Aggregator failover", expected: "Primary fails → secondary; both fail → correct reason; better-quote policy", status: "implemented", codeRef: "Ext1 B.2 (OD-17)" },
  { id: "T-49", test: "Selective pause", expected: "Only paused asset's trades rejected", status: "implemented", codeRef: "engine.ts eject/peg pause paths" },
  { id: "T-50", test: "EIP-712 signed decisions", expected: "Invalid sig, expired, replayed, cross-chain, stale version all rejected", status: "implemented+unit-tested", codeRef: "mandate.ts tradeDecisionDigest + registry" },
  { id: "T-51", test: "Keeper failover", expected: "Backup after 30 min; keeper ≠ submitter; emergency keeper gated", status: "implemented+unit-tested", codeRef: "mandate.ts authorizedSigners" },
  { id: "T-52", test: "Reserve state recomputation", expected: "NAV/RR/LCR match independent recomputation; event emitted", status: "implemented", codeRef: "engine.ts computeSnapshot per tick" },
  { id: "T-53", test: "Formal invariants", expected: "INV-1 violation → revert; INV-8 → emit + CAUTION", status: "implemented+unit-tested", codeRef: "mandate.ts checkInvariants" },
  { id: "T-54", test: "Market hours", expected: "PAXG outside London → protection ×2, size ×0.5; USDC paused → reject", status: "implemented", codeRef: "mandate.ts marketHoursAdjustment" },
  { id: "T-55", test: "Contract initialization", expected: "Initializer callable once; admin on Safe, not deployer", status: "implemented", codeRef: "contracts/MTQSigmaV3.sol + ROLE_ROTATION.md" },
  { id: "T-56", test: "Deployment ordering", expected: "Correct dependency graph; skipped step fails", status: "implemented", codeRef: "scripts/deploy-ecosystem.ts" },
  { id: "T-57", test: "Upgradeability path", expected: "Chosen path works; other not accidentally enabled", status: "satisfied-by-document", codeRef: "UPGRADEABILITY.md" },
  { id: "T-58", test: "Mock environment", expected: "All mocks compile, deploy, behave", status: "implemented", codeRef: "contracts/test/MTQSigmaV3.t.sol mocks" },
  { id: "T-59", test: "Decision replay (deterministic)", expected: "Valid decision matches; tampered detected", status: "implemented+unit-tested", codeRef: "mandate.ts DecisionReplayRegistry + digest" },
  { id: "T-60", test: "Combined invariants + circuit breaker", expected: "INV violation triggers correct breaker; recovery works", status: "implemented", codeRef: "mandate.ts checkOracleHealth + checkInvariants" },
  { id: "T-61", test: "NAV computation", expected: "Matches independent recomputation; haircuts correct", status: "implemented+unit-tested", codeRef: "engine.ts reserveAssetValues + canonical suite" },
  { id: "T-62", test: "RR computation", expected: "Floors map NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY", status: "implemented+unit-tested", codeRef: "state-machine.ts determineState" },
  { id: "T-63", test: "LCR computation", expected: "Gold not liquid; LCR < 1 → DEFENSIVE", status: "implemented+unit-tested", codeRef: "engine.ts computeLcr" },
  { id: "T-64", test: "Buffer state transitions", expected: "Ramps linear; emergency immediate; recovery confirmed", status: "implemented+unit-tested", codeRef: "engine.ts updateBufferState" },
  { id: "T-65", test: "First-loss waterfall", expected: "Surplus → buffer fiat → buffer gold → core fiat → core gold", status: "implemented+unit-tested", codeRef: "engine.ts applyLoss" },
  { id: "T-66", test: "Reserve stress scenarios", expected: "Coverage ≥ 1.00 or governed recovery", status: "implemented+unit-tested", codeRef: "__tests__/stress-rerun.ts S5/S6/S7" },
  { id: "T-67", test: "Daily state vector", expected: "Hashes match; action = f(state) not f(calendar)", status: "implemented+unit-tested", codeRef: "pilot-state DailyStateVector + I11 test" },
  { id: "T-68", test: "Asset admission", expected: "Invalid haircut rejected; concentration blocks; roles gate transitions", status: "implemented+unit-tested", codeRef: "registry.ts + canonical suite" },
  { id: "T-69", test: "De-peg and eject", expected: "12h detection; ladder stages; 5% rule; emergency bypass; reintegration", status: "implemented+unit-tested", codeRef: "engine.ts updatePegHealth + canonical suite" },
  { id: "T-70", test: "Treasury operations", expected: "Sweep > $10k; replenish RR<1.05 + 4/7; transfer 7/7; 48h timelock", status: "implemented+unit-tested", codeRef: "engine.ts maybeTreasurySweep" },
  { id: "T-71", test: "MEV protection", expected: "Private submission + commit-reveal with timing + replay rejection", status: "implemented+unit-tested", codeRef: "mandate.ts CommitRevealRegistry" },
  { id: "T-72", test: "Token edge cases", expected: "Paused out of LCR; blacklisted pauses; rebasing rejected; codehash change → WATCH", status: "implemented", codeRef: "registry.ts review loop" },
  { id: "T-73", test: "Log retention", expected: "Immutable append; hash chain; public anchor", status: "implemented+unit-tested", codeRef: "__tests__/audit-retention-test.ts" },
  { id: "T-74", test: "Emergency response", expected: "P1 within SLA; matrix correct; post-incident report", status: "implemented", codeRef: "audit-work governance deliverables" },
  { id: "T-75", test: "Combined system shadow", expected: "MASE+MARP+Reserve+Governance consistent decisions", status: "shadow-observed", codeRef: "pilot-state tick + marp.ts mandate shadow" },
  { id: "T-76", test: "Oracle health → reserve → eject cascade", expected: "Degradation + depeg ladder interact correctly", status: "implemented", codeRef: "engine peg/eject under oracle gating" },
  { id: "T-77", test: "Rollback", expected: "Chosen upgradeability path preserves state", status: "implemented", codeRef: "UPGRADEABILITY.md migration plan" },
  { id: "T-78", test: "Emergency Council authority", expected: "All emergency actions 4/7-gated", status: "implemented", codeRef: "blueprint.ts GOVERNANCE_LAYERS" },
  { id: "T-79", test: "Governance parameter change", expected: "Correct authority + timelock; history preserved", status: "implemented", codeRef: "blueprint.ts PARAMETER_REGISTRY" },
  { id: "T-80", test: "Full-stack integration", expected: "T-01..T-79 pass; deployment register; reconciliation report", status: "implemented", codeRef: "audit-work/v5/T01-T88-RECONCILIATION.md — all 88 rows evidence-mapped; suite run 2026-10-19: canonical 250/250, mandate-vectors 66/66, e2e 26/26, stress 11/11, backtest 5/5, retention PASS; hand tally matches registerRollups() exactly; REFERENCE-LAYER reconciliation only — NOT a full gate run (no on-chain gate execution / Committee approvals); deployment register at docs/DEPLOYMENT-RECORD.md" },
  { id: "T-81", test: "MASE weights → MARP targets", expected: "targetW consumed correctly; objectives separate", status: "implemented+unit-tested", codeRef: "mase.ts §7.6 → marp.ts shadow" },
  { id: "T-82", test: "Mint flow", expected: "USDC → MTQ at formula; fee to wallet; state updated", status: "implemented+unit-tested", codeRef: "engine.ts applyMint + canonical suite" },
  { id: "T-83", test: "Redeem flow (full basket)", expected: "Burn MTQ; proportional basket; fee; state updated", status: "implemented+unit-tested", codeRef: "engine.ts applyRedeem" },
  { id: "T-84", test: "Redeem flow (single asset)", expected: "Router converts; minAmountOut enforced", status: "implemented", codeRef: "RedeemSimulator single-asset option" },
  { id: "T-85", test: "Genesis event", expected: "7 steps; denominator 1.0000; 1M MTQ to Safe; event correct", status: "implemented+unit-tested", codeRef: "genesis.ts executeGenesisSequence + contracts/MTQSigmaV3.sol verifyIndexBase() (on-chain view, compiled 0 errors — redeployment pending)" },
  { id: "T-86", test: "Oracle feed configuration", expected: "Feeds read correctly; staleness/confidence/deviation applied", status: "implemented+unit-tested", codeRef: "oracle.ts + oracle-feeds.ts (per-chain registry) + canonical oracle truth table" },
  { id: "T-87", test: "Safe configuration check", expected: "Threshold/signers/modules/guard match 4/7", status: "demonstrated-failed", codeRef: "PERFORMED 2026-10-19 on BOTH chains (read-only): threshold=1, owners=1 (deployer EOA), VERSION 1.4.1, nonce=0, modules=0, guard=address(0) — expected 4/7 NOT MET (OD-35 CRITICAL finding). scripts/verify-safe.ts + audit-work/v5/SAFE-VERIFICATION.md" },
  { id: "T-88", test: "MTQ token standard", expected: "Permits, snapshots, restrictions verified per OD-37", status: "implemented", codeRef: "contracts/MTQSigmaV3.sol §1.b (EIP-2612 + ERC20Votes inline) + contracts/TOKEN-STANDARD.md — solcjs 0.8.36 compiled zero errors; on-chain deployment + audit pending" },
];

// =============================================================================
// Rollups
// =============================================================================

export function registerRollups() {
  const odByStatus = OPEN_DECISIONS.reduce<Record<string, number>>((acc, od) => {
    acc[od.status] = (acc[od.status] ?? 0) + 1;
    return acc;
  }, {});
  const testByStatus = TEST_MATRIX.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    odTotal: OPEN_DECISIONS.length,
    odOpen: OPEN_DECISIONS.filter((o) => o.status === "OPEN").length,
    odByStatus,
    conflictsTotal: CONFLICT_REGISTER.length,
    conflictsResolvedByCode: CONFLICT_REGISTER.filter((c) => c.codeRef).length,
    testsTotal: TEST_MATRIX.length,
    testsUnitTested: TEST_MATRIX.filter((t) => t.status === "implemented+unit-tested").length,
    testsImplemented: TEST_MATRIX.filter((t) => t.status === "implemented").length,
    testsShadow: TEST_MATRIX.filter((t) => t.status === "shadow-observed").length,
    testsNotDemonstrated: TEST_MATRIX.filter((t) => t.status === "not-demonstrated").length,
    testsDemonstratedFailed: TEST_MATRIX.filter((t) => t.status === "demonstrated-failed").length,
    testsDeferred: TEST_MATRIX.filter((t) => t.status.startsWith("deferred") || t.status === "satisfied-by-document").length,
    testByStatus,
  };
}
