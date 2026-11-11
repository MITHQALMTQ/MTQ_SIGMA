# Phase 0 — Recovery & State-Integrity Assessment

## 1. The live incident this audit captured (primary evidence)

**PLATFORM REIMAGE STATE SUBSTITUTION — observed 2026-11-11T00:20Z (F-0-P0-02):**

| Observation | Evidence (commands in evidence-index) |
|---|---|
| Last verified healthy state: 2026-11-10T23:31:59Z — lineage B checkout, heartbeat OK (chainTip 23846, customRows 129,692, deficit 0, server 200, upload 403, watchdog alive), origin/main 926ee00 pushed, browser E2E green | previous-session telemetry (heartbeat.json on origin), commit e9e663f/926ee00 |
| At 00:23:11Z: sandbox re-imaged — HEAD=d6fd5d6 (lineage A: task45+task46+1 cron commit, frozen 16:56Z), 2 ahead/168 behind; `.env` regenerated 50 bytes; db/, dev.log, watchdog absent; platform processes all started 00:20 | git rev-parse/rev-list; ps; ls; mtimes |
| Local origin/main ref was STALE at ff2d385 (snapshot froze ~16:17Z fetch state) until this audit's fetch restored 926ee00 | fetch output line `ff2d385..926ee00` |
| Local dump tips h3941/12,395 vs origin h23811/129,583 (v13) → ≈19,870-block deficit | backups/db-snapshots; origin snapshot-publish commits |
| Scheduler registry SURVIVED this time (522460/522457 enabled); backstop 00:17:48Z fire incremented run_count (3) with **no relay, no telemetry observed** (registration ≠ execution — §13.3 distinction); display clock +8h vs next_run_time UTC | cron list (2×) |
| reflog of the substituted worktree shows the parallel workstream's own amend-history and a 16:56Z "UUID-cron" commit — corroborating a second agent lineage frozen into the image | git reflog |

**Decision recorded (Phase-0 read-only discipline): NO realignment, NO boot.** §1.1 forbids reset/clean/rebase to "make it look consistent"; booting this tree would trigger stale-dump restoration (the 2026-11-08T22:47:59Z regression class). Adjudication belongs to the approval gate.

## 2. Recovery architecture (what exists, where)

**Verified-capable chain (origin/main only at audit):** plane-5 v3.3 contract — fetch → bootstrap guard (BLOCKED-on-unique-local-content → no realign, /tmp telemetry only, NO commit) → drift guard (ff-only / subsumption-proven) → source-integrity heal → runtime preflight (frozen-lockfile) → db-selfheal (staged generations, forward-only, refuse-behind, sentinel `db/ALLOW-GENESIS-RESET`, identity gate, rollback prevention) → server+watchdog (sanctioned remediation, exclusive flock) → upload-403 check → dual heartbeat (clock round-trip verified; durable only when git synced) → commit/push rules → execution ledger (backups/plane5/execution-ledger.jsonl).
**Demonstrated live:** 2026-11-10 full day — deficit 19,613→0; recovery generation activated 23:04:16Z; snapshots v12/v13 published with sha256 verification + independent validation from origin; heartbeat OK at 23:31:59Z.

**At the audited HEAD:** watchdog v5 (INERT), db-selfheal/cloud-sync/restore-verify (present), git-drift-guard (present, 14/14 tests), source-integrity-heal (ABSENT), instrumentation boot-order gate (ABSENT), plane-5 suite (ABSENT) → **the local chain, if booted, restores STALE dumps** [F-0-P1-02].

## 3. Documented incident history (re-image/state-loss class — the §13.1 evidence base)

| Date (UTC) | Event | Loss |
|---|---|---|
| 2026-10-24 | stale-preview/dev-tree/CSS class begins | — |
| 2026-10-26 | Incidents #4, #5 — whole-repo re-images (stale snapshot e349973; origin intact) | local state |
| 2026-11-05 17:02-20:34 | snapshot regression: upload route deleted (3rd), vault wiped; auto-commit captured loss | upload route, vault |
| 2026-11-06 ~00:12 | Incident #6 — DB regression (chain re-seeded h≈50; custom 118/4,414 rows; ~25h) | ~25h state |
| 2026-11-06 ~11:57 | Incident #7 — chain.db wiped, custom→221KB stub, upload deleted (4th); **auto-healed zero-manual** | ~16 blocks/~35 rows |
| 2026-11-07 ~15:20 | Incident #8 — stale CODE boot (origin 26 ahead) → drift-guard created | code freshness |
| 2026-11-08 05:5x | Incident #10 + v27 recovery (false-BLOCKED ×4 git C-quoting; 11.8k-block deficit; upload deleted 8th×) | 11.8k blocks |
| 2026-11-08 22:47:59 | **stale-dump self-heal regression** — boot on stale snapshot restored h3941 over origin h17661 | 13,719 blocks (prevented-by-design afterwards on origin) |
| 2026-11-09 14:51 / 11-10 | Incident-22 recurrences (runtime mismatch) | availability |
| 2026-11-10 00:18-02:07 | base-image refresh: DBs stale h3946/12,395; `.staging`, /tmp creds, cron registry wiped; recovery gen h23435 activated 02:07:32Z | scheduler registry |
| 2026-11-10 21:23 | second registry wipe; jobs re-registered 22:1xZ | scheduler registry |
| 2026-11-11 00:20 | **the substitution this audit captured** | working lineage, DBs, local evidence |

## 4. Scheduler persistence (§13.3 verdict)

Job definitions live in platform payloads only — NOT declarative in-repo; re-registration manual (2×); execution history partially in ledger (git-tracked, good) but fires fail silently at the platform layer (15 consecutive "model concurrency" rejections — no dead-man alert existed); registration/invocation/completion distinctions not machine-checked; clock skew unresolved. **§13.3 status: NOT MET** [F-0-P1-05].

## 5. Recovery-safety rules honored in this baseline (no violations committed)

No DB reset, no re-seed, no backup deletion, no newer-data overwrite, no history rewriting for cosmetic consistency, no recovery-guard disable, no partial-snapshot publication, no writes to divergent cloud DBs (Turso/Neon untouched — env unset), no competing recovery launched (plane-5 fires run the guard only; the single sanctioned backstop relaunch of 2026-11-10T23:30Z was pre-audit, on the then-current lineage, per its own commit rules). Historical records with unverifiable provenance (the 08:20:30Z orphaned telemetry entry) were recovered **verbatim** with explicit provenance notes, never fabricated (commit 449b018 precedent).

## 6. Honest capability statement

Recovery from *data-layer* loss is genuinely strong and battle-tested (forward-only, sentinel-authorized, hash-verified, autonomously executed). Recovery from *lineage substitution* is guarded (bootstrap BLOCK) but currently **operator-dependent**; recovery from *registry loss* is manual; none of these controls are present in the substituted tree that would boot them. §13.4's "do not" list is respected by the current design; §13.2's "atomic generation activation + tamper-evident records" exists on the origin lineage only.
