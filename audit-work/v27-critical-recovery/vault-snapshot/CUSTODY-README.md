# MTQΣ — CRITICAL RECOVERY VAULT (v27) — CUSTODY NOTES

Vault: recovery-v27-critical-20261108T052951Z (created 2026-11-08T05:29:51Z by an earlier interrupted attempt of directive v27; completed and verified 2026-11-08T05:3xZ).

## Provenance classes
- GIT-VERIFIED (byte-verifiable against git objects): dumps/origin-latest-chain.sql, dumps/origin-latest-custom.sql, evidence/db-selfheal-origin-main.ts, evidence/db-cloud-sync-origin-main.ts, evidence/dev-watchdog-v4-origin-main.sh, evidence/guard-cli-origin-main.ts, evidence/git-drift-lib-origin-main.ts, evidence/v26-task61b-cont-REPORT-origin.md — each hashes to its origin/main blob at 6243041.
- NEW-CHECKSUM-ONLY (no independent historical source; on-box ephemeral state): db-live/chain.db, db-live/custom.db, dumps/disk-latest-*.sql, evidence/upload-archive/** (upload/ is untracked-owner-evidence; the 11 blocked screenshots also live inside local-only commit 9fe4058, itself preserved in git-state/local-line.bundle → dual coverage).
- PRESERVED-BUT-LOST-PROVENANCE: mtq-sigma-backups/selfheal-archive/20261108T050552349Z-chain (EMPTY dir — documents that the 05:05Z boot found a WIPED chain.db and self-healed it from disk dumps; incident class #6 recurrence), 20261108T050556699Z-custom/custom.db (221KB pre-heal nearly-empty custom.db).

## Authoritative recovery source decision (Phase 0)
- origin/main @ 6243041 committed dumps: chain h15,801 (32,070 rows) · custom 13 tables / 17,673 rows — SELECTED (newest validated, off-box durable, genesis gen_3baf0dba canonical, verified round-trip in task61b-cont).
- backup-2026-11-07 tag: h7,337 — older, rejected.
- Live DBs (h~4.0k, 10 tables) — regressed snapshot state, rejected as source.
- pre61c on-box vault (gitdrift-20261107-182315): WIPED by recycles; no durable copy on origin → its claimed h15,832 live state is UNRECOVERABLE (31 blocks beyond 15,801 have no surviving durable copy — documented, not silently discarded).
- Retention note: origin custom dump RebalancingDecision=10,101 vs documented 10,000 telemetry cap — verify implementation in Phase 4.4.
