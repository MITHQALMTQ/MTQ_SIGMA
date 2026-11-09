# MTQΣ — V31 Root-Cause Register

**Scope:** every recurring failure in project history (V31 Phase 1, items 1–18) plus defects discovered and verified during the V31 Phase 0 audit of 2026-11-09.
**Baseline:** `13e744e` (local == origin/main, tree clean, verified before register creation).
**Classification:** `TESTNET ONLY · SHADOW MODE · MONETARY/GOVERNANCE ACCEPTANCE PENDING`.
**Language policy:** English only (operator directive, 2026-11-09).

Status vocabulary: `VERIFIED-FIXED` (live evidence), `FIXED-IN-CODE` (source-verified, live acceptance pending), `FIXED-TODAY` (landed in this V31 batch; live regression evidence from the next scheduler fires pending), `PARTIALLY-MITIGATED`, `PLATFORM-LIMITATION`, `OPEN`.

---

## Incident 1 — Sandbox re-image restores stale Task 46 source

- **Root cause:** the platform restores a filesystem snapshot taken before current tooling existed; the restored checkout predates `scripts/plane5-*.sh`, the drift guard, and watchdog v4.
- **Trigger:** sandbox re-image (platform-controlled, periodic).
- **Impact:** old application code runs against a database it did not create; every recovery tool is absent exactly when it is needed.
- **Previous fix:** external bootstrap gate (`scripts/plane5-bootstrap.sh`) that re-materializes the guard from `origin/main` before any data-layer action; cron payloads embed an inline `git show origin/main:...` fallback.
- **Why it recurred:** the platform can still start `next dev` directly from the stale image with no pre-boot hook (platform limitation); the bootstrap gate only runs when Plane 5 fires or is invoked manually.
- **Permanent correction:** in-process protection in `src/instrumentation.ts` (git-drift guard runs inside the server process before chain boot and DB self-heal; source-integrity restore heals mid-run deletions). A stale image that contains this instrumentation protects itself; a pre-instrumentation image cannot (documented residual limitation — V31 Phase 6C).
- **Preventive invariant:** repository authority must be established before any database self-heal, in every process generation that contains the guard.
- **Regression test:** V30 acceptance evidence (scheduler-dispatched backstop after re-image); V31 Phase 12 Test B (stale-local simulation) — OPEN.
- **Live evidence:** instrumentation boot chain verified in source 2026-11-09; V30 §J row 1 PASS (job 516197 fire 23:17:48Z, ledger EXECUTED-OK).
- **Residual limitation:** the platform starts `next dev` with no editable startup hook; an image older than the instrumentation cannot self-protect. Recorded honestly, not claimed fixed.

## Incident 2 — Platform starts the old application directly without watchdog v4

- **Root cause:** platform startup invokes the dev server directly; `dev-watchdog.sh` (the v4 boot chain owner) is not part of the platform's startup path.
- **Trigger:** re-image or platform restart.
- **Impact:** server runs without the guard → source-integrity-heal → db-selfheal → next dev ordering; DB self-heal ordering then depends solely on in-process instrumentation.
- **Previous fix:** watchdog v4 boot chain; in-process equivalents in `src/instrumentation.ts`.
- **Why it recurred:** external startup path is platform-controlled.
- **Permanent correction:** in-process guard gating (instrumentation) makes the server itself enforce ordering even without the watchdog; watchdog remains the outer belt.
- **Preventive invariant:** DB self-heal must be gated on a verified drift verdict regardless of which process invokes it.
- **Regression test:** instrumentation source review (2026-11-09); Phase 12 Test A — OPEN.
- **Live evidence:** `src/instrumentation.ts` lines verified: drift BLOCKED → self-heal stands down; chain node gated on verdict.
- **Residual limitation:** platform startup hook not editable; recorded per V31 Phase 6C.

## Incident 3 — Database self-healing occurring before repository verification

- **Status:** FIXED-IN-CODE (verified 2026-11-09; Phase 12 acceptance pending).
- **Root cause:** original boot order ran DB self-heal before establishing repository authority.
- **Permanent correction:** `src/instrumentation.ts` runs `guardGitDrift()` first; `driftBlocked` stands down DB self-heal and poisons chain readiness (`__MTQ_CHAIN_ERROR__`). The backstop runner re-runs the full bootstrap gate before any plane action.
- **Preventive invariant:** no DB restore without a VERIFIED drift verdict. **Regression test:** Phase 11 item 2/3 — OPEN (test harness pending). **Live evidence:** source order verified; backstop contract enforces bootstrap exit 0 before planes. **Residual limitation:** none known in-repo.

## Incident 4 — Chain database regression h17,661 → h4,028

- **Status:** OPEN (historical incident; permanent correction partially in place).
- **Root cause:** an older snapshot was restored over a newer live chain (pre-forward-only era).
- **Impact:** ~13.6k blocks of chain history temporarily lost (recovered via git dump lineage).
- **Previous fix:** forward-only recovery rules + dual lag metrics (`unbackedAhead`, `recoveryDeficit`) in backstop plane 2 and the heartbeat writer; `db-selfheal.ts` restores only when the dump is strictly newer.
- **Why it could recur:** the *decision logic* refuses older-over-newer, but no dedicated regression test reproduces the exact incident (V31 Phase 10 item 3).
- **Permanent correction:** forward-only invariant retained; RC-6 (this batch) additionally makes snapshot-parse failures degrade the db plane instead of passing as OK.
- **Preventive invariant:** recoveryDeficit > 0 must classify RECOVERY_REQUIRED/ALERT, never OK; parse-failed tips must never read as healthy.
- **Regression test:** scripted probe added with RC-6 (this batch); full Phase 10 battery — OPEN.
- **Live evidence:** current chain h18,936 > committed h18,362 (forward-only holding, 2026-11-09).
- **Residual limitation:** none known in-repo.

## Incident 5 — Local SQLite and production standalone databases diverging

- **Status:** FIXED-IN-CODE for path identity (canonicalRoot); cloud-side reconciliation UNVERIFIED.
- **Root cause:** standalone server cwd `.next/standalone` resolved DB paths inside the build output; plus local-vs-cloud operational divergence unmeasured.
- **Permanent correction:** `canonicalRoot()` in `src/lib/db-ops.ts`, `src/lib/chain/store.ts`, `src/lib/chain/genesis.ts` (verified present 2026-11-09); explicit `.next/standalone` unwinding.
- **Preventive invariant:** one canonical DB location per database across dev/prod/watchdog/scheduler/self-heal.
- **Regression test:** Phase 12 Test C (production lifecycle) — OPEN. **Live evidence:** source verified; dev stack currently authoritative.
- **Residual limitation / OPEN:** cloud operational databases (Turso primary, Neon mirror) are documented in code (`src/lib/db.ts`, `src/lib/neon-client.ts`, `src/lib/neon-schema.ts`, Inngest hourly sync) but are NOT configured in this sandbox (`.env` carries only `DATABASE_URL=file:...custom.db`). Cloud health is UNVERIFIED until credentials/config are present — V31 Phase 2/3/4 work, honestly reported as UNVERIFIED, not healthy.

## Incident 6 — Turbopack standalone builds writing to a bundled database copy

- **Status:** FIXED-IN-CODE (verified 2026-11-09: `canonicalRoot()` unwinds `.next/standalone`).
- **Root cause:** cwd-based path resolution inside build output.
- **Preventive invariant:** DB path must resolve outside `.next/`; V31 Phase 5 asks for a startup assertion refusing production boot if the DB resolves inside build output — OPEN (planned).
- **Regression test:** Phase 12 Test C — OPEN. **Live evidence:** source verified.

## Incident 7 — Write-behind snapshots not reaching the remote durable layer

- **Status:** VERIFIED-FIXED (live evidence 2026-11-09).
- **Root cause:** backstop commit rule excluded `backups/db-snapshots`; the platform's cron wrapper auto-commits the dump without pushing; bootstrap exit 13 blocked subsequent fires.
- **Permanent correction (v30, commit `94b08a9`):** backstop commit rule now includes `backups/db-snapshots` (allowlist + add sites) so the hourly backstop pushes the snapshot forward itself.
- **Live evidence:** dump tip h18,936 published to origin in `13e744e` (secret-scan PASS) after wrapper auto-commit `0347231` stranded ahead; the 00:17:48Z-era exit-13 loop closed.
- **Preventive invariant:** every durable write must be followed by a push attempt in the same execution. **Regression test:** the scheduler fires themselves (ongoing). **Residual limitation:** monitor-only fires still cannot push (observe-only by contract); RC-3 (this batch) ensures they alert instead of silently blocking.

## Incident 8 — Bootstrap failures caused by local commits not yet pushed

- **Status:** FIXED-TODAY (two-layer fix).
- **Root cause:** (a) backstop commit rule excluded the dump (fixed in v30 `94b08a9`); (b) the monitor hard-exits (exit 9, no classification, no alert) whenever bootstrap fails — even when the failure is merely "local ahead, unpushed" (exit 13), during which the on-disk heartbeat is still the freshest valid evidence.
- **Permanent correction (this batch, RC-3):** monitor distinguishes degraded-bootstrap (exit 13/14/15 — tree provably synced-or-ahead; guard already passed) from authenticity failure (exit 11/12/1 — trust nothing). Degraded mode still reads and classifies the heartbeat, writes alerts and state to /tmp only, never commits, and reports an explicit degraded classification. The relay line keeps its format and carries the bootstrap state.
- **Preventive invariant:** the observer must never lose observability merely because the publisher is unsynced.
- **Regression test:** the 00:56:31Z BOOTSTRAP-FAILED entry reproduced the failure; next monitor fire under the fixed script is the live regression (pending). **Residual limitation:** durable alert persistence during degraded windows is impossible by definition (git unsynced); the relay reply is the alert channel, per contract.

## Incident 9 — Plane 5 job rejection from model concurrency limitations

- **Status:** PARTIALLY-MITIGATED (platform limitation, documented).
- **Root cause:** gateway-side global model concurrency budget; rejected dispatches get no queue and no retry.
- **Impact:** lost coverage windows (e.g., 00:17:48Z fire rejected 2026-11-09).
- **Previous fix:** v30 deterministic one-script execution (minimal model footprint); hourly cadence bounds loss to ≤1h per rejection.
- **Permanent correction (in-platform):** rejection evidence is durably recorded — scheduler-observed state (runCount/stage/info) is embedded in every ledger entry, so rejected dispatches are distinguishable from never-dispatched; monitor age threshold (9,000s) converts lost backstop fires into alerts.
- **Live evidence:** 00:58:43Z monitor ledger entry embeds the rejected 00:17:48Z dispatch (runCount 2, stage failed, "model concurrency limit exceeded").
- **Preventive invariant:** every fire outcome, including rejection, must be observable in durable evidence. **Residual limitation:** rejection itself is outside repository control — recorded per V31 Directive 0.

## Incident 10 — Scheduler execution status not matching actual script completion

- **Root cause:** scheduler `stage` reflects the agent turn, not the deterministic script's own verdict.
- **Impact:** "succeeded" can mask a BLOCKED/bootstrap-failed script run (observed: stage `started` while script had crashed).
- **Permanent correction:** the execution ledger is the ground truth (STARTED + FINAL with outcome classification and scheduler-observed state); RC-1 (this batch) makes the ledger git-tracked so this ground truth survives re-images.
- **Preventive invariant:** acceptance evidence must come from the ledger, never from scheduler stage alone. **Live evidence:** 00:56:31Z BOOTSTRAP-FAILED ledger entry vs scheduler stage "started". **Residual limitation:** none in-repo (evidence now durable with RC-1).

## Incident 11 — Execution-ledger entries not being tracked by Git

- **Status:** FIXED-TODAY (RC-1).
- **Root cause:** `.gitignore` line 89 (`/backups/plane5/*`) whitelists only `heartbeat.json`, `monitor-state.json`, `alerts.log` — the ledger was never tracked.
- **Impact:** every EXECUTED-* record, including rejected-dispatch evidence, lived only on local disk and died at each re-image. Verified 2026-11-09: `git ls-tree HEAD backups/plane5/` shows exactly three files; monitor commits carried only `monitor-state.json`.
- **Permanent correction:** whitelist `backups/plane5/execution-ledger.jsonl` (+ its append-only archive from RC-5) in `.gitignore`; add the file; verify with `git check-ignore -v` (must NOT match), `git ls-tree`, and remote-tree confirmation after push.
- **Preventive invariant:** audit evidence must live in the durable layer, not on ephemeral disk. **Regression test:** post-push `git ls-tree origin/main` — pending this batch's landing. **Residual limitation:** none.

## Incident 12 — Non-JSON bootstrap output crashing ledger recording

- **Status:** VERIFIED-FIXED (live evidence 2026-11-09, v30 hotfix `e0daa15`).
- **Root cause:** `ledger()`'s python heredoc called `json.loads()` on any extra fragment starting with `{`/`[` — a `[bootstrap …] FAIL …` log tail crashed the append, losing the durable BOOTSTRAP-FAILED evidence; the BLOCKED echo line also never reached the relay (observed: two consecutive silent exit-9 runs at the 23:55:45Z fire).
- **Permanent correction:** fragments that fail JSON parsing are kept verbatim; BLOCKED lines are emitted to both stdout and stderr.
- **Live evidence:** at the 00:55:45Z fire the BLOCKED line surfaced verbatim and the ledger recorded BOOTSTRAP-FAILED (`00:56:31.053Z` entry), then the fire completed after the guard-directed push.
- **Preventive invariant:** evidence recording must never crash on evidence content. **Regression test:** the 00:56Z fire (reproduced + prevented, live). **Residual limitation:** none.

## Incident 13 — Missing scheduler identity and incorrect `job=manual` reporting

- **Status:** FIXED-TODAY (RC-2).
- **Root cause:** cron payloads are immutable after creation and do not pass `--job-id`; the script defaults to `manual`. V31 Phase 8 forbids job recreation, so the ID cannot be injected via payload.
- **Permanent correction:** topology-derived defaults inside the runner — monitor mode defaults to job 516198, backstop to 516197 (the only plane-5 jobs in the verified scheduler registry, checked 2026-11-09 08:55 +08), overridable by `--job-id`/`PLANE5_JOB_ID` for manual runs; ledger and output lines carry the resolved ID. Registry must be re-verified whenever jobs change (documented in the script header).
- **Preventive invariant:** every ledger entry must identify its dispatching job. **Regression test:** next monitor fire (01:55:45Z) must record `jobId=516198` — pending. **Residual limitation:** attribution is topology-derived (registry-verified at landing time), not cryptographically bound — honest disclosure.

## Incident 14 — Monitor accepting a fresh heartbeat without adequately checking scheduler health

- **Status:** PARTIALLY-MITIGATED; hardening TODAY.
- **Root cause:** monitor classification considered only heartbeat age/result; scheduler rejections were visible in the ledger but did not influence the classification.
- **Permanent correction (this batch):** RC-3 — any degraded-bootstrap state produces an alerting classification; the ledger already embeds scheduler-observed state on every entry. Full scheduler-health classification (rejected-fire counting, next-run sanity) remains OPEN for V31 Phase 8 extension.
- **Preventive invariant:** a fresh heartbeat must never conceal a rejected execution — the monitor's relay already reports the observed scheduler state (Step 1), and the ledger preserves it. **Live evidence:** 00:58:43Z entry (fresh-enough heartbeat AND embedded rejection). **Residual limitation:** classification vocabulary for scheduler health pending Phase 8.

## Incident 15 — Heartbeat reporting OK without watchdog v4 verification

- **Status:** FIXED-TODAY (RC-4).
- **Root cause:** verified in code 2026-11-09 — both the tracked writer (`scripts/plane5-backstop-heartbeat.ts` line 54) and the inline fallback (`scripts/plane5-run.sh`) compute `result="OK"` from git/db/server/route only; watchdog presence is measured by the backstop (plane 3) but is not part of the verdict.
- **Permanent correction:** watchdog presence (process check) is measured in the writer and required for `OK` (missing watchdog → BLOCKED-level verdict with explicit reason); inline fallback wired identically.
- **Preventive invariant:** overall OK requires every operational plane INCLUDING the watchdog. **Regression test:** next backstop fire's heartbeat must carry the watchdog field — pending. **Residual limitation:** process-name check (`dev-watchdog`) is a heuristic; a stronger liveness signal (pidfile/heartbeat file) is future work.

## Incident 16 — Database snapshot parsing failures being interpreted as healthy data

- **Status:** FIXED-TODAY (RC-6).
- **Root cause:** verified in code 2026-11-09 — `tip()` returns -1 on parse failure; `recoveryDeficit = max(0, -1 - h) = 0`; `floors_ok` does not inspect `committedTip`/`diskTip` or `unbackedAhead`, so db stays "OK" while the committed dump is unparseable and `unbackedAhead` silently inflates to h+1. The writer has the same gap (and its non-null `match()!` throws → falls back to the same buggy path).
- **Permanent correction:** parse failure (tip < 0) or implausible unbackedAhead (e.g., > 3h of production growth bound) classifies the db plane RECOVERY_REQUIRED/ALERT — never OK; the writer's parse is made safe and consistent.
- **Preventive invariant:** an unreadable recovery source must degrade health, never pass as healthy. **Regression test:** scripted probe (parse-failure input → non-OK verdict) with this batch; live fire confirmation pending. **Residual limitation:** none.

## Incident 17 — Database path resolution differing between development and production

- **Status:** FIXED-IN-CODE (canonicalRoot, verified 2026-11-09).
- **Root cause:** cwd-relative resolution.
- **Preventive invariant:** `MTQ_SIGMA_ROOT`/module-root authority, `.next/standalone` unwinding. **Regression test:** Phase 12 Test C — OPEN. **Residual limitation:** production-build startup assertion (Phase 5) not yet added — planned with Phase 12.

## Incident 18 — Other recurrences discovered during the audit

1. **Monitor BLOCKED-without-observation** (discovered 2026-11-09, fires 23:55Z/00:55Z): monitor exited 9 with no classification whenever bootstrap failed — folded into Incident 8 / RC-3.
2. **BLOCKED line never reaching the relay on non-zero exit** (discovered 23:55Z fire): fixed in v30 hotfix `e0daa15` (dual-stream emit) — VERIFIED-FIXED (00:56Z fire relayed the BLOCKED line).
3. **Ledger unbounded growth** (V31 Phase 9 requirement): RC-5 — append-only rotation to a tracked archive; never deletes audit history.
4. **Wrapper auto-commits without push** (platform cron agent-loop): incidents 7/8's trigger; in-platform mitigation is the backstop push rule + RC-3 degraded monitoring. Platform-side push behavior is outside repository control — recorded as residual limitation.

---

## Fix batch landed 2026-11-09 (this V31 execution)

| ID | Fix | Files | Regression evidence |
|---|---|---|---|
| RC-1 | Ledger git-tracked | `.gitignore`, ledger file added | `git ls-tree origin/main` after push (pending) |
| RC-2 | Job attribution | `scripts/plane5-run.sh` | 01:55:45Z monitor fire records `jobId=516198` (pending) |
| RC-3 | Degraded-bootstrap observation | `scripts/plane5-run.sh` | Next exit-13 window observes + alerts (pending) |
| RC-4 | Watchdog required for OK | `scripts/plane5-run.sh`, `scripts/plane5-backstop-heartbeat.ts` | Next backstop heartbeat carries watchdog (pending) |
| RC-5 | Ledger rotation (append-only archive) | `scripts/plane5-run.sh` | Rotation probe (pending) |
| RC-6 | Parse-failure degrades db plane | same as RC-4 | Scripted probe (pending) |

Commit SHAs for this batch: recorded in the landing commit message and `worklog.md` (filled at landing time — evidence, not promise).

## Platform-controlled residual limitations (honest disclosure)

1. Gateway model-concurrency rejections (no queue/retry) — Incidents 9.
2. No editable platform startup hook (stale image cannot self-protect) — Incidents 1/2.
3. Cron payload immutability (job ID cannot be baked into payloads) — Incident 13.
4. Cron wrapper auto-commit behavior — Incident 18.4.
5. Cloud operational databases (Turso/Neon) unconfigured in this sandbox — Phase 2/3/4 verification blocked pending credentials; reported UNVERIFIED, never healthy.
