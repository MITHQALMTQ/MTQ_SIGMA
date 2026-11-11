# Phase 0 — Evidence Index (reproducible by another reviewer)

All commands executed read-only in `/home/z/my-project` during 2026-11-11T00:2x–00:5xZ unless noted. No secret values are reproduced anywhere (policy §19; the one credential observation is redacted by design).

## 1. Repository ground truth

```
git remote -v                 → github.com/MITHQALMTQ/MTQ_SIGMA.git (fetch/push; URL embeds x-access-token — REDACTED)
git branch -a                 → * main; remotes/origin/main; remotes/origin/backup-incident10-amend
git tag                       → backup-2026-11-08/09/10, backup-stable-2026-09-26, no-rollback-anchor-2026-10-25
git rev-list --count HEAD      → 85
git log --oneline -4           → d6fd5d6 (c8cbcc8c-…-cron, 2026-11-10T16:56:54Z), 9fe4058 (task46), ff67aa2 (task45), 8c32de5 (task44)
git status --short             → (empty — clean tree at substituted HEAD)
git fetch origin               → "ff2d385..926ee00  main -> origin/main"   ← proves the image froze with a 16:17Z-era origin ref
git rev-parse origin/main      → 926ee001e70e404dd3ea870c37f4786524458517
git rev-list --left-right --count HEAD...origin/main → 2  168
git merge-base HEAD origin/main → ff67aa2ce9368a82145b00b94e80441738e3426 (task45, 2026-11-06T12:49Z)
git cat-file -t {926ee00,e9e663f,3704c80,a066adb,0f7b10a,449b018} → commit ×6 (objects present post-fetch)
git rev-parse origin/backup-incident10-amend → 9fe40589fdff70f7636dc6f13d4cb29364016afe (= task46)
git reflog -12                  → the parallel workstream's amend-history + "reset: moving to origin/main" (4fe4528-era)
git log --format=%s origin/main | (count UUID-cron subject pattern) → 38
git config user.name / user.email → Z User / z@container
git config core.hooksPath        → .githooks      (secret gate ACTIVE)
ls .git/hooks | rg -v sample     → (empty — hook wiring is via core.hooksPath, not .git/hooks)
ls .github/workflows             → backtest-nightly, backup, ci, compute-engine, deploy-testnet, forge-tests, health-probe, inngest-resync, keeper-heartbeat
ls .github/CODEOWNERS            → absent
```

## 2. Runtime / environment

```
date -u                          → 2026-11-11T00:23:11Z (audit start); 00:46:17Z (mid-audit)
whoami / hostname               → z / c-6af3b4be-140d72b5-bce37c3c94cd
ps aux --sort=-%cpu             → platform only: tini→/start.sh, caddy (/app/Caddyfile), zcode-driver, python main.py (all START 00:20); NO next/watchdog
ss -tlnp                         → 127.0.0.1:12600/19001/12700, 0.0.0.0:19005/19006, *:81
ls db/                           → No such file or directory          ← live DB absent (re-imaged)
ls dev.log                       → No such file or directory
cat .env (keys only)             → DATABASE_URL
DATABASE_URL value               → file:/home/z/my-project/db/custom.db   (sqlite file path — non-secret)
ls backups/db-snapshots/         → latest-chain.sql, latest-custom.sql  (local tips h3941/12,395 per task-series records)
ls backups/plane5/               → execution-ledger.jsonl ONLY (single entry, 16:56:44Z BOOTSTRAP-FAILED monitor run; backstop runCount 15 failed)
ls mini-services/               → RETIREMENT-NOTE.md, keeper/ (RETIREMENT-LOCALLY marker), mtq-feed/
node_modules/.bin/next           → present (secret-scan hook executable without installs)
```

## 3. Scheduler (platform tool)

```
cron list (this audit) → jobs 522460 (backstop, hourly :17:48Z) & 522457 (monitor, hourly :55:45Z), status enabled
   backstop: run_count 3, last_run_at "2026-11-11 08:17:48" (display clock +8h skewed), next_run_time 2026-11-11T01:17:48Z (UTC)
   monitor: run_count 2, last_run_at "2026-11-11 07:55:45" (= 23:55:45Z), next_run_time 2026-11-11T00:55:45Z
   payloads reference plane5-run.sh with origin/main fallback path (guard BLOCKED semantics embedded)
```
Prior-session evidence (same chat lineage): registry wiped 2026-11-10T21:23Z (second wipe of the day), re-registered 22:1xZ; 15 consecutive failed fires "model concurrency limit exceeded" while run_count incremented.

## 4. Key-material verification (no values reproduced)

```
worktree scan for C-045-a/b literals (66-hex / 128-hex / base58 forms) → 0 matches (clean)
git show 2e684d9:worklog.md | grep -cE '<66-hex literal regex>'  → 1   ← C-045-a present in history
git show 2da73fd:scripts/verify-key-and-audit-roles.ts | grep -cE '<66-hex literal regex>' → 1
git log --all --oneline -- .env → (empty — .env never committed)
ls upload/private_key.txt → absent (dir holds documents/screenshots only)
ls .fresh-evm-keypair-DO-NOT-COMMIT.txt → absent (gitignored output of generate-new-evm-key.mjs)
```

## 5. On-chain estate evidence (from repo records; live reads last verified 2026-10-19 per roles.ts audit trail)

Addresses (public data): v1.2 tokens Monad-10143 `0x5D95…fd4a`, Arc-5042002 `0x826b…63c1`, Robinhood `0xA3B8…4EF0`; Genesis Safe `0xE718…A7D0` (threshold 1 / sole owner deployer EOA / nonce 0 / no modules / no guard); Governance `0xE35a91…Bd66`; deployer EOA `0x3C39…c8d8c` (DEFAULT_ADMIN+MINTER+PAUSER ×2 chains). V2: `contracts/deployments/MTQSigmaV2-PENDING.json` (status V3_SOURCE_READY_PENDING_DEPLOY; blocked on fresh funded key — prior compromised C-045-a).

## 6. Subagent forensic reports (full text in session, summarized into the domain documents)

- TASK 2-a — Application & API surface (59 routes enumerated; upload route NOT PRESENT; unauth mutation surfaces; boot chain; Caddy exposure; auth reality).
- TASK 2-b — Monetary authority & governance (operations table; governance inversion; contract table; KEY MATERIAL findings incl. history verification; oracle reality).
- TASK 2-c — Ops/recovery/control evidence (18-control inventory; watchdog chain; 9-workflow CI table; 10+ incident timeline; prior findings status; secret posture).

## 7. Prior-session live evidence (same chat lineage, pre-substitution)

2026-11-10T23:30Z sanctioned backstop relaunch output (verbatim, on then-lineage B):
`PLANE_5_BACKSTOP git=OK gitState=EXACT_MATCH db=DATABASE_RECOVERED server=200+watchdog route=403 tip=h23833 rows=129644 unbacked=147 deficit=0 published=h23686 snapshotPublished=yes heartbeat=2026-11-10T23:31:59.705Z result=OK origin=a066adb… commit=e9e663f job=516197` — plus heartbeat.json (chainTip 23846, deficit 0, watchdog alive) and browser E2E green (landing, governance dropdown, footer geometry, zero console errors). This is the last verified-healthy runtime state; the current sandbox is NOT that state.

## 8. Chain of custody note

This assessment directory (17 documents) was written read-only relative to application/monetary/deployment/database/signing behavior. The ONLY mutation attributable to Phase 0 is the addition of `security/assessments/phase-0/**` itself, committed on a dedicated evidence branch (not main) via the wired pre-commit secret gate. No realignment, boot, install, dependency change, credential change, or history rewrite was performed (§21 STEP 10 compliance).

## 9. Addendum (2026-11-11T00:5xZ) — concurrent platform automation interfered TWICE during evidence preservation

Reflog (exact timestamps):

```
d6fd5d6 HEAD@{2026-11-11 00:54:06 +0000}: checkout: moving from main to security/phase-0-baseline    ← auditor (git switch -c)
d6fd5d6 HEAD@{2026-11-11 00:54:11 +0000}: checkout: moving from security/phase-0-baseline to main     ← INTERFERENCE #1 (not the auditor)
29581df HEAD@{2026-11-11 00:54:11 +0000}: commit: Phase 0 forensic baseline …                       ← auditor commit (landed on main as a result)
29581df HEAD@{2026-11-11 00:55:55 +0000}: checkout: moving from main to security/phase-0-baseline    ← auditor correction
d6fd5d6 HEAD@{2026-11-11 00:56:12 +0000}: checkout: moving from security/phase-0-baseline to main     ← INTERFERENCE #2 (17s after correction)
```

Effects and containment: interference #1 caused the Phase-0 commit to land on local `main` and the first evidence-branch push to carry only d6fd5d6; corrected at 00:55Z (branch ref → 29581df, remote fast-forwarded d6fd5d6..29581df, local `main` restored to substituted ground truth d6fd5d6). Interference #2 switched the working tree back to `main` (evidence files transiently absent from tree — never lost: committed on branch and pushed). No interference touched origin/main (926ee00 throughout), no Phase-0 content was altered (content integrity = commit 29581df), and both events were detected and contained within ~60s.

Attribution (evidence, not certainty): no registered plane-5 fire was active in either window (backstop 00:17:48Z fire left no relay/telemetry — registration ≠ execution; monitor due 00:55:45Z). The platform boot chain runs `.zscripts/*` steps ("Project initialization check" 21s, "Restoring zcode state", "custom dev script" — /tmp/boot-timeline.log, root-owned, started 00:20:14Z), and a platform-side normalization loop executing `git checkout main` is the most plausible actor class; the historical UUID-cron commits (38 on origin/main) demonstrate this behavior class exists in the estate. Exact script attribution remains open — documented, not guessed.

Evidentiary value: live corroboration of F-0-P0-03 (single shared administrative substrate — uncoordinated automation mutates git HEAD mid-operation of another principal, twice, seconds after each correction) and of the §13.3/§1.4 principle that separate processes are not separate security boundaries when they share the substrate.

Final preservation state (post-correction): evidence = branch `security/phase-0-baseline` @ 29581df (+ this addendum commit), pushed to origin; local `main` = d6fd5d6 (substituted ground truth, restored); origin/main = 926ee00 (untouched throughout Phase 0).
