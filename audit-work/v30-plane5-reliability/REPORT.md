# MTQΣ — V30 Plane 5 Scheduler Reliability & Bootstrap Acceptance

**Release classification:** TESTNET ONLY · SHADOW MODE · MONETARY/GOVERNANCE ACCEPTANCE PENDING
**Session window:** 2026-11-08 ~22:58Z → 23:20Z (interactive v30 session; all times UTC)
**Baseline at session start:** origin/main `bf4559d` → working session commit `6ff8143` (tooling) → this report
**Final status line:** **NOT EARNED YET** — held until one-time verifier job `516200` (fires 01:10Z) confirms the first scheduler-dispatched hourly backstop cycle. See §J.

---

## A. Current Git and platform state — **PASS**

| Item | Value |
|---|---|
| origin/main | `6ff8143` (this session's tooling commit; prior `39553ee` = 22:55:45Z monitor alert) |
| Local HEAD | `6ff8143`, tree clean except by-design write-behind (`backups/db-snapshots/latest-chain.sql` refreshed to h17725, guard-derivable) and throttled monitor telemetry (`alerts.log`, `monitor-state.json` — swept by the next plane5 commit) |
| Sandbox re-image | ~22:47Z (platform booted stale task46 snapshot `9fe4058` directly; recovery below) |
| Server | `next dev` :3000 → **200**, watchdog v4 alive (relaunched 23:04Z through the full boot chain) |
| DB (post-remediation) | chainTip **h17749** · integrity ok · boot_mode self-healed · genesis `gen_3baf0dba…` canonical · customRows 17,644 · integrity ok |
| Dual lag | diskTip h17725 · committedTip h17661 · unbackedAhead 88 · recoveryDeficit **0** |

## B. Scheduler job registration and full execution history — **PASS (documented; failures recorded, not hidden)**

| Job | Payload | Schedule | Execution history |
|---|---|---|---|
| 515684 (v3.1 monitor, **deleted at v30**) | 7-step agent contract | :55:45 hourly | **4/4 fires SUCCEEDED**: 19:55:45Z, 20:55:45Z, 21:55:45Z, 22:55:45Z (commits `0d761f1`, `bf4559d`, `39553ee`) |
| 515685 (v3.2 backstop, **deleted at v30**) | 7-step agent contract, ~2× payload size | :17:48 every 2h | **0/2 fires succeeded — BOTH permanently REJECTED**: 19:17:48Z and 21:17:48Z, `execution.stage=failed`, `info="model concurrency limit exceeded"`, run_count 2, no retry, next tick +2h |
| **516197** (v3.3 backstop, new) | **deterministic ONE-script** (`scripts/plane5-run.sh backstop`) | :17:48 **hourly** | registered 23:15Z; first fire 00:17:48Z |
| **516198** (v3.2 monitor, new) | **deterministic TWO-tool-call** (cron list → `plane5-run.sh monitor --scheduler-json`) | :55:45 hourly | registered 23:15Z; first fire 23:55:45Z |
| **516200** (one-shot verifier) | acceptance verification + REPORT §J update | one_time 01:10Z | registered 23:16Z |

## C. Root cause of concurrency failures — **ROOT CAUSE IDENTIFIED AS A PLATFORM LIMITATION; not fully eliminable from inside the sandbox**

Observable facts (evidence: scheduler API states + committed telemetry):
1. The gateway enforces a **global model concurrency limit** on agent executions; rejected dispatches fail immediately with `model concurrency limit exceeded`.
2. The scheduler does **not queue, retry, or re-dispatch** a rejected execution — it is permanently lost until the next cron tick (run_count increments; `next_run_time` advances with no compensating attempt).
3. Slots **are released on completion** — the monitor fired successfully 4 consecutive hours (19:55→22:55) while the backstop was failing, i.e. failures do not poison capacity.
4. Both backstop rejections (19:17:48Z, 21:17:48Z) occurred while an interactive agent session was plausibly active in this chat (the v29 session that created the jobs at 19:15:30Z was still alive at 19:17:48Z); monitor fires at :55:45 found idle windows. **The exact slot-holder is platform-internal and cannot be conclusively attributed from inside the sandbox** — this is documented honestly, not guessed.
5. A scheduled timestamp is not evidence of execution; a dispatched execution is not evidence of completion (the scheduler's `stage` field is the only completion signal exposed).

**Correction delivered (Phase B):** a lightweight deterministic execution model — the scheduled agent's only job is to run ONE committed script and relay one line (`scripts/plane5-run.sh`, commit `6ff8143`), minimizing per-fire model footprint and wall-clock window; hourly backstop cadence so one rejected fire costs ≤1h coverage (was 2h); explicit `flock` (no concurrent self-heal); bounded `curl -m 5`; durable execution ledger. **Explicitly NOT claimed:** that moving the schedule "resolved" the concurrency limit. The limitation itself remains (see §I) — the correction bounds its blast radius and makes every miss observable.

## D. Permanent scheduler reliability correction — **PASS (mechanism committed + smoke-tested)**

- `scripts/plane5-run.sh` (committed `6ff8143`): deterministic monitor + backstop contracts (v3.1/v3.2 semantics preserved verbatim — bootstrap-from-origin, never raw-git realign, guard BLOCKED → /tmp-only + no commit, forward-only DB recovery, dual heartbeat with clock round-trip verification, commit/push rules incl. 30-min monitor throttle and push-rejection recovery, worklog on remediation).
- Durable execution ledger `backups/plane5/execution-ledger.jsonl` (guard-derivable prefix — a stranded write can never block realignment): every run appends STARTED/FINAL entries with outcome `EXECUTED-OK/ALERT/BLOCKED | BOOTSTRAP-FAILED | OVERLAP-SKIP`, and the monitor records the **scheduler-observed state** (`--scheduler-json`: run_count/stage/info/lastRunAt of both jobs) so a **dispatched-but-rejected** fire is distinguishable from a **never-dispatched** one. `/tmp/plane5-execution-ledger.jsonl` always captures bootstrap-stage failures.
- Smoke tests this session (MANUAL — labeled, not scheduler evidence): classification matrix 5/5 PASS (`fresh-OK→PLANE_5_OK`, `fresh-BLOCKED→PLANE_5_BLOCKED`, `fresh-ALERT→PLANE_5_ALERT`, `stale-OK→PLANE_5_ALERT`, `clock-inconsistent→PLANE_5_ALERT`); overlap guard → exit 43 `OVERLAP_SKIP`, /tmp ledger line, **zero durable writes**; full monitor run end-to-end (bootstrap exit 0 → stale heartbeat age 20,929s → PLANE_5_ALERT → alerts.log + monitor-state + ledger FINAL with scheduler-observed JSON → 30-min throttle correctly suppressed the commit — last plane5 commit 22:57:22Z was 17 min prior).

## E. Platform startup ordering assessment — **PLATFORM HOOK UNCHANGEABLE (documented precisely); IN-PROCESS ORDERING FIX COMMITTED — PASS**

Findings (with live evidence from this session's re-image):
1. **No `start.sh` exists** anywhere in the project; the platform's own startup mechanism launches `next dev -p 3000` **directly** (ps: `/usr/bin/bash -c next dev -p 3000 2>&1 | tee dev.log`, started 22:47Z at re-image, no watchdog). This command is baked into the sandbox image/orchestrator **outside the sandbox — it cannot be changed from inside**, and no startup hook is exposed that could enforce the §Phase-D 12-step order at platform boot.
2. **Live incident (the exact v29 §4 hazard) at 22:47:59.640Z:** the platform's direct boot ran the stale task46-era snapshot, whose in-process self-heal (`boot_mode=self-healed`, `selfheal_dump=latest-chain.sql`) restored chain.db from the snapshot's **obsolete disk dump h3941** while origin/main's committed dump was **h17661** → live tip regressed to h4028 (≈13.7k-block data regression) **before any repository verification**. dev.log verbatim: `[selfheal] chain.db RESTORED from cloud dump (live missing → h3941)` / `[chain] … height=3941 · mode=RESUME`.
3. The stale server then died at ~22:56Z when the 22:55:45Z monitor's bootstrap realign swapped sources under it (`Cannot find module './otel/logger.js'`, swc mismatch) — a stale platform-booted server is ephemeral by nature; the sanctioned watchdog chain owns the clean reboot.

**Permanent in-process fix (commit `6ff8143`, `src/instrumentation.ts` step [0]):** the git-drift guard now runs **before** `ensureChainNode()`'s DB self-heal on EVERY server boot — no matter who starts the server (platform direct boot included). The tree is realigned forward-only (guard's archive + content-subsumption proofs; `db/*.db` never touched) **before** the self-heal reads the disk dumps, so the heal consumes the newest committed dumps. Guard `blocked` → the self-heal **stands down** (never over unadjudicated unique content; chain reports ready:false). Unverifiable git (transient fetch failure) → best-effort + loud log; the **strict** gate remains the external bootstrap (`plane5-bootstrap.sh` exit 9/11–15 semantics) + watchdog v4 boot chain. Because the gate is committed source, **every future re-image snapshot ships it** — that is what makes the fix permanent; snapshots predating the gate (like task46) remain covered only by the external layers, which is the documented residual limitation.

## F. Bootstrap and recovery execution evidence — **PASS**

- **Re-image → bootstrap → realign (scheduler-dispatched):** the 22:55:45Z monitor fire's bootstrap realigned the stale snapshot `9fe4058` → `39553ee` through the harness-proven guard (HEAD verified == origin; prerequisites + committed snapshot verified: committedTip h17661, canonical genesis present), restoring the durable telemetry layer (`backups/plane5/`).
- **Retrieval independence:** the payloads embed the `git show origin/main:scripts/plane5-run.sh > /tmp/…` fallback so scheduled recovery never depends on the checkout containing current tooling (v29 §5); the worktree copy was present this cycle and the guard's materialize-if-absent path is design-proven.
- **DB recovery (forward-only, sanctioned):** watchdog v4 boot chain launched 23:04Z → guard → source-integrity heal → `db-selfheal` → `next dev`; chain restored **forward-only** h4028 → h17661 (dump strictly ahead; regressed file archived; identity gates enforced) → resumed to h17749 by 23:14Z; integrity ok; genesis canonical; recoveryDeficit 0. **No reseed, no truncation, no older-snapshot overwrite** (the live-behind-dump state was healed toward the newer validated source — the only legal direction).

## G. Durable heartbeat and monitoring evidence — **PASS**

- The durable alert record **survived the 22:47Z re-image** (proof: alerts.log lines from 12:05Z / 19:59:08Z / 20:56:18Z present on disk and in git history after the reset) — Phase F's re-image-survival requirement is proven by this very incident.
- Missed backstop fires became alerts: 19:17:48Z + 21:17:48Z rejections → monitor alerts 19:59:08Z (`0d761f1`), 20:56:18Z (`bf4559d`), 22:57:17Z (`39553ee`) — **no silent suppression** (the monitor kept firing hourly through the backstop's failures).
- Heartbeat remains honestly STALE (17:25:14.581Z, result=OK) — last successful backstop execution; it is never presented as proof of current health. Clock round-trip verified (tsIso↔tsMs).
- `monitor-state.json` durable + /tmp mirror; `missingSinceMs` baseline governs (heartbeat present-but-stale ⇒ baseline intact, null).

## H. Six-plane operational results — **PASS (manual session measurement 23:14:30Z); SCHEDULER-DISPATCHED RUN PENDING 00:17:48Z**

| Plane | Result | Evidence |
|---|---|---|
| git | OK | HEAD==origin/main `6ff8143`, guard exit 0 |
| db | OK | h17749 · integrity ok · customRows 17,644 · boot_mode self-healed (not re-seeded) · recoveryDeficit 0 · unbackedAhead 88 |
| server | 200 + watchdog alive | curl 200; 3 watchdog processes (relaunched via v4 chain 23:04Z) |
| route | 403 (fail-closed) | POST /api/constituency/upload → 403, file present |
| durable lag | diskTip h17725 / committedTip h17661 / unbacked 88 / deficit 0 | write-behind refreshed post-heal |
| heartbeat | stale 17:25:14Z (honest) | awaits first hourly backstop fire |

## I. Remaining platform limitations — **DOCUMENTED (not claimed fixed)**

1. **Global model concurrency limit, no queue/retry** for scheduled agentTurn dispatches — a fire colliding with an active session/other load is permanently lost until the next tick. Mitigation: deterministic one-script payloads (minimal footprint/window), hourly cadence (≤1h exposure), ledger + monitor alert-on-miss. The limitation itself is outside the sandbox's control.
2. **Platform startup hook is a fixed direct `next dev`** — no in-sandbox mechanism can force bootstrap-before-app at platform boot. Mitigation: committed in-process boot-order gate [0] (all future snapshots ship it) + external bootstrap + watchdog v4. Snapshots predating the gate remain exposed (as the 22:47Z incident proved) until the next generation of images.
3. **Scheduler API exposes only last-state + run_count** (no execution IDs/history endpoint) — the durable ledger + per-fire scheduler-json snapshots compensate.
4. **Platform-internal slot attribution is unobservable** — root-cause analysis is bounded by what the scheduler exposes (honest limit, §C).

## J. Final acceptance matrix — **as of 23:20Z (pre-first-hourly-fire); verifier 516200 finalizes at ~01:10Z**

| # | Criterion | Verdict | Evidence / pending |
|---|---|---|---|
| 1 | Backstop executes successfully through the actual scheduler | **NOT VERIFIED** | every v3.2 fire rejected (§B); first v3.3 hourly fire 00:17:48Z; job 516197 run_count must advance with stage=succeeded + ledger FINAL + fresh heartbeat + commit |
| 2 | Monitor executes successfully through the actual scheduler | **PASS (v3.1: 4/4 fires, commits `0d761f1`/`bf4559d`/`39553ee`)** / v3.2 payload NOT VERIFIED until 23:55:45Z (job 516198) | scheduler-dispatched with committed telemetry |
| 3 | Neither recurring job silently lost through concurrency rejection | **PASS for detection** (rejections → committed alerts 19:59/20:56/22:57; monitor cross-checks both jobs' run_count/stage every fire via scheduler-json; a deleted job is visible as absent from cron list) | permanence re-verified by 516200 |
| 4 | Every execution has durable evidence | **PASS** | execution-ledger.jsonl + heartbeat + alerts + git commits (§D/G) |
| 5 | Missed executions generate alerts | **PASS** | 19:17:48Z/21:17:48Z rejections → three committed alert lines; no silent suppression |
| 6 | A successful heartbeat does not conceal a failed plane | **PASS** | matrix sim fresh-BLOCKED→PLANE_5_BLOCKED (5/5); writer computes result=OK only when every plane passes; monitor contract keeps BLOCKED distinct from OK |
| 7 | Bootstrap retrieves authoritative recovery tooling after a re-image | **PASS** | 22:47Z re-image → 22:55:45Z scheduler-dispatched bootstrap realigned `9fe4058`→`39553ee` + restored durable telemetry (§F) |
| 8 | Old app code cannot DB-self-heal before repository verification, or the limitation is explicitly documented | **PASS** (in-process gate [0] committed `6ff8143`; every future snapshot ships it) **+ limitation documented** (platform hook unchangeable; pre-gate snapshots covered by external layers only — §E.3) |
| 9 | Database recovery remains forward-only and integrity-verified | **PASS** | h4028→h17661 forward-only restore + resume to h17749; integrity ok; genesis canonical; deficit 0 (§F) |
| 10 | No duplicate recovery loops or competing servers | **PASS** | single watchdog instance; backstop `flock` makes concurrent self-heal structurally impossible (OVERLAP_SKIP exit 43 verified); watchdog EADDRINUSE port guard |
| — | **Final status line** | **HELD** | emitted only by verifier 516200 after criteria 1 + the v3.2-payload row of 2 actually pass |

---

### Evidence pointer for verifier 516200

- Ledger: `backups/plane5/execution-ledger.jsonl` (look for `mode=backstop` FINAL `EXECUTED-*` after 00:00Z, and `mode=monitor` classification entries).
- Scheduler: cron list → jobs 516197/516198 run_count/stage/info/last_run_at/next_run_time.
- Heartbeat: `backups/plane5/heartbeat.json` (expect tsIso ≈ 00:17:48Z+, result per real planes, nextDueMs +1h) + `sha256sum`.
- Commits: `git log --oneline` — expect `plane5-heartbeat: … OK` (job 516197) and possibly `plane5-monitor: …` (job 516198).
- Rules: a manual execution NEVER substitutes for scheduler-dispatched evidence; PASS only what the durable record proves.
