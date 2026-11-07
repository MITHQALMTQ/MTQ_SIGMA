# BACKUP MANIFEST — 2026-11-07 Task 61 (incident #9 realignment + hardening)

## Cloud layer (git-tracked, pushed with task61)
- `backups/db-snapshots/latest-chain.sql` — h13,450 · 27,368 rows · 12 tables
  · round-trip VERIFIED (restores to recorded tip exactly; integrity ok;
  genesis gen_3baf0dba… + 8 validators match live).
- `backups/db-snapshots/latest-custom.sql` — 17,273 rows · 13 tables
  (AiModelCatalog 101 · ConsensusRun 50 · ConsensusVote 146) · round-trip
  VERIFIED exact.
- Write-behind: watchdog v4 cloud-sync subloop live (refreshed h13,387→
  h13,450 during the session; Δ60-block threshold observed working).

## Local vaults (disk, gitignored)
- `mtq-sigma-backups/selfheal-archive/gitdrift-20261107-182315/` —
  pre-realign incident-#9 vault: 432MB full-history git bundle (ALL refs
  incl. amended 9c3ead3 + branch backup-incident9-amend) · physical
  chain.db (h4,001) + custom.db (10 tables) pre-realign copies · complete
  upload/ archive (31 files incl. all owner evidence screenshots) ·
  SHA256SUMS (34 entries) · MANIFEST.md (chain of custody).
- `mtq-sigma-backups/selfheal-archive/20261107T182454133Z-chain/` — live
  chain.db casualty archived by boot self-heal (pre-restore state).
- `mtq-sigma-backups/selfheal-archive/20261107T182542648Z-custom/` — live
  custom.db casualty archived by boot self-heal (pre-restore state).
- Git branch `backup-incident9-amend` @ 9c3ead3 — the drifted amend
  preserved as a ref in the local repo.

## DB health (post-task61, verified)
| DB        | integrity | tip/state                          | vs cloud layer |
|-----------|-----------|------------------------------------|----------------|
| chain.db  | ok        | h13,4xx advancing (resumed, no re-seed) | ≥ dump h13,450 (write-behind) |
| custom.db | ok        | 13 tables · 17,2xx rows (catching up after retention-trim) | rolling-window design (−63 and closing) |

## Chain of custody
incident #9 addendum in `backups/INCIDENT-2026-11-07-GIT-DRIFT.md` ·
worklog task61 · commit task61 (evidence audit-work/v20-task61 incl. 30s
live-value video) · all pushes to origin/main.
