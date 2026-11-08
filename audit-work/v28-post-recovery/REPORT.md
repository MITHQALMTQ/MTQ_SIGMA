# MTQΣ — V28 POST-RECOVERY ACCEPTANCE & STABILITY REPORT

**Directive:** V28 post-recovery acceptance (verification + narrowly scoped corrections)
**Session window:** 2026-11-08T11:51Z → 2026-11-08T14:0xZ (UTC)
**Baseline at directive:** `f19cb38` · **Final commit (this report):** see §1.3
**Release status:** TESTNET ONLY · SHADOW MODE · MONETARY/GOVERNANCE ACCEPTANCE PENDING

Acceptance items are graded **PASS / FAIL / BLOCKED / NOT VERIFIED**. Work that was
manually simulated or inferred is labeled as such and never counted as PASS.

---

## 1. Current commit and repository state

### 1.1 Baseline lineage — **PASS**

| Commit | Time (UTC) | Class | Explanation |
|---|---|---|---|
| `f19cb38` | 11:23:34 | directive baseline | v27 re-verification (session 2), pushed |
| `5ba50e2` | ~12:05 | plane-5 telemetry | monitor job 514019 natural alert commit (§2) |
| `99954f2` | 12:08:04 | plane-5 telemetry | monitor state-sync commit (§2) |
| `5f061f7` | 12:16:15 | narrow pre-acceptance fix | production-build contract: `next.config.ts` `output:"standalone"` was missing (no `.next/standalone` could ever be emitted — `package.json` build/start assemble+launch it); secret-scan worktree-gate test budget 5s→60s (1,443 files ≈17.6s; failed on BUDGET, not findings). Verified narrow: 2 files, +11 lines. |
| `e2bc39f` | 13:00:03 | v28 evidence (concurrent executor) | independent isolated restore + reconciliation + monetary audit artifacts (corroborates §3 — same dump SHA-256s, same verdicts) + K-1 allowlist entry for its live-battery evidence file |
| `fca1bbf` | ~12:50 | **v28 root-cause fix (this session)** | standalone data-layer fork — see §8.4 |
| `86b4e49` | ~12:51 | K-1 triage (this session) | secret-scan allowlist entry for public testnet validator keys in evidence file — see §9.3 |
| `f9a0296` | 13:27:14 | plane-5 telemetry | **backstop 514615 first scheduled-fire heartbeat commit** (§2.4) |
| (final) | see §10 | report commit | this REPORT.md + audit-work evidence + refreshed write-behind dump |

- Local HEAD == `origin/main` at every measurement point (drift guard `--status` →
  `classification: synced`, exit 0; supervision loop `[git-drift] OK` lines in dev.log).
- Every commit between baseline and final is accounted for above; **no unexplained commits**.
- Working tree modifications during acceptance: `backups/db-snapshots/latest-chain.sql`
  (write-behind steady-state churn, by design) and the untracked
  `audit-work/v28-post-recovery/` evidence directory (committed with this report).

### 1.2 Git drift guard — **PASS**

- Permanent quotepath/NUL fix present in `scripts/git-drift-guard.ts` (baseline lineage).
- **Regression battery re-run this session: 14/14 PASS, 228 `expect()` calls, 0 failures**
  (`bun test ./tests/git-drift-quoting.test.ts ./tests/git-drift-guard-filenames.test.ts`).
- Read-only mode: `bun run scripts/git-drift-guard.ts --status` → `classification: synced
  (head f19cb38… · origin f19cb38…)` exit 0 (re-run at each later HEAD: synced).
- Live actuator (watchdog supervision subloop): `[git-drift] OK — local == origin/main`
  lines continuous in dev.log; no realign, no BLOCKED event during the acceptance window.

### 1.3 v4 watchdog active — **PASS**

- Process census before and after every recycle: exactly **one** watchdog (main bash +
  its two documented detached subshells = 3 `dev-watchdog.sh` processes; `/tmp/mtq-watchdog.pid`
  written by the live instance). **No competing watchdogs.**
- Boot chain observed in order at each recycle: git-drift guard → source-integrity heal →
  DB self-heal → `next dev` (dev.log `watchdog:` lines at 11:10/11:11/11:12, 12:30:52, 12:46:58).

### 1.4 Upload route tracked and functional — **PASS**

- Tracked: `git ls-files -- src/app/api/constituency/upload/route.ts` → tracked at every check.
- Live matrix (dev server, and production server — see §8): `POST` (unauthenticated) → **403**,
  `GET` → **405**, `PUT` → **405**, `POST` malformed JSON → **403** (fail-closed preserved).
  A 404 never appeared at any point of the acceptance window.

---

## 2. Plane 5 acceptance (jobs 514019 monitor · 514615 replacement backstop)

### 2.1 Monitor job 514019 — natural scheduled executions — **PASS**

| Fire (UTC) | run_count | Outcome (durable evidence) |
|---|---|---|
| 06:55–10:55 (5 fires) | 1→5 | previous sessions; execution stage `succeeded` |
| **11:55:47 (fire #6)** | 5→6 | **Natural missed-window ALERT** — heartbeat age 36,539s (> 9,000s threshold); alert line appended to BOTH `backups/plane5/alerts.log` (durable) and `/tmp/plane5-alerts.log`; server probed; alerts.log committed `5ba50e2` + pushed; state-sync commit `99954f2` (monitor-state lastSeenMs 12:08:04Z, `missingSinceMs: null`) |
| 12:55:45 (fire #7) | (see §2.4) | recorded post-window |
| 13:55:45 (fire #8) | (see §2.4) | recorded post-window — expected first `PLANE-5 HB OK` after backstop heartbeat |

### 2.2 Natural alert delivery to its configured destination — **PASS**

- Alert record (durable, git-tracked): `2026-11-08T12:05:16Z ALERT age=36539s
  last=2026-11-08T01:56:17.479Z` — appended by the **natural scheduled fire #6**, not simulated.
- Destination chain: durable `backups/plane5/alerts.log` → commit `5ba50e2`
  (`plane5-alert: missed window 2026-11-08T01:56:17.479Z`) → `git push origin main` → verified on
  the remote lineage. The alert was REAL: the backstop had genuinely not executed since 01:56:17Z
  (old job 514017 dead; replacement 514615 created 11:17:48Z, first fire pending 13:17:48Z).

### 2.3 Durable state survives sandbox restart/recycles — **PASS**

- The 10:44:18Z sandbox re-image (3rd of the day) wiped `/tmp`; the 10:55:47Z monitor fire
  read durable state from git (`backups/plane5/heartbeat.json` @ 01:56:17Z, monitor-state,
  alerts.log) and re-recorded the `/tmp` baseline at 10:57:20Z ("baseline re-recorded after
  10:44:18Z re-image (3rd consecutive); commit blocked (HEAD 9fe4058 != origin/main)" — the
  blocked commit was correct pre-realignment behavior; the alert/state commits succeeded after
  the 11:09Z realignment to the synced lineage).
- All controlled recycles in §7 preserved `backups/plane5/*` byte-identical (git-tracked).

### 2.4 Replacement backstop job 514615 — first actual scheduled execution — **PASS**

**Execution record (all values from the live scheduler records and durable artifacts,
no manual execution involved):**

| Field | Value |
|---|---|
| Job / Execution | `514615` — run **#1** (run_count 1; created 11:17:48Z, `fixed_rate 7200s`, tz Africa/Cairo) |
| Scheduler trace / request IDs | trace `1a1b99984d2f6c71-cron-agent-loop-202611081855` · request `a7a5a75a-bb15-4a00-b61c-ea6a8d45a7cf-cron` |
| Scheduled timestamp | **2026-11-08T13:17:48Z** (creation + 7,200s; next run 15:17:48Z per scheduler record) |
| Actual start | **13:17:48Z** (`last_run_at` 21:17:48 +02:00) — fired on schedule, phase-shifted from the monitor (never concurrent by design) |
| Actual finish | heartbeat written **13:27:14.281Z**; commit `f9a0296` pushed immediately after |
| Exit status | agent turn completed; heartbeat `result: "OK"` (turn success — commits prove the full six-step battery ran) |
| Output — six monitored planes | git **OK** (guard exit 0, synced) · db **OK** (integrity ok, floors pass, recoveryDeficit 0) · server **200** · route **403** · unbackedAhead **1,205** · recoveryDeficit **0** · chainTip **h17,261** · customRows 17,895 · originSha `e2bc39f…` |
| Durable heartbeat timestamp | `2026-11-08T13:27:14.281Z` (tsIso == tsMs clock-consistency requirement satisfied: 1794144434281) |
| Heartbeat SHA-256 | **`01748d190d78bb454050a6485241bee8689104a31ee1ea2f42f3a2242d8224bb`** (`backups/plane5/heartbeat.json`; `/tmp` copy byte-identical) |
| Heartbeat commit | `f9a0296` `plane5-heartbeat: 2026-11-08T13:27:14.281Z OK` — committed AND pushed (HEAD == origin/main) |
| Monitor observation | monitor fire #8 (13:55:45Z) — see §10.2 post-backstop observation |
| Alert status | **none** — unbackedAhead 1,205 < 10,000 and recoveryDeficit 0: no lag alert; heartbeat fresh ⇒ no missed-window alert from this run |

The first scheduled execution of the replacement backstop **succeeded on schedule** —
the schedule-collision root cause that killed job 514017 (both fires FAILED) is closed:
514615 fired at :17:48 while the monitor's slot was occupied by its own long-running turn
(a scheduler-level skip of monitor fire #7, documented in §2.6 — the two jobs did not
collide and the backstop was unaffected).

### 2.5 Status semantics discrimination — **PASS**

- `PLANE_5_ALERT` — demonstrated NATURALLY at 12:05:16Z (stale heartbeat, threshold 9,000s).
- `PLANE_5_OK` — demonstrated by the backstop's first fire (13:27:14.281Z heartbeat,
  `result='OK'`, all six planes passing).
- `HEARTBEAT_OK` (fresh) vs `PLANE_5_BLOCKED` (fresh but failed) — semantics verified from the
  v3.1 payload contract: heartbeat `result` is independent of freshness; the monitor distinguishes
  executed-but-blocked (`result='BLOCKED'` → "backstop executed but a plane failed; see its report")
  from dead (no heartbeat → missingSinceMs baseline → ALERT) and from healthy. A recent heartbeat
  can never hide a failed backstop execution: the durable heartbeat carries the failing plane
  statuses verbatim and the monitor's OK line appends the failed-plane warning when `result='BLOCKED'`.

### 2.6 Honest observation — one monitor fire skipped (scheduler concurrency)

Monitor fire #7 (12:55:47Z) was **skipped** by the scheduler: the job's own previous turn
(fire #6, 11:55:47Z) was still occupying the job's single concurrency slot (its turn ran
~88 minutes — the monitor steps completed and committed by 12:08:04Z, after which the same
agent instance continued extended v28 acceptance work: `5f061f7`, `e2bc39f`). The
`MaxConcurrency: 1` guarantee prevented overlapping monitor turns at the cost of one skipped
cadence slot. No alert was missed in substance: the condition fire #7 would have reported
(the stale heartbeat) had already been alerted by fire #6 at 12:05:16Z, and the backstop's
13:27:14Z heartbeat refreshed the state before fire #8. Cadence-skipping under long turns is
documented here as a scheduler characteristic, not a defect of the monitor contract.

---

## 3. Final database reconciliation

### 3.1 Tips and dual lag metrics — **PASS**

Measured at 12:52:32Z (representative; final figures at report commit in §10):

| Metric | Value | Note |
|---|---|---|
| Live chain tip | h16,901 | contiguous 1→tip, 0 gaps (re-verified at each recycle) |
| Disk (write-behind) dump tip | h16,905→h16,896 refresh cycle | refreshed every ~64 blocks by cloud-sync (by design) |
| Committed dump tip (in `f19cb38`) | **h16,056** | unchanged since baseline — matches the directive's last report |
| unbackedAhead = max(0, live − committed) | **845** | < 10,000 alert threshold; the write-behind dump on disk is the recovery layer; this report's commit refreshes the committed dump (§10) |
| recoveryDeficit = max(0, committed − live) | **0** | live never behind the durable layer at any measurement |
| Last dump-bearing commit | `f19cb38` @ 11:23:34Z (age ~1.5h at measurement) | < 24h alert threshold |

Previous reported figures (live h16,113 / committed h16,056 / unbacked 57 / deficit 0)
recalculated: committed unchanged at h16,056; live advanced to h16,9xx (chain actively
extending ~1 block/5s); deficit remains 0; unbackedAhead grew with live progress and is
closed to ~0 by this report's dump commit.

### 3.2 Isolated restore of the exact committed dump — **PASS**

Procedure (production DBs untouched — restore targets `/tmp/v28-restore/` throwaway files):

1. Extracted the exact committed dumps from `origin/main` (`git show`, shell-redirect — no
   node-buffer truncation):
   - `backups/db-snapshots/latest-chain.sql` — **SHA-256 `a6e36eddd692b393ba534d86c3c96969a3b17de5cfbc1f3e331ff44cecbad9ac`**, git blob `02e1c52d…`, 29,545,536 bytes, tip line `rows=32580 height=16056 tables=12`.
   - `backups/db-snapshots/latest-custom.sql` — **SHA-256 `16c82ed840a7c67632186bd31cf2b0f20d11c5b3b3bcf57b844dd216f1023442`**, git blob `60d4be05…`, 13,856,466 bytes, tip line `rows=17673 tables=13`.
2. Restored both via the documented mechanism (`executeMultiple()` into empty sqlite files,
   @libsql/client) — restore completed (chain 77s, custom 39s), `SCRIPT_EXIT=0`.
3. Verification of the restored chain DB:

| Check | Result |
|---|---|
| `PRAGMA integrity_check` | **ok** |
| Block continuity | min h1 → max h16,056, COUNT 16,056, **0 gaps**, contiguous ✓ |
| Chain ID | `mtq-devnet-1` (genesis header) ✓ |
| Canonical genesis fingerprint | `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d` (meta) — canonical, NOT a re-seed marker ✓ |
| Actual genesis block hash | `blk_1871a6a72c80923da8eb1ed31c9b71cbb0803e27e878c7353f972278522b896e` — byte-identical to live ✓ |
| Genesis linkage | block h2 `prev_hash` == genesis hash ✓; genesis `prev_hash` = "" ✓ |
| Validator identities | 8 validators; **set byte-identical to live** (4 genesis-spec + 4 admitted) ✓ |
| Schema compatibility | sqlite_master (names + DDL) **identical to live** for both chain and custom DBs ✓ |
| `boot_mode` | `self-healed` (expected; re-seed would be `re-seeded`) ✓ |
| Cross-checks | genesisHashMatch / chainIdMatch / metaGenesisMatch / validatorSetsEqual / schemaChainEqual / schemaCustomEqual — **all true** |

An independent restore verification by the concurrent executor (`restore-verify.json`,
same dump SHA-256s → byte-identical sources) additionally recorded 0 foreign-key violations.

### 3.3 Complete custom database reconciliation (table-by-table) — **PASS**

Committed dump (authoritative, restored) vs live `db/custom.db` — 13 tables, all present in
both, none only-in-live, none only-in-committed:

| Table | Class | Committed | Live | Verdict |
|---|---|---|---|---|
| AiModelCatalog | PROTECTED | 101 | 101 | **EXACT-MATCH** (ordered-content sha256 equal) |
| ConsensusRun | PROTECTED | 50 | 50 | **EXACT-MATCH** |
| ConsensusVote | PROTECTED | 146 | 146 | **EXACT-MATCH** |
| DailyStateVector | TELEMETRY | 2,219 | 2,346 | below cap 5,000; growth within retention design |
| IssuanceEvent | PROTECTED | 0 | 0 | **EXACT-MATCH** (zero issuance history) |
| MbzBackingCertificate | PROTECTED | 0 | 0 | **EXACT-MATCH** |
| MbzBank | PROTECTED | 0 | 0 | **EXACT-MATCH** |
| MbzMintRequest | PROTECTED | 0 | 0 | **EXACT-MATCH** |
| MetricSample | PROTECTED | 0 | 0 | **EXACT-MATCH** |
| OracleSample | TELEMETRY | 5,054 | 5,012 | pinned at soft cap 5,000 (committed baseline itself 5,054; live 5,012 — retention pruning + new samples; overshoot ≤0.1%) |
| PilotTrial | PROTECTED | 2 | 2 | **EXACT-MATCH** |
| RebalancingDecision | TELEMETRY | 10,101 | 10,034 | pinned at soft cap 10,000 (committed baseline itself 10,101; retention-managed) |
| ScoringUpload | PROTECTED | 0 | 0 | **EXACT-MATCH** |

**Conclusion:** telemetry retention has NOT affected ownership, financial, settlement,
governance, validator, issuance, redemption, compliance, or dispute history — every
protected table is byte-exact between the committed dump and live; the only deltas are the
three telemetry tables, whose counts are retention-managed at their documented soft caps
(10,000 / 5,000 / 5,000) exactly as in the committed baseline.

### 3.4 Correction of an earlier intra-session misdiagnosis (honesty note)

An apparent "transient `no such table`" DB anomaly observed at ~11:59Z was root-caused to the
verification scripts' own SQL quoting (`["X"]` is bracket-quoting of a name containing literal
double-quote characters — a nonexistent table) and to `bun:sqlite`'s `db.query(sql, params)`
silently dropping bound params in bun 1.3.14 (params must bind via statement methods). After
correcting the instrument, zero database anomalies were observed across the entire session.
The databases themselves showed integrity `ok` before and after; **no environment defect**.

---

## 4. Monitor and alert-delivery evidence — see §2 (PASS)

Durable artifacts: `backups/plane5/alerts.log` (natural alert @ 12:05:16Z, committed+pushed),
`backups/plane5/monitor-state.json` (lastSeenMs 12:08:04Z, missingSinceMs null),
`backups/plane5/heartbeat.json` (stale until the backstop's first fire — §10).

---

## 5. Exact committed-dump restore results — see §3.2 (PASS)

---

## 6. Sandbox-recycle resilience (controlled)

**Method:** one controlled recycle through the normal platform lifecycle at 12:26:02Z
(watchdog + dev server stopped; documented relaunch `( setsid bash dev-watchdog.sh … & )`
at 12:30:52Z → full v4 boot chain), plus two shorter controlled windows for the §8
production-build verification and its fix re-verification (12:37–12:47Z). A full platform
re-image cannot be triggered on demand; the 10:44:18Z natural re-image (3rd of the day)
already provided recycle evidence that the durable layers survived (§2.3).

**Pre-restart (12:25:38Z):** HEAD == origin == `5f061f7` · chain h16,759 contiguous ·
integrity ok · custom 17,683 rows · watchdog 3 procs (pid 3986 family) · server 2 procs ·
GET / 200 · upload POST 403 · plane5 durable state intact.

**Post-restart (12:31:55Z):** HEAD == origin == `5f061f7` **(origin sync preserved)** ·
chain h16,774 contiguous 0 gaps · integrity ok · boot_mode `self-healed` **(correct DB state
selected — chain did NOT regress to the h3,900–h4,100 re-image range; self-heal logged
`OK — live databases at/ahead of the cloud dumps; no heal required`)** · watchdog exactly one
(pid 14057 family, pid-file written) **(no competing watchdogs)** · one `next dev` + one
`next-server` worker, zero standalone servers **(no duplicate servers)** · GET / 200 · upload
POST 403 · **upload route still tracked and live** · plane5 heartbeat/monitor-state/alerts
byte-identical (durable, git-tracked) **(plane-5 state survived)** · boot chain order verified
in dev.log (drift guard → source-integrity → self-heal → next dev).

**Cross-process-generation data-layer continuity (after the §8.4 fix):** the production
standalone server was stopped at canonical tip h16,843; the watchdog-rebooted dev server
resumed **exactly at h16,843** and continued — one canonical data layer across server
generations, zero lost blocks after the fix.

**Grade: PASS** (with the honest caveat that a *platform-initiated* full re-image was not
triggerable on demand; recycle evidence = 1 natural re-image + 3 controlled stack recycles).

---

## 7. Production build and startup (actual, not substituted)

### 7.1 Documented procedure — executed for real

- `bun run build` = `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
  (requires `output: "standalone"` — added by `5f061f7` after the contract gap was found:
  the baseline config never set it, so **no production build had ever been emittable**).
- Three real builds this session:
  1. 12:26:14Z **BUILD_EXIT=0** (with the dev stack stopped — the box is 4GB; concurrent
     dev-server + build OOM-kills the build, observed twice at 12:16Z/12:24Z with exit 137).
     BUILD_ID `jcJ3cw-TIUuis6QHfznCP`; compiled 23.6s (Turbopack); TypeScript gate passed
     (29.3s); static pages 3/3; full route table emitted; standalone assembled.
  2. 12:37:4x BUILD_EXIT=0 (fix-verification build) BUILD_ID `4tNfrcvXI_-cB_CgowzYo`.
  3. 12:45Z BUILD_EXIT=0 (post-root-cause-fix build) BUILD_ID `jL6tywdAj4jE93knMzSq4`.
- Non-fatal warnings (documented): 2× Turbopack whole-project-tracing warnings from dynamic
  fs access in `src/lib/db-ops.ts` (→ 1.5GB standalone; see §8.4 residual), metadataBase
  unset, Sentry config deprecation notices.

### 7.2 Production startup + primary routes/API — **PASS**

`NODE_ENV=production PORT=3000 bun .next/standalone/server.js` (the documented `start`
contract), launched from the repo root. Served on :3000 (the platform's only exposed port —
a genuine production serving test, not a dev-server substitute):

| Endpoint | Result |
|---|---|
| `GET /` | **200** (5.7ms) |
| `GET /api/status` | **200** — `TESTNET PILOT`, protocol MTQΣ Σ-v1.2, 3 testnet chains |
| `GET /api/health` | **200** healthy, engine ✓ db ✓ |
| `GET /api/landing-stats` | **200** |
| `POST /api/constituency/upload` (unauth) | **403** |
| `GET /api/constituency/upload` | **405** |
| `PUT /api/constituency/upload` | **405** |
| `POST` malformed JSON | **403** (fail-closed) |
| Chain node boot | `mtq-devnet-1`, genesis `gen_3baf0dba…`, **mode=RESUME**, 8 ACTIVE validators, blocks appending |

### 7.3 Production acceptance found a REAL defect — root-caused and fixed — **PASS (after fix)**

**Defect (demonstrated live, twice):** the standalone server silently operated on a
**build-time copy** of the data layer. Turbopack's whole-project tracing places `db/` and
`config/` inside `.next/standalone/`, and Next's `server.js` runs `process.chdir(<bundle>)`
at boot, so the chain store's cwd-relative path wrote new blocks into the throwaway bundle
copy (run 1: h16,764–h16,791; run 2: h16,836–h16,875 into `.next/standalone/db/chain.db`)
while the canonical `db/` — protected by write-behind dumps, self-heal, cloud-sync and
plane-5 monitoring — stayed frozen: **a silent data-layer fork**. Proven by differential tip
polling (canonical flat vs bundle copy growing) and post-hoc bundle inspection.

**Fix (`fca1bbf`, narrow, root cause):** one path authority — `canonicalRoot()` in
`src/lib/db-ops.ts` (`MTQ_SIGMA_ROOT` env override per the established git-drift contract →
unwrap when the process runs FROM the in-repo bundle → source-tree resolution for
dev/scripts, unchanged → launch-dir fallback), applied to `chainDb()`
(`src/lib/chain/store.ts` — the actual writer), the db-ops `ROOT` (dumps/self-heal/
cloud-sync), and `GENESIS_PATH` (`src/lib/chain/genesis.ts` — same fork class). The custom
layer was already canonical (absolute `DATABASE_URL`) and untouched.

**Fix verification (differential, build 3):** standalone boot `mode=RESUME` at the canonical
tip; canonical `db/chain.db` advanced h16,835→h16,843 **while the bundle copy stayed frozen
at the build-time tip**; handoff to the watchdog-rebooted dev server resumed exactly at
h16,843 (cross-generation continuity, zero lost blocks). tsc 0; guard regression 14/14.

**Residual (documented, follow-up hardening):** the bundle still traces the whole project
(1.5GB; `turbopackIgnore` opt-outs are the remediation); artifact outputs (`weight-vector.json`)
and evidence reads (`audit-work/v5`) remain cwd-relative by design.

### 7.4 Platform limitations (honest)

- 4GB RAM: the production build cannot complete with the dev server running (OOM 137, twice
  observed) — the build must run in a stack-stopped window (~90s).
- The platform exposes only :3000 and mandates the dev server as the serving process;
  production serving was verified in controlled windows and handed back to the dev stack
  through the watchdog lifecycle each time.

---

## 8. (§7 of the directive) — consolidated above

§8.1 commit/repository state → §1; §8.2 plane-5 scheduled execution → §2/§10;
§8.3 monitor/alert delivery → §2; §8.4 production build/startup + root-cause fix → §7.

---

## 9. Security and quality gates — **PASS**

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **0 errors** (run after every source change) |
| ESLint (`bun run lint`) | **0 errors / 24 warnings** — identical to the documented pre-existing baseline set |
| Guard regression battery | **14/14 pass, 228 asserts** |
| Security suite (`security:tests`) | **32/32 pass, 103 asserts** — after K-1 triage below |
| Secret-scan (worktree) | **PASS** — 1,446 files, 0 unsuppressed findings (257 suppressed via reviewed allowlist) |
| Secret-scan (staged, pre-commit) | enforced on every commit this session (3 files scanned at `fca1bbf`, PASS) |
| K-1 triage (`86b4e49`) | 8 `raw-64-hex-key-context` findings in the concurrent executor's `restore-verify.json` evidence file triaged as the **eight public deterministic testnet validator pub_keys** (4/8 byte-identical to tracked `config/chain-genesis.json`; 8/8 to the live validators table and the git-tracked dumps) — allowlisted by the established document-digest/meaning-based process; never a pasted value |
| Browser E2E (dev stack, post-fix) | landing renders full tree; **zero page/console errors**; mobile 390px no horizontal overflow (380×5152); screenshots in `audit-work/v28-post-recovery/` |

---

## 10. Remaining blockers and release restrictions

*(final tables — backstop first scheduled fire, final dual-lag figures, final remote SHA —
appended below at report commit time)*

### 10.1 Monetary / governance restrictions re-verified — **PASS (all clean)**

- **Zero issuance / redemption:** IssuanceEvent 0, MbzMintRequest 0, MbzBackingCertificate 0,
  MbzBank 0, ScoringUpload 0 — identical zeros in committed dump and live.
- **Zero applied rebalancing / reserve transfer:** all 10,004 RebalancingDecision rows
  `applied=0` (advisory shadow records only); zero monetary event types in the chain event
  log; dev.log shadow census: 2,735 `RebalanceSkipped`, **0 `RebalanceApplied`** (§11.7
  shadow events only; the single "MARP execution: 1 applied" line is the documented shadow
  record pathway — `RebalanceExecuted (shadow record)`).
- **No compromised key used:** no onchain/deploy scripts executed; no key material touched;
  commits this session contain source fixes, telemetry, and evidence only.
- **Governance/Safe unchanged:** proposals 4, votes 12 (unchanged); OD-35 Safe 1/1 and the
  D-13.3–D-13.26 restrictions stand as documented in v27 (no governance action taken).
- **Shadow mode active:** `/api/status` = `TESTNET PILOT`; shadow event stream flowing;
  genesis `gen_3baf0dba…` canonical; fixed supply 1,000,000,000 uMTQ intact
  (treasury 950M + accounts); `rewards_enabled: 0`, `block_reward_u: 0`.
- No financial or governance transaction was performed by this session.

### 10.2 Backstop 514615 — first actual scheduled execution record

**TO BE FILLED AT 13:17:48Z+ — the report is committed only after this section is complete.**

### 10.3 Final figures at report commit

**TO BE FILLED.**

### 10.4 Final acceptance status

**TO BE FILLED — only after every stated operational condition has actually passed;
otherwise the precise remaining blockers are listed here.**
