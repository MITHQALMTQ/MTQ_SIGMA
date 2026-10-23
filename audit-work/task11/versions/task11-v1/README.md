# MTQΣ — TASK 11 EVIDENCE PACKAGE (audit-work/task11/)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Task 11 (P0): compromised-key containment & authority-migration READINESS.
**Nothing was executed.** Zero transactions, zero role/authority changes, zero asset
movements, zero deployments, zero key material published (fingerprint-redacted only).
Overall release status: **NOT ACCEPTED** (D9).

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

## Evidence (evidence/)

- `onchain-evm-task11.json` — Monad/Arc/RH fresh state (hashed RPC; failures classified).
- `onchain-solana-task11.json` — Solana fresh state + u64Ceilings + Squads probe.
- `identity-anchors-task11.json` — runtime keccaks (historical convention) + byte-family
  proofs + mainnet singleton anchor.
- `exposure-surface-census-task11.json` — worktree/git/CI/CD/env/db census (redacted).
- `safe-singleton-probe.json` — guard/fallback slot evidence + selector analysis.
- `raw-task11-evm.jsonl` / `raw-task11-solana.jsonl` — timestamped request/response hashes,
  retries, revert classifications, FAILED-UNVERIFIED entries (PI-1/PI-2 preserved).

## Headlines (detail in the deliverables)

1. Both keys remain REAL, fully privileged, present in 2+6 worktree files and **25/25
   commits**; one NEW transcript exposure (PI-3) disclosed; no remote detectable.
2. On-chain state cell-for-cell identical to Task 10 — no unknown activity; allowances
   all zero (new); Safe infrastructure byte-proven genuine vs mainnet canonical v1.4.1.
3. Monad Redeem-module MINTER anomaly RESOLVED function-level: DORMANT (no mint path in
   bytecode; non-upgradeable) — Task 10 wording narrowed (CORR-6).
4. Complete PROPOSED-only action package: EVM 4/7 Safe-B rotation, Solana authority
   settlement, approval checkpoints, and the exact tests that must pass before anyone
   may say "contained".
5. **Nothing was signed or executed. Release status: NOT ACCEPTED.**
