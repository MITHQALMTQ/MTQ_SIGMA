# Incident Manifest — 2026-11-06 Database Regression (Incident #6 of the sandbox re-image class)

**Detected**: 2026-11-06 ~00:4x UTC (this session), via baseline DB row-count comparison
against `backups/BACKUP-MANIFEST-2026-11-06.md` during the standing session-open verification.

**Class**: sandbox filesystem snapshot/re-image regression — the documented Tasks 29–31
and task43a pattern, this time hitting the **data layer** instead of source files.

## What happened

A single event at ~2026-11-06T00:12–00:13Z (evidence: file/dir mtimes; fresh dev-server
start at 00:13; first re-seeded block timestamp `1793923991853` = 00:13:11Z):

1. `db/chain.db` (gitignored) regressed to genesis-scale → the running chain node
   re-seeded a fresh chain (`meta.boot_mode = "re-seeded"`, 4 genesis validators,
   height mining from 1).
2. `db/custom.db` (gitignored) regressed to genesis-scale telemetry (118 rows vs the
   audited 4,414) — schema intact including task42 tables, data gone.
3. `mtq-sigma-backups/2026-11-06-task38-pre/` (disk-only vault) **wiped** — exactly the
   task43a wipe-risk finding.
4. `src/app/api/constituency/upload/route.ts` (git-tracked) **deleted from the working
   tree** — the same file lost in the task43a regression (3rd occurrence).
5. Git-tracked truth fully survived: `backups/db-snapshots/latest-{custom,chain}.sql`
   (the task38-pre CLOUD layer) untouched on disk and byte-verified against the
   manifest SHA-256 fingerprints.

**Unrecoverable loss** (bounded, honest): live writes between the 22:34Z dump and the
00:12Z event — chain blocks h1439→~h1458+ (the task38 audit observed 1392→1458) and
~35 telemetry rows. Everything after recovery resumes from the last cloud-verified
state. **The cloud DB layer built in task38(pre) is what saved the platform from total
devnet-history loss.**

## Recovery executed (forward-only, verified at every step)

1. Restored the upload route from HEAD (`git restore` — byte-exact, empty diff).
2. `verify-upload-path` PASS (LIVE-UPLOADED w/ digest, cleanup).
3. Stopped the dev server; archived the regressed DBs as forensic evidence
   (`mtq-sigma-backups/2026-11-06-incident-regression/`, SHA-256 recorded below).
4. Rebuilt both DBs from the git-tracked cloud dumps:
   `prisma db:push` (custom schema) + `initSchema()` (chain schema) + dump apply.
   Restored: **custom 4,414 rows / 10 tables · chain 3,339 rows / 12 tables @ h1438**,
   `PRAGMA integrity_check` ok on both, genesis hash identical (`gen_3baf0dba…` —
   deterministic genesis ⇒ resume, not re-seed).
5. Restarted the dev server with the double-fork orphan pattern
   (`setsid --fork` — single-fork spawns are reaped by the tool-call teardown).
   Node log: `mode=RESUME`, height resumed at 1438 and is advancing.
6. Verified the full state: validators 8 · accounts 13 · proposals 4 · votes 12 ·
   stakes 4 · unbondings 4 · oracle_observations 72 · oracle_prices 2 · txs 119;
   9/9 key API endpoints 200; oracle prices honestly STALE (fail-closed freshness
   expiry across the incident gap — by design).
7. Post-recovery backup refresh (this is now the latest cloud layer):
   - Physical VACUUM-INTO snapshots: `mtq-sigma-backups/2026-11-06-post-recovery/`
   - Logical dumps refreshed + **round-trip validated** (fresh dumps restore to the
     current tip, integrity ok — the new generator is `scripts/backup-logical-dump.ts`).

## Current verified state (post-recovery fingerprints)

| Artifact | SHA-256 |
|---|---|
| `backups/db-snapshots/latest-custom.sql` (4,449 rows @ refresh) | `af7800cae7109087ebb406911fb9da3e28a91a6dc5a72b22ed5c68071dc87275` |
| `backups/db-snapshots/latest-chain.sql` (3,378 rows @ refresh, h1458) | `da48b1bc24c6743fc82c8138c411a9d465b996071ff045d0e6e74588c0a7f7c5` |
| `mtq-sigma-backups/2026-11-06-post-recovery/custom-…db` (physical) | `89cfd8948b38c11f0750337c282775ab0ba46bc344886f104d8f04c1e9134009` |
| `mtq-sigma-backups/2026-11-06-post-recovery/chain-…db` (physical) | `65b982538bc96151784900c64e4cc088604ba432e3cb44e700ab95e2f3d87626` |
| Forensic `custom-regressed-20261106T0013.db` | `1ffc30bbdb8a56c71bbf95ab604653170d51955e6c91bbb01528939260dbf160` |
| Forensic `chain-regressed-20261106T0013.db` | `069d9d6a3f7620233163658785ba2626f208bb68251d8a64c0e91bbdea82908a` |

## Hardening shipped with this incident

1. **`scripts/check-db-regression.ts`** — genesis-scale detector (chain height floor 500,
   custom rows floor 4000), wired into the session-open battery as **[6/6]** and hard-failing
   the battery. This incident's signature (h≈50 / 118 rows) would have been caught in
   seconds at session open instead of by manual comparison.
2. **`scripts/backup-logical-dump.ts`** — the cloud-layer dump generator committed as a
   durable tool (the task38(pre) dumps were an ad-hoc artifact; the procedure is now
   reproducible in one command per database, round-trip validated).
3. **Restore procedure** (documented here, executed and verified this session):
   - `git restore src/app/api/constituency/upload/route.ts` (if the working-tree loss recurs)
   - stop dev server · archive regressed DBs (forensics)
   - `rm db/custom.db && bun run db:push` then apply `latest-custom.sql` via libsql
     `executeMultiple` (dumps are data-only; they carry their own transaction wrapper)
   - `rm db/chain.db`, create schema via `initSchema()` (or boot the node once against an
     empty file), then apply `latest-chain.sql`
   - restart dev server with the double-fork orphan pattern (`setsid --fork`)
   - verify: `mode=RESUME` in dev.log · height ≥ dump tip · `bash scripts/session-open-battery.sh`
4. Standing lesson reinforced: **the disk-only vault is not durable across re-images —
   the git-tracked cloud layer is the recovery source of record.** Refresh
   `backups/db-snapshots/latest-*.sql` after any substantive data change (one command each).

---

## ROOT-CAUSE REMEDIATION — Task 42 (2026-11-06, same day)

The sections above describe DETECTION and MANUAL recovery. Task 42 closes the
root cause itself: **the databases can still be deleted by a re-image, but the
platform now self-heals in seconds with bounded loss and zero manual work.**

### Root-cause chain (why DBs kept getting "deleted")

1. The sandbox re-image wipes gitignored paths — `db/*.db` and the disk vault
   are gitignored BY DESIGN (continuously-written binaries), so every re-image
   deletes them. This external cause cannot be removed from inside the box.
2. On the next dev-server boot, `ensureChainNode()` found height 0 and
   **silently re-seeded genesis** — actively diverging from the recovered
   history and making the regression worse (the 00:13 re-seed).
3. Detection existed only at session-open (manual, battery [6/6]); the
   watchdog restarted `next dev` with no DB guard; the cloud layer was
   refreshed only manually ("after substantive change") — the incident's
   honest loss bound was ~25h of chain.

### The fix (three independent layers, any one sufficient)

| Layer | Where | What it does |
|---|---|---|
| **Boot self-heal** (primary) | `src/lib/chain/node.ts` `ensureChainNode()` → `src/lib/db-ops.ts` `selfHealDatabases()` | BEFORE any schema/genesis work: if the git-tracked dump is strictly ahead of the live DB (missing / unreadable / genesis-scale), archive the regressed file to `mtq-sigma-backups/selfheal-archive/` and rebuild it from the dump, verified (integrity_check + exact tip). Runs no matter WHO starts the dev server. The silent re-seed path is closed. |
| **Watchdog pre-boot heal + port guard** | `dev-watchdog.sh` v2 | Runs `scripts/db-selfheal.ts` before every `next dev` start; never double-starts a healthy server; supervises passively when :3000 is already up. |
| **Continuous cloud-sync + mid-run guard** | `scripts/db-cloud-sync.ts` (60s loop under the watchdog) | Write-behind refresh of the cloud dumps (chain Δ≥60 blocks ≈ ~5 min worst-case loss; custom Δ≥400 rows). **Refuses to dump a DB that is behind its dump** (a wipe must never overwrite the recovery source). If the live DB falls behind while the server runs (ghost-inode deletion), it SIGTERMs the server (only when the watchdog is alive to restart it) so the reboot heals. |

Safety properties (all enforced in `src/lib/db-ops.ts`):
- **Forward-only**: a live DB at/ahead of its dump is never touched (Phase-C
  drill: chain wiped → chain restored, custom byte-identical by SHA-256).
- **Never destroys the cloud copy**: the refresh path suppresses dumping on
  the regression signature.
- **Atomic dumps**: tmp+rename write — a concurrent git auto-commit can never
  snapshot a torn dump.
- **Verified restores**: integrity_check + exact tip/rows match, else the
  half-built file is deleted and the error is rethrown (nothing boots on a
  torn state).
- **Intentional resets stay possible**: the sentinel `db/ALLOW-GENESIS-RESET`
  (`bun run scripts/db-selfheal.ts --allow-reset "reason"`, first line =
  expiry epoch-ms) stands the auto-heal down while fresh; the session-open
  battery passes with a loud NOTE. Loud-and-acknowledged beats silent loss.
- **Honest instrumentation**: a healed chain records `boot_mode=self-healed`,
  `selfheal_at`, `selfheal_dump` in its meta table.

Dump format upgraded to **v2 self-contained** (schema+data+machine-readable
`-- MTQ-DUMP-TIP rows=… height=… tables=…` line): restoring needs only an
empty file + `executeMultiple()` — no Prisma, no initSchema. Legacy v1 dumps
remain restorable (schema fallback path). NOTE (bug found+fixed during build):
`sqlite_master` stores CREATE statements without trailing semicolons — the
dumper terminates each DDL line explicitly.

### LIVE FIRE-DRILL (executed and verified 2026-11-06 ~01:07–01:10Z)

- **Phase A — healthy restart**: old bare server killed → watchdog adopted the
  port in ~8s → pre-boot heal correctly NO-OP'd ("live at/ahead of cloud
  dumps") → `next dev` booted with v49 code → `mode=RESUME` at h1879.
- **Phase B — full wipe (the incident scenario)**: server+watchdog stopped →
  dumps refreshed at the frozen tip (h1883, round-trip PASS) → **both DB files
  removed** (quarantined to `mtq-sigma-backups/2026-11-06-task42-drill-quarantine/`)
  → `check-db-regression` FAILS loudly (detection) → watchdog relaunched →
  **both DBs auto-RESTORED from the git-tracked dumps in ~5s** → `mode=RESUME`
  at h1883 → height advancing → session-open battery 6/6 PASS. Zero manual
  recovery work, zero loss (drill dumps were taken at the frozen tip).
- **Phase C — selective wipe**: only `db/chain.db` wiped (0-byte) → heal
  archived the dead file, restored chain to h1883, RESUME — **custom.db
  byte-identical before/after (SHA-256 verified)**: the heal never touches a
  healthy DB.
- **Browser E2E post-drill**: app + Overview render live (gold/PAXG/XAUT/RR ∞),
  NOC shows the recovered chain (height 18xx live, validators 8/8), mobile
  390px zero horizontal overflow, ZERO console/page errors. Screenshots:
  `audit-work/v13-task42/`.

### Standing posture after Task 42

- The dev server runs under `dev-watchdog.sh` v2 (self-heal + cloud-sync armed).
  Relaunch if ever absent: `( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )`.
- Cloud layer freshness is now automatic (≤ ~5 min of chain behind worst-case);
  the platform's git auto-commit carries the tracked dumps into history, and
  session-close pushes carry them to origin (the true cloud).
- Worst-case honest loss bound for a re-image: blocks/telemetry since the last
  cloud-sync refresh (minutes) — versus 25h in the original incident.
- Remaining external residual (documented, outside the box): the re-image also
  restores SOURCE to the last auto-committed state; the battery [2/6]
  local==origin check + forward-only `git reset --hard origin/main` recovery
  (Tasks 30/31) remains the guard for that class.
