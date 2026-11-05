# Backup Manifest — 2026-11-06 (TASK-38 pre-change)

**Trigger**: owner directive — "harden and backup on local server and on cloud" before
Overview-dashboard audit fixes (TASK-38).

**Git baseline**: `main @ d57c2d1` (task43) — local == origin/main (0/0 ahead/behind),
working tree clean except the new upload. No data loss; no regression.

**Database integrity (pre-backup, verified)**:
- `db/custom.db` — `PRAGMA integrity_check` = **ok** · 11 tables · 4,414 rows total
  (DailyStateVector 228 · OracleSample 1368 · RebalancingDecision 2663 · others 0/1)
- `db/chain.db` — `PRAGMA integrity_check` = **ok** · 13 tables · 3,339 rows total
  (blocks 1392 · events 1613 · txs 119 · oracle_observations 72 · validators 8 ·
  accounts 13 · proposals 4 · votes 12 · stakes 4 · unbondings 4 · oracle_prices 2 · meta 4)
- Live-ness: block height advancing at backup time; `/api/metrics` 200 in ~85ms.

## Layers (dual-location, SHA-256 fingerprints)

### LOCAL (disk-only vault — `mtq-sigma-backups/2026-11-06-task38-pre/`)
| Artifact | Bytes | SHA-256 |
|---|---|---|
| custom-2026-11-06T-task38pre.db (physical) | 1,892,352 | `e1ffeb45497a80882abbeb8b3e4f89571cf0a9e1eb17a3eb20c7315e339bd596` |
| chain-2026-11-06T-task38pre.db (physical) | 3,510,272 | `08a3e35753fc2081e40bb15066e24f341e207b6336235a17dc22d37305b245ca` |
| custom-…-logical.sql (4,414 rows) | 3,095,668 | `34ca97c3cd863fea19e6e0f1fb926c307133ebe84174a4eb4a2ff6782b271953` |
| chain-…-logical.sql (3,339 rows) | 2,799,728 | `6b6b07113fe54b3d4b0334641570c80586df668e294f82478dbf082c38249367` |
| mtq-sigma-full-d57c2d1.bundle (git, --all) | 323,130,300 | `4c3a70dc995206015e529cb394ccc3ab2e282cd30cc2bde1251a05ea2cfbde40` |

### CLOUD (git-tracked — survives total disk loss)
| Artifact | Path | SHA-256 |
|---|---|---|
| latest-custom.sql (logical dump, 4,414 rows) | `backups/db-snapshots/latest-custom.sql` | `34ca97c3cd863fea19e6e0f1fb926c307133ebe84174a4eb4a2ff6782b271953` |
| latest-chain.sql (logical dump, 3,339 rows) | `backups/db-snapshots/latest-chain.sql` | `6b6b07113fe54b3d4b0334641570c80586df668e294f82478dbf082c38249367` |
| Full repo history | GitHub `MITHQALMTQ/MTQ_SIGMA` (origin/main push) | commit-level |

**Restore procedures**:
- Physical: `cp <vault>/custom-…pre.db db/custom.db` (server stopped) — byte-exact.
- Logical: `sqlite3 db/custom.db < latest-custom.sql` after `bun run db:push` (schema);
  chain.db likewise (chain service stopped).
- Git: `git clone mtq-sigma-full-d57c2d1.bundle` or fetch from origin.

**Hardening notes (TASK-38)**:
1. NEW cloud-DB layer: prior protocol kept DB artifacts disk-only (task43a documented
   the wipe risk — the disk-only vault was lost to a snapshot regression while tracked
   manifests survived). This backup closes that gap by tracking the latest logical dumps
   in-git (only `latest-*` overwritten each backup; git history retains prior states).
2. The 323MB bundle + physical copies remain disk-only (repo-size hygiene).
3. No cloud *database service* is wired in this environment (honest note, unchanged) —
   the cloud layer here is the git repository itself.
