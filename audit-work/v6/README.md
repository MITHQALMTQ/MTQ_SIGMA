# MTQΣ Evidence Package v6 — Evidence Reconciliation and Pre-Remediation Control (review-only)

**State: NOT ACCEPTED. No release gate advanced. No on-chain action authorized or performed.**
Produced under the *MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive* against HEAD `b68ccb8ebe9a95e24e5c44c4a98c06aae44d26aa` (content-identical working tree — mode-only chmod residue, hash-verified).

## Deliverables (directive §7)

| # | File | Contents |
|---|---|---|
| D-1 | `D1-ACCEPTANCE-REPORT.md` | Corrected acceptance report + evidence baseline manifest: commit relationship `b24e7e0`↔`b68ccb8`, hashes (sources, lockfile, bytecode keccak/sha256), all suite re-runs at HEAD, gate-by-gate status, OD decision matrix, stop-condition dispositions, remote+CI proposal |
| D-2 | `D2-CUSTODY-RECONCILIATION.md` | Custody & supply dossier: current/historical/unestablishable split; all 3 candidates × 2 chains reconciled to raw-wei; candidate-C self-custody discovery; USDC 100%-deployer discovery; bytecode identities |
| D-3 | `D3-ADDRESS-BOOK-DRAFT.md` | Corrected canonical address book — **DRAFT, human approval required**; keccak-based identity; contamination register; unprobed records list; recommendation (no auto-selection) |
| D-4 | `D4-SIZE-AND-EXECUTION-TEST-PLAN.md` | Contract-size remediation options paper (A–E with trust boundaries) + mandatory EVM execution-test matrix (E-01..E-18; digest vs execution kept distinct; Foundry failure caches listed) |
| D-5 | `D5-REMEDIATION-REGISTER.md` | Gate-by-gate remediation register R-01..R-16 with owners, dependencies, evidence requirements, approval authorities; transaction-plan template |
| D-6 | `D6-UNRESOLVED-CLAIMS.md` | 25 unresolved/non-reproducible/disproved claims — severities retained, no silent downgrades |

## Machine evidence (this round, read-only)

- `BASELINE-MANIFEST.txt` — git state + sha256 of 15 key sources
- `custody-inventory-probe.json` — full-bytecode keccak identities, balances, reserve getters, log-access probes
- `usdc-custody-probe.json` — USDC-side custody (new)
- `compile-repro-*.json` — 9 reproducible compiles with bytecode hashes (V3 HEAD = 40,500 B; V2 = 24,718–28,714 B, all over EIP-170)
- `pre-rerun/` — snapshots of all probe/JSON artifacts before re-runs (nothing overwritten)
- `logs/` — complete stdout of every re-run suite and probe

## New findings registered this round (additive; none previously existing were altered)

- **C-044 (CRITICAL)** — no EIP-170-compliant deployable source exists; PENDING size claim non-reproducible
- **C-045 (CRITICAL)** — plaintext deployer private key committed in repo
- **C-046 (CRITICAL)** — candidate-C genesis supply self-custodied inside the token contracts
- **C-047 (CRITICAL)** — 1.1M genesis USDC never left the deployer EOA (both chains)
- **C-048 (INFORMATIONAL)** — bytecode identities keccak-proven (Safe proxy/singleton/candidate-B byte-identical cross-chain; both false-Safes byte-identical to each other)
- **C-049 (MEDIUM)** — log-history inaccessibility characterized (Monad: all windows refused incl. 500 blocks; Arc: ≤2,000-block windows)

## Reproduce everything

```
bun run src/lib/mtq/__tests__/canonical-invariants.ts   # 250/250
bun run src/lib/mtq/__tests__/mandate-vectors.ts        # 66/66
bun run src/lib/mtq/__tests__/e2e-integration.ts         # 26/26
bun run src/lib/mtq/__tests__/stress-rerun.ts            # 11/11
bun run src/lib/mtq/__tests__/audit-retention-test.ts     # PASS
bun run src/lib/mtq/__tests__/historical-backtest.ts     # PASS (synthetic-data caveat)
bun run scripts/run-onchain-tests.ts                      # 28/28 read-only
bun run scripts/verify-safe.ts                            # CRITICAL reproduced
bun run scripts/verify-safe-balances.ts                   # C-043 reproduced
bun run scripts/verify-custody-inventory.ts               # read-only
bun run scripts/verify-usdc-custody.ts                    # read-only
node contracts/out-v3/eip712-verify.cjs                   # digest-level 4/4
node contracts/out-v3/compile-repro-hash.mjs contracts/MTQSigmaV3.sol MTQSigmaV3 <label>
bun run lint && bun run typecheck                         # exit 0 / exit 0
```

*All on-chain interactions in this package are read-only view calls. Production reserve trading remains NOT AUTHORIZED.*
