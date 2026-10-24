// MTQΣ EVIDENCE PACKAGE v6 — typed data module for the review-only UI.
// Source of truth: audit-work/v6/*.md (D-1..D-6) + machine JSONs/probe logs in
// audit-work/v6/. Every value here mirrors those artifacts exactly; the UI must
// present this as REVIEW-ONLY with the NOT-ACCEPTED posture (no gate advanced,
// no on-chain action authorized).
//
// Directive: MTQΣ — Evidence Reconciliation and Pre-Remediation Control.

export const EVIDENCE_PACKAGE_META = {
  directive: "MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive",
  status: "NOT ACCEPTED",
  statusDetail:
    "Controlled verification phase. No release gate advanced. No on-chain action authorized or performed. Shadow-enforced posture preserved.",
  baselineCommit: "b68ccb8ebe9a95e24e5c44c4a98c06aae44d26aa",
  baselineNote:
    "Working tree at verification: mode-only chmod residue (0644→0755), content byte-identical to HEAD (hash-verified).",
  remote: "none — no git remote configured; immutability is machine-local until D-1 §7 plan lands",
  mandateSha256: "ac9638200369d066d12e4e2d2b06e1cbeb3e1a0c5e88e3ad5c7cb287defb3a75",
  freshAnchors: {
    monadBlocks: [72486899, 72487204, 72487374, 72488308],
    arcBlocks: [68070028, 68070214, 68070288, 68070826],
    dateUtc: "2026-10-19 20:45–21:05 UTC",
  },
  docsDir: "audit-work/v6/",
} as const;

export type Restriction = { id: string; rule: string; enforced: string };

export const ABSOLUTE_RESTRICTIONS: Restriction[] = [
  { id: "X-1", rule: "No move/mint/burn/redeem/approve/bridge/transfer of any token or native asset", enforced: "Enforced — zero transaction-capable code paths exercised; read-only probes only" },
  { id: "X-2", rule: "No transaction execution against either Genesis Reserve Safe", enforced: "Enforced — view calls only (eth_call/eth_getCode/eth_getStorageAt); Safe nonce unchanged at 0" },
  { id: "X-3", rule: "No deploy/upgrade/modify of any on-chain contract", enforced: "Enforced — all compiles were local solcjs runs; no bytecode was broadcast" },
  { id: "X-4", rule: "No generation/import/exposure of private keys, seeds, or signer credentials", enforced: "Enforced — none touched; the pre-existing committed key literal (C-045) was preserved untouched as evidence and flagged P0" },
  { id: "X-5", rule: "No live trading, reserve operations, or production monetary execution", enforced: "Enforced — ECONOMIC_ELIGIBILITY_ENABLED=false; keeper cannot sign; no broadcast code in app/API" },
  { id: "X-6", rule: "Preserve shadow posture, all evidence, failed tests, and conflict records", enforced: "Enforced — v5 artifacts snapshotted to audit-work/v6/pre-rerun/ before any re-run; adverse findings preserved verbatim" },
  { id: "X-7", rule: "Any on-chain change requires a separate reviewable transaction plan first", enforced: "Enforced — template codified in D-5 Part 3; no plan submitted, no action taken" },
];

export type Deliverable = { id: string; file: string; title: string; summary: string; keyPoints: string[] };

export const DELIVERABLES: Deliverable[] = [
  {
    id: "D-1",
    file: "audit-work/v6/D1-ACCEPTANCE-REPORT.md",
    title: "Corrected Acceptance Report + Evidence Baseline Manifest",
    summary:
      "Commit relationship b24e7e0↔b68ccb8 resolved; hashes (mandate source, sources, lockfile, bytecode keccak/sha256); every documented suite re-run green at the verification baseline HEAD (b68ccb8, 2026-10-19); gate-by-gate status; OD decision matrix; stop-condition dispositions; secure remote + CI proposal.",
    keyPoints: [
      "All suites re-run at the verification baseline HEAD (b68ccb8, 2026-10-19): canonical 250/250 · vectors 66/66 · e2e 26/26 · stress 11/11 · retention PASS · backtest PASS (synthetic-data caveat) · EIP-712 digests 4/4 (digest-level) · onchain 28/28 · lint/tsc clean",
      "Every claim now tied to an exact commit + block anchor; stale references catalogued",
      "No gate advanced; no committee approval exists anywhere in the register",
    ],
  },
  {
    id: "D-2",
    file: "audit-work/v6/D2-CUSTODY-RECONCILIATION.md",
    title: "Custody & Token-Supply Reconciliation Dossier",
    summary:
      "Current / historical / unestablishable custody split per directive §3; all three MTQ candidates reconciled to raw wei on both chains; USDC-side custody closed; bytecode identities keccak-proven.",
    keyPoints: [
      "Genesis Safe 0xE718…A7D0: genuine Safe v1.4.1 but 1/1 deployer-controlled, nonce 0, zero assets (Gen-1/2/3)",
      "NEW C-046: candidate-C genesis 1M sits INSIDE the token contracts (genesisReserve()=self)",
      "NEW C-047: 1.1M genesis USDC is 100% in the deployer EOA on BOTH chains",
      "Historical custody bounded honestly: never-executed (nonce=0) established; never-received NOT provable without logs (RPC limitations characterized)",
    ],
  },
  {
    id: "D-3",
    file: "audit-work/v6/D3-ADDRESS-BOOK-DRAFT.md",
    title: "Corrected Canonical Address Book — DRAFT (human approval required)",
    summary:
      "Per-chain, per-candidate identity by keccak256 of full runtime bytecode — not by name/symbol/supply. Contamination register, false-Safe records, unprobed records. No canonical token auto-selected.",
    keyPoints: [
      "Candidate B (0x0Ac2…/0x2420…) is the only keccak-proven cross-chain-identical token",
      "Both Ecosystem 'Safe' records are the SAME non-Safe contract deployed on both chains (0x3c6c7d25…)",
      "Robinhood chain entirely unprobed incl. its 'Safe (Multi-Sig, 4/7)' label; Solana has two conflicting records",
    ],
  },
  {
    id: "D-4",
    file: "audit-work/v6/D4-SIZE-AND-EXECUTION-TEST-PLAN.md",
    title: "Contract-Size Options Paper + EVM Execution-Test Matrix",
    summary:
      "40,500-byte runtime REPRODUCED exactly; size narrative fully adjudicated (36,706→40,411→40,500); ZERO deployable source exists (C-044); options A–E compared with trust boundaries; execution matrix E-01..E-18 defined (digest ≠ execution).",
    keyPoints: [
      "V3 @ HEAD: 40,500 B (+15,925 over EIP-170) — keccak 0x6b5cf853…",
      "V2 core best case: 24,718 B (cancun, runs=1) — still +142 over; PENDING's 23,220 B claim matches no git source",
      "permit()/delegate()/delegateBySig() have NEVER been execution-tested anywhere in the repo",
      "Committed Foundry FAILURE caches (4 fuzz + 1 reentrancy) must be resolved before any compliance claim",
    ],
  },
  {
    id: "D-5",
    file: "audit-work/v6/D5-REMEDIATION-REGISTER.md",
    title: "Gate-by-Gate Remediation Register",
    summary:
      "R-01..R-16 with owners, dependencies, required evidence, and explicit approval authorities; mandatory transaction-plan template for every on-chain action; strict ordering (key rotation first).",
    keyPoints: [
      "R-01 (P0): purge + rotate the exposed deployer key BEFORE any asset movement",
      "R-02→R-04: reconfigure Safe to 4/7 → declare canonical token → transfer genesis assets (each a reviewed plan)",
      "Gate map: Gate 5 blocked by OD-35/C-043/C-045/C-046/C-047; production (Gate 6) requires independent security review that does not yet exist",
    ],
  },
  {
    id: "D-6",
    file: "audit-work/v6/D6-UNRESOLVED-CLAIMS.md",
    title: "Unresolved & Non-Reproducible Claims Register",
    summary:
      "25 claims with severities retained — disproved, non-reproducible, unresolved, unestablishable, or resolved-this-round (with committed counterevidence). No silent downgrades.",
    keyPoints: [
      "Disproved: 4/7 Safe; 1M-to-Safe genesis; USDC reserve funding; 'empty' failure caches",
      "Non-reproducible: the 23,220 B deployable claim",
      "Unestablishable without archive access: full custody history (Monad RPC refuses ALL log windows incl. 500 blocks)",
    ],
  },
];

export type Finding = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  detail: string;
  refs: string;
};

export const FINDINGS_V6: Finding[] = [
  { id: "C-045", severity: "CRITICAL", title: "Deployer private key committed in repo", detail: "Plaintext secp256k1 key literal at scripts/verify-key-and-audit-roles.ts:5 derives the deployer EOA — sole Safe owner, ~100% of candidate-B genesis supply, all admin roles, 100% of USDC deposits.", refs: "D-5 R-01 (first)" },
  { id: "C-044", severity: "CRITICAL", title: "Zero EIP-170-deployable token source", detail: "V3=40,500 B (+15,925); V2 core 24,718–28,714 B across all settings (+142 best case). PENDING's '23,220 B within limit' matches no source revision in git history.", refs: "D-4" },
  { id: "C-046", severity: "CRITICAL", title: "Candidate-C genesis is self-custodied", detail: "genesisReserve() returns the token contract's own address on both chains; the 1,000,000 MTQ sits inside the token contracts; owner = deployer EOA.", refs: "D-2 §3" },
  { id: "C-047", severity: "CRITICAL", title: "Genesis USDC never left the deployer EOA", detail: "MockUSDC supply = 1,100,000 USDC on each chain, 100.00% held by the deployer; zero at Safe, Mints, Reserves, token contracts.", refs: "D-2 §4" },
  { id: "C-043", severity: "CRITICAL", title: "Safe holds zero of every candidate (reproduced)", detail: "Genesis Safe balance = 0 (native + all MTQ candidates) on both chains across three read generations; Ch. 20.1 step-5 disproved for live deployments.", refs: "D-2 §1/§3" },
  { id: "C-040/OD-35", severity: "CRITICAL", title: "Safe is 1/1 deployer-controlled, not 4/7", detail: "threshold=1, sole owner = deployer EOA, VERSION 1.4.1, nonce=0, modules=0, guard=0x0 — reproduced Gen-1/2/3. T-87 demonstrated-failed.", refs: "D-2 §1" },
  { id: "C-041", severity: "HIGH", title: "Three live MTQ tokens per chain", detail: "MITHQAL / MTQΣ-canonical-map / MTQSigma-deployment-JSON records are three different live contracts per chain; canonical declaration pending governance.", refs: "D-3" },
  { id: "C-042", severity: "HIGH", title: "9+ cross-chain address contaminations", detail: "Same hex hosts different contracts across chains (incl. Oracle↔false-Safe); both Ecosystem 'Safe' records are keccak-proven the same non-Safe contract.", refs: "D-3 §6" },
  { id: "C-049", severity: "MEDIUM", title: "Log history inaccessible via public RPCs", detail: "Monad refuses ALL eth_getLogs windows (incl. 500 blocks, HTTP 413); Arc accepts ≤2,000-block windows (68M blocks ⇒ ~34k requests). Historical custody bounded accordingly.", refs: "D-2 §5" },
  { id: "C-048", severity: "INFO", title: "Bytecode identities keccak-proven", detail: "Safe proxy + singleton + candidate-B byte-identical cross-chain; candidates A/C, Oracle, Governance differ per chain. Upgrades v5's length+prefix inference.", refs: "D-3" },
];

export type SuiteResult = { suite: string; command: string; result: string; note?: string };

export const RERUN_RESULTS: SuiteResult[] = [
  { suite: "Canonical invariants", command: "bun run src/lib/mtq/__tests__/canonical-invariants.ts", result: "250/250 PASS" },
  { suite: "Mandate vectors", command: "bun run src/lib/mtq/__tests__/mandate-vectors.ts", result: "66/66 PASS" },
  { suite: "E2E integration", command: "bun run src/lib/mtq/__tests__/e2e-integration.ts", result: "26/26 PASS" },
  { suite: "Stress re-run", command: "bun run src/lib/mtq/__tests__/stress-rerun.ts", result: "11/11 PASS", note: "S5 survival 100%" },
  { suite: "Audit retention", command: "bun run src/lib/mtq/__tests__/audit-retention-test.ts", result: "PASS" },
  { suite: "Historical backtest", command: "bun run src/lib/mtq/__tests__/historical-backtest.ts", result: "PASS", note: "SYNTHETIC base-fixings data — not real-market evidence" },
  { suite: "EIP-712 digests", command: "node contracts/out-v3/eip712-verify.cjs", result: "4/4 MATCH", note: "digest-level ONLY — no execution test" },
  { suite: "On-chain tests", command: "bun run scripts/run-onchain-tests.ts", result: "28/28 PASS", note: "7 JS-mirror fuzz + 21 read-only RPC invariants" },
  { suite: "Safe configuration probe", command: "bun run scripts/verify-safe.ts", result: "CRITICAL reproduced", note: "both chains, fresh blocks" },
  { suite: "Safe balances probe", command: "bun run scripts/verify-safe-balances.ts", result: "C-043 reproduced" },
  { suite: "Custody inventory", command: "bun run scripts/verify-custody-inventory.ts", result: "new evidence", note: "keccak identities + holder reconciliation" },
  { suite: "USDC custody", command: "bun run scripts/verify-usdc-custody.ts", result: "new evidence", note: "100% in deployer EOA (C-047)" },
  { suite: "ESLint / TypeScript", command: "bun run lint && bun run typecheck", result: "exit 0 / exit 0" },
];

export type CompileRow = {
  source: string; evm: string; runs: number | string; viaIr: boolean;
  runtime: number; over: number; keccak: string; note?: string;
};

export const COMPILE_MATRIX: CompileRow[] = [
  { source: "MTQSigmaV3 @ HEAD (b24e7e0 tree)", evm: "shanghai", runs: 200, viaIr: true, runtime: 40500, over: 15925, keccak: "0x6b5cf853…a03d", note: "reported size REPRODUCED exactly" },
  { source: "MTQSigmaV3 @ a56646b", evm: "shanghai", runs: 200, viaIr: true, runtime: 40411, over: 15835, keccak: "0xab15bb61…f94831", note: "permit+votes added here (+3,705 B)" },
  { source: "MTQSigmaV3 @ c6ec946", evm: "shanghai", runs: 200, viaIr: true, runtime: 36706, over: 12130, keccak: "0xa0eec119…ab16e", note: "docs' baseline confirmed" },
  { source: "MTQSigmaV3 @ c6ec946", evm: "paris", runs: 200, viaIr: true, runtime: 38152, over: 13576, keccak: "0x2c793eee…bd2f", note: "= committed v3-baseline artifact (adjudicated)" },
  { source: "MTQSigmaV2 @ HEAD", evm: "shanghai", runs: 200, viaIr: true, runtime: 24894, over: 318, keccak: "0x7f3dd874…92432" },
  { source: "MTQSigmaV2 @ HEAD", evm: "cancun", runs: 200, viaIr: true, runtime: 24866, over: 290, keccak: "0x9c6ed217…e2388" },
  { source: "MTQSigmaV2 @ HEAD", evm: "shanghai", runs: 200, viaIr: false, runtime: 28714, over: 4138, keccak: "0x61c80a34…36edd" },
  { source: "MTQSigmaV2 @ HEAD", evm: "shanghai", runs: 1, viaIr: true, runtime: 24745, over: 169, keccak: "0xe57bf0d2…5936c" },
  { source: "MTQSigmaV2 @ HEAD", evm: "cancun", runs: 1, viaIr: true, runtime: 24718, over: 142, keccak: "0x0f9c28a7…5404f", note: "BEST CASE — still over the 24,576 B limit" },
];

export type CustodyRow = {
  chain: string; asset: string; address: string; supply: string;
  deployerShare: string; safeShare: string; note: string;
};

export const CUSTODY_TABLE: CustodyRow[] = [
  { chain: "Monad 10143", asset: "Candidate A 'MITHQAL' 0x9e6E…53aD", address: "0x9e6E…53aD", supply: "310.949", deployerShare: "309.949 (−3 wei)", safeShare: "0", note: "1.000000000000000003 MTQ unlocated (dust; needs logs)" },
  { chain: "Monad 10143", asset: "Candidate B 'MTQΣ' 0x0Ac2…982f", address: "0x0Ac2…982f", supply: "1,000,000.00000001998", deployerShare: "~100%", safeShare: "0", note: "byte-identical to Arc candidate B (keccak-proven)" },
  { chain: "Monad 10143", asset: "Candidate C 'MTQΣ' 0x5D95…fd4a", address: "0x5D95…fd4a", supply: "1,012,987", deployerShare: "12,987", safeShare: "0", note: "1,000,000 self-held INSIDE the token contract (C-046)" },
  { chain: "Monad 10143", asset: "MockUSDC 0x28a2…d6DE", address: "0x28a2…d6DE", supply: "1,100,000 USDC", deployerShare: "100.00%", safeShare: "0", note: "C-047 — never left the deployer EOA" },
  { chain: "Arc 5042002", asset: "Candidate A 'MITHQAL' 0x237c…6601", address: "0x237c…6601", supply: "1,000", deployerShare: "999 (−3 wei)", safeShare: "0", note: "1.000000000000000003 MTQ unlocated (dust)" },
  { chain: "Arc 5042002", asset: "Candidate B 'MTQΣ' 0x2420…9897", address: "0x2420…9897", supply: "1,000,000.00000001998", deployerShare: "~100%", safeShare: "0", note: "byte-identical to Monad candidate B (keccak-proven)" },
  { chain: "Arc 5042002", asset: "Candidate C 'MTQ Sigma' 0x826b…63c1", address: "0x826b…63c1", supply: "1,005,889", deployerShare: "5,888", safeShare: "0", note: "1,000,000 self-held INSIDE the token contract (C-046)" },
  { chain: "Arc 5042002", asset: "MockUSDC 0x334D…0dEb", address: "0x334D…0dEb", supply: "1,100,000 USDC", deployerShare: "100.00%", safeShare: "0", note: "C-047 — never left the deployer EOA" },
];

export type GateRow = { gate: string; definition: string; status: string; blockers: string };

export const GATE_STATUS: GateRow[] = [
  { gate: "Gate 1 — closure", definition: "audit + conflict register + J(s) + thresholds; Committee approvals", status: "NOT CLOSED", blockers: "OD-1/2/3/5 OPEN; 49 conflicts registered (C-001..C-049)" },
  { gate: "Gate 2 — shadow on Monad", definition: "shadow implementation operating", status: "SHADOW (permitted)", blockers: "OD-34: oracle real-vs-mock UNDETERMINED; economic eligibility hard-disabled" },
  { gate: "Gate 3 — quant/technical validation", definition: "walk-forward + technical validation", status: "NOT STARTED", blockers: "26 OOS samples insufficient; backtest is synthetic-data; committee not constituted" },
  { gate: "Gate 4 — shadow acceptance", definition: "≥30 days + coverage criteria", status: "NOT STARTED", blockers: "depends on Gate 3" },
  { gate: "Gate 5 — limited live pilot", definition: "requires Gate 4 + OD-6/7/13 approved", status: "BLOCKED (CRITICAL)", blockers: "OD-35 1/1 Safe; C-043/045/046/047 custody concentration + key exposure" },
  { gate: "Gate 6 — production authorization", definition: "governance decision + OD-11", status: "NOT AUTHORIZED", blockers: "upstream gates + independent security review (none exists)" },
  { gate: "Gate 7 — Solana/multichain", definition: "OD-9/OD-10 approved", status: "NOT AUTHORIZED", blockers: "Solana records unverified (two conflicting canonical records)" },
];

export type DecisionRow = { id: string; decision: string; implemented: string; verified: string; proposed: string; approved: string; authorized: string };

export const OD_MATRIX: DecisionRow[] = [
  { id: "OD-1", decision: "Full J(s) definition (κ, reserve-risk term)", implemented: "candidate-v1 (mandate.ts §3.5, uniform κ placeholder)", verified: "unit-tested at reference layer (66/66)", proposed: "candidate only", approved: "OPEN — Quantitative Committee", authorized: "NOT GRANTED" },
  { id: "OD-2", decision: "Threshold policy: $10 absolute vs 1% relative", implemented: "both computed per shadow decision, never combined", verified: "per-decision dual records", proposed: "undecided", approved: "OPEN — Quantitative Committee", authorized: "NOT GRANTED" },
  { id: "OD-3", decision: "Committee constitution, authority, quorum", implemented: "modeled in blueprint.ts GOVERNANCE_LAYERS", verified: "n/a — no human committee exists", proposed: "constitution pending", approved: "OPEN — Project owner + governance", authorized: "NOT GRANTED — blocks Gate 1" },
  { id: "OD-5", decision: "Reserve-risk term & methodology for J(s)", implemented: "zero placeholder registered (never invented)", verified: "placeholder behavior tested", proposed: "methodology pending", approved: "OPEN — Quantitative Committee", authorized: "NOT GRANTED" },
  { id: "OD-29", decision: "Supply cap policy", implemented: "none (no fixed cap)", verified: "documented", proposed: "open", approved: "OPEN", authorized: "NOT GRANTED" },
  { id: "OD-35", decision: "Verify Safe configuration (4/7)", implemented: "reads performed (3 generations)", verified: "VERIFIED-FAILED — 1/1 deployer-controlled", proposed: "reconfigure to 4/7 (R-02)", approved: "governance action pending", authorized: "NOT GRANTED — blocks Gate 5" },
];

export const STOP_CONDITIONS = [
  { condition: "Unexplained supply discrepancy", triggered: true, disposition: "3-wei dust pattern on every candidate (both chains); 1.000000000000000003 MTQ unlocated (candidate A) — recorded, immaterial (10⁻¹⁸), not explainable without logs (C-049)" },
  { condition: "Address mismatch", triggered: true, disposition: "C-041 three-token conflict + C-042 contaminations + 2 unprobed token records + 2 conflicting Solana records (D-3)" },
  { condition: "Inaccessible evidence", triggered: true, disposition: "log history (both chains), Foundry environment (no forge), git remote (none) — all characterized with reproducible probes" },
  { condition: "Failed invariant", triggered: true, disposition: "T-87 Safe 4/7 check failed (1/1); committed Foundry failure caches unresolved; none suppressed" },
  { condition: "Custody-history inconsistency", triggered: true, disposition: "C-043/046/047: Safe holds zero; genesis MTQ + USDC 100% under one exposed key; Ch. 20.1 steps 4–5 disproved for live deployments" },
];

export const REMEDIATION_TOP = [
  { id: "R-01", text: "Purge the committed private key + rotate the deployer key (nothing else may move first)", onChain: true },
  { id: "R-02", text: "Reconfigure the Genesis Safe to 4/7 with constituted signers (plan required)", onChain: true },
  { id: "R-03", text: "Governance declares the canonical MTQ per chain (resolves C-041)", onChain: false },
  { id: "R-04", text: "Transfer/jettison genesis assets to the 4/7 Safe / reserve custodian per approved plan", onChain: true },
  { id: "R-06", text: "Contract-size remediation (D-4 options) + full execution-test matrix green before deploy", onChain: false },
];

export const CLAIM_COUNTS = { total: 25, critical: 5, high: 8, resolvedThisRound: 3 } as const;
