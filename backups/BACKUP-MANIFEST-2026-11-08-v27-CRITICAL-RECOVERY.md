# BACKUP MANIFEST — 2026-11-08 — v27 CRITICAL RECOVERY

**Vault:** `mtq-sigma-backups/recovery-v27-critical-20261108T052951Z/` (on-box; gitignored by design — this manifest is the durable, tracked record)
**Created:** 2026-11-08T05:29:51Z (pre-change, per preserve-before-reset) · trimmed + custody-verified 05:35Z · SHA256SUMS regenerated 05:52Z (30/30 OK)
**Recovery session:** v27 critical directive · HEAD realigned 9fe4058→6243041 via guard FF · DB restored h15,801 → live 15,810+

## Vault contents & provenance

| Path | Provenance class | Notes |
|---|---|---|
| `git-state/local-line-compact.bundle` | NEW-CHECKSUM-ONLY (bundle) | ff67aa2..9fe4058 (`refs/heads/backup-incident10-amend`); unique local line. Full history redundant — durable on origin. 426MB full-history bundle removed 05:35Z (concurrent-executor trim, accepted: complete history already durable on origin) |
| `git-state/{refs,summary,status,local-side-changed,local-only-commit-task46}.txt` | GIT-VERIFIED derivable | git plumbing output at 05:29Z |
| `db-live/chain.db` (h4,199) · `db-live/custom.db` (10 tables/12,395) | NEW-CHECKSUM-ONLY | pre-recovery regressed live state (superseded by h15,801 restore) |
| `dumps/disk-latest-{chain,custom}.sql` | NEW-CHECKSUM-ONLY | write-behind state at 05:29Z (h3,941-era, regressed) |
| `dumps/origin-latest-{chain,custom}.sql` | **GIT-VERIFIED** | byte-identical to origin/main@6243041 blobs — chain h15,801 (32,070 rows) · custom 13 tables/17,673 rows — **the selected authoritative recovery source** |
| `evidence/guard-cli-origin-main.ts` · `evidence/git-drift-lib-origin-main.ts` · `evidence/dev-watchdog-v4-origin-main.sh` · `evidence/{db-selfheal,db-cloud-sync}-origin-main.ts` · `evidence/v26-task61b-cont-REPORT-origin.md` | **GIT-VERIFIED** | pre-fix origin versions (defect evidence) |
| `evidence/dev-watchdog-v2-local-stale.sh` | NEW-CHECKSUM-ONLY | the stale v2 that was running pre-recovery |
| `evidence/git-drift.ts` · `evidence/git-drift-guard.ts` · `evidence/git-drift-quoting.test.ts` | NEW-CHECKSUM-ONLY | the v27 FIXED versions (post-recovery committed to origin) |
| `evidence/cron-jobs.json` | NEW-CHECKSUM-ONLY | jobs 513021/513022 config at 05:30Z |
| `measurements/live-db.json` | NEW-CHECKSUM-ONLY | pre-recovery live measurements |
| `CUSTODY-README.md` · `TRIM-NOTE.txt` · `EXECUTION-COORDINATION.md` | NEW-CHECKSUM-ONLY | custody classes, concurrent-executor record |

## Authoritative recovery source decision (Phase 0/4.1)

- **SELECTED: origin/main@6243041 committed dumps** — chain h15,801 · custom 13/17,673 (newest validated, off-box durable, canonical genesis `gen_3baf0dba…`, task61b-cont round-trip verified).
- backup-2026-11-07 tag (h7,337): older — rejected. Live DBs (h~4.0k, 10 tables): regressed snapshot state — rejected as source.
- **pre61c vault (gitdrift-20261107-182315): WIPED by recycles** (never committed → not durable). Its baseline was h14,564 (older than authoritative anyway). The session's later live state **h15,832 is unrecoverable** — 31 blocks beyond h15,801 have no surviving durable copy. Telemetry-era blocks (rewards_enabled:0, block_reward_u:0 — no monetary state). Documented, not silently discarded.

## The 11 blocked screenshots — durability

Blob `adc0997a…` et al. exist **at origin/main tip (6243041) `upload/`** — byte-identical to the local line's copies. The "unique-content" classification was purely the C-quoting artifact; post-fix the geometry classifies ancestor-blob/derivable. Evidence is durably on origin; on-box copies in `upload/` (tracked) + vault bundle.

## Live state post-recovery (05:50Z)

chain h15,810 contiguous (0 gaps) · validators 8 · integrity ok · boot_mode=self-healed · custom 13 tables/17,539 rows (telemetry-cap deltas only) · server HTTP 200 on realigned code · upload route 403 fail-closed · watchdog v4 supervising (drift OK · source-integrity OK · self-heal · cloud-sync armed).
