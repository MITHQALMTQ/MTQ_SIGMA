# MTQΣ — TASK 10 EVIDENCE PACKAGE (audit-work/task10/)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Produced 2026-10-22 · §1 verification-only held throughout: **0 transactions, 0 role changes, 0 asset
movements, 0 key exposure** (all key material redacted to first-6…last-4 fingerprints everywhere).

## Deliverables (required output 1–8)

| # | File |
|---|---|
| 1 | `D1-KEY-INCIDENT-REPORT.md` — redacted C-045 incident report (two REAL exposed keys confirmed) |
| 2 | `D2-CANONICAL-ADDRESS-BOOK-PROPOSAL.md` — three-tier book for human approval; C-041 reserved to governance |
| 3 | `D3-SOURCE-BYTECODE-IDENTITY-MATRIX.md` — identity matrix, selector discovery, deployability per chain |
| 4 | `D4-PRIVILEGE-AUTHORITY-GRAPH.md` — function-level authority graph + corrections (CORR-1) + anomalies |
| 5 | `D5-SUPPLY-GENESIS-CUSTODY-REPORT.md` — mandate vs live reconciliation incl. Solana u64 analysis |
| 6 | `D6-SPEC-DISCREPANCIES.md` — 15 discrepancies with evidence + proposed resolutions + approvals |
| 7 | `D7-REMEDIATION-PLAN.md` — transaction-free K-1…K-7 + phased plan with dependencies/risks/approvals |
| 8 | `D8-RELEASE-GATE-REPORT.md` — updated gates, status preserved: NOT ACCEPTED |

## Tooling (reproducible, re-run with bun)

- `forensics-key-incident.ts` — offline key forensics (derivation, repo+git census, redacted output).
- `onchain-probe.ts` [evm|rh|solana|all] — read-only EVM probes (roles, bytecode, selectors, Safe, generations).
- `solana-probe2.ts` — batched/patient Solana probe (mint layout parse, wallets, signatures, creation tx).
- `supplemental-probe.ts` — generation-holder hunt (self-custody proof) + 4byte selector resolution.

## Evidence files (evidence/)

- `key-incident-forensics.json` (9.95 MB, redaction-swept) — derived addresses, census, git window.
- `onchain-evm.json` — Monad+Arc fresh inventories (18 contracts: code size, keccak, selectors, EIP-1967
  slots, role matrices, balances, Safe dossier, Governor probes, deployer nonces).
- `onchain-robinhood.json` — third-chain probe (RPC alive; fake Safe proven; byte-twin generations).
- `onchain-solana.json` — mint layouts (current + superseded), balances, histories, creation tx.
- `supplemental-generations.json` — generation holder hunt + privilege surfaces + 4byte resolutions.
- `raw-onchain.jsonl` — timestamped request/response log with retries (mirrors Task 9's raw.jsonl practice).

## Headline verdicts (detail in deliverables)

1. **C-045 CONFIRMED REAL ×2**: EVM deployer key (derives to `0x3C39…d8c`) + Solana 4saT key (old-mint
   authority, funded wallet). Both in repo, worklog (EVM), and ALL 24 git commits. Treat as compromised.
2. **Task 9 report error corrected (CORR-1)**: Mint module HOLDS MINTER_ROLE on both MTQ tokens (its own raw
   evidence said so) — "unwired" was wrong; governance remains single-key. No state change occurred between
   Task 9 and Task 10 (cell-for-cell identical live state re-proven).
3. **Supply/genesis**: mandate 1M→Safe unmet everywhere; Monad 310.949 / Arc 1,000 in deployer EOA; gen-A/C
   self-custody 1M each; Solana u64-max deliberate mint, structurally non-conformant at 18 decimals.
4. **Identity**: no deployed contract matches any local build; Governance = two builds at one address;
   Robinhood "Safe" fake (third chain); 4+ live MTQ generations.
5. **Overall: NOT ACCEPTED** — no gate advanced; containment K-1/K-2 is the blocking P0 (owner action).
