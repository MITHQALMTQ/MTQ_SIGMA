# Incident 19 — The Bootstrap/Git-Drift Contradiction (exit-13 loop)

**Report date:** 2026-11-09 (V31 TURN 2A)
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED
**Baseline at report start:** origin/main `9560222`, local HEAD `63eb204` (failed execution) → `da904b2` (post-fire)
**Fix commits:** `5ded004` (live transition repair publication + manifest v1), `48da9bc` (source-code fix + harness)
**Status after this report:** root cause PROVEN and eliminated; original scenario PASSES in isolation (78/78 harness checks); live transition executed and verified; scheduler-fire regression evidence from the 03:17:48Z fire recorded below.

---

## 1. The exact failed scheduler execution

- **Failed execution timestamp:** 2026-11-09T02:18:12.717Z (bootstrap log line, exit-13 FAIL).
- **Failed local HEAD at execution:** `63eb204558a965d3bd46ccadcfcc38c1ae8caa24`.
- **Remote origin/main:** `95602224d8de2b3e6991ef5810bf4ef37d6fe938`.
- **Failure line (verbatim, durable ledger):**
  `FAIL HEAD 63eb204558a965d3bd46ccadcfcc38c1ae8caa24 != origin/main 95602224d8de2b3e6991ef5810bf4ef37d6fe938 after guard — BLOCKED`
- **Wrapper outcome:** `PLANE_5_BACKSTOP BLOCKED bootstrap_exit=13`, wrapper exit 9.

## 2. Scheduler record and ledger evidence (Phase 1 reconstruction)

| Evidence | Value | Source |
|---|---|---|
| Scheduler job (backstop) | `516197`, cron `48 17 * * * ?` Africa/Cairo, hourly :17:48Z | scheduler registry (listed 2026-11-09) |
| Dispatch | run_count=4, last_run 02:17:48Z, stage `succeeded` (the agent TURN succeeded in relaying the BLOCKED verdict — the wrapper it ran is what blocked) | registry `execution` block |
| Turn completion bracket | registry `updated_at` 02:18:41Z — brackets the wrapper run | registry |
| Durable ledger | `02:18:11.421Z mode=backstop jobId=516197 phase=FINAL outcome=BOOTSTRAP-FAILED bootstrapExit=13` + verbatim bootstrap tail | `backups/plane5/execution-ledger.jsonl` |
| Bootstrap internal timestamps | guard pass 02:18:12.715Z → §3.8 FAIL 02:18:12.717Z (200 ms apart — the contradiction fires instantly after the guard passes) | ledger `bootstrapTail` |
| Post-block platform sweep | commit `da904b2` at 02:18:26Z (subject `4892effd-…-cron`) containing exactly the files dirtied during that fire: `backups/db-snapshots/latest-chain.sql` + `backups/plane5/execution-ledger.jsonl` | git reflog + `git show --name-status` |
| Heartbeat | correctly NOT refreshed (last durable heartbeat 01:19:10.381Z, result OK) — a failed execution must never write a fresh heartbeat | `backups/plane5/heartbeat.json` |
| Watchdog / server | alive and untouched during the fire (no remediation ran — the failure was pre-plane-3) | process table, dev.log |
| Working tree / databases | no database was modified; no source file changed during the failed execution | `git show --name-status da904b2` (operational files only) |

Attribution caveat (honest): the wrapper's job-ID default attributes ANY `backstop` invocation without `--job-id`/`PLANE5_JOB_ID` to `516197`. The 02:18:11.421Z entry IS the scheduler fire (registry bracket 02:17:48→02:18:41Z, run_count=4, and the `-cron` suffixed sweep commit 02:18:26Z inside the bracket), while my 02:21:44Z manual smoke re-run was ALSO recorded with `jobId=516197` — a known misattribution surface for manual runs; the ledger evidence for the incident itself is the 02:18:11.421Z entry plus the registry bracket, not the manual re-run.

## 3. Pre-fire and post-fire Git states

```
02:08:20Z  9560222  v31 Phase 5 source commit — pushed; origin/main from this point
02:09:15Z  45443cc  platform turn-end sweep (subject 42c58ed2-…) — latest-chain.sql only
02:16:32Z  63eb204  platform turn-end sweep (subject bdd78e67-…) — latest-chain.sql only
02:17:48Z  ── scheduler dispatches job 516197 (run_count=4)
02:18:12Z  ── bootstrap: guard exit 0 → §3.8 FAIL → exit 13 (HEAD=63eb204)
02:18:26Z  da904b2  platform turn-end sweep (subject 4892effd-…-cron) — latest-chain.sql + execution-ledger.jsonl
02:18:41Z  ── scheduler turn completes (stage=succeeded — the relay worked)
02:21:45Z  ── manual re-fire by the audit session: identical BLOCKED, now at HEAD=da904b2
```

Every ahead commit is a snapshot/evidence-only commit (verified by `git show --name-status` on all three); the chain is strictly linear from `9560222`; dump heights across them advance forward-only (h19573 → h19636 → h19700, read from the committed blobs' `-- MTQ-DUMP-TIP` lines).

## 4. The `45443cc` versus `63eb204` discrepancy

These are **distinct successive platform turn-end sweep commits, not the same commit**:

- `45443cc` (02:09:15Z): parent `9560222` — the sweep at the end of the interactive turn that produced the v31 Phase 5 push. During that turn the write-behind loop had refreshed `latest-chain.sql` past the committed state; the platform committed the dirty file at turn end.
- `63eb204` (02:16:32Z): parent `45443cc` — a further sweep (platform housekeeping turn; the exact turn identity is not verifiable from inside the repository — contents prove snapshot-only, dump-only, forward-only).
- `da904b2` (02:18:26Z): the sweep of the failed scheduler fire itself.

The observed HEAD "changed" from `45443cc` to `63eb204` (and later `da904b2`) simply because **every agent-turn end produces another sweep commit while a tracked dump stays dirty** — the recurrence mechanism itself (see §6). None of the three commits touches application source, configuration, scripts, workflows, or security files.

## 5. The exact contradictory code conditions (Phase 2 trace)

Execution trace of the failed fire (file:line as of origin/main `9560222`):

```
02:18:10Z  wrapper §0 (scripts/plane5-run.sh) → bash scripts/plane5-bootstrap.sh
02:18:12.7xx  bootstrap §3.2  fetch OK; origin/main = 9560222
            bootstrap §3.5–3.7  bun run scripts/git-drift-guard.ts
              src/lib/boot/git-drift.ts:292-330 classifyGitDrift():
                head 63eb204 != origin 9560222; merge-base 9560222;
                localOnly=[45443cc,63eb204]; behindCount=0 → klass="ahead-only"
              src/lib/boot/git-drift.ts:563-569 guardGitDrift() case "ahead-only":
                log "local is AHEAD of origin/main by 2 commit(s) — not a regression;
                     PUSH so the cloud layer holds this work"
                → action "none" → CLI exit 0
            bootstrap: "guard exit 0 — synced/ahead (git plane OK)"     ← GUARD PASSES
            bootstrap §3.8 (scripts/plane5-bootstrap.sh:78-83, old text):
              HEAD_SHA != ORIGIN_SHA → "FAIL HEAD … after guard — BLOCKED" → exit 13   ← BOOTSTRAP BLOCKS
02:18:11.42Z  ledger FINAL BOOTSTRAP-FAILED (bootstrapExit=13)
02:18:26Z  platform turn-end sweep → da904b2 (unpushed) → next fire repeats
```

**The same Git state passes one guard and fails the next, 200 ms apart.** A third copy of the same equality policy existed in the heartbeat writer (`scripts/plane5-backstop-heartbeat.ts:65`, old text: `const git = headSha === originSha ? "OK" : "BLOCKED"`) — so even a bootstrap fix alone would have re-manifested the block at the heartbeat layer.

**Lowest responsible architectural layers:**
1. **For the incident (the exit-13 contradiction):** the external bootstrap gate — it imposed a strictly stronger policy (HEAD == origin) than the guard it had just invoked, sharing no classification vocabulary with it, at the layer ABOVE the guard.
2. **For the recurring drift feeding it:** the write-behind persistence design — task42's cloud-sync loop deliberately kept the git-TRACKED dump perpetually dirty (`WRITE_BEHIND_DUMP_RE` was invented to tolerate exactly that steady state), which the platform's turn-end auto-commit then swept into uncontrolled unpushed commits on every fire.

## 6. Proven root cause

1. **(Platform, intended behavior, outside repository control)** The platform agent-loop wrapper auto-commits ALL dirty tracked files at the end of every agent turn — interactive or cron — with the turn's request UUID as the commit subject (`-cron` suffix for cron turns), unpushed. Proven by: `da904b2` containing exactly the two files dirtied during the 02:17:48Z fire; commit subjects matching gateway request IDs across the reflog (e.g. `158a0b8` = job log_ids request_id).
2. **(Repository design defect — the feed)** The write-behind loop dirtied the tracked `backups/db-snapshots/latest-chain.sql` continuously (by design since task42), guaranteeing the platform sweep always had snapshot content to commit.
3. **(Repository gate defect — the trigger)** bootstrap §3.8's strict `HEAD == origin/main` assertion contradicted the guard's `ahead-only → benign` classification, converting a benign, validated, forward-only operational-snapshot-ahead state into exit 13 on **every** fire following any turn end — i.e., effectively every hourly fire (the observed 00:09/00:55/01:17-era loop of incident 19, and the 02:18:12.717Z execution of this report).
4. The 02:17:48Z scheduler dispatch itself was **healthy** (registry bracket + ledger + relay all confirm); the failure was purely the gate contradiction. No database was modified; no source was changed; the heartbeat was correctly left stale.

## 7. Architectural fix (Phases 3–5)

### 7.1 One shared branch-state classification (single source of truth)

`src/lib/boot/git-state.ts` (+ CLI `scripts/git-state-classify.ts`, node-builtins-only so it runs in the server, in plain bun scripts, and in dependency-free test sandboxes) classifies the branch into exactly the eight V31-T2A states — `EXACT_MATCH`, `SAFE_SNAPSHOT_AHEAD`, `SOURCE_CODE_AHEAD`, `BEHIND`, `DIVERGED`, `REMOTE_UNAVAILABLE`, `SNAPSHOT_INVALID`, `AUTHORITY_UNVERIFIED` — consumed by bootstrap §3.8, the wrapper's git plane, the heartbeat writer's git plane, and the publisher's safety gate. SAFE_SNAPSHOT_AHEAD requires ALL of:

- every commit in `origin..HEAD` touches ONLY explicitly allowlisted operational paths — file-level snapshot allowlist (`backups/db-snapshots/latest-chain.sql`, `latest-custom.sql`, `manifest.json` — no broad wildcard), plane-5 telemetry files, `worklog.md`, `audit-work/`, `evidence/` — with statuses A/M only (deletions refused);
- every ahead commit's dump payloads pass INDEPENDENT structural checks: v2 tip parse, canonical genesis `gen_3baf0dba…` present, transaction completeness (`BEGIN TRANSACTION;` … `COMMIT;` trailer — partial dumps never pass), forward-only chain heights (custom rows tolerate only the ≤10 % retention-prune delta);
- the HEAD state carries a `manifest.json` whose sha256 hashes match the committed blobs, with matching heights/rows/genesis/source-DB identity, and a version that does not regress the origin baseline's;
- recovery authority intact: `db-selfheal.ts` + `src/lib/db-ops.ts` present at HEAD, and the intentional-reset sentinel inactive.

Bootstrap behavior per state: EXACT_MATCH / SAFE_SNAPSHOT_AHEAD → proceed; every other state → exit 13 (the monitor's degraded-observation window semantics are preserved). Bootstrap §3.10 now independently re-verifies the HEAD-committed snapshot against the manifest (it never merely trusts the §3.8 classifier — an accepted Git state cannot authorize restoration by itself; recovery's own fail-closed forward-only authorization in `selfHealDatabases` is unchanged and additionally refuses manifest-mismatched published dumps at the recovery boundary).

### 7.2 Staging write-behind + atomic validated publication (ends the feed)

- The 60 s write-behind loops (in-process tick + watchdog subloop) now refresh **untracked staging dumps** (`backups/db-snapshots/.staging/latest-*.sql`, atomic tmp+rename). The tracked published files are no longer perpetually dirty — the platform turn-end sweep has nothing snapshot-shaped to sweep.
- `scripts/snapshot-publish.ts` (+ `src/lib/boot/snapshot-manifest.ts`) is the ONLY writer of the tracked files: validate (parse/genesis/completeness/forward-only) → build manifest (sha256, bytes, height, rows, genesis, source DB, timestamp, version=prev+1) → atomic tmp+rename publication → `git add` of EXACTLY the three snapshot paths → commit → push (push failure is a safe SAFE_SNAPSHOT_AHEAD state, retried by the next execution — never an error).
- Publication cadence: hourly by the backstop (plane 2b), plus a threshold-gated autonomous publication (≥600 blocks / ≥4000 rows past published) from the 60 s loops — bounded staleness even when every scheduler fire is rejected by the gateway, without turning git into real-time DB replication.
- Transition repair: when the only bootstrap failure is `SNAPSHOT_INVALID` (a platform sweep advanced a dump without a manifest — the incident-19 geometry), the wrapper performs ONE sanctioned repair publication and retries the bootstrap ONCE. Publication ≠ recovery: structurally invalid dumps (bad genesis, height regression, partial payload) are refused by the publisher and stay blocked.
- Recovery sources: `selfHealDatabases` prefers the staged dump when structurally valid and not behind the published one (minutes-scale loss window preserved), else the manifest-verified published dump.

### 7.3 Heartbeat writer

`plane5-backstop-heartbeat.ts` git plane now derives from the shared classifier (`gitState` field added to the heartbeat) — the third equality site is gone. `diskTip` reads the staged dump when present.

## 8. Regression test results (Phases 6–7, isolated)

`tests/plane5-git-state-regression.sh` — isolated sandboxes carrying the REAL light tooling, disposable fixture dumps/DBs, per-sandbox bare origins whose URL satisfies the authenticity pattern, PATH-stubbed `ss/curl/ps/pkill` so wrapper-level scenarios can never touch the live server. **78/78 checks PASS** (full log: `audit-work/v31-root-cause/regression-harness-run.txt`):

- S1 exact match → EXACT_MATCH/exit 0 · S2 one valid snapshot-ahead → SAFE/exit 0 · S3 three valid → SAFE/exit 0
- S4 source-ahead → SOURCE_CODE_AHEAD/exit 10/bootstrap 13 · S5 mixed commit → SOURCE_CODE_AHEAD
- S6 behind → BEHIND/exit 11; bootstrap proceeds ONLY via the guard's controlled fast-forward (then EXACT_MATCH)
- S7 diverged → DIVERGED/exit 12; guard blocks on unique content (exit 1)
- S8 remote unavailable → REMOTE_UNAVAILABLE/exit 13; bootstrap fetch-fail exit 12 (no automatic recovery)
- S9 hash tamper → SNAPSHOT_INVALID · S10 missing manifest (the literal legacy sweep geometry) → SNAPSHOT_INVALID · S11 no genesis → SNAPSHOT_INVALID · S12 height regression → SNAPSHOT_INVALID · S13 torn/partial dump → SNAPSHOT_INVALID
- S14 heal CLI absent → AUTHORITY_UNVERIFIED/exit 15 · S15 manifest version progression 1→3 verified · S16 one invalid among valid commits → SNAPSHOT_INVALID (every commit in the range is validated)
- S17 origin moves during validation → fresh-fetch classification DIVERGED; bootstrap proceeds only via archive+subsumption-proof realignment (never a stale accept)
- S18 second snapshot lands mid-flow → publisher publishes it; both ahead commits validated; SAFE
- S19 lock held by concurrent execution → OVERLAP_SKIP, durable ledger untouched
- S20 reset sentinel (recovery explicitly blocked) → AUTHORITY_UNVERIFIED
- **P1 (the original incident-19 scenario, positive):** verified clone at EXACT_MATCH → valid forward-only staged snapshot → wrapper publication commit left UNPUSHED → bootstrap classifies SAFE_SNAPSHOT_AHEAD and reaches BOOTSTRAP_OK (snapshot-verified-at-HEAD, §3.9/§3.10 green); the full six-plane backstop completes `result=OK … gitState=SAFE_SNAPSHOT_AHEAD`, ledger EXECUTED-OK, durable heartbeat OK — the exact historical failure no longer occurs.
- **P2 (negative):** unpushed SOURCE commit after a valid snapshot → SOURCE_CODE_AHEAD; bootstrap exit 13; wrapper relays BLOCKED; ledger `BOOTSTRAP-FAILED … gitState=SOURCE_CODE_AHEAD`.
- **R1 (transition repair):** literal legacy geometry (dump-only sweep commit, no manifest) → SNAPSHOT_INVALID → wrapper's ONE sanctioned repair publication → retry bootstrap proceeds → EXECUTED-OK, ledger REPAIR-PUBLICATION recorded.

## 9. Live transition evidence (executed 03:09–03:17Z)

1. Pre-fix live classification (read-only): `SNAPSHOT_INVALID`, ahead=3 (the three sweep commits), all snapshot-only + forward-only — blocked **solely** on the missing manifest: the classifier's honest verdict on the real repository.
2. Repair publication `5ded004`: adopted the current working-tree dumps (chain h20209/40,886 rows, custom 18,077 rows) with manifest v1; committed exactly the three snapshot paths; pushed `9560222..5ded004` — the sweep lineage reached the cloud layer without any history rewriting, force-push, or reset.
3. Post-transition: classifier `EXACT_MATCH` (manifest chainShaOk/customShaOk/genesisOk all true); **bootstrap exit 0** — `git state EXACT_MATCH — HEAD == origin/main == 5ded004…`, `snapshot verified at HEAD: manifest v1 · committedTip=h20209 · sha256 match · canonical genesis present`, `BOOTSTRAP_OK`.
4. Dev server restarted through the watchdog v4 chain at 03:12:57Z (git-drift OK → source-integrity OK → db-selfheal refused the manifest-mismatched dirty tracked dump exactly as designed (live DB ahead; no heal required) → next dev up, health 200). One live defect was caught and fixed during the transition: direct `node:path`/`node:child_process` imports in `instrumentation.ts` broke the Edge-runtime compilation of the instrumentation entry (loud per-tick warnings) — extracted to `src/lib/boot/inproc-publication.ts` (the established dynamic-import-owner pattern); typecheck 0 after the fix.
5. Source fix committed and pushed `48da9bc` at 03:16:57Z; the 03:17:48Z scheduler fire (below) then ran the fixed system from a clean pushed tree.

### 9.1 The 03:17:48Z scheduler fire — LIVE regression evidence on the fixed system

(dispatched ~1 minute after the fix push; recorded here from the durable ledger after the fire)

- Verified outcome: **`EXECUTED-OK`** — durable ledger entry `2026-11-09T03:18:05.278Z mode=backstop jobId=516197 outcome=EXECUTED-OK gitState=EXACT_MATCH commit=1d8cb11 repair=not-needed`; durable heartbeat `2026-11-09T03:18:12.402Z result=OK gitState=EXACT_MATCH planes.git=OK`; the fire's evidence commit `1d8cb11` ("plane5-heartbeat: 2026-11-08T03:18:12.402Z OK") was created and PUSHED by the fire itself. This is the exact fire class that failed at 02:18:12.717Z.
- Follow-on (same fire): its turn-end sweep committed the still-dirty tracked dump without a manifest (the residual dirt from the pre-restart old-loop window — commit `46a63d3`) → the classifier honestly reported `SNAPSHOT_INVALID` → the sanctioned repair publication ran (`694e7dc`, chain h20333, manifest v2, pushed) → `EXACT_MATCH` restored. The complete detect → block → validate → publish → verify cycle executed LIVE, matching harness scenario R1.

## 10. Residual risks and platform limitations (honest disclosure)

1. **Platform turn-end auto-commit remains outside repository control.** With the staging architecture the tracked snapshots are no longer dirtied by the loops, but any OTHER dirty tracked file at an agent-turn end is still swept into an unpushed commit. Such commits are classified: evidence-only content → SAFE (accepted, pushed by the next execution); any source content → SOURCE_CODE_AHEAD (blocked, operator adjudication). The loop can no longer silently recur, but the platform behavior itself is not editable from inside the repository (V31 register residual limitation 4).
2. **Manual-fire attribution:** `plane5-run.sh` still defaults job IDs from registry topology; manual runs MUST pass `--job-id manual` (the 02:21:44Z smoke misattribution is recorded in §2). A future hardening could require an explicit flag for scheduler-attributed runs.
3. **One-time re-image transition:** a re-image restoring a PRE-fix server image boots old in-process code that dirties the tracked dump again until the tree realigns to the fixed origin; the wrapper's repair path self-heals that geometry (proven by R1), but the first fire after such a re-image may spend one cycle on REPAIR-PUBLICATION instead of a straight EXECUTED-OK. Once images carry the fixed code, the window closes.
4. **Manifest v1 covers the PUBLISHED pair only.** Staged dumps are validated structurally (parse/genesis/completeness) but carry no manifest until publication — by design (they are pre-publication state); recovery from staging relies on those structural checks plus the live-DB forward-only comparisons.
5. **Threshold publication spawns `bun` from the server process** (in-process tick) — same process-spawn pattern the codebase already uses for git in the guard; a missing `bun` on PATH in the server environment degrades to a logged, non-fatal error (the watchdog subloop and hourly backstop remain as independent publication paths).
6. **Scheduler-level:** gateway model-concurrency rejections (no queue/retry) can still reject individual fires; with the threshold publication + monitor watermark alerting (RC-9) the degradation is now observable and bounded rather than silent.

## 11. Proven findings vs hypotheses

**Proven (code + records + live probes):** everything in §1–§6 and §8–§9 — the dispatch/ledger/reflog evidence chain; the three-commit snapshot-only forward-only ancestry; the platform turn-end sweep mechanism (contents + UUID/request-ID correlation + timing brackets); the three equality-policy sites; the guard-passes/bootstrap-blocks 200 ms trace; the 78/78 isolated matrix; the live transition (EXACT_MATCH, bootstrap exit 0, manifest v1 verified); the Edge-runtime import defect and its fix; the publisher ROOT-path defect (module-URL resolved against `..` treated the file as a directory — caught live because the harness had masked it via `MTQ_SIGMA_ROOT`) and its fix.

**Hypotheses / not fully verifiable from inside the repository:** the identity of the platform housekeeping turn that produced `63eb204` at 02:16:32Z (contents and parentage are proven; the turn's trigger is platform-internal); the platform's exact sweep-selection rule beyond the observed "all dirty tracked files at agent-turn end"; long-run behavior of threshold publication under sustained scheduler rejection (mechanism proven in isolation and live-boot, extended soak pending the next fires).

## 12. Acceptance criteria status

1. Root cause identified — YES (§6). 2. Guard contradiction eliminated — YES (single shared classification; all three equality sites replaced). 3. Valid snapshot-only ahead commits recognized — YES (S2/S3/S15/P1 + live). 4. Unverified source-ahead blocked — YES (S4/S5/P2). 5. Invalid snapshots blocked — YES (S9–S13/S16). 6. Recovery authorization fail-closed — YES (unchanged `selfHealDatabases` + manifest-refusal at the recovery boundary + S14/S20). 7. Original incident-19 scenario passes in isolation — YES (P1). 8. Source-ahead negative test passes — YES (P2). 9. Scheduler/ledger evidence correctly attributed — YES for the incident (registry bracket + 02:18:11.421Z entry; manual-smoke misattribution disclosed and separated). 10. No database state overwritten or lost — YES (no live DB writes at any point; live DB advanced normally throughout; recovery never fired beyond a refused-dump warning with the live DB ahead).

**Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**
