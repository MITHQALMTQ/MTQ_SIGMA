# MTQΣ — Local Backup Manifest — 2026-10-26 (Task 32)

**HEAD at backup:** `f6ec9353aa96f094c0f374a14ae1d772ed4fe2d0` (origin/main, Vercel production — commitSha verified via `/api/health`)
**Location:** `/home/z/mtq-sigma-backups/2026-10-26/` (outside the tree, scanner-safe)
**Volatility warning:** local files do **not** survive sandbox re-images — the prior backup sets (2026-10-23, 2026-10-25) were wiped that way. The git content itself is durable on GitHub (`main` + tags). Transfer these artifacts to durable storage for long-term retention.

## Artifacts (SHA-256 in `SHA256SUMS.txt`)

| File | Size (B) | SHA-256 |
|---|---|---|
| `mtqsigma-full-repo-f6ec935.bundle` | 329,061,616 | `8aadc6cf3680c302f72b65f8a8c796efd82420d613ad5c501c4bcd076bc45878` |
| `mtqsigma-source-f6ec935.tar.gz` | 331,312,762 | `dbd3299e88558b80d75117a7d4b1a0017dbf34a8a9535b9f635b3f272a1bc5a3` |
| `db-custom-f6ec935.db` | 1,355,776 | `560fd206af0c1c86e0ceeb26e440e98e0d187823ae539ca475a0b20148bb9ce3` |
| `env-copy-f6ec935.txt` | 50 | `be8e1a92feff8f6cb699a9a70cc7d76a183538ab8c68a45e7d40f0d32bf20b94` |

- **Bundle** — `git bundle create --all`, 15 refs; `git bundle verify` = *"The bundle records a complete history."* Directly clonable and pushable to any remote.
- **Source tarball** — full working tree minus `.git`, `node_modules`, `.next`.
- **DB** — byte copy of `db/custom.db` (local SQLite pilot ledger).
- **Env** — `.env` copy; contains ONLY `DATABASE_URL` in this sandbox (no cloud credentials).

## Bundle contents (15 refs) — includes everything deleted by the Task-32 "delete old git" cleanup

`main` @ f6ec935 · `archive/local-history-pre-d3` (24c1105) · `archive/remote-main-pre-d3` (f0f18fd) · `origin/autonoma-integration` (106 abandoned autonoma-tool commits, last 2026-09-14) · `origin/codex/testnet-readiness-gates-2026-10-24` · `origin/security/production-readiness-2026-10-24` · `origin/vercel/install-and-configure-vercel-w-mf0oii` · 6 tags (backup-2026-09-22, backup-stable-2026-09-26, backup-2026-10-24, backup-2026-10-25, backup-2026-10-26, no-rollback-anchor-2026-10-25).

> **After the Task-32 cleanup these archive/side branches exist ONLY in this bundle** (deleted from the local repo and from GitHub per owner directive "delete all old git"). The bundle is deliberately **local-only**: uploading pre-D3 history back to the cloud would undo the owner's Task-25 remote scrub of pre-D3 reachability.

## Restore

```bash
# Full repo from bundle (any branch/tag above):
git clone mtqsigma-full-repo-f6ec935.bundle restored && cd restored && git checkout main
# Push to a new remote:
git remote add origin <url> && git push --all && git push --tags
# Source tree:
tar -xzf mtqsigma-source-f6ec935.tar.gz -C <dest>
# Local DB:
cp db-custom-f6ec935.db db/custom.db
```

## Cloud layers (verified this task)

- **GitHub** — `MITHQALMTQ/MTQ_SIGMA` @ f6ec935, now exactly ONE branch (`main`); all protective tags intact.
- **Vercel production** — `mtq-sigma.vercel.app` @ f6ec935, healthy (engine:true, db:true).
- **Turso DB dumps → GitHub Releases** — `backup-2026-10-26` release: 03:00 UTC scheduled asset + on-demand dispatched run `40299469156` (completed success, 09:25:47Z). Daily 03:00 UTC cron standing.
