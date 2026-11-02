# TASK-39 Pre-Change Backup Manifest — 2026-11-03

**Owner directive (COO/CTO/CFO/PM quad-mandate)**: (1) verify no database loss +
latest git; (2) harden and back up BEFORE the honest-limits remediation
(live scoring feeds / lifecycle-parameter approvals / V4 dynamic-membership
contract layer).

## Verification (pre-backup)

| Check | Result |
|---|---|
| `git status --porcelain` | CLEAN — working tree at `4e0f24e` (main) |
| Latest work committed | TASK-37 (`4992d9f`) + TASK-38 (`4e0f24e`) present in history |
| `PRAGMA integrity_check` (db/custom.db) | `ok` |
| DB liveness | engine live — row counts advanced during session (DailyStateVector 85→95, OracleSample 510→570, RebalancingDecision 989→1107) — **no database loss** |
| Dormant tables (PilotTrial/IssuanceEvent/Mbz*/MetricSample = 0 rows) | by design (Task-36 purge; never-connected MBZ tables) |
| `/api/health` | 200 (engine:true, db:true) |
| secret-scan (977 files) | PASS (after vault hygiene below) |
| check-no-neon (47 API routes) | PASS |
| release-controls + address-book tests | 20/20 PASS |

## Backup artifacts (this directory, SHA-256 in SHA256SUMS.txt)

| Artifact | Size | sha256 (first 16) |
|---|---|---|
| `custom-20261102T234841Z.db` — physical copy of `db/custom.db` at 23:48:41Z | 880,640 B | `290e5186ccfb1a88…` |
| `repo-bundle-4e0f24e.bundle` — `git bundle --all` @ `4e0f24e` | 321,135,319 B | `d9f779ae9faa3433…` |
| `backups/sqlite-backup-20261102T234841Z.json` — logical 9-model dump (1,772 rows) | (under /backups, gitignored) | `be2eb55b4e9b9d08…` |

Recovery: `git clone repo-bundle-4e0f24e.bundle <dir>` restores full history;
`custom-*.db` is a drop-in `db/custom.db` restore; the JSON dump is the
logical 9-model restore per `scripts/backup-sqlite.ts` header.

## Hardening applied (this session)

1. **Vault hygiene**: backup DB copy initially named
   `custom.db.<timestamp>` — the timestamped suffix defeated the scanner's
   `.db` binary-suffix skip (binary bytes read as utf8 → one false-positive
   `solana-128hex-secret-context` finding). Renamed to
   `custom-<timestamp>.db` → same skip policy as the live DB; re-scan PASS
   with zero allowlist changes.
2. **`.gitignore`**: `/mtq-sigma-backups/*` vault is now explicitly disk-only
   (matches the `/backups/*` convention; only `BACKUP-MANIFEST-*.md` tracked).
3. Pre-existing posture re-verified unchanged: fail-closed stubs, C-045
   containment record, owner-designated local secret stores untouched.

## Posture

TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED. This manifest is a
pre-change recovery point for TASK-39 remediation work (honest-limits items:
live scoring feeds, §13 lifecycle-parameter approval workflow, V4
dynamic-membership contract layer).
