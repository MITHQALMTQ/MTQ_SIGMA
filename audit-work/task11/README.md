# MTQΣ — TASK 11 EVIDENCE PACKAGE (audit-work/task11/)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Task 11 (P0): compromised-key containment & authority-migration READINESS.
**Nothing was executed.** Zero transactions, zero role/authority changes, zero asset
movements, zero deployments. **[C11.1-01]** Key-material disclosure, stated precisely
per channel: the deliverable/evidence **files** contain zero key material beyond redacted
fingerprints (byte-verified); the repository **worktree** contains both literals (2 EVM
files incl. a worklog quote · 6 Solana files); **all 25/25 git commits** contain both;
the EVM literal **was emitted once into the Task 11 session transcript** (PI-3 — a
confirmed disclosure, disclosed in D1/D2); remote/CI/backup/session-retention surfaces are
**UNVERIFIED** (no local remote ≠ no remote copies). Repository cleanup does **not** revoke
a key — on-chain rotation is the only robust containment (D2 §1.4).
Overall release status: **NOT ACCEPTED** (D9).

**Task 11.1 (this revision):** evidence-integrity review and documentation corrections —
see `CORRECTIONS-REGISTER.md` (C11.1-01…05, probe incidents PI-11.1-a…e),
`TASK11-1-FINAL-REVIEW.md`, `OPEN-RISK-AND-APPROVAL-MATRIX.md`; previous versions preserved
byte-identical in `versions/task11-v1/`. No gate advanced by any correction (§7 rule).

## Deliverables

| # | File |
|---|---|
| 1 | `D1-INCIDENT-STATUS.md` — current exposure status, evidence confidence, affected systems |
| 2 | `D2-EXPOSURE-SURFACE.md` — redacted per-key exposure: repo copies, git history, CI/CD, unresolved remote surfaces |
| 3 | `D3-EVM-ROTATION-PLAN.md` — chain-by-chain function-level authority-migration plan (grant-before-revoke; Safe-B 4/7 destination) |
| 4 | `D4-SOLANA-AUTHORITY-PLAN.md` — mint-by-mint authority + disposition; u64/decimals analysis; Squads option (program identity UNVERIFIED) |
| 5 | `D5-TRANSACTION-REGISTER.md` — ordered proposals T-0.x…T-4.x — **PROPOSED — NOT SIGNED — NOT EXECUTED** |
| 6 | `D6-CANONICAL-ARCHITECTURE-DECISIONS.md` — generation comparison; decisions reserved for human governance |
| 7 | `D7-APPROVAL-AND-DEPENDENCY-MATRIX.md` — named approver roles, checkpoints CKPT-0…10, dependency/risks |
| 8 | `D8-POST-REMEDIATION-VERIFICATION.md` — exact tests required before any "contained" claim |
| 9 | `D9-TASK11-RELEASE-GATES.md` — gates evidence; every existing rejection preserved; NOT ACCEPTED |
| 10 | `TASK11-FINAL-REPORT.md` — executive summary + the six required separate statements |
| 11 | **`CORRECTIONS-REGISTER.md`** — Task 11.1 corrections C11.1-01…05 + probe incidents PI-11.1-a…e + five-channel disclosure record + keccak-convention record + preserved-versions manifest |
| 12 | **`TASK11-1-FINAL-REVIEW.md`** — the Task 11.1 review: confirmed observations / analysis / inference / unresolved questions, transcript disclosure explanation, approval queue |
| 13 | **`OPEN-RISK-AND-APPROVAL-MATRIX.md`** — concise open-risk (R-1…R-12) × approval-dependency matrix + standing rules |
| 14 | `versions/task11-v1/` — every pre-correction deliverable preserved byte-identical (sha256 manifest in the corrections register) |

## Reproducible read-only scripts (bun; no dependencies beyond ethers)

- `verify-evm.ts` — fresh EVM census (Monad/Arc/RH): roles, allowances (first-time),
  holders, Safe dossiers, generations, Governor params, selector containment scans,
  native/nonces — hashed transport.
- `verify-solana.ts` — fresh Solana census (both mints, both wallets, ATAs, signatures,
  Squads candidate probe, u64 ceiling tables) — jsonParsed authoritative parse.
- `forensics-census-task11.ts` — offline exposure census (worktree byte-scan, git history
  via stdin-pattern grep, CI/CD inventory, env/db/log scans; literal never printed —
  see the in-file disclosure about the argv incident PI-3 and its fix).
- `hash-anchors.ts` — identity-anchor re-hash under the Tasks-9/10 keccak convention
  (reproduces every Task 10 hash byte-exactly).
- `probe-safe-singleton.ts` — Safe proxy/singleton authenticity probe incl. mainnet
  ground-truth comparison.
- **`redeem-module-forensics.ts` (Task 11.1)** — read-only execution-path forensics:
  full disassembly, complete external-call-site enumeration, per-site selector tracing,
  live storage-slot reads, dispatch extraction, shift-reconstructed-selector scan,
  mainnet SafeL2 canonical re-confirmation.

## Evidence (evidence/)

- `onchain-evm-task11.json` — Monad/Arc/RH fresh state (hashed RPC; failures classified).
- `onchain-solana-task11.json` — Solana fresh state + u64Ceilings + Squads probe.
- `identity-anchors-task11.json` — runtime keccaks (historical convention) + byte-family
  proofs + mainnet singleton anchor.
- `exposure-surface-census-task11.json` — worktree/git/CI/CD/env/db census (redacted).
- `safe-singleton-probe.json` — guard/fallback slot evidence + selector analysis.
- `raw-task11-evm.jsonl` / `raw-task11-solana.jsonl` — timestamped request/response hashes,
  retries, revert classifications, FAILED-UNVERIFIED entries (PI-1/PI-2 preserved).
- **`redeem-module-forensics-task111.json` (Task 11.1)** — the §2 execution-path evidence:
  anchors, call-site traces, dispatch tables, live slots, selector scans (raw-byte keccak
  convention; probe incidents disclosed in-header).
- **`raw-task111-evm.jsonl` (Task 11.1)** — hashed request/response log of the forensics
  probe (all runs preserved).
- **`redeem-module-disassembly-{monad,arc}-{mint,redeem,mtq,algorithm,reserve}.txt`**
  (Task 11.1) — full annotated disassembly listings (metadata boundary marked).

## Headlines (detail in the deliverables)

1. Both keys remain REAL, fully privileged, present in 2+6 worktree files and **25/25
   commits**; one transcript exposure (PI-3) disclosed and channel-scoped **[C11.1-01]**;
   **no git remote is configured on this machine — remote existence UNVERIFIED [C11.1-04]**
   (CKPT-1 attestation required).
2. On-chain state cell-for-cell identical to Task 10 **at the recorded blocks, for every
   probed method and queried cell [C11.1-04]** — no drift observed in probed cells; the 36
   **queried** allowance cells returned zero at those blocks (other combinations
   UNVERIFIED); Safe singleton (SafeL2 v1.4.1 @ `0x29fcB43b…`) byte-identical Monad = Arc =
   Ethereum mainnet **[C11.1-03]**; proxy runtime (171 B) byte-identical **cross-chain**
   — its canonical-reference comparison was NOT performed (UNVERIFIED, no longer claimed);
   proxy and singleton are **different artifacts, never byte-identical to each other**.
3. Monad Redeem-module MINTER anomaly **narrowed to a call-graph-scoped proof
   [C11.1-02]**: six external-call sites enumerated and traced per site; no mint selector in
   **any encoding** (incl. shift-reconstructed — automated scan); zero CALLDATACOPY (no
   forwarding); no DELEGATECALL/CREATE; stored references live-verified (Reserve/Algorithm
   — neither can mint). The role grant remains unexplained and stays an open finding.
   **Correction:** Arc Redeem **does** call burn (shift-encoded selector — Task 11's
   byte-scan missed it); “transferFrom only” is corrected.
4. Complete PROPOSED-only action package: EVM 4/7 Safe-B rotation, Solana authority
   settlement, approval checkpoints, and the exact tests that must pass before anyone
   may say "contained". Phase 0 reclassified as **parallel hygiene — not a prerequisite
   for the chain phases** **[C11.1-05]**.
5. **Nothing was signed or executed. Release status: NOT ACCEPTED.**
