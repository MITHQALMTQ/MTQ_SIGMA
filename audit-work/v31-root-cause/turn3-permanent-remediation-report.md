# V31 TURN 3 — Permanent Platform Startup Repair, Database Recovery Hardening & End-to-End Validation

**Execution window:** 2026-11-09T15:48Z → 16:35Z (this session; concurrent platform activity continued throughout — see §7)
**Repository:** MITHQALMTQ/MTQ_SIGMA (testnet shadow)
**Baseline at start:** origin/main `f6b2c31`; live DB regressed to h3997 (recoveryDeficit 17604 vs published h21601); server HTTP 500 (MODULE_UNPARSABLE); watchdog v4 (pre-v5 script); heartbeat 15:19:13Z result=ALERT
**State at close:** origin/main `842a2de`; live DB HEALTHY h21871 (deficit 0, unbacked 208 vs committed h21663); server GET / 200; watchdog v5 singleton via the platform entrypoint; 138-test regression battery green; heartbeat dbState=HEALTHY result=OK (16:18:49Z, written by the 16:17:48Z scheduler fire on the new code)
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED

**Addendum — second session (2026-11-09T20:16Z → 20:5xZ; operator-requested GitHub push + cloud verification):** the sixth (~17:00Z, detected by the 17:17:48Z fire) and seventh (20:16:04Z) Incident-22 recurrences both produced the regressed-DB signature; the seventh was detected and restored **UNATTENDED** by the hardened chain (watchdog v5 up 20:18:48Z → FOREIGN_WRITE_DETECTED 20:18:49.613Z → DECISION_AUTHORIZED 20:18:50.257Z "published h21663 over live h3966" → staged generation `gen-20261109T201850258Z-h21663-ui23` VALIDATED + ACTIVATED 20:24:04.513Z → `next dev` → health HTTP 200, engine+db healthy) — **re-image cycle 2/3 verified**. §9 cloud track re-verified read-only with operator-provided credentials (see §9 below — `CLOUD_DATABASE_UNVERIFIED` upgraded to verified-frozen). GitHub fully synced through `1ad1f18`. The 20:16Z stale self-heal proves the base image is STILL stale — criterion 3 remains platform-blocked.

**Root cause (Incident 22 — ACCEPTED, not reinvestigated):** platform sandbox re-provisioning restores a stale Task-46-era image (old source/deps/Nov 6 dumps); the platform boots `next dev` directly on it with no pre-boot hook; the image's pre-T2A self-heal restores the stale dumps over the live database BEFORE any git realignment; the mid-run realignment then flips code under the running server and the dependency mismatch (swc 16.1.3 vs next 16.4.5, missing vendored meriyah) kills it; the next sandbox init repeats the sequence. Every resolved false lead stays closed (TURN 2A/2B registers).

**The fifth recurrence — captured live this turn (§1 evidence, not a new investigation):** the 14:50Z re-image boot log (dev.log lines 1–54) shows the full causal chain verbatim: stale `next dev` self-heal "[selfheal] chain.db RESTORED from cloud dump (live missing → h3941)" at 14:51 → server up on stale code (h3941, GET / 200) → platform realigns git (reflog `reset: moving to cf0cdc81`) → next.config.ts change detected → restart crashes (`Cannot find module '../../../meriyah/dist/meriyah2.js'`, `Mismatching @next/swc version, detected: 16.1.3 while Next.js is on 16.4.5`) → server dead until the 15:17:48Z backstop fire launched watchdog v4 → the NEW generation-store self-heal restored h21601 as one validated generation at 15:23:10.860Z (recovery journal: PREPARE → VALIDATED → ACTIVATING → ACTIVATED; casualty archive kept) → `next dev` v16.4.5 up 15:23.

---

## Root-cause remediation records (14 fields each)

### R-1 — Platform base-image refresh + mandatory pre-boot gate

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-1 (§2) — stale-image direct application start |
| 2 | Title | Platform entrypoint gate chain + runtime dependency preflight |
| 3 | Causal-chain link | "platform starts `next dev` directly from the stale image with no pre-boot hook" — the enabler of every recurrence |
| 4 | Remediation (in-repo) | (a) `package.json` `dev` now routes `bun run dev` → `scripts/dev-entrypoint.sh` → watchdog v5 (setsid-detached, singleton flock) → git-drift guard → source-integrity heal → **runtime dependency preflight** (`scripts/runtime-preflight.ts`: next version ↔ manifest, @next/swc ABI match, vendored-meriyah presence, next CLI) → one `bun install --frozen-lockfile` repair → still-mismatched = DO NOT START (honest blocked status) → db-selfheal (generation store) → `next dev` → **readiness verification** (port guard: HTTP 200 = healthy; a non-200 responder is reclaimed through the full heal chain — the 500-served server passively supervised forever is closed). (b) Bootstrap §3.11 runs the preflight at every fire (exit 16 → wrapper repairs once, retries once). (c) Bootstrap materializes the preflight + verifier tooling from origin/main. |
| 5 | Files changed | `package.json`, `scripts/dev-entrypoint.sh` (new), `dev-watchdog.sh` (v5: singleton lock + port-guard hardening + preflight wiring + fail-closed self-heal exit contract), `scripts/runtime-preflight.ts` (meriyah path fix), `scripts/plane5-bootstrap.sh` (§3.11 + materialization) |
| 6 | **Status** | **FIXED IN CODE — PLATFORM VALIDATION PENDING** (in-repo gate: FIXED AND VERIFIED live 16:03→16:08; platform base-image half: PLATFORM BLOCKED) |
| 7 | Live evidence | Full chain boot executed this session: entrypoint (pid 6511) → watchdog v5 (6515) → guard/heal/preflight/selfheal → next-server 16.4.5 (7234) → GET / 200, /api/healthy all-green; the 14:50Z recurrence itself was recovered by the generation path at 15:23Z (ledger 15:18:04 FINAL, `remediated=yes`) |
| 8 | Regression evidence | 78/78 harness (template now carries preflight + package.json + node_modules symlink; §3.11 exercised in-sandbox); live defect found+fixed during the turn: preflight probed `node_modules/meriyah/dist/meriyah2.js` — a path NOTHING requires (the real require resolves to `@sentry/server-utils/build/cjs/vendored/meriyah/dist/meriyah2.js`) and false-positive-BLOCKED a consistent runtime indefinitely |
| 9 | Residual risk | The STALE image's own `package.json` still says raw `next dev` — until the image is refreshed, the first boot after each re-image runs old code for up to the ≤1h backstop window (or until the stale server crashes on the dependency mismatch, which then hands the port to the watchdog chain) |
| 10 | Platform action required | **Refresh the sandbox base image to current origin/main** (or wire the watchdog launch into the platform's own provisioning) — the platform-side control this session cannot reach |
| 11 | Verification requirement | A re-image cycle that boots through `scripts/dev-entrypoint.sh` from first start (observable: dev.log begins with the v5 watchdog banner, not a raw stale self-heal restore) |
| 12 | Commit refs | `a0475c0` (entrypoint+singleton+preflight fix), `b322840` (port guard), `842a2de` chain |
| 13 | Test refs | harness P1/P2/R1 (78/78); live boot 16:03–16:08 |
| 14 | Notes | The entrypoint also survives its own death: it exits when the watchdog dies, so any platform supervisor restarts the whole gate chain |

### R-2 — Database restoration authorization (central, fail-closed)

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-2 (§3) — restore decisions re-derived at every call site |
| 2 | Title | Central recovery authorization + explicit probe outcomes |
| 3 | Causal-chain link | the unsafe `liveChainH = chainProbe.ok ? height : 0` pattern + F-1 (refused-note not gating) + F-2 (missing manifest bypass) |
| 4 | Remediation | `src/lib/boot/db-probe.ts` — EIGHT explicit probe outcomes (DATABASE_HEALTHY/BUSY/UNREADABLE/MISSING/IDENTITY_MISMATCH/INTEGRITY_FAILURE/SCHEMA_UNSUPPORTED/AUTHORITY_UNVERIFIED); only HEALTHY carries a usable height. `src/lib/boot/recovery-authorization.ts` — ONE shared decision: sentinel → repository identity → git state (necessary, never sufficient) → live probes (explicit; unreadable/busy/corrupt/identity-mismatch BLOCK automatic restoration) → manifest gate (missing/invalid manifest = published source REFUSED — F-2 closed) → staged structural validation (never behind published) → source-of-record (staged-at/ahead wins) → forward-only direction → custom material-loss guards BOTH directions → genesis identity. Refusal is terminal (§3.3): `db-ops.selfHealDatabases()` consumes the decision verbatim; `node.ts` THROWS on refusal/failed heal (the silent re-seed path is unreachable); `db-selfheal.ts` exits 2 on refusal (watchdog does NOT start next dev). |
| 5 | Files changed | `src/lib/boot/db-probe.ts`, `src/lib/boot/recovery-authorization.ts` (concurrent-executor implementation, audited + chain-side SCHEMA_UNSUPPORTED→LIVE_DB_SCHEMA_UNVERIFIED taxonomy fix this turn), `src/lib/db-ops.ts`, `src/lib/chain/node.ts`, `scripts/db-selfheal.ts` |
| 6 | **Status** | **FIXED AND VERIFIED** |
| 7 | Live evidence | The 15:23:10Z sanctioned restoration ran THROUGH the central decision (ledger 15:18:04: gitState SAFE_SNAPSHOT_AHEAD, db ALERT h3997, remediated=yes → generation restore h21601); every subsequent boot's self-heal runs the decision (16:0x, 16:2x no-ops: "at/ahead of every verified recovery source") |
| 8 | Regression evidence | 21 bun-test units: SENTINEL/REMOTE/GIT-STATE refusals, all five live-probe refusal classes (incl. zero-height closure), MANIFEST_MISSING/INVALID (hash/completeness/genesis), staged-behind-published refusal, NO_VERIFIED_RECOVERY_SOURCE, forward-only authorization, controlled recovery, custom material-loss both directions, source-of-record selection, refusal terminality |
| 9 | Residual risk | The DATABASE_AUTHORITY_UNVERIFIED outcome is declared but never emitted by the current probes (reserved taxonomy slot); a first-boot-fresh-environment genesis seeding remains by design (nothing to lose, nothing to recover) |
| 10 | Platform action required | none |
| 11 | Verification requirement | none pending |
| 12 | Commit refs | `e8da08a` (concurrent executor), `842a2de` (taxonomy fix) |
| 13 | Test refs | `tests/boot/recovery-authorization.test.ts` (21) |
| 14 | Notes | The decision record (every check + verdict) is embedded in every HealReport and — as of `842a2de` — journalled durably (R-6) |

### R-2B — Atomic / interruption-safe staged-generation restoration

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-2B (§4) — dump-by-dump restore into the operational path |
| 2 | Title | Staged generations with a single authoritative pointer |
| 3 | Causal-chain link | interruption mid-import → torn DB at the operational path; chain/custom restored independently → mixed generations |
| 4 | Remediation | `src/lib/boot/generation-store.ts`: PREPARE (isolated import into `db/generations/<id>/`, operational paths untouched) → VALIDATE (integrity, genesis, chain-id, height contiguity, parent-hash continuity, exact counts, cross-DB consistency; failure discards the dir) → ACTIVATE (casualty archive of prior files → copy BOTH files → fsync → atomic tmp+rename pointer write = THE commit point → journal ACTIVATED). Crash-safety from the pointer + durable journal + `reconcileActivation()` running before ANY database consumer in every boot path (interrupted ACTIVATING → complete from the immutable dir, or roll back to the prior generation — never mixed/torn). `detectForeignWrite()` records the Incident-22 signature. Honest atomicity statement in the module header (crash-safety ≠ two-file rename atomicity). |
| 5 | Files changed | `src/lib/boot/generation-store.ts`, `src/lib/db-ops.ts` (selfHealDatabases rewritten around it), `.gitignore` (generation binaries untracked; manifests/journal/pointer tracked) |
| 6 | **Status** | **FIXED AND VERIFIED** |
| 7 | Live evidence | First production activation this session: generation `gen-20261109T151814356Z-h0-q573` restored h21601/18077 rows at 15:23:10.860Z with casualty archive `casualty-20261109152310839/` (the regressed h3997 pair quarantined); pointer + journal + manifest tracked in git |
| 8 | Regression evidence | 12 bun-test units (journal/pointer primitives, tip-refusal without dir creation, true-tip generation ids, validate-pass + manifest, contiguity-failure discards, activation archives casualty + atomic pointer, interrupted-ACTIVATING complete, unusable-dir rollback, foreign-write detection). **Three live defects found and fixed this turn:** (1) the chain_id query's parenthesization parsed under bun but NOT under swc/Turbopack — MODULE_UNPARSABLE took the entire server down (GET / 500) — rewritten in the swc-safe form; (2) `newGenerationId(0)` hard-coded the tip (ids lied "h0"); (3) `PrepareInput["source"]` type error (bun build does not type-check; tsc caught it). Also blocked: platform sweeps committing MID-IMPORT binary states (2.9MB/8.5MB of a growing 47MB file) — torn-state-in-history. |
| 9 | Residual risk | The generation id of the 15:23 activation predates the true-tip fix (cosmetic, documented); prepare-time for a 40MB dump is minutes (RECOVERY_IN_PROGRESS covers the window in the taxonomy) |
| 10 | Platform action required | none |
| 11 | Verification requirement | none pending |
| 12 | Commit refs | `e8da08a`, `b322840` (all three defect fixes + hygiene) |
| 13 | Test refs | `tests/boot/generation-store.test.ts` (12) |
| 14 | Notes | The swc/bun parser divergence is itself a recorded process defect: the static gate for recovery-critical code must include tsc AND a live-route check, not `bun build` alone |

### R-3 — Snapshot publication & write-behind

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-3 (§5) |
| 2 | Title | Validated atomic publication + staged write-behind |
| 3 | Causal-chain link | tracked dumps perpetually dirty → uncontrolled snapshot drift; write-behind regressing the cloud copy |
| 4 | Remediation | (T2A, re-verified this turn against the new generation code) staging write-behind refreshes UNTRACKED `.staging/` dumps only (60s loop; regression-signature suppression — a dump is NEVER regenerated when the live DB is behind it); the tracked `latest-*.sql` + `manifest.json` are written ONLY by the validated atomic publisher (structural validation → sha256 manifest → tmp+rename → commit of exactly the three paths → push); the recovery authorization consumes published+staged with the manifest gate; the backstop's plane 2b publishes every fire |
| 5 | Files changed | (T2A set) + verified consumers: `src/lib/db-ops.ts`, `src/lib/boot/recovery-authorization.ts`, `scripts/plane5-run.sh` plane 2b |
| 6 | **Status** | **FIXED AND VERIFIED** |
| 7 | Live evidence | manifest v4 (h21601, 14:23Z) → v5 (h21663, 16:2xZ) published by the 16:17:48Z fire through the full new pipeline (commit `6df5f07`); recovery-authorization validated v4 as the 15:23 restoration source |
| 8 | Regression evidence | harness publication scenarios (S-series + R1 repair) 78/78; authorization manifest-gate units (7) |
| 9 | Residual risk | unbackedAhead accrues between publications (bounded: 208 at close, threshold 2000; plane-2b publishes each hourly fire) |
| 10 | Platform action required | none |
| 11 | Verification requirement | none pending |
| 12 | Commit refs | T2A lineage; this turn's consumers in `e8da08a`/`842a2de` |
| 13 | Test refs | harness 78/78; `tests/boot/recovery-authorization.test.ts` |
| 14 | Notes | — |

### R-4 — Plane-5 verifies the ACTUAL database; expanded alert taxonomy

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-4 (§6) — F-3: monitor never probed the DB |
| 2 | Title | 14-state taxonomy, shared classifier, monitor probes the real DB |
| 3 | Causal-chain link | the h20333→h3941 regression hid behind a fresh OK heartbeat for ~3h |
| 4 | Remediation | `src/lib/boot/db-plane-state.ts` — the SHARED pure classifier: HEALTHY · STALE_IMAGE · DATABASE_UNREADABLE · DATABASE_IDENTITY_MISMATCH · DATABASE_REGRESSION · RECOVERY_IN_PROGRESS · RECOVERY_FAILED · DATABASE_RECOVERED (DB-side; infra-side states assembled by plane5-run.sh: BOOTSTRAP_BLOCKED · SERVER_UNAVAILABLE · WATCHDOG_UNAVAILABLE · ROUTE_FAILURE · LOCK_CONTENTION · SCHEDULER_REJECTED) with precedence (failed recovery > in-progress > probe-failure > identity > stale-image/regression > recovered > healthy) and a 30-min recovered-decay. `scripts/plane5-db-verify.ts` — read-only verifier (probes, pointer, journal, committed layer, dual lag metrics) consumed by BOTH plane5 modes; fail-closed when the verifier itself is unavailable. Monitor: probes the actual DB + server/watchdog/route (READ-ONLY — observes and alerts, never remediates); no heartbeat self-report can mask a regression. Backstop plane 2: replaced the collapsed OK/RECOVERY_REQUIRED/ALERT probe — which also CRASHED outright on a missing database file — with the verifier. Heartbeat writer: carries dbState/dbSeverity/dbDetail in every heartbeat; no longer crashes on missing DB (records DATABASE_MISSING). STALE_IMAGE signature = live tip below the active-generation pointer AND the serving restore newer than the pointer's activation; `boot_mode=self-healed` alone is evidence, never a verdict (it survives inside sanctioned restores — regression-tested). |
| 5 | Files changed | `src/lib/boot/db-plane-state.ts` (new), `scripts/plane5-db-verify.ts` (new), `scripts/plane5-run.sh` (monitor + backstop + fallback heartbeat + OVERLAP_SKIP state), `scripts/plane5-backstop-heartbeat.ts` (rewritten measurement section), `scripts/plane5-bootstrap.sh` (verifier materialization) |
| 6 | **Status** | **FIXED AND VERIFIED** |
| 7 | Live evidence | (a) the 16:17:48Z scheduler fire ran the new code end-to-end: heartbeat 16:18:49 result=OK, dbState=HEALTHY, dbDetail "live h21712 · probes healthy", planes all green, snapshotPublished v5, pushed (`6df5f07`); (b) live monitor run 16:23: PLANE_5_OK `db=HEALTHY infra=none server=200 watchdog=1 route=403` — the monitor independently verifies every plane; (c) the 15:19-era regressed heartbeat (result=ALERT, db=ALERT, tip=h3997) now stands as the negative-case record |
| 8 | Regression evidence | 18 classifier units (all 8 DB states, decay, precedence, stale-image vs sanctioned-marker discrimination, custom tolerance) + harness updated to the taxonomy (78/78) |
| 9 | Residual risk | monitor fires whose tree lacks the verifier (pre-TURN-3 origin) read DATABASE_UNREADABLE fail-closed — honest by design |
| 10 | Platform action required | none |
| 11 | Verification requirement | none pending |
| 12 | Commit refs | `50193cc` (R-4 batch), `27f2a0a` |
| 13 | Test refs | `tests/boot/db-plane-state.test.ts` (18); harness P1 db=HEALTHY |
| 14 | Notes | the 16:17:48Z fire itself died in the post-heartbeat commit phase (platform turn teardown reaps mid-run bash — known class, ledger shows STARTED without FINAL; all planes were green when it died and the heartbeat/publish evidence survived) |

### R-5 — Locking & concurrent recovery (the recorded OVERLAP_SKIPs)

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-5 (§7) |
| 2 | Title | Watchdog singleton + holder-identity recording + the OVERLAP_SKIP investigation |
| 3 | Causal-chain link | 13:17:48Z and 14:17:48Z backstop OVERLAP_SKIPs (exit 43) with an UNIDENTIFIED lock holder ≥62 min |
| 4 | Remediation | (a) **Investigation conclusion (evidence-based):** the holder was the concurrent agent session executing TURN 3 preparation work — during the held windows the snapshot publisher advanced manifest v3 (`d67d927`, h20966) and v4 (`cf0cdc8`, h21601, 14:23:12Z), and the TURN 3 code batch landed as `e8da08a` (15:19:54Z); origin-tip advancement + heartbeat refreshes external to the fires corroborate continuous sanctioned activity. PID/cmdline identification was impossible post-mortem because no holder evidence existed — closed structurally now. (b) **Holder identity is recorded at acquisition**: every backstop acquiring the flock writes `<lock>.holder` (timestamp, pid, cmdline); OVERLAP_SKIP relays `lastHolder=…` — future skips name who held the lock and since when. lsof-based identification was evaluated and REJECTED (the investigating process self-lists via its inherited fd 9 on the lock file; dead pids spray stderr — reproduced live). (c) **Watchdog singleton lock** (flock on `/tmp/mtq-watchdog.lock`): duplicate supervision trees (double write-behind, EADDRINUSE ping-pong) are structurally impossible. (d) The lock is NEVER removed because it appears old — only the holder's own exit releases it. |
| 5 | Files changed | `scripts/plane5-run.sh` (companion holder file), `dev-watchdog.sh` (singleton) |
| 6 | **Status** | **FIXED AND VERIFIED** (investigation: closed with structural prevention; no live lock-holder telemetry for the historical events — honestly UNVERIFIABLE beyond the commit-window correlation) |
| 7 | Live evidence | the 16:17:48Z fire acquired the lock cleanly (ledger "backstop lock acquired"); concurrent platform activity all session never collided with the singleton (one watchdog tree throughout: 6515) |
| 8 | Regression evidence | harness S19 (OVERLAP_SKIP stands down, ledger untouched) 78/78 on the new code |
| 9 | Residual risk | a holder that dies without releasing... impossible (flock auto-releases on process death); a STALE `.holder` companion reports the LAST holder (by design — evidence, not lock state) |
| 10 | Platform action required | none |
| 11 | Verification requirement | the next natural OVERLAP_SKIP relays `lastHolder=` — then verified end-to-end |
| 12 | Commit refs | `a0475c0` (singleton), `27f2a0a` (companion) |
| 13 | Test refs | harness S19 |
| 14 | Notes | — |

### R-6 — Durable execution evidence

| # | Field | Record |
|---|---|---|
| 1 | Root-cause ID | R-6 (§8) |
| 2 | Title | Every recovery decision and phase leaves a durable record |
| 3 | Causal-chain link | remediations executed with no durable why (post-commit dirty appends wiped at re-provisioning — TURN 2B archaeology) |
| 4 | Remediation | `db/generations/recovery-journal.jsonl` (tracked): PREPARE/PREPARE_FAILED/VALIDATED/VALIDATION_FAILED/ACTIVATING/ACTIVATED/RECONCILED_*/ROLLED_BACK/DISCARDED/FOREIGN_WRITE_DETECTED + **DECISION_AUTHORIZED / DECISION_REFUSED** (new this turn: the central decision's why — authorization AND every fail-closed refusal; the healthy no-op is deliberately NOT journalled to avoid per-boot noise). `db/active-generation.json` (tracked) — the pointer. Per-generation `generation.json` manifests (tracked). Casualty archives (disk, pruned to 3). Execution ledger (tracked) with dbState/dbSeverity/dbDetail per fire. `<lock>.holder` companions. |
| 5 | Files changed | `src/lib/db-ops.ts` (decision journaling), `src/lib/boot/generation-store.ts` (phase union), `.gitignore` (evidence-file tracking) |
| 6 | **Status** | **FIXED AND VERIFIED** |
| 7 | Live evidence | journal: 4 entries for the 15:23 activation (PREPARE→VALIDATED→ACTIVATING→ACTIVATED); healthy no-op boots leave it untouched (verified live: 4 entries after multiple boots); heartbeat/ledger carry the taxonomy |
| 8 | Regression evidence | generation-store journal units; live no-op check |
| 9 | Residual risk | journalAppend is best-effort by design (the pointer is the commit point) |
| 10 | Platform action required | none |
| 11 | Verification requirement | the next REFUSED or AUTHORIZED decision appends its entry (observable on the next recurrence/restore) |
| 12 | Commit refs | `842a2de` |
| 13 | Test refs | generation-store units; live no-op |
| 14 | Notes | — |

---

## §9 — Cloud DB track (kept separate, read-only)

**Upgraded 2026-11-10 addendum: `CLOUD_DATABASE_UNVERIFIED` → VERIFIED (read-only; operator provided credentials this session; stored outside the repository at `/tmp/cloud.env`, mode 600, never committed — secret-scan hook PASS on every commit).** No cloud state was written; no credentials were rotated. Every prior cloud boundary was re-tested with real credentials:

| Endpoint | Access | Evidence-based state |
|---|---|---|
| **GitHub** (MITHQALMTQ/MTQ_SIGMA) | ✅ push verified | `a6fd079..1ad1f18 main → main` pushed this session; `HEAD == origin/main == 1ad1f18`; all telemetry + restoration evidence durable on the remote |
| **Turso** (`libsql://mtqs-fortleem…`) | ✅ auth OK (previous 401 lifted by the provided token) | Schema present (10 tables: DailyStateVector, IssuanceEvent, Mbz*, MetricSample, OracleSample, PilotTrial, RebalancingDecision, keeper_audit). **Cloud-side DB of the frozen Vercel stack — stale, not a current replica**: last keeper_audit write 2026-10-18 (`tick_at` 1792336793717, step=init, status=error, "RPC_URL not set"); zeros in IssuanceEvent/MbzBank/MetricSample; RebalancingDecision 10000 vs local 10099; DailyStateVector 5000 vs local 2623 (divergent datasets — the sandbox was re-imaged while cloud accumulated its own history) |
| **Neon** (pooler + `neondb`) | ✅ auth OK (PG 18.6, `neondb_owner`) | `mtq_*` mirror intact: mtq_rebalancing_decision 56513 · mtq_oracle_sample 34958 · mtq_daily_state_vector 15962 · mtq_pilot_trial 30 · **mtq_sync_state frozen at 2026-10-29T02:01:16Z** — exactly matching the prior forensics; the sync pipeline is down with the Vercel stack (12 days stale) |
| **Vercel** (`mtq-sigma.vercel.app`) | ✅ token valid (team-scoped; project `mtq-sigma` `prj_ZyfeYmYZ2cu2rcNsLLYerBNEVA11` listable) | **Public URL HTTP 402 (payment-required class restriction)**; latest deployments ~2026-10-28; crons enabled but definitions empty. The previously-recorded "deployment restriction" is now identified as billing-class |
| **Inngest** | ✅ signing key valid (`GET /v2/apps` 200) | App `mtq-sigma` registered (6 functions; last sync 2026-10-26 from `mtq-sigma.vercel.app/api/inngest`); **events flowing today** (latest `inngest/function.finished` 2026-11-09T20:28:40.872Z) but the run **FAILED: "Your server returned HTTP 402 before the SDK responded"** — the Vercel restriction breaks function execution downstream |

**Root cloud blocker (operator action):** the Vercel billing/402 restriction. Restoring it (settle billing → redeploy) revives Inngest function execution and the cloud sync pipelines in one move. **Cloud data push intentionally NOT performed** — the mirrors are divergent, not simply behind (Neon mtq_rebalancing_decision 56513 > local 10099; Turso/cloud histories accumulated across sandbox re-imaging), so a naive push would destroy newer cloud state and violate the forward-only recovery principle. Any cloud resync must be an explicit operator decision after Vercel restoration.

## §10 — Regression battery

**138 tests, all green:**
- `bun test tests/boot/` — **60/60**: db-plane-state classifier (18: every taxonomy state, precedence, decay, stale-image vs sanctioned-marker discrimination, custom prune tolerance), recovery-authorization (21: the full fail-closed matrix incl. F-1/F-2/zero-height closures, forward-only, staged/published authority, both custom material-loss directions), generation-store (12: lifecycle, refusal, discard, activation, reconciliation, foreign-write).
- `tests/plane5-git-state-regression.sh` — **78/78** (updated to the taxonomy: template carries the verifier + libraries + runtime preflight + package.json + node_modules symlink; db-plane expectation `db=HEALTHY`).
- Static gates: `tsc --noEmit` exit 0 · lint 0 errors (24 pre-existing warnings) · `bun build` parse gates PASS for all recovery-critical scripts.
- Requirement was ≥44 tests; delivered 138.

## §11 — Platform re-image cycles (≥3 required)

**Cycle 1 — OBSERVED (on the pre-hardening stack, full evidence):** 14:50Z re-image (uptime + boot log) → stale self-heal h3941 (dev.log verbatim) → dependency-mismatch crash → 15:17:48Z backstop fire → watchdog → **generation-store recovery to h21601 at 15:23:10.860Z** (journal + casualty archive + ledger + heartbeat) → server 200. The NEW recovery path worked on its first production recurrence.
**Cycle 2 — VERIFIED (2026-11-10 addendum, full evidence, unattended):** 20:16:04Z stale-image self-heal regressed live → h3966 (dev.log verbatim: `chain.db RESTORED from cloud dump (live missing → h3941)` + `custom.db RESTORED … → 12395 rows` — the Nov-6-era dump signature, seventh recurrence) → 20:18:48Z watchdog v5 chain (guard → source-integrity heal → runtime preflight → central-authorization self-heal) → FOREIGN_WRITE_DETECTED (live h3966 < active generation tip h21601) → DECISION_AUTHORIZED (published h21663 over live h3966) → staged generation `gen-20261109T201850258Z-h21663-ui23` VALIDATED (h21663 · 18077 rows · all §4.2 checks) + ACTIVATED 20:24:04.513Z (pointer committed, casualty archive kept) → `next dev` → health HTTP 200. Detection→healthy ≈ 8 minutes, zero manual intervention. Evidence: recovery journal (5 entries), execution ledger (20:18:20Z STARTED/FINAL, remediated=yes), dev.log boot banner sequence, commit `1ad1f18`. The sixth recurrence (~17:00Z, detected by the 17:17:48Z fire, tip h3943) is NOT counted as a cycle: its recovery path is not journaled — the live DB returned to a probe-HEALTHY state by 19:55:45Z (monitor) with no journal activation between 15:23Z and 20:18Z (provenance unproven — most plausibly a direct restore by the concurrent executor session; recorded honestly, flagged, not interpreted).
**Cycle 3 — PENDING:** accrues with the next platform re-provisioning; must show the full gate-chain boot path in evidence (dev.log banner, journal, heartbeat dbState, monitor relay). Not fabricatable (2/3).

## §12 — 24-hour scheduled soak

Started 2026-11-09T15:23Z (first stable post-recovery state on the new code). The two scheduler jobs (516197 backstop :17:48 hourly, 516198 monitor :55:45 hourly) now run the TURN 3 code from origin/main; every fire appends the taxonomy to the durable ledger. Evidence so far: 15:55:58Z monitor (degraded — pre-commit tree, honest /tmp telemetry only), 16:17:48Z backstop (full new pipeline: verifier HEALTHY, publish v5, new-format heartbeat, push; killed in the commit phase by turn teardown — planes all green at death, evidence durable), 16:23Z manual monitor (PLANE_5_OK db=HEALTHY). **Addendum fire log (17:17Z → 20:19Z, all on the new code, honest classifications throughout):** 17:17:48Z backstop ALERT db=STALE_IMAGE tip=h3943 (sixth recurrence detected; remediation did not complete that fire — recorded), 18:17:48Z backstop ALERT tip=h3944 (regression persisted, honestly alerted), 19:17:48Z backstop BLOCKED exit=13 SOURCE_CODE_AHEAD (drift guard held against unpushed concurrent-executor work — fail-closed as designed), 19:55:45Z monitor PLANE_5_ALERT (content: heartbeat result=ALERT; own probes db=HEALTHY server=200 watchdog=1 route=403 — the interim non-journaled live-DB state noted above), 20:17:48Z backstop ALERT + full sanctioned remediation (this fire executed the cycle-2 restoration; heartbeat 20:19:49Z result=ALERT reflecting the pre-restoration state — a fresh heartbeat was never presented as proof of health). The soak completes 2026-11-10T15:23Z; acceptance = green fires across ≥1 natural re-image with no manual intervention — cycle 2's unattended recovery (above) now satisfies the re-image survival requirement; the remaining soak requirement is the elapsed 24h window itself.

## §13 — Register/report updates

`ROOT_CAUSE_REGISTER.md` Incident 22 → remediation record (this turn); `REPORT.md` TURN 3 section; this report; worklog entry. All statuses above.

## §14 — Completion gate (20 criteria, honest verdicts)

| # | Criterion | Verdict |
|---|---|---|
| 1 | Proven root cause accepted; no resolved false lead reopened | ✅ (fifth recurrence captured as evidence, not investigation) |
| 2 | R-1 pre-boot gate implemented in-repo | ✅ FIXED AND VERIFIED (entrypoint → watchdog v5 → guard → heal → preflight → selfheal → next dev → readiness) |
| 3 | R-1 platform base image refreshed | ❌ **PLATFORM BLOCKED** — operator action required (see R-1 field 10) |
| 4 | R-2 central fail-closed authorization | ✅ FIXED AND VERIFIED |
| 5 | F-1 refused-note control flow closed | ✅ (refusal terminal; node.ts throws; exit 2 blocks boot) |
| 6 | F-2 missing-manifest bypass closed | ✅ (manifest missing = published source refused) |
| 7 | Zero-height hazard closed | ✅ (explicit outcomes; only HEALTHY carries height) |
| 8 | R-2B staged generations, atomic pointer, crash-safe reconcile | ✅ FIXED AND VERIFIED (live activation 15:23Z) |
| 9 | Interruption-safety proven | ✅ (reconcile units + design; the 16:17 fire teardown was an EXECUTION interruption, not an activation — journal clean) |
| 10 | R-3 publication/write-behind coherent with generations | ✅ (v5 published through the new pipeline this turn) |
| 11 | F-3 monitor never probes DB — closed | ✅ (monitor probes + 14-state taxonomy; live PLANE_5_OK db=HEALTHY) |
| 12 | Alert taxonomy: 14 distinct states, no generic ALERT | ✅ (classifier + plane5-run assembly; every line carries the state) |
| 13 | STALE_IMAGE signature detection | ✅ (tip-vs-pointer + fresh-restore marker; regression-tested discrimination) |
| 14 | R-5 OVERLAP_SKIP investigated + structural prevention | ✅ (holder identified by commit-window evidence; singleton + holder companions) |
| 15 | R-6 durable execution evidence | ✅ (journal + pointer + manifests + ledger + decision records) |
| 16 | ≥44-test regression battery green | ✅ (138) |
| 17 | Static gates green (tsc/lint/parse) | ✅ |
| 18 | ≥3 re-image cycles verified on the new chain | ❌ **2/3 — accrual pending** (cycle 1: 15:23Z activation; cycle 2: 20:24Z activation — seventh recurrence detected + restored unattended, ~8 min detection→healthy; one more required; the platform controls re-image timing) |
| 19 | 24-hour soak on scheduled fires | ❌ **IN PROGRESS** — started 15:23Z, completes 2026-11-10T15:23Z |
| 20 | Cloud layer verified or honestly recorded | ✅ **VERIFIED read-only** (2026-11-10 addendum: Turso auth OK/mirror stale-divergent, Neon auth OK/mirror frozen 2026-10-29T02:01:16Z, Vercel token OK/URL HTTP 402 billing-class, Inngest key OK/app registered/events flowing; root blocker = Vercel 402 — operator action; no writes, no rotations; see §9) |

## Final status

**V31 NOT COMPLETE — SPECIFIC BLOCKERS LISTED**

Everything controllable from inside this sandbox is **FIXED AND VERIFIED** (criteria 1–2, 4–17, 20: seventeen of twenty — the prior "sixteen" was a miscount, corrected in this addendum). The open items and their exact owners:

1. **Platform base-image refresh (criterion 3)** — operator/platform action: rebuild the sandbox base image from current origin/main (or wire watchdog launch into platform provisioning). Verification: a re-image whose first boot logs the v5 watchdog banner instead of a raw stale self-heal. Until then, each re-image keeps a ≤1h backstop-remediation window — **proven survivable twice now** (cycles 1 and 2 both recovered generation-safely; cycle 2 unattended in ~8 minutes).
2. **Re-image cycle 3 (criterion 18)** — 2/3 accrued; the next natural re-provisioning completes it if the hardened chain again boots and recovers unattended.
3. **24-hour soak (criterion 19)** — completes 2026-11-10T15:23Z; the hourly fires must stay green (or alert honestly) with no manual intervention. Multi-fire scheduler evidence is now substantial (17:17/18:17/19:17/19:55/20:17 fires all ran the new code with honest ALERT/BLOCKED/PLANE_5_ALERT classifications through a live recurrence window).
4. **Cloud stack restoration (operator action, outside the 20 criteria)** — settle the Vercel billing/402 restriction and redeploy `mtq-sigma`; this revives Inngest function execution and the Turso/Neon sync pipelines. Cloud data push deliberately NOT performed (divergent mirrors — forward-only principle; see §9).

No completion was fabricated: the blockers above are time-based and platform-owned, not code-owned. **Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**
