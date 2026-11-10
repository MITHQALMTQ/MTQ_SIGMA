# MTQΣ V31 §9 — Post-Import Reconciliation & Recovery-Snapshot Closeout

**Date:** 2026-11-10 · **Operator directive:** V31 §9 (post-import reconciliation + recovery-snapshot closeout)
**Repository:** MITHQALMTQ/MTQ_SIGMA · **Working dir:** /home/z/my-project · **Branch:** main
**Release:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

**Final status (the three verifiable levels, honestly separated):**

| Level | Status | Basis |
|---|---|---|
| IMPORT EXECUTION VERIFIED | **YES** | Both import runs' outcomes corroborated by independent live-DB evidence (union content present, queryable, quick_check ok); counters reconciled with method caveats flagged (§2). |
| DATA RECONCILIATION VERIFIED | **YES, WITH FLAGGED EXCEPTIONS** | Inserted-count method contamination bounded; `fetched` total inconsistency + identical-vs-different conflict classification marked **UNVERIFIABLE** — the import stdout was destroyed by the 00:18Z platform refresh and the cloud credentials were wiped with /tmp (§2, §3). |
| RECOVERY SNAPSHOT VERIFIED | **YES** | Manifest v11 independently validated against BOTH committed payloads (hash/bytes/rows/height/genesis/completeness); all ten post-publication checks green (§8). |

---

## 0. Event timeline (UTC, 2026-11-09 → 11-10)

| Time | Event |
|---|---|
| 22:12:13 | v7 published (chain h22807 · custom 18,077) |
| ~22:40 | **First cloud→local import** (Turso+Neon → local, INSERT OR IGNORE by PK): fetched 132,631* · inserted 112,961 (count-method) · live 18,305→131,288 (+22 residual) |
| 22:44:43.505Z | write-behind staging capture → the custom dump that became v8/v9 (128,303 rows) |
| 22:51:16 | 36e4584: retention caps raised (DSV 25k/OS 50k/RD 75k) + v8 published (h23125 · 128,303) |
| 22:51–23:1x | old-caps server process kept pruning the union until reboot (live → 123,439) |
| 23:18:33.886Z | v9 published (h23435 · 128,303) |
| ~23:20–23:23 | **Second import (re-run / top-up)**: preflight 123,558 → inserted 8,650 (count-method) → 132,223 (+15 residual); regression battery 132,245 (+22 ticks) |
| 23:23:29 | 9f57e5e worklog entry; pushed |
| **00:18:23–27** | **PLATFORM BASE-IMAGE REFRESH (8th Incident-22 recurrence):** live DBs replaced by a stale image (chain h3946 · 12,395 rows); `backups/db-snapshots/.staging/` wiped; `/tmp` wiped (**cloud credentials lost**); **cron registry wiped** (jobs 516197/516198 gone — verified: no 01:17:48Z fire; registry list empty) |
| 00:18:45 | plane-5 backstop fired: STALE_IMAGE detected → sanctioned remediation authorized (published h23435 over live h3946) |
| 00:19–02:07 | db-selfheal: staged generation `gen-20261110T001926785Z-h23435-i2bw` (52.5MB chain.db + 79MB custom-dump import; exclusive flock) |
| 02:07:32 | PREPARE → **VALIDATED** (h23435 · 128,303 · all §4.2 checks) → **ACTIVATED** (pointer committed; casualty archive kept) |
| 02:07+ | `next dev` booted through the watchdog v5 chain (port 3000) |
| 02:17:48 | backstop fire (re-registered job 519580): committed recovery evidence → published **v10** (chain h23497 · custom 128,303 — custom side fell back to the published v9 text because the custom staging had not yet refreshed) → heartbeat **OK** 02:20:16 |
| 02:24:04.186Z | **v11 published** (this session, sanctioned path `scripts/snapshot-publish.ts`): chain h23559/47,586 · custom **128,729**/15 tables · commit 03e1234 **pushed** |
| 02:26+ | Phase-8 battery: all ten checks green |

## 1. Ground truth established (Phase 1)

- **Git:** HEAD == origin/main (post-corrections 8ef6068; post-closeout 03e1234); clean tree; local-only line of the pre-refresh state archived by the git-drift guard (`mtq-sigma-backups/selfheal-archive/gitdrift-2026-11-10T00-18-48Z/`, 489MB local-line.bundle, subsumptionSafe=true — no source loss).
- **Processes:** server down at task start; watchdog alive (3 procs); db-selfheal mid-restore (99% CPU). After 02:07: `next dev` PID 7583 (port 3000), watchdog alive.
- **Live DB (post-restore, 02:12):** quick_check **ok**; per-table: AiModelCatalog 101 · ConsensusRun 50 · ConsensusVote 146 · **DSV 17,893** · IssuanceEvent 0 · Mbz* 0 · MetricSample 0 · **OS 39,234** · PilotTrial 34 · **RD 66,015** · ScoringUpload 0 · **keeper_audit 5,091** · **mtq_sync_state 3** · TOTAL **128,567** (= v9's 128,303 + 264 post-boot ticks). v9 dump tip confirms the restore source exactly.
- **Retention:** caps RD 75,000 / DSV 25,000 / OS 50,000; sole caller = pilot-state tick loop (5-min throttle, ≤1,000 rows/table/invocation, oldest-first); with live counts under every cap the prune is a **no-op**.
- **Generation identity:** active = `gen-20261110T001926785Z-h23435-i2bw` (activated 02:07:32.227Z, sourceOrigin=published, manifest v9); journal complete (FOREIGN_WRITE_DETECTED → DECISION_AUTHORIZED → PREPARE → VALIDATED → ACTIVATING → ACTIVATED); casualty archive kept.
- **Published manifest v9 (pre-existing):** chain h23435 · 47,338 rows · sha `9f9a72ad…` · custom 128,303 · 15 tables · sha `6e3405ca…` · generated 2026-11-09T23:18:33.886Z.
- **Staged dumps:** ABSENT (wiped by the platform refresh) — refreshed by the write-behind within minutes of the 02:07 boot (chain h23559 · custom 128,729 at 02:19).
- **Scheduler executions:** backstop 516197 last EXECUTED-ALERT (00:18:45Z, the detecting fire); monitor 516198 last EXECUTED-PLANE_5_OK (2026-11-09T21:55:55Z). **Registry found wiped** → re-registered: backstop **519580** (hourly :17:48Z) + monitor **519582** (hourly :55:45Z); the 02:17:48Z backstop fire ran the full contract end-to-end (proof of restored cadence).

## 2. Import arithmetic reconciled (Phase 2)

**Re-run (the "second import", ~23:20–23:23):**

| Figure | Value | Class |
|---|---|---|
| Live before → after | 123,558 → 132,223 | net **+8,665** |
| Count-method inserted (Σ per-table after−before) | **8,650** (DSV +3,000 · OS +2,880 · RD +2,770 · others +0) | the OLD figure |
| Neon-pass count-deltas | 8,292 (DSV 2,997 · OS 2,742 · RD 2,553) | pass-level |
| Turso-pass count-deltas | +358 (DSV +3 · OS +138 · RD +217) | pass-level |
| Residual outside insert windows | +15 (123,558 + 8,650 = 132,208 vs 132,223) | concurrent app writes |
| Regression battery (minutes later) | 132,245 = 132,223 + 22 | post-import ticks |

- **Root cause of the reporting defect:** the importer logged the **accumulated** tally on the second (Turso) pass — so "DSV +2,997 (neon) +3,000 (turso)" read as per-source additions (implied 16,942 = **double-count by 8,292**), when 3,000 was the neon+urso RUNNING total. Correct decomposition: neon-pass 8,292 + turso-pass 358 = 8,650.
- **Method contamination (the task's suspicion — CONFIRMED):** the old method computed `inserted` from before/after COUNTS, which silently absorbs concurrent app writes (and would absorb retention prunes; none were active during the re-run — new caps were live). The +15 residual is the out-of-window part; the in-window part is bounded by the pass-level anomalies (≤ ~358+) → **true statement-level inserted ∈ [≈8,292, 8,650]** — not pin-able post-hoc because the import stdout was destroyed in the 00:18Z platform refresh.
- **`fetched=132,631` — FLAGGED UNVERIFIABLE:** arithmetically inconsistent with the independently verified source counts (Neon tables 107,463 + keeper_audit 5,091 + mtq_sync_state 3 = 112,557; the worklog's own Turso table sizes DSV 20,962 / OS 40,000 / RD 66,513 imply a both-source full fetch ≥ ~240k). The exact source decomposition cannot be reconstructed from surviving evidence.
- **First import (context):** fetched 132,631* · inserted 112,961 (count-method) · live 18,305→131,288 (+22 residual) — same method caveats.
- **Corrective action (committed 8ef6068):** `scripts/cloud-to-local-import.ts` now derives `inserted` from **statement-level Σ ResultSet.rowsAffected** (1 per real insert, 0 per PK-ignore), keeps before/after as an explicit cross-check, reports `ignored`, `netDelta` and `concurrent` separately, and prints per-pass contributions AND running totals on distinct fields — the accumulated-tally mislabeling hazard is structurally eliminated.

## 3. Primary-key conflict audit (Phase 3)

- Importer semantics: `INSERT OR IGNORE` by PK only — **no local row was ever overwritten** (no UPDATE/DELETE anywhere); the LOCAL side of every conflict is preserved in the restored DB; the CLOUD side remains intact in Turso/Neon (nothing was written to the cloud).
- Re-run PK-ignored = fetched − inserted = **≥ 123,981** (inherits the `fetched` uncertainty above). Affected tables: DSV, OS, RD, PilotTrial (shared tables with pre-existing local rows); keeper_audit and mtq_sync_state were NEW tables (0 conflicts).
- **Classification:** identical-content vs different-content — **UNVERIFIABLE** post-hoc (requires a cloud-vs-local normalized row-hash comparison; credentials wiped with /tmp; import stdout lost). Schema/normalization incompatibilities: none observed (all normalizations are value-level: ISO→epoch-ms, PG booleans→0/1; no row was rejected).
- **Claim discipline:** a complete cloud-data union is **NOT claimed** until the conflict accounting is settled. Remediation path: a future read-only conflict-audit pass with operator credentials (the corrected importer already records statement-level inserted/ignored per table per source, making the next run self-auditing).

## 4. Provenance & hash-chain classification (Phase 4)

- **Source hash availability:** Neon `mtq_*` tables carry **no** prevHash/rowHash columns → imported Neon rows have NULL hash columns locally (no source hash evidence — hashes were never manufactured). Turso DSV/RD **do** carry prevHash/rowHash → imported verbatim.
- **Sanctioned verification** (`scripts/check-audit-trail.ts`, live DB, 02:15 — read-only):

| Table | rows | verified (EXACT v2.1) | legacy-float | broken | unhashed |
|---|---|---|---|---|---|
| DailyStateVector | 17,894 | **2,930** | 0 | **0** | 14,964 |
| RebalancingDecision | 66,018 | **10,178** | 0 | **0** | 55,840 |

- **Classification:** *Cryptographically verified* 13,108 rows (Turso-origin + local rows — every stored hash reproduces EXACTLY under the local canonical v2.1 semantics, i.e. the production stack's chain semantics and the local ones agree; generation validation also confirmed parentHash continuity). *Unhashed / no source hash evidence* 70,804 rows (Neon-origin). *Legacy but structurally valid* 0 · *Broken/inconsistent* **0** · *Unverifiable* 0.
- Historical rows preserved as-is; imported hashes were NOT attached to the live chain as if locally generated; import provenance is recorded (generation.json sourceOrigin, importer logs, this report).

## 5. `mtq_sync_state` cursor semantics (Phase 5)

- The imported local table holds **3 ARCHIVAL rows** — the Neon **mirror's** high-water cursors frozen at the 2026-10-29T02:01Z sync outage (values: DSV 1793239270379 / OS 1793239270514 / RD 1793239274262 ms + last cuids).
- **Consumers audit:** the only reader/writer of `mtq_sync_state` is `src/lib/neon-client.ts` (`getSyncCursor`/`setSyncCursor`/`ensureSyncStateTable`) — all operating on the **Neon-side cloud connection** (`getSql()`), never the local table. No application route, job, or script reads the local copy (repo-wide grep). → **Archival, not operational.**
- It cannot advance or suppress any local process (the local table is inert). A future cloud sync resumes from the **Neon-side** cursor and re-sweeps with `ON CONFLICT DO NOTHING` (self-healing, append-only) — no silent cloud-data-loss authorization path exists. The local rows are frozen import provenance.

## 6. Retention & regression-test consistency (Phase 6)

- Caps (src/lib/mtq/audit-trail.ts): **RD 75,000 · DSV 25,000 · OS 50,000**; prune = oldest-first, batch ≤ 1,000 rows/table, once per 5 min from the tick loop (sole caller).
- **Env-policy mismatch resolved:** the code had NO environment-specific configuration (compiled constants) while the comments described "local full-history vs production capped-window". Implemented the actual configuration surface (commit 8ef6068): **exported `RETENTION_CAPS`** + `MTQ_AUDIT_RETENTION_*` env overrides — defaults UNCHANGED (local full-history policy); a production deployment opts into the capped window by setting the env vars.
- **Test corrected:** `src/lib/mtq/__tests__/audit-retention-test.ts` previously hardcoded the pre-§9 10,000 cap AND ran against the LIVE database. Rewritten: asserts the actual configured defaults (75k/25k/50k) via the shared export, exercises the env-override path, and runs **only in an isolated temp DB** (mkdtemp + `prisma db push`; live DB guarded-off). **PASS** (first-call deletes exactly PRUNE_BATCH_SIZE=1,000; loop converges to cap; oldest-first verified; engine-like rows survive; temp DB removed).
- Stale "≤10k/5k/5k" prune comment in pilot-state.ts fixed. `tsc --noEmit` clean · eslint clean · secret-scan PASS.

## 7. Recovery snapshot publication (Phase 7)

| Manifest | chain | custom | generated | commit |
|---|---|---|---|---|
| v9 (pre-existing) | h23435 · 47,338 · sha `9f9a72ad…` | 128,303 · sha `6e3405ca…` | 2026-11-09T23:18:33.886Z | f3ee2f3 |
| v10 (backstop 02:17:48Z fire) | h23497 · 47,462 · sha `a4dfb38e…` | 128,303 (v9 text — fallback) | 2026-11-10T02:18:01.205Z | f8845f8 |
| **v11 (this closeout)** | **h23559 · 47,586 · sha `d698e636bfa85e42…`** | **128,729 · sha `4009e7b8d632baf3…`** | **2026-11-10T02:24:04.186Z** | **03e1234 (pushed)** |

- Path: `scripts/snapshot-publish.ts` ONLY (validated atomic publication; tmp+rename; git add of exactly the three snapshot paths; push succeeded). No manual manifest edits, no raw copies, no validator bypass.
- The published custom row count (128,729) reflects **the accepted latest database state at snapshot time** — the restored union state plus post-restore ticks at the 02:19 staging capture.
- **Live-vs-published unbacked delta** (at validation, 02:26): +75 blocks (h23634 vs h23559) · +246 rows (128,975 vs 128,729) — normal live-tick growth, widening; bounded by the 60s write-behind + hourly publication cadence.

## 8. Post-publication validation (Phase 8) — all ten green

1. Manifest re-read from origin/main (HEAD == origin == 03e1234; payload diffs empty) ✓
2. Both payload hashes recalculated — `validateManifestAgainst` **ok=true, reasons=[]** ✓
3. Row counts + chain height match dump tips (47,586/h23559 · 128,729/15 tables) ✓
4. `PRAGMA quick_check` on live: **ok** ✓
5. Regression battery: **OK — mature databases, no regression signature** (chain h23629 · custom 128,953) ✓
6. App queries serve imported historical records: `/api/trials` 200 (cloud-imported trials incl. `cmw5aec6…`), `/api/landing-stats` 200; DSV deep-history span **2026-09-11T11:34Z → live**; keeper_audit 5,091 rows from 2026-10-18 ✓
7. Server 200 · watchdog alive (3 procs) · sanctioned upload route `/api/constituency/upload` **403 fail-closed** ✓
8. Cloud-sync guard **quiet** (healthy write-behind deltas; staged chain re-refreshed h23624) ✓
9. No retention deletion of imported history: DSV 17,916/25k · OS 39,372/50k · RD 66,272/75k — all under caps, counts growing ✓
10. **No unauthorized cloud writes:** `/tmp/cloud.env` absent (credentials wiped); `.env` has zero TURSO/NEON keys; dev.log clean of cloud write attempts — cloud writes are structurally impossible from this box ✓

## 9. Honest loss accounting & remaining limitations

- The 00:18Z platform refresh destroyed the pre-clobber live state (132,223 + ~2h of ticks ≈ ~134k rows) and the sanctioned chain restored the v9 image (128,303). Of the +8,650 top-up rows: ~4.9k (pruned after the 22:44 capture) **are preserved inside v9/v11**; **~2,985 (pruned before the capture) exist today only in the cloud**; all post-re-run local-only ticks are unrecoverable.
- v11's unbacked deficit vs the pre-clobber accepted state ≈ 3.5–4k rows. **Recovery path:** an idempotent cloud re-import (INSERT OR IGNORE) — **NOT run**: §9's absolute prohibition ("no re-run without demonstrated missing-data requirement AND approved reconciliation plan") was honored, and it is presently impossible anyway (credentials wiped with /tmp). Operator action required: re-supply credentials + approve a reconciliation plan.
- The cloud-side PK-conflict content audit (§3) and the fetched-total recount (§2) await the same credentials.
- Platform base-image refresh recurrences (this was the 8th Incident-22 occurrence) remain an operator infrastructure action; the recovery chain absorbs each one (detection→healthy ≈ 1h48m this time) but every recurrence costs the unbacked window.
- The cron registry wipe is now absorbed operationally (jobs re-registered 519580/519582 — the 02:17:48Z fire executed the full contract including publication), but the registry lives outside the repo and will be lost again on the next refresh.

**TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.**

---

## 10. Continuation session (2026-11-10T21:39–22:35Z) — 9th/10th recurrence verification, guard adjudication, sanctioned restoration relaunch

The platform refreshed the base image twice more after this report (≈16:2xZ and 21:23Z): live DBs re-wiped to a schema-only stub (custom.db 221KB, 12 tables, all 0 rows; chain.db absent), the repo re-frozen to a stale Nov-7 lineage + 2 local-only commits (guard BLOCKED at the 16:56Z monitor fire), and the cron registry wiped a second time. A continuation session (V31 §9 directive) performed:

| Step | Result |
|---|---|
| Guard adjudication (BLOCKED operator path) | 38 local-side paths: 21 ancestor-blob · 12 derivable · 1 deleted-origin-wins · **1 unique-content: worklog.md, 5 lines — the orphaned 08:20:30Z telemetry entry, recovered verbatim into the canonical worklog**. Local line archived to `mtq-sigma-backups/selfheal-archive/gitdrift-2026-11-10T21-38Z/` (binary format-patches ×2 + local-line.bundle + ADJUDICATION.md). Realigned to `ff2d385` — no genuine content lost (blob-redundancy proof). |
| v11 re-verification | SHA-256 recomputed **EXACT** for both payloads (`d698e636…`/`4009e7b8…`); INSERT statements 47,586/128,729 = manifest = actual data rows (8 ConsensusVote INSERTs wrap lines — line-count pitfall documented); per-table split cross-validates the §1 live snapshot to the row (128,567 + 162 post-restore ticks = 128,729). |
| Hash-chain (§4 re-verified from the committed dump) | Hash-bearing: DSV 2,938 + RD 10,274 · **unhashed 70,804 (DSV 14,964 + RD 55,840) — IDENTICAL to the §4 live-verified set** · broken 0 (live re-verification re-run after restore) · OS 39,288 unhashed-by-design (no hash columns in schema). |
| Cursors (§5 re-verified) | 3 archival rows frozen 2026-10-29T02:01Z (1793239270379 / …514 / …262); consumers audit re-confirmed — `neon-client.ts` operates the Neon-side cloud table only; the local copy is inert. |
| Retention (§6 re-verified) | `audit-retention-test.ts` independently re-run → **PASS** (defaults 75k/25k/50k · MTQ_AUDIT_RETENTION_* overrides honored · PRUNE_BATCH_SIZE=1000 incremental batching · oldest-first · engine rows survive · isolated temp DB, removed). |
| Restoration | `plane5-run.sh backstop` 21:36:41Z: guard EXACT_MATCH → `DATABASE_REGRESSION` (h0/0) → watchdog v5 launched (singleton lock) → journal `DECISION_AUTHORIZED: published h23559 over live hmissing (controlled)` → generation `gen-20261110T213647981Z-h23559-zo2n` staged (chain complete 52,797,440 B; custom import in flight at commit time, ETA ~02:15Z) → heartbeat 21:37:46Z ALERT committed `40d7803` + pushed. Activation → next dev → write-behind staging refresh → the hourly backstop publishes **v12** autonomously. |
| Watch | Registry re-armed after the 2nd wipe: monitor **522457** + backstop **522460** (hourly :55:45Z / :17:48Z UTC). |

Final status (continuation): **IMPORT EXECUTION VERIFIED** (unchanged) · **DATA RECONCILIATION VERIFIED** (flagged exceptions unchanged — fetched-total + conflict content; evidence destroyed by the platform refreshes) · **RECOVERY SNAPSHOT VERIFIED** (v11 independently re-verified cryptographically; machine restoration to the v11 state relaunched through the sanctioned chain; v12+ publication continues on the hourly cadence with the write-behind staging).

### 10.1 Completion (23:04–23:25Z) — restoration activated, live battery all-green, v12 published + independently validated

| Item | Result |
|---|---|
| Activation | `gen-20261110T213647981Z-h23559-zo2n` **VALIDATED h23559 · 128,729 rows — exactly the v11 manifest count — all §4.2 checks** → **ACTIVATED 23:04:16.073Z** (casualty archive kept) → `next dev` healthy (health 200 at 23:12; watchdog 3 procs). |
| Live hash-chain re-verification | `check-audit-trail` (read-only): **DSV verified 2,954 EXACT + RD 10,462 EXACT (canonical v2.1) · broken 0 · legacy-float 0 · unhashed 70,804** — identical to both the §4 live set and the committed-dump count (**three-way agreement**). |
| Live battery | quick_check **ok** · regression battery **OK — mature databases** (h23648 · 129,029) · `/api/trials` 200 serving the cloud-imported trial `cmw5aec6…` · `/api/landing-stats` 200 · upload route **403 fail-closed** · cloud-sync guard quiet · retention no-op (DSV 17,928/25k · OS 39,444/50k · RD 66,415/75k, growing) · NO cloud writes (credentials structurally absent). |
| **v12 publication** | `scripts/snapshot-publish.ts` (sole sanctioned path): chain **h23686 · 47,840 rows** (sha `7805026b99f5e8316e44…`) · custom **129,156 rows · 15 tables** (sha `d965a5c96846437273…`) · generated 2026-11-10T23:18:15.646Z · atomic · commit **`0f7b10a` PUSHED** (exactly the three snapshot paths). |
| Post-publication validation | manifest v12 re-read from origin ✓ · both SHA-256 recomputed **EXACT** ✓ · INSERT counts 47,840/129,156 = manifest ✓ · genesis ✓ · live-vs-published delta normal-widening (bounded by the 60s write-behind + hourly publication). |

Final status (completed): **IMPORT EXECUTION VERIFIED** · **DATA RECONCILIATION VERIFIED** (flagged exceptions: fetched-total + conflict content — await operator-supplied cloud credentials) · **RECOVERY SNAPSHOT VERIFIED** (v11 → v12). Remaining limitation: ~2,985 cloud-only top-up rows + the PK-conflict content audit await credentials and an approved plan.

**TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.**
