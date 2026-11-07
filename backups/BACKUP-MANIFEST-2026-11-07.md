# BACKUP MANIFEST — 2026-11-07 (Task 60 / incident #8 closure)

**Trigger:** owner directive — latest git on local server AND cloud · no
database missing/removed · root-cause fix · harden · backup · push.
**Outcome:** local == origin/main == `e62d45e` (verified after push:
`0 0` ahead/behind) · both DBs healthy & advancing · root cause closed
(git-drift guard, RUNBOOK §2.1.3, incident manifest
`backups/INCIDENT-2026-11-07-GIT-DRIFT.md`).

## Layers (dual-layer posture, refreshed this session)

### 1. Cloud layer (git-tracked — the recovery source of record)

- `backups/db-snapshots/latest-chain.sql` — format v2 self-contained,
  tip **h13260 / 26,988 rows** at commit time; **round-trip VERIFIED**
  (`db-restore-verify.ts`: restores to its recorded tip exactly; integrity
  ok; genesis `gen_3baf0dba…` + 8 validators match the live chain).
- `backups/db-snapshots/latest-custom.sql` — 17,273 rows / 14 tables
  (task59 state, incl. AI consensus tables); write-behind loop continues
  refreshing on Δ thresholds (chain Δ≥60 / custom Δ≥400).
- Full git history pushed to `github.com/MITHQALMTQ/MTQ_SIGMA` @ `e62d45e`.

### 2. Local vault (disk-only, this machine)

- **Pre-realign vault** `backups/vault-incident8-20261107-154121/` —
  physical `chain.db` (h4,129 state, 9.4MB) + `custom.db` (13,004-row
  regressed state, 5.4MB) + 425MB full-history git bundle of the amended
  local line (recoverable: `git clone repo-at-amend-9c3ead3.bundle`) +
  upload-evidence copies + SHA-256 manifest. Evidence of the incident's
  pre-recovery state.
- **Post-task60 vault** `mtq-sigma-backups/vault-task60-20261107-161021/` —
  physical `chain.db` (h13,357, SHA-256 `8a3ec204…`) + `custom.db`
  (17,2xx rows, SHA-256 `3fcf6f7a…`) + full-history git bundle @
  `e62d45e` (SHA-256 `dd047609…`, `git bundle verify` = complete history).
- **Self-heal archive** `mtq-sigma-backups/selfheal-archive/` — the
  regressed chain.db/custom.db archived automatically by the task42 boot
  self-heal during recovery (`20261107T154215…` entries).

## Database health (verified this session)

| Check | chain.db | custom.db |
|---|---|---|
| integrity_check | ok | ok |
| tables | 13 | 14 (incl. AiModelCatalog/ConsensusRun/ConsensusVote) |
| tip / rows | h13,357 & advancing | 17,2xx rows & advancing |
| regression detector | OK (mature) | OK (mature) |
| round-trip dump | PASS | (task59 layer, loop-maintained) |

## Verified chain of custody

1. Session-open: incident #8 detected (local 26 behind origin + amend drift
   + route deleted 5th).
2. Pre-realign vault taken → forward-only realign to `4bfe765` → boot
   self-heal restored DBs from cloud layer (+8,944 blocks, +3 tables).
3. Hardening: git-drift guard (harness 6/6) committed as `e62d45e`.
4. Round-trip verified chain dump pushed to cloud.
5. Post-push vault at `e62d45e` + live DBs (this manifest).

**Standing rules:** never overwrite a dump from a DB behind it · never leave
work unpushed (the git-drift guard reminds on every check) · amend only
before push.
