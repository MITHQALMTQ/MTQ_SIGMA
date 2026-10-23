# MTQΣ Backup Manifest — 2026-10-23T12:55:35Z

**Created by:** Orchestrator (COO/CTO/PM) under the owner's 2026-10-23 directive
**Posture:** TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED

## Contents

| Artifact | Size | What it is |
|---|---|---|
| `mtqsigma-full-repo-20261023T125535Z.bundle` | 215 MB | **Complete git history** (all commits through `c3e628d`). Verified: "records a complete history". Restorable with `git clone <bundle> mtqsigma` — and pushable to any cloud remote as-is. |
| `mtqsigma-source-20261023T125535Z.tar.gz` | 271 MB | Full working tree (source, contracts, audit-work evidence, docs, upload artifacts, skills) excluding `.git`, `node_modules`, `.next`, build caches. |
| `mtqsigma-db-20261023T125535Z.sqlite` | 2.0 MB | Byte copy of the live Prisma SQLite database (`db/custom.db`). |
| `mtqsigma-audit-trail-20261023T125535Z.json` | 4.3 MB | Logical JSON dump of all audit tables (schemaVersion 2): PilotTrial 2 · MetricSample 0 · DailyStateVector 219 · RebalancingDecision 2,536 · OracleSample 1,314 · **IssuanceEvent 297** (every issuance demo event, incl. the M8-3 cycle runs). |

## SHA-256 (first 16 hex)

```
40abd671d810c8be  mtqsigma-audit-trail-20261023T125535Z.json
c402327d40f60caa  mtqsigma-db-20261023T125535Z.sqlite
2cbd98c82490ef4b  mtqsigma-full-repo-20261023T125535Z.bundle
0dc6494bfc9148f5  mtqsigma-source-20261023T125535Z.tar.gz
```

## Local server status

The Next.js dev server (port 3000, the Pilot Command Center) is running under the
detached `dev-watchdog.sh` (Task-8 heap cap 768 MB; auto-restart on death). Health
verified at backup time: HTTP 200 on `/`, `/api/health`, `/api/status`.

## Pushing to the cloud (honest status)

**No cloud remote is currently configured in this environment** — there is no git
remote, and no GitHub/GitLab/Vercel/Turso credentials exist in `.env` or the
environment. Nothing was pushed anywhere; no fabrication.

To push this backup to a cloud host once credentials/a remote are provided:

```bash
# Full history + working state (recommended — the bundle IS the repo):
git clone backups/mtqsigma-full-repo-20261023T125535Z.bundle mtqsigma-restored
cd mtqsigma-restored
git remote add origin <YOUR_CLOUD_REMOTE_URL>   # e.g. git@github.com:org/mtqsigma.git
git push -u origin --all                         # pushes every branch
git push origin --tags                           # pushes every tag

# Or, from this machine directly, once a remote is added here:
git remote add origin <YOUR_CLOUD_REMOTE_URL>
git push -u origin --all && git push origin --tags
```

The bundle carries the complete history through commit `c3e628d`
("fix: self-healing chunk-load recovery…"), including the entire Task 1–13 + M8
audit trail with all evidence directories.

---

## 2026-10-23T20:42Z — Local SQLite full backup (fix 16d-006/16d-007, Task 16-fix-C)

The 12:55Z artifacts listed above were found **gone from the filesystem** by
audit 16-d (only this manifest survived; nothing was ever pushed to a cloud
remote). This entry records the FIRST backup artifact created since.

| Artifact | Size | What it is |
|---|---|---|
| `sqlite-backup-20261023T204235Z.json` | 8.07 MB | Logical JSON dump of **all 9 tables** via `scripts/backup-turso.ts`'s missing sibling — the new `scripts/backup-sqlite.ts` (schemaVersion 3). As-of logical snapshot (tables read sequentially while the live engine ticks; each table is one consistent SELECT). Float64 serialized as shortest round-trip decimals; DateTime as ISO-8601; BigInt as strings. |

**SHA-256 (full):** `56b59907f4d48019bc3114d1797760ca55f5eebad30b9b770fabd700be8ed917`
(over the exact JSON content written; the dump command prints it on the manifest line)

**Row counts:** PilotTrial=10 · MetricSample=0 · DailyStateVector=470 ·
RebalancingDecision=5,426 · OracleSample=2,814 · IssuanceEvent=28 ·
MbzMintRequest=0 · MbzBackingCertificate=0 · MbzBank=0 · **total=8,748**

**Command (not yet in package.json — orchestrator to add
`"db:backup": "bun run scripts/backup-sqlite.ts"`):**

```bash
bun run scripts/backup-sqlite.ts
```

**Honest gaps that remain:** no scheduled/offsite push exists yet (still no
cloud remote/credentials in this environment) — this artifact lives on the
same disk as the DB it protects. Restore-test not yet performed.
