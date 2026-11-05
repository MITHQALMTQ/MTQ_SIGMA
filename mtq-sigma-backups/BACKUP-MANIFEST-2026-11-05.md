# Backup & Integrity Manifest — 2026-11-05 (Task 43 pre-flight)

## Incident record (honest, forensics-first)

- **Event**: Between 2026-11-05 17:02 UTC (task42 commit `b648935`, pushed to `origin/main`) and ~20:34 UTC, the sandbox experienced a **snapshot regression** (the documented Tasks 29–31 pattern: filesystem re-image, NOT a git rollback).
- **Losses observed**:
  1. `src/app/api/constituency/upload/route.ts` (168 lines / 6,913 B — built and E2E-verified in task42 as the AREAER operator-upload ingestion path) was deleted from the working tree. A platform auto-commit `094c4e0` (author "Z User", UUID subject `4dea726e-…`) captured the deletion at 20:34:11 UTC.
  2. `mtq-sigma-backups/` (disk-only, gitignored backup layer — including `2026-11-04-task40-premerge/` and `2026-11-06-task42-pre/` bundles) was **wiped entirely**.
- **Not lost**: git history (all Tasks 29–42 commits intact; reflog clean; no stashes; `origin/main` = `b648935` — the regression commit was never pushed), both live databases, all tracked files.

## Forensic verification (commands run this session)

- `git diff b648935 094c4e0 --stat` → **sole delta = the one route file** (168 deletions, no other change).
- `git status --porcelain` post-auto-commit → clean (deletion fully captured).
- `git reflog -6`, `git stash list` → no hidden states, no parallel branches.

## Recovery (forward-only, no history rewrite)

- `git checkout b648935 -- src/app/api/constituency/upload/route.ts` → byte-exact restore (168 lines, 6,913 B).
- `bunx tsc --noEmit` → **exit 0**.
- `bun run scripts/verify-upload-path.ts` → **PASS** (EUR convertibility → `LIVE-UPLOADED`, value 0.93, digest `sha256:5568bc77…`, provenance label asserted; USD stays `FIXTURE-FALLBACK`; 1 test row cleaned up).

## Database assurance (local)

| Database | integrity_check | Tables | State |
| --- | --- | --- | --- |
| `db/custom.db` (Prisma pilot store) | **ok** | 11 (incl. `ScoringUpload`, `PilotTrial`, `IssuanceEvent`, `MbzBank`…) | live, rows advancing |
| `db/chain.db` (sovereign devnet ledger) | **ok** | 11 (accounts, blocks, events, meta, proposals, stakes, txs, unbondings, validators, votes) | live, height advancing, QC 40/40 |

Cloud note (honest): **no cloud database is wired in this environment** — `.env` contains only `DATABASE_URL` (local file). Turso cloud backups were last run green in Task 32 with owner-provided credentials (not present in this session's env). Neon is deliberately excluded (check-no-neon gate). The durable off-box third copy therefore remains an **owner-side action** (see recommendation below).

## Fresh backup created (pre-Task-43, standing rule)

Location: `mtq-sigma-backups/2026-11-05-task43-pre/`

| Artifact | SHA-256 |
| --- | --- |
| `repo-at-recovery.bundle` (git bundle, all refs, @ recovery state incl. `094c4e0`) | `1005b1fe171154f87f28d459184db444e37e3a42d8e3d844e412e24a8100bc0f` |
| `custom.db` (physical copy) | `65623581001764225cb4b54cc2ca4a5d2b157484335e93f94153c957101cc01a` |
| `chain.db` (physical copy) | `73a9ae7f96a8dafe1bffcaac9a12a2f77c71aa231c4f93ada110fc3298165637` |

## Lesson & standing remediation

1. **Disk-only layers do not survive snapshot regressions.** This manifest is therefore committed to git in TWO tracked locations: `backups/BACKUP-MANIFEST-2026-11-05.md` and `mtq-sigma-backups/BACKUP-MANIFEST-2026-11-05.md` (the `.gitignore` exception `!/mtq-sigma-backups/BACKUP-MANIFEST-*.md` exists for exactly this).
2. **Bundles remain disk-only** (322 MB — too large for git). Recommendation (owner-side): replicate `mtq-sigma-backups/` off-box (owner Turso credentials / object storage) after each task to establish the durable third copy; re-create immediately after any detected re-image.
3. **Auto-commit hygiene**: platform auto-commits capture regressed states as readily as progress. The guard that caught this one: comparing HEAD against the last *verified* commit (`git diff <verified> HEAD --stat`) at session open — now part of the session-open battery.
