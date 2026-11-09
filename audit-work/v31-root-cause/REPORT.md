# V31 TURN 2A — Root-Cause Fix Report: Incident 19 / Bootstrap Exit-13 Contradiction

**Execution window:** 2026-11-09T02:21Z → 03:2xZ (this session)
**Repository:** MITHQALMTQ/MTQ_SIGMA (testnet shadow)
**Baseline at start:** origin/main `9560222`; local HEAD `da904b2` (three unpushed platform sweep commits)
**State at close:** origin/main `694e7dc` (or later — see final verification); classifier `EXACT_MATCH`; manifest v2 verified; bootstrap exit 0; scheduler-dispatched fire on the fixed system: `EXECUTED-OK`
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED

The full incident analysis, evidence chain, and residual-risk register live in
[`incident-19-bootstrap-contradiction.md`](./incident-19-bootstrap-contradiction.md).
This report summarizes the turn's objective completion.

---

## A. Objective

Eliminate permanently the contradiction between the Git drift guard (which
classifies a snapshot-only ahead branch as benign, exit 0) and the bootstrap's
strict `HEAD == origin/main` assertion (which blocked the same state with
exit 13) — while NEVER weakening source-code integrity: a validated
forward-only database snapshot must not be rejected merely because it is
unpushed; an unverified source-code commit must never be accepted merely
because the branch is ahead.

## B. What was proven (Phase 1–2)

- The 02:17:48Z dispatch (job 516197, run_count=4, registry bracket to 02:18:41Z) executed the wrapper; the durable ledger recorded `BOOTSTRAP-FAILED bootstrapExit=13` at 02:18:11.421Z with the verbatim `HEAD 63eb204 != origin/main 9560222 after guard — BLOCKED` tail; the guard had passed 200 ms earlier ("synced/ahead — git plane OK").
- `45443cc`, `63eb204`, `da904b2` are three DISTINCT successive platform turn-end sweep commits (subjects = gateway request UUIDs; `da904b2` = the failed fire's own turn-end sweep, contents = exactly the files dirtied during that fire), all snapshot/evidence-only, strictly forward-only (h19573 → h19636 → h19700), linear from `9560222`.
- Three copies of the contradictory equality policy existed: bootstrap §3.8, the heartbeat writer's git plane, and (implicitly benign) the guard's ahead-only exemption.
- Root cause (proven): platform turn-end auto-commit (intended platform behavior) × write-behind keeping the TRACKED dump perpetually dirty (repository design) × the bootstrap's contradictory stricter assertion (the gate that turned a benign state into the outage).

## C. What was built (Phases 3–5)

| Component | File(s) | Role |
|---|---|---|
| Shared branch-state classification (8 states) | `src/lib/boot/git-state.ts`, `scripts/git-state-classify.ts` | single source of truth for bootstrap §3.8, wrapper/heartbeat git planes, publisher gate |
| Snapshot manifest + atomic publication core | `src/lib/boot/snapshot-manifest.ts` | structural dump validation (tip/genesis/completeness), sha256 manifest build/verify, atomic tmp+rename publication, commit of exactly the three snapshot paths + push |
| Publisher CLI (default / `--threshold` / `--repair`) | `scripts/snapshot-publish.ts` | the ONLY writer of the tracked snapshot files; git-state-gated; never publishes from an unadjudicated tree |
| Bootstrap §3.8 replacement + §3.10 manifest verification + §3.4 materialization of the new tooling | `scripts/plane5-bootstrap.sh` | EXACT_MATCH / SAFE_SNAPSHOT_AHEAD proceed; every other state exit 13; independent re-verification of the HEAD snapshot |
| Staging write-behind | `src/lib/db-ops.ts`, `scripts/db-cloud-sync.ts`, `src/instrumentation.ts`, `src/lib/boot/inproc-publication.ts` | 60 s loops refresh UNTRACKED `.staging/` dumps; threshold-gated autonomous publication; tracked files stay clean |
| Wrapper integration | `scripts/plane5-run.sh` | plane 2b publication step; SNAPSHOT_INVALID transition repair (one publication + one bootstrap retry); PLANE5_LOCK_FILE sandbox override; ledger carries `gitState`/`publishedTip`/`snapshotPublished`/`repair` |
| Heartbeat writer | `scripts/plane5-backstop-heartbeat.ts` | git plane from the shared classifier (`gitState` in the heartbeat); staged-aware diskTip |
| Isolated regression harness | `tests/plane5-git-state-regression.sh` | 20-scenario Phase 6 matrix + Phase 7 reproduction/negative/repair, PATH-stubbed so the live system is never touched |

## D. Verification results

1. **Isolated harness: 78/78 PASS** (`audit-work/v31-root-cause/regression-harness-run.txt`), including the Phase 7 acceptance pair:
   - P1 (the original incident-19 scenario): unpushed wrapper snapshot commit → bootstrap `SAFE_SNAPSHOT_AHEAD` → `BOOTSTRAP_OK` → full six-plane backstop `result=OK`, ledger `EXECUTED-OK`, heartbeat OK.
   - P2 (negative): unpushed SOURCE commit → `SOURCE_CODE_AHEAD` → bootstrap exit 13 → wrapper relays BLOCKED.
   - R1 (transition repair): legacy dump-only sweep geometry → `SNAPSHOT_INVALID` → one sanctioned repair publication → retry proceeds → `EXECUTED-OK`.
2. **Static gates:** `tsc --noEmit` exit 0 · `eslint` 0 errors (24 pre-existing warnings) · `bun build --target=node` parse gates PASS for all recovery-critical scripts (git-state-classify, snapshot-publish, plane5-backstop-heartbeat, db-cloud-sync, db-selfheal).
3. **Live transition (executed this session):**
   - Pre-fix live classification: `SNAPSHOT_INVALID`, ahead=3, all snapshot-only + forward-only — blocked solely on the missing manifest.
   - Repair publication `5ded004` (manifest v1, chain h20209): pushed the sweep lineage to origin WITHOUT history rewriting, force-push, or reset; bootstrap then exit 0 (`EXACT_MATCH`, `snapshot verified at HEAD: manifest v1 · committedTip=h20209 · sha256 match`).
   - Dev server restarted through the watchdog v4 chain; new staging write-behind armed; one live defect found+fixed during the transition (Edge-runtime compilation of direct node: imports in instrumentation.ts → extracted to `src/lib/boot/inproc-publication.ts`).
   - Source fix pushed `48da9bc` at 03:16:57Z.
4. **Live scheduler-fire confirmation (the decisive evidence — NOT a manual run):**
   - **03:17:48Z dispatch (job 516197) → 03:18:05.278Z ledger: `EXECUTED-OK`, `gitState=EXACT_MATCH`, evidence commit `1d8cb11` pushed; heartbeat 03:18:12.402Z `result=OK`, `gitState=EXACT_MATCH`, `planes.git=OK`.** The exact fire class that failed at 02:18:12.717Z completed green on the fixed system.
   - The fire's own turn-end sweep then committed the still-dirty tracked dump (residual dirt from the pre-restart old-loop window) without a manifest → classifier honestly reported `SNAPSHOT_INVALID` → the sanctioned repair path published it (chain h20333, manifest v2, commit `694e7dc`, pushed) → `EXACT_MATCH` again. The complete detect → block → validate → publish → verify cycle ran LIVE, exactly as designed and as proven by harness scenario R1.

## E. Files changed (this turn)

Source: `scripts/plane5-bootstrap.sh`, `scripts/plane5-run.sh`, `scripts/plane5-backstop-heartbeat.ts`, `scripts/db-cloud-sync.ts`, `src/lib/db-ops.ts`, `src/instrumentation.ts`, `.gitignore` — modified; `src/lib/boot/git-state.ts`, `src/lib/boot/snapshot-manifest.ts`, `src/lib/boot/inproc-publication.ts`, `scripts/git-state-classify.ts`, `scripts/snapshot-publish.ts`, `tests/plane5-git-state-regression.sh` — new.
Evidence: `audit-work/v31-root-cause/incident-19-bootstrap-contradiction.md` (new), `audit-work/v31-root-cause/regression-harness-run.txt` (new), this report, `ROOT_CAUSE_REGISTER.md` update, `worklog.md` entry.
Operational artifacts produced by the system itself during the turn: `backups/db-snapshots/manifest.json` (v1 → v2), publication commits `5ded004` / `694e7dc`, heartbeat/evidence commits `1d8cb11`, the scheduler fire's ledger entries.

## F. Guardrails honored

No force-push, no reset, no raw Git realignment, no history rewriting (the sweep lineage was published forward-only); no monetary/supply/reserves/governance/consensus/cryptographic behavior touched; no live database written by the fix (the live chain advanced normally throughout; the self-heal refused the manifest-mismatched dirty dump exactly as designed and confirmed the live DB was ahead); recovery authorization remains fail-closed; secret scan re-run at landing (PASS — see register update).

## G. Honest open items

1. Scheduler-fire regression evidence BEYOND the 03:17:48Z fire (a multi-fire soak on the pure new-code path — no transition dirt) accrues with the next hourly fires; the monitor fire at :55:45Z will additionally exercise its observation path on the new writer.
2. Manual-run job-ID attribution hardening (require explicit opt-in for scheduler-attributed runs) — small residual, disclosed.
3. Platform turn-end auto-commit remains outside repository control; its effects are now classified/bounded/self-healing rather than eliminated at the source.

**Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**

---
---

# V31 TURN 2B — Critical Database Regression Forensic Investigation & Runtime Integrity

**Execution window:** 2026-11-09T12:04:33Z → ~12:35Z (this session)
**Baseline at start:** origin/main `a1a4ae2` (local +1 unpushed platform sweep `3f91941` — correctly classified `SAFE_SNAPSHOT_AHEAD` by the live fire during the turn)
**State at close:** origin/main `817d06a`; live chain h20410 (integrity ok); server 200; route 403; git synced
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED · **investigation strictly READ-ONLY**

The full forensic evidence chain lives in
[`database-regression-forensic-report.md`](./database-regression-forensic-report.md)
(register: Incident 22). This section summarizes the turn.

## A. Objective

Explain why Plane 5 previously reported a healthy chain tip of h20333 with 18,146 rows and later reported a live tip of h3942–h3945 with 12,395 rows — establishing where the authoritative h20333 state exists and why the live application reported h3945 — without modifying any operational database, recovery cursor, snapshot, or Git state.

## B. What was proven

1. **The healthy baseline is real and durable:** the 03:18:05.278Z ledger entry records `chainTip=20333, customRows=18146, diskTip=20271, publishedTip=20209, unbackedAhead=124, recoveryDeficit=0, server=200+watchdog, route=403, result=OK`; the authoritative snapshot was published at 03:20:21Z (`694e7dc`, manifest v2, chain h20333 · 41,134 rows · custom 18,077 rows, genesis `gen_3baf0dba…`), sha256-verified independently during this investigation.
2. **The regression is real and timestamped:** first regressed observation 06:18:43Z (`tip=h3945 rows=12395 deficit=16388`); the live DB regressed inside the window (03:23:49Z, 06:18:43Z) — the prior session died at 03:23:26Z mid-backstop-run; the 05:17:49Z dispatch hit a sandbox death.
3. **The mechanism (proven by direct forensic capture of a live recurrence at 11:53Z):** the platform re-provisions instances from a **task46-era base image** (local HEAD `9fe4058`, reflog from Nov 5–7, Next 16.1.x, working-tree dumps stamped **2026-11-06T14:03:46Z** at chain h3941/custom 12,395 rows) and boots its own `next dev` directly on it; the image's **pre-T2A self-heal** (message "RESTORED from cloud dump", byte-identical to `48da9bc~1`) restores the re-image-wiped db/ from the stale dumps **before any git realignment** — durable proof: db meta `selfheal_at=2026-11-09T11:53:41.959Z`, empty chain archive dir (file deleted), 221,184-byte custom stub, drift archive with byte copies of the stale dumps.
4. **The oscillation h3945→h3942→h3945→h3944→h3945 with constant rows:** per-instance restore-to-h3941 + 1–4 blocks of growth before each turn's teardown. One mechanism, not reorgs or dual databases.
5. **Server/route 000000:** the mid-turn realignment flips code/deps under the running 16.1.3 server → hot-restart → `setCodeFrameRenderer` TypeError + swc 16.1.3-vs-16.4.5 mismatch → process death; `000000` = connection refused (curl probe semantics verified).
6. **No permanent data loss:** the h20333 state was preserved in the published snapshot throughout; the live DB's re-grown blocks were empty (`num_txs=0`); custom telemetry's 5,682 hidden rows were preserved in the published custom dump.
7. **The sanctioned recovery executed organically during the investigation:** the scheduled 12:17:48Z backstop fire (ledger 12:18:26.034Z, `remediated=yes`) relaunched watchdog v4 → db-selfheal restored h20333 at **12:22:19.263Z** → `next dev` v16.4.5 at 12:23Z → verified recovered (chain h20410, integrity ok, server 200, route 403, git synced `817d06a`). Not a manual action; ledger-evidenced.

## C. Root cause (lowest responsible layer)

**The platform's sandbox provisioning — a stale base image plus direct dev-server start with no pre-boot realignment hook.** Every in-repo defense (drift-guard-before-heal, T2A manifest gating, watchdog v4 ordering, forward-only rules) is correct and committed but cannot execute in a process generation whose code predates it. This is the Incident-1/2/4 family, third documented occurrence, now with full forensic proof.

## D. Defects found in current code (disclosed, unfixed)

- **F-1:** `selfHealDatabases()` logs "recovery from it refused (fail-closed)" for a noted-unusable published dump, but the restore branch is not gated on the note.
- **F-2:** a missing `manifest.json` skips published-dump verification entirely (not fail-closed).
- **F-3:** monitor fires never probe the DB plane — the regression hid behind a fresh OK heartbeat for ~3h.

## E. Deliverables and verdict

- New: `audit-work/v31-root-cause/database-regression-forensic-report.md` (17 sections: chronology, DB identities/paths, h20333 verification, live-DB verification, record-level differences, genesis/identity reconciliation, process mapping, metric audit, server/route diagnostics, recovery-mechanism inventory, root-cause determination, data-loss and recoverability assessments, unresolved evidence, gated remediation plan, §14 acceptance checklist, compliance statement).
- Updated: `ROOT_CAUSE_REGISTER.md` (Incident 22 added; Incident 4 marked RECURRED; TURN 2B note), this report.
- **Phase verdict: `PHASE_2B_COMPLETE`** — all 13 acceptance criteria met; cloud layer honestly **UNVERIFIED** (no credentials in this environment; Incident 21 evidence remains the latest verified state).
- Remediation R-1 (platform image refresh — the class-defeating fix) is operator/platform-side; in-repo hardening R-2/R-3 prepared as recommendations only. **No operational database was modified by this investigation** — all probes read-only; the recovery was the platform's own scheduled fire + watchdog.

**Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**

## F. TURN 2B second-pass verification (appendendum, 2026-11-09T12:19–12:52Z)

An independent second read-only forensic pass corroborated every material conclusion of the report above and upgraded two partial items to complete: (1) **full parent-hash continuity walk — 0 violations** across all 20,332 snapshot edges and 20,381 live edges (closes §14.6); (2) **cold rebuild of both published dumps** as a second reconstructibility proof (chain exactly 20,333 blocks contiguous; custom 18,077 rows exact manifest match). It also decoded the `server=000000`/`route=000000` token semantics (curl `000` + fallback `echo 000` concatenation = no HTTP listener at probe time), corroborated latent defect F-1 at code level, proved via committed-ledger archaeology that the 06:18–10:18 backstop FINAL entries were never in any commit (post-commit dirty appends wiped at turn-boundary re-provisionings), retracted a preliminary "CLI syntax corruption" reading after byte-level verification (Incident 18's documented `[h` display-mangling trap — file verified correct, 1:0 token counts), and recorded live forward growth to h20524 @12:41Z (server 200, route 403, git synced `817d06a`). Full detail: `database-regression-forensic-report.md` §18 (Addendum). **Phase verdict unchanged: `PHASE_2B_COMPLETE`.**

---

# V31 TURN 3 — Permanent Platform Startup Repair, Database Recovery Hardening & End-to-End Validation

**Execution window:** 2026-11-09T15:48Z → 16:35Z (this session)
**Baseline at start:** origin/main `f6b2c31`; live DB regressed h3997 (deficit 17604); server HTTP 500; heartbeat 15:19Z result=ALERT
**State at close:** origin/main `842a2de`; DB HEALTHY h21871 (deficit 0); server 200; entrypoint gate chain live; 138-test battery green; heartbeat dbState=HEALTHY result=OK
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED

The full 14-field remediation records (R-1, R-2, R-2B, R-3, R-4, R-5, R-6), the §9–§13 evidence, and the §14 completion gate live in
[`turn3-permanent-remediation-report.md`](./turn3-permanent-remediation-report.md).
This section summarizes the turn.

## A. Objective
Eliminate the complete Incident-22 causal chain permanently, repair every architectural weakness it exposed, verify the actual platform startup process, and validate end-to-end — without reopening the closed investigation and without fabricating completion.

## B. What the turn found on arrival (the fifth recurrence, live)
- The 14:50Z re-image had re-run the full causal chain (dev.log verbatim: stale self-heal h3941 → realign → swc/meriyah crash).
- The concurrent-executor TURN 3 code batch (`e8da08a`) had landed mid-flight: the generation store had already restored h21601 at 15:23:10Z (journal + casualty archive), but its `generation-store.ts` carried an swc/bun parser-divergence defect that left the server returning HTTP 500 (MODULE_UNPARSABLE) — which the then-running watchdog v4 passively supervised as "healthy" (curl exit code, not HTTP status).

## C. What the turn built and verified (all live, all pushed)
1. **Emergency + audit repairs** (`b322840`): swc-safe rewrite of the chain_id query, true-tip generation ids, `sourceOrigin` type fix, port-guard hardening (HTTP 200 = healthy; non-200 reclaimed through the heal chain), generation-binary repo hygiene (mid-import torn states blocked from history).
2. **R-1 platform entrypoint gate chain** (`a0475c0`): `bun run dev` → `scripts/dev-entrypoint.sh` → watchdog v5 (singleton flock; runtime preflight with the meriyah false-positive fixed to the real vendored path; fail-closed self-heal exits) → next dev → readiness. Live boot verified 16:03→16:08.
3. **R-4 14-state taxonomy** (`50193cc`): shared classifier (`db-plane-state.ts`), verifier CLI, monitor F-3 fix (probes the ACTUAL DB read-only), backstop plane-2 replacement (the old probe crashed on a missing DB file), heartbeat carries dbState. Live: 16:17:48Z scheduler fire ran the full new pipeline (heartbeat h21712 dbState=HEALTHY result=OK; publish v5); manual monitor run PLANE_5_OK db=HEALTHY.
4. **R-5/R-6** (`27f2a0a`, `842a2de`): watchdog singleton; OVERLAP_SKIP holder identity recorded at acquisition (lsof self-listing rejected with a live reproduction); durable DECISION_AUTHORIZED/DECISION_REFUSED journaling.
5. **§10 battery**: 60 new bun-test units + the updated 78/78 harness = **138 green** (requirement: ≥44); tsc 0, lint 0 errors.

## D. Honest open items (the completion gate, 16/20 criteria met)
**Final status: `V31 NOT COMPLETE — SPECIFIC BLOCKERS LISTED`** — (1) the platform base-image refresh (operator action; until then each re-image keeps a ≤1h backstop window); (2) re-image cycles 2–3 of ≥3 (1/3 observed, cycle 1 fully evidenced); (3) the 24-hour soak (started 15:23Z, completes 2026-11-10T15:23Z); (4) multi-fire scheduler evidence on the pure new-code path (accruing hourly). All in-repo remediations: FIXED AND VERIFIED.

**Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**
