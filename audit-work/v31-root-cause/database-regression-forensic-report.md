# V31 TURN 2B — Critical Database Regression Forensic Report (h20333 → h394x)

**Investigation window:** 2026-11-09T12:04:33Z → ~12:35Z (this session)
**Report authored:** 2026-11-09T12:3xZ
**Repository:** MITHQALMTQ/MTQ_SIGMA (working dir /home/z/my-project)
**Classification:** TESTNET ONLY · SHADOW MODE · NOT PRODUCTION-AUTHORIZED
**Investigation mode:** READ-ONLY. No database, recovery cursor, snapshot, migration, restart, reseed, or Git history was modified by this investigation. (The forward-only recovery that occurred at 12:18–12:23Z was executed by the platform's own scheduled plane-5 backstop fire and watchdog v4 chain — concurrent activity, not an action of this investigation; evidence below.)

---

## 0. Executive summary

Between the last healthy observation (2026-11-09T03:18:05Z: live chain **h20333**, 18,146 custom rows, `recoveryDeficit=0`, server 200, route 403) and the first regressed observation (06:18:43Z: live tip **h3945**, 12,395 rows, `recoveryDeficit=16388`, server 000000, route 000000), the live database lost ~16,392 blocks of apparent height. **This was not a metric artifact and not a path divergence.** The authoritative h20333 state was never lost — it remained fully preserved and sha256-verified in the git-published snapshot (`backups/db-snapshots/latest-chain.sql`, manifest v2, commit `694e7dc`). What regressed was the **live db/ files**, and the regression was executed by the repository's own boot self-heal running **stale, pre-fix code from a stale platform sandbox image, reading a stale Nov-6 dump**.

**Proven root cause (one sentence):** the platform restores sandbox instances from a machine image frozen at the task-46 era (~Nov 6–7: local HEAD `9fe4058`, Next 16.1.x runtime, working-tree dumps stamped 2026-11-06T14:03:46Z at chain h3941 / custom 12,395 rows), starts its own dev server directly on that image (no watchdog, no bootstrap), and the image's pre-T2A `selfHealDatabases()` — which has no drift guard, no manifest verification — restores the wiped `db/chain.db`/`db/custom.db` from the image's three-day-stale dumps *before* any git realignment to origin/main occurs, permanently re-basing the live database 16,392 blocks behind the published snapshot until the next sanctioned recovery.

The same class is documented twice before (Incident 4; the 2026-11-08T22:47:59Z occurrence recorded in `src/instrumentation.ts` [0] — identical h3941-from-task46-image signature). The in-repo fix (drift-guard-before-heal, T2A manifest gating, watchdog v4 ordering) is correct and committed, but **cannot execute in a process generation whose code predates it** — the lowest responsible layer is the platform's sandbox provisioning (stale base image + direct dev-server start), which is outside repository control.

**Live epilogue:** while this investigation was under way, the scheduled 20:17:48+08 backstop fire (job 516197, ledger 12:18:26.034Z, `remediated=yes`) relaunched the watchdog, whose v4 chain ran db-selfheal **with current code** and forward-only-restored the live DB from the published h20333 dump at **2026-11-09T12:22:19.263Z** (db meta `selfheal_at`), then booted `next dev` v16.4.5; the chain resumed and is healthy at the time of writing (h20410, integrity ok, server 200, route 403, git synced `817d06a`). No manual repair is needed or authorized.

---

## 1. Exact chronology

All times UTC. "Instance" = one platform sandbox process generation.

| # | Time (UTC) | Event | Evidence |
|---|---|---|---|
| 1 | 2026-11-06T14:03:46.982Z / 47.081Z | Stale dumps created (chain `rows=8346 height=3941`, custom `rows=12395`) — later frozen inside the platform base image | archived dump headers (gitdrift archive `files/backups/db-snapshots/`) |
| 2 | ~2026-11-07 | Platform image frozen at task46 state: local HEAD `9fe40589fdff70f7636dc6f13d4cb29364016afe` (task46 amend), node_modules Next 16.1.x, dirty tree incl. the Nov-6 dumps, upload route deleted | drift MANIFEST `localHead`; image-era `package.json` (`"next": "^16.1.1"`); reflog last pre-image entry |
| 3 | 2026-11-09T03:17:48Z | Backstop fire (job 516197, run 5) — **healthy baseline**: ledger 03:18:05.278Z `EXECUTED-OK`, `chainTip=20333`, `customRows=18146`, `diskTip=20271`, `publishedTip=20209`, `committedTip=20209`, `unbackedAhead=124`, `recoveryDeficit=0`, `server=200+watchdog`, `route=403`, commit `1d8cb11` | `backups/plane5/execution-ledger.jsonl` |
| 4 | 03:18:35Z | Platform turn-end sweep `46a63d3` commits refreshed dump | git history |
| 5 | 03:20:20–21Z | **Authoritative snapshot published**: `694e7dc` "snapshot-publish: chain h20333 · custom 18077 rows · manifest v2", pushed; manifest `generatedAt 03:20:20.357Z`, chain sha256 `7a870c5b…`, genesis `gen_3baf0dba…` | manifest.json; git |
| 6 | 03:23:26Z | Prior session's manual backstop STARTED (lock acquired); heartbeat 03:23:31.563Z `result=OK` (commit `0a73f3f`); **no FINAL ledger entry — prior agent session died mid-run (context exhaustion)** | ledger; git |
| 7 | 03:23:49Z | `1b95d61` (T2A evidence) — prior session's last commit | git |
| 8 | (03:23, 06:18) | **REGRESSION WINDOW.** Prior instance dies; platform re-provisions from the stale image; image's dev server boots; pre-T2A self-heal restores db/ from the image's h3941/12,395 dumps. First-event timestamp not provable (archives wiped by subsequent re-images). Sandbox-death marker: the 05:17:49Z backstop dispatch reported "sandbox failed to start" (run 7). The 05:55:45Z monitor dispatch (run 7) left no ledger/commit evidence (unobserved). | reflog reset; 05:17 turn record in session; absence of evidence |
| 9 | 03:55:45Z / 04:55:45Z | Monitor fires: `PLANE_5_OK` then `PLANE_5_ALERT` (age-based; gateway rejected the 04:17:48Z backstop — run 6). **Monitors do not probe the DB — the regression was already present but invisible** | session relay records; alerts.log |
| 10 | 06:17:48Z | Backstop run 8 (this session): ledger STARTED 06:18:43.872Z → **first regressed DB observation: `tip=h3945 rows=12395 deficit=16388 published=h20333 server=000000 route=000000`** → `result=ALERT`, heartbeat commit `2b1e628` | ledger; session relay |
| 11 | 07:17–10:17Z | Backstop runs 9–12: tips **h3942 → h3945 → h3944 → h3945**, rows constant 12,395, deficit 16391/16388/16389/16388; commits `d5308fd`, `bf20856`, `c14971f`, `8d77859` + monitor commits `4e55bad`, `98f0132`, `b0535e6`. Backstop ledger FINAL appends wiped by turn-boundary resets (STARTED entries survive — committed with the heartbeats; FINALs were appended post-commit and left dirty) | ledger; git file lists per heartbeat commit |
| 12 | 11:17:49Z | Backstop run 13 dispatch — sandbox unavailable to the agent; script never ran | session record |
| 13 | ~11:53:0xZ | **This instance image-restored** (proof: reflog's last local entry is the task46 amend; `.git` replaced; tree at `9fe4058` with the Nov-6 stale dumps dirty, upload route deleted, node_modules 16.1.x; db/ wiped: chain.db **deleted**, custom.db → **221,184-byte stub**) | reflog; drift MANIFEST; archive dirs |
| 14 | 11:53:2x–42Z | Platform's own dev server boots directly on the stale image; **pre-T2A self-heal runs** (message format `RESTORED from cloud dump` — byte-identical to `48da9bc~1:src/lib/db-ops.ts` line 508): chain.db restored **h3941 · 8,346 rows**, custom.db restored **12,395 rows**; node RESUME h3941; db meta `selfheal_at=2026-11-09T11:53:41.959Z`, `selfheal_dump=latest-chain.sql` | dev.log lines 17–21 (captured before truncation); db meta; archives `20261109T115337928Z-chain` (empty — file was deleted), `20261109T115342033Z-custom` (221,184-byte stub) |
| 15 | ~11:54:02Z | Server Ready (Next **16.1.3**, image runtime); 3 × `GET / 200` served | dev.log lines 22–26 |
| 16 | 11:55:45Z | Monitor fire (this session) → script 11:56:17 → bootstrap fetch → drift classified **DIVERGED (localHead `9fe4058`, localOnly=1, behind=99, subsumptionSafe=true)** → drift heal archived (`gitdrift-2026-11-09T11-56-20Z`, 461MB local-line bundle + byte copies incl. the stale dumps 7,381,956 / 8,915,620 bytes) → `git reset --hard b0535e6` (reflog @{2}) → 11:56:39Z `EXACT_MATCH`, manifest v2 verified | drift MANIFEST.txt; reflog; /tmp/plane5-git-state.json |
| 17 | ~11:56:2xZ | Realignment flips `next.config.ts`/package.json (+ bun install → node_modules 16.4.5) under the running 16.1.3 server → auto-restart → **`TypeError: setCodeFrameRenderer is not a function` + "Mismatching @next/swc version, detected: 16.1.3 while Next.js is on 16.4.5" → server crash → server=000000 route=000000** from this point | dev.log lines 27–45 (captured before truncation) |
| 18 | 11:56:41 / 11:57:41Z | Monitor commit `a1a4ae2`; platform sweep `3f91941` (ledger only — 1 commit ahead, unpushed) | git |
| 19 | 12:04:33Z | **TURN 2B investigation begins (this session, read-only)** | this report |
| 20 | 12:17:48Z | Scheduled backstop fire (job 516197, concurrent turn, same instance): STARTED 12:18:26.034Z → `gitState=SAFE_SNAPSHOT_AHEAD` (the T2A classifier correctly admitting the unpushed sweep commit) → db plane **pre-recovery observation: `chainTip=3969`, `customRows=12395`, `recoveryDeficit=16364`, `diskTip=20333`, `publishedTip=20333`** → server 000000 → **`remediated=yes` (watchdog relaunched)**; heartbeat 12:19:34.500Z ALERT; commit `817d06a` pushed | ledger (both entries survived); git |
| 21 | 12:18–12:23Z | **Sanctioned organic recovery**: watchdog v4 chain (guard → source-integrity heal [upload route restored, `routeState=present`] → **db-selfheal: forward-only restore from the published h20333 dump at 12:22:19.263Z** → `next dev` v16.4.5 at 12:23Z). chain.db grows 9.1MB → 45.6MB | ps (watchdog PIDs 2644/2647/2648 @12:18; next-server PID 3034 @12:23); db meta `selfheal_at`; file sizes |
| 22 | 12:26–12:33Z | **Verified recovered**: server `http 200`, `/api/health` 200, upload route `403` (intended fail-closed contract), chain `MAX_HEIGHT 20352 → 20375 → 20410` (integrity `ok`), custom 18,041 rows, staging write-behind refreshed (`.staging/latest-chain.sql`, 37,541,680 bytes @12:29), git `HEAD == origin/main == 817d06a` | live probes (this report §5–§9) |

**When exactly did live change from h20333 to h3945?** Provably inside (03:23:49Z, 06:18:43Z); most probably at the first stale-image boot after the prior session's instance died (the 05:17:49Z sandbox-death marker bounds it). The exact first-event timestamp is **not provable** — earlier selfheal-archive evidence was destroyed by subsequent re-images (the archive tree is untracked), and backstop ledger FINAL entries were wiped by turn-boundary resets.

---

## 2. Every database identity and physical path

### 2.1 Local operational databases (both canonical, both held by the live server process)

| Database | Canonical absolute path | Engine | Identity |
|---|---|---|---|
| Chain | `/home/z/my-project/db/chain.db` | SQLite (libsql client / bun:sqlite read probes) | `chain_id=mtq-devnet-1`, genesis `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d`, 12 tables + `votes` + `sqlite_sequence` |
| Custom | `/home/z/my-project/db/custom.db` | SQLite via `DATABASE_URL=file:/home/z/my-project/db/custom.db` (`.env`, sole variable) | 13 user tables (AiModelCatalog, ConsensusRun, ConsensusVote, DailyStateVector, IssuanceEvent, MbzBackingCertificate, MbzBank, MbzMintRequest, MetricSample, OracleSample, PilotTrial, RebalancingDecision, ScoringUpload) |

Path resolution: `canonicalRoot()` (`src/lib/db-ops.ts` lines 90–98: MTQ_SIGMA_ROOT override → cwd unwrap for `.next/standalone` → module-tree resolution) with `assertRootOutsideBuildOutput()` (Incident-5/6 guard). `.next/standalone` does **not exist** in this instance — no bundled DB copy is possible; all observed writers/readers resolved to the canonical `db/` paths (process mapping §7).

### 2.2 Snapshot / recovery layer

| Artifact | Path | State at investigation |
|---|---|---|
| Published chain dump | `backups/db-snapshots/latest-chain.sql` | 37,424,272 bytes; sha256 `7a870c5b70d822d310e417fb1850ebb5e32b102e5790b4be22474a20fa04fef4` (**matches manifest**); tip line `rows=41134 height=20333 tables=12 [accounts:14 blocks:20333 events:20554 …]`; header `@ 2026-11-09T03:18:10.187Z`; terminates `COMMIT;` (complete) |
| Published custom dump | `backups/db-snapshots/latest-custom.sql` | 14,436,291 bytes; sha256 `7e02d41a7325c6e703ee5032260e15a0083cf4f363e7dcbe46c7d69297804c6e` (**matches manifest**); tip `rows=18077 height=- tables=13 [AiModelCatalog:101 ConsensusRun:50 ConsensusVote:146 DailyStateVector:2614 …]` |
| Manifest | `backups/db-snapshots/manifest.json` | v2, `generatedAt 2026-11-09T03:20:20.357Z`, chain height 20333, genesis `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d`, both sha256s, byte sizes, dumpFormat 2 |
| Staging write-behind | `backups/db-snapshots/.staging/` | Absent at 12:04Z (wiped by the re-image — gitignored); **recreated 12:29Z by the current code's write-behind** (37,541,680 bytes, refreshed from the recovered live DB) |
| Self-heal archives | `mtq-sigma-backups/selfheal-archive/` | `20261109T115337928Z-chain/` (**empty** — chain.db had been deleted, nothing to archive); `20261109T115342033Z-custom/` (221,184-byte stub — the documented re-image signature); `gitdrift-2026-11-09T11-56-20Z/` (drift realignment archive, incl. **byte copies of the stale dumps**: chain 7,381,956 bytes, custom 8,915,620 bytes) |
| Sentinel | `db/ALLOW-GENESIS-RESET` | Inactive (`resetSentinelActive:false` in the git-state record) |

### 2.3 Cloud operational databases — **UNVERIFIED (current)**

This environment's `.env` contains only `DATABASE_URL=file:…custom.db` — no Turso, Neon, Vercel, or Inngest credentials. The last independently verified cloud state is Incident 21 (2026-11-09T02:00–02:05Z probes, `cloud-layer-evidence.md`): Vercel HTTP 402 / deployments disabled since Oct 28; Turso production token HTTP 401; Neon mirror alive but frozen at 2026-10-29T02:01Z; Inngest event key live. Nothing in the current environment contradicts or updates those findings; per the preventive invariant, absence of a live probe = UNVERIFIED, never healthy.

---

## 3. The h20333 snapshot — independent verification

1. **Hash:** recomputed sha256 of `latest-chain.sql` = `7a870c5b…fef4` — matches manifest. Same for custom (`7e02d41a…4c6e`). ✓
2. **Manifest version:** 2, structurally complete (chain + custom sections, genesis, heights, rows, bytes, dumpFormat). ✓
3. **Genesis identity:** `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d` present in the dump content (byte grep) and in the manifest; identical to the live DB's `meta.genesis_hash`. ✓
4. **Chain id:** `mtq-devnet-1` in block headers throughout. ✓
5. **Source database identity:** header line names `/home/z/my-project/db/chain.db @ 2026-11-09T03:18:10.187Z` — the canonical live chain of the healthy 03:18Z instance. ✓
6. **Creation timestamp:** 03:18:10.187Z (dump) / 03:20:20.357Z (manifest), consistent with the healthy ledger entry (03:18:05Z: live 20333, disk 20271 pre-flush; the write-behind flushed to h20333 before/at dump time). ✓
7. **Completeness:** terminates `COMMIT;`; tip line is self-consistent (rows=41134 = Σ table counts incl. blocks:20333). ✓
8. **Max block height:** 20333 (tip line `blocks:20333`; independently `MAX(height)` from the restored DB = 20333 at restore time, now >20333 with new blocks). ✓
9. **Parent-hash continuity:** spot-verified at the splice point — the dump's block at height 3941 is `blk_21a8f6e0613a0e63c09d05d71c1b08551f51cf93f6a86f820ef0a2ad48f7ac16`, **byte-identical to the stale-image dump's and the pre-recovery live DB's block 3941** (see §5). A full block-by-block continuity walk of all 20,333 blocks was not performed (out of read-only scope); the successful verified restore (integrity + exact-tip check inside `restoreDbFromDump`) plus the node resuming and appending on top constitute the operative verification. ◐ (spot-verified)
10. **Block-hash continuity:** same basis as (9). ◐
11. **Database integrity:** the 12:22:19Z restore's built-in verification passed (integrity + exact tip 20333); live DB now reports `PRAGMA integrity_check = ok`. ✓
12. **Independent reconstructibility:** **proven live** — the 12:22:19.263Z db-selfheal restored `db/chain.db` from exactly this file and the node resumed cleanly (h20333 → h20410+ with no gaps; `MAX(height) == COUNT(blocks)`). ✓
13. **Same authoritative chain as the live database?** **Yes** — identical genesis, identical chain_id, byte-identical block at the shared splice height 3941. h20333 is the *newer* state of the *same* chain; the regressed live DB was an older re-growth of the same chain. ✓

**Verdict on h20333:** the authoritative verified state (not stale, not foreign, not inconsistent — its database had genuinely reached h20333 at 03:18–03:20Z and the publication pipeline sha256-committed it).

---

## 4. The live h394x database — independent inspection (pre-recovery state)

Probed read-only (bun:sqlite `readonly: true`) at 12:07Z, before the 12:22Z recovery:

- `MAX(height)` = **3969**, `COUNT(blocks)` = 3,969 (contiguous; genesis at height 1)
- `meta`: `genesis_hash = gen_3baf0dba…` (same as snapshot ✓), `chain_id` in headers `mtq-devnet-1` ✓, **`boot_mode = "self-healed"`, `selfheal_at = "2026-11-09T11:53:41.959Z"`, `selfheal_dump = "latest-chain.sql"`** — durable in-database proof of the heal event and its timestamp
- `custom.db`: 12,395 total rows, per-table counts **byte-identical to the Nov-6 stale dump** (DailyStateVector 664, OracleSample 3984, RebalancingDecision 7747, AiModelCatalog/ConsensusRun/ConsensusVote **absent** — those tables post-date the image), `integrity_check = ok`
- Block h3941 hash `blk_21a8f6e0613a0e63…` = the h20333 dump's block 3941 (same chain ✓); blocks 3942–3969 carry **current** timestamps (11:53:42–11:56:27Z), `num_txs=0`, empty tx roots — ephemeral re-growth
- The reported h3945 (heartbeats 06:20–10:20Z) vs probed 3969: h3945 was the per-instance probe-time value; 3969 = this instance's growth before the crash. Consistent.

**Answers to §7's questions:** (1) h3945 was the actual DB tip at observation time (not cached, not stale query, not wrong database — the backstop reads `MAX(height)` directly from `db/chain.db`); (5) it was a *complete, valid, contiguous* chain — simply an older state plus ephemeral empty blocks; (6) no missing/invalid blocks (integrity ok, counts contiguous).

**The oscillation h3945 → h3942 → h3945 → h3944 → h3945 with constant rows:** each hourly backstop fire ran in a *different* platform instance re-provisioned from the same stale image; each instance re-restored the DB to **h3941** at its boot (the Nov-6 dump), the node appended 1–4 blocks before the instance's server crashed/was torn down at turn end, and the probe read the variable result (3941+1…3941+4). Rows stayed 12,395 because custom.db was re-restored to the identical Nov-6 content every time and telemetry writes were minimal. **Non-monotonic tips across fires = per-turn restore-to-3941 + variable small growth — one mechanism, not reorgs, not multiple live DBs, not read inconsistency.**

---

## 5. Record-level differences (live regressed vs published authoritative)

| Measure | Live (pre-recovery, 12:07Z) | Published snapshot | Δ |
|---|---|---|---|
| Chain blocks | 3,969 | 20,333 | −16,364 (deficit observed 16364 at 12:18Z; 16388 at 06:18Z on h3945) |
| Chain rows (all tables) | ~8,374 (8,346 dump + 28 re-grown) | 41,134 | −32,760 |
| Custom rows | 12,395 | 18,077 | −5,682 (incl. 3 whole tables absent: AiModelCatalog 101, ConsensusRun 50, ConsensusVote 146; DailyStateVector 664 vs 2614) |
| Genesis | `gen_3baf0dba…` | `gen_3baf0dba…` | identical |
| Chain id | `mtq-devnet-1` | `mtq-devnet-1` | identical |
| Block @ h3941 | `blk_21a8f6e0613a0e63…` | `blk_21a8f6e0613a0e63…` | identical |

The 16,388-height difference is therefore **fully explained**: 20,333 (authoritative) − 3,945 (restored Nov-6 tip + growth) = 16,388; the same chain, older state, restored by stale code from a stale dump.

Minor recorded deltas (honest notes, not material): live customRows at the healthy 03:18Z ledger = 18,146 vs the 03:18:10Z dump = 18,077 (+69, write-timing); post-recovery live count = 18,041 vs dump 18,077 (−36, telemetry churn around restore).

---

## 6. Genesis and chain identity reconciliation

- Genesis hash `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d`: identical in (a) live `db/chain.db` meta, (b) the published h20333 dump, (c) `manifest.json`, (d) the stale Nov-6 dump (via the restored DB's meta and the boot log line `genesis=gen_3baf0dba552b527da4…`). One chain, one identity across all states. ✓
- The h20333 chain contains the Nov-6 tip block byte-identically (h3941 above) — the Nov-9 chain is a strict continuation of the Nov-6 state. ✓
- **A larger published height was never treated as authority by proof alone** — authority is established by sha256 + manifest + genesis + ancestry (§3) and forward-only rules (§8); and the *regression* itself was never sanctioned: no code path ever chose h3941 *over* h20333 with knowledge of both — h3941 was chosen by code that could only see h3941.

---

## 7. Runtime process mapping (all active processes → database paths)

**Current (post-recovery, 12:23Z+):**

| PID | Process | DB paths held (fd scan) |
|---|---|---|
| 3034 | `next-server (v16.4.5)` | `/home/z/my-project/db/chain.db` (4 fds) + `/home/z/my-project/db/custom.db` — **canonical** ✓ |
| 3022 / 3060 | `next dev` launcher / turbopack pool | (children of the server) |
| 2644/2647/2648 | `bash dev-watchdog.sh` (since 12:18Z) | watchdog chain owner (guard → source-integrity → db-selfheal → next dev) |

**During the investigation window (12:04–12:18Z):** no `next`/`bun`/watchdog processes at all — the server was dead (crashed 11:56Z); probes of port 3000 returned connection-refused (`http_code=000`). This is precisely why the backstop's `server=000000 route=000000`: the HTTP planes are `curl -m 5` probes (GET `/` expecting 200; POST `/api/constituency/upload` expecting **403**, the route's intended fail-closed auth contract); `000000` = no HTTP response (process absent), *not* a probe malfunction and not a route-authorization failure. With the server up, both probes now return their contract values (200 / 403) and `routeState=present` (the drift realign restored the upload route file that the image had deleted — drift MANIFEST: `deleted-origin-wins src/app/api/constituency/upload/route.ts`).

**During the stale window (11:53–11:56Z):** the platform's own `next dev` (image runtime, Next 16.1.3) — process gone by investigation time; identity established by dev.log banner + version-mismatch crash signature + image-era package.json (`next ^16.1.1`). It was the process whose instrumentation ran the stale self-heal (§1 row 14).

**`canonicalRoot()` callers verified:** `src/lib/db-ops.ts` (ROOT for dumps/self-heal/cloud-sync), `src/lib/chain/store.ts` (chainDb — the writer), `src/lib/chain/genesis.ts` — all resolve to `/home/z/my-project`; `assertRootOutsideBuildOutput()` active; `.next/standalone` absent. **No two processes were found reading/writing different database copies in this instance.** The historical dual-DB hazard (Incident 6, bundled copy) is structurally absent here.

---

## 8. Recovery-metric audit (implementation vs observed)

Implementation (`scripts/plane5-run.sh` plane 2, python3 readout; `src/lib/db-ops.ts` probes):

- `liveTip` = `SELECT MAX(height) FROM blocks` on `db/chain.db` — direct file read, not cached, not via the server. ✓
- `customRows` = Σ `COUNT(*)` over custom tables (matches my independent probe exactly: 12,395). ✓
- `publishedTip` = tip line of the dump at HEAD; `committedTip` = origin's dump; `diskTip` = staged-else-published. ✓
- `unbackedAhead = max(0, live − published)`; `recoveryDeficit = max(0, published − live)`.

Arithmetic verified on four independent data points: 03:18Z (live 20333, published 20209 → unbacked 124, deficit 0 ✓); 06:18Z (20333−3945 = 16388 ✓); 07:18Z (20333−3942 = 16391 ✓); 12:18Z (20333−3969 = 16364 ✓). **The metric implementation is correct and the deficit was real.** The comparison is same-chain, same-database-class (both `db/chain.db` states of the same genesis — §6), so `recoveryDeficit = publishedTip − liveTip` is a valid like-for-like comparison here.

**A larger published height is NOT interpreted as permission to overwrite the live DB** in the plane logic: the backstop never auto-restores; only `selfHealDatabases()` restores, only when the dump is strictly ahead, and it archives the regressed file first (forward-only, rollback-prevention). `unbacked=0` means "live is not ahead of published" — correct in the regressed state. The metrics distinguish valid-live-ahead (unbacked>0, deficit 0) from valid-snapshot-ahead (deficit>0); different-chain/different-identity cases are separated by the manifest genesis/sha verification (fail-closed when a manifest exists — see F-2 below for the missing-manifest gap).

**Latent defects discovered during this audit (NOT the cause of today's incident — the incident ran pre-T2A code — but directly relevant to §10's checklist; fix requires operator authorization, none applied by this investigation):**

- **F-1 (fail-closed claim not enforced):** `bestRecoverySource()` returns the published source *with* a note (`manifest verification FAILED` / `incomplete` / `unreadable`), `selfHealDatabases()` logs "recovery from it refused (fail-closed)" (lines 608–610) — but the restore branch (line 611 `if (chainTip && chainDumpH > liveChainH)`) does **not** gate on the note and would still restore from the flagged dump. The warning's claim and the code's behavior diverge.
- **F-2 (missing manifest ⇒ no verification, not fail-closed):** when `manifest.json` is absent, the published dump is treated as usable without any genesis/sha verification (`if (manifest && usable) {…}` — manifest null skips validation). §10 requires "a missing snapshot manifest never permits restoration"; the current self-heal does not enforce that.
- **F-3 (detection gap, monitoring):** monitor fires do not probe the DB plane; during 03:55–05:55Z the regression existed while the monitor reported `PLANE_5_OK` (fresh OK heartbeat) and an age-based alert — the db-plane deficit was invisible until the first backstop DB probe at 06:18Z (~3h detection bound, worsened by the gateway-rejected 04:17Z fire and the sandbox-dead 05:17Z fire).

---

## 9. Server and route failure — diagnosis

- **`server=000000`** = `curl -m 5 http://localhost:3000/` got no HTTP status (connection refused) — the dev server process was absent (crashed). Root cause of the crash: the 11:56:20Z drift realignment swapped tracked files and node_modules under the *running* image-runtime server (16.1.3) to the current versions (package 16.4.5) → dev-server hot restart → `TypeError: setCodeFrameRenderer is not a function` with `⚠ Mismatching @next/swc version, detected: 16.1.3 while Next.js is on 16.4.5` → process death. (dev.log captured verbatim before its per-boot truncation by `tee dev.log`.)
- **`route=000000`** = same cause (no server). It is **not** a 403-misinterpretation: 403 is the *expected* pass value for the upload route's fail-closed auth gate; with the server up it returns 403 (verified 12:33Z) and the plane records `routeState=present`.
- Distinguishing verdict: *server down* (process absent) — not "started but not ready", not DB-connection failure (routes don't gate on DB for the probe), not watchdog-unavailable (watchdog plane is a separate `ps` check; it was also dead 11:56–12:18Z and was relaunched by the backstop remediation), not probe malfunction (curl semantics verified live).
- The server was up and serving 200 during 11:53–11:56Z (stale code), dead 11:56–12:23Z, and healthy since 12:23Z (200 / health 200 / route 403).

---

## 10. Automatic recovery mechanisms — inventory and behavior in this incident

| Mechanism | Trigger | Behavior in this incident |
|---|---|---|
| Instrumentation boot self-heal (`ensureChainNode` → `selfHealDatabases`) | server boot | **Executed the regression at 11:53:41.959Z** — image code (pre-T2A: no drift guard, no manifest gate) restored stale dumps. In *current* code this is gated on the drift verdict (guard-before-heal, `src/instrumentation.ts` [0]) — the fix that the image's code predates. The same code path, run with current code, is what **recovered** the DB at 12:22:19Z (via watchdog) |
| Watchdog v4 boot chain (guard → source-integrity heal → db-selfheal → next dev) | launched by plane-5 remediation (server≠200 or watchdog dead) | Launched 12:18Z by the scheduled backstop fire; executed the sanctioned recovery order; server up 12:23Z |
| In-process 60s tick (staging write-behind + threshold publication + source sweep + drift guard) | running server | Armed in current code (log line "[guard] in-process … loop armed"); refreshed `.staging/` at 12:29Z |
| Snapshot publisher (`scripts/snapshot-publish.ts`, manifest v2, atomic) | threshold / repair | Not implicated; its 03:20Z output (h20333) was correct and is what recovery restored from |
| `db-selfheal.ts` CLI | manual/watchdog | The recovery executor (12:22Z) |
| Sentinel `ALLOW-GENESIS-RESET` | operator | Inactive — genesis re-seed path not taken (verified: live DB has the canonical genesis, `mode=RESUME`) |
| Forward-only rules in `cloudSyncRefresh` (refuse dump-over-better-live) | write-behind | Held — the stale dumps were never *written* over anything; they were *restored from* (the inverse direction) |

**§10 checklist verdicts:** an invalid DB never silently became empty (restore-or-stand-down semantics held); no recovery timeout granted authority (timeouts were not involved); a missing manifest did not permit restoration *in this incident* (the incident pre-dates manifests — but see F-2 for the current-code gap); a different database identity did not pass (same genesis everywhere); a lower chain height never *replaced* a higher validated state *by decision* — it was restored by code that could not see the higher state (the distinction that makes this a platform-ordering failure, not a logic failure); multiple recovery processes did not run concurrently (backstop lock + watchdog flock held; the only concurrency observed was the investigation's read-only probes against the recovering DB, which surfaced as a transient `SQLITE_BUSY` on one probe — no write attempted by the investigation).

---

## 11. Root-cause determination

**Proven root cause (confidence: high — direct forensic capture):**

> The platform re-provisions sandbox instances from a **stale base image frozen at the task-46 era** (local HEAD `9fe4058`, Next 16.1.x, working-tree dumps from 2026-11-06T14:03:46Z at chain h3941/custom 12,395 rows) and **starts its own dev server directly on that image** (no watchdog v4, no external bootstrap). The image's pre-T2A instrumentation runs `selfHealDatabases()` immediately at boot — before any git realignment to origin/main — and restores the just-wiped canonical `db/` files from the image's three-day-stale dumps. The live database is thereby re-based ~16,392 blocks behind the sha256-verified published snapshot. When realignment later occurs (first plane-5 fire of the turn), it flips code and dependencies under the running stale server, which crashes on the version mix (server=000000), and the cycle repeats at every re-provisioning (tip oscillation h3941–h3969, rows constant 12,395).

**Lowest responsible architectural layer:** the **platform's sandbox provisioning** — (a) the stale base image, and (b) the direct `next dev` start with no pre-boot realignment hook (Incidents 1/2's documented platform limitation). This is *below* the repository: every in-repo defense (drift-guard-before-heal, manifest-gated recovery, watchdog ordering, forward-only rules) is correct and committed, but cannot execute in a process generation whose code predates it. **No monitoring metric, application code, or snapshot-publisher defect caused the regression — those layers all behaved correctly once running current code** (the db plane's ALERT was *true*; the publisher's h20333 snapshot was *correct*; the recovery, once current code ran, was *correct*).

**Classification of candidate causes:**

| Candidate | Verdict |
|---|---|
| Actual database state regression (live DB replaced by older state) | **Proven** (the effect) — mechanism as above |
| Platform re-image restoring stale image + direct server boot + pre-guard self-heal | **Proven root cause** (dev.log + db meta + drift MANIFEST + reflog + archived stale dumps + version-mix crash signature) |
| Pre-T2A heal lacking manifest/authority verification | **Contributing factor** (the defect that made the stale restore possible; fixed in code since `48da9bc`, ineffective inside the stale image) |
| Database-path divergence / wrong database identity / multiple writers on different files | **Ruled out** (single canonical path set; fd scan; no `.next/standalone`; genesis identical) |
| Snapshot publication or restoration error (h20333 bad) | **Ruled out** (sha256/manifest/ancestry/reconstructibility all verified; the snapshot is the *recovery source*) |
| Chain-tip metric inconsistency / stale or cached readings | **Ruled out** (direct file reads; arithmetic verified; oscillation explained by per-instance restores) |
| Watchdog misbehavior | **Ruled out as cause** (watchdog was simply absent during the stale boots; when launched, it *performed the recovery correctly*) |
| Cloud-layer influence (Turso/Neon/Vercel) | **Ruled out as cause** (no credentials present; local files only; cloud state UNVERIFIED but not involved in local restore) |

**Recurrence class:** third documented occurrence of the Incident-1/2/4 family (2026-11-08T22:47:59Z — identical h3941-from-task46-image signature recorded in `src/instrumentation.ts` [0]; Incident 4's h17,661→h4,028; today's h20333→h3941).

---

## 12. Data-loss assessment

- **Authoritative chain state: zero permanent loss.** The h20333 state was fully preserved (sha256-verified) in the published snapshot and was restored bit-consistently (block h3941 byte-identical; node resumed and extended).
- **Permanently lost (bounded, immaterial):** (a) any in-memory chain growth beyond h20333 in the dying prior session (~03:23Z) that post-dated the 03:20Z publication — bounded by the write-behind window (minutes of chain; the last pre-flush disk tip was h20271, the publication captured h20333, so the bound is the tail of the 03:20–03:23Z window); (b) the ephemeral re-grown blocks 3942–3969/3941–3945 of the regressed instances — all `num_txs=0`, no transactions, no economic content.
- **Custom telemetry: zero permanent loss** — the Nov-9 03:18Z state (18,077 rows) was preserved in the published custom dump and restored; the regression temporarily *hid* 5,682 rows (12,395 vs 18,077) for ~9h.
- **Temporary unavailability, not loss:** during 06:18–12:22Z the *live* system served a 16,392-block-older chain view. No monetary/supply/reserves/governance/consensus state was altered (blocks were empty; rewards disabled per chain_params `rewards_enabled:0`).

---

## 13. Recoverability assessment — and the recovery that already happened

**Recoverability: proven, live.** The sanctioned forward-only recovery executed *organically during this investigation* (no investigation action involved):

1. 12:17:48Z scheduled backstop fire (job 516197; ledger STARTED + FINAL 12:18:26.034Z; `gitState=SAFE_SNAPSHOT_AHEAD`; pre-recovery observation tip 3969/deficit 16364; `remediated=yes`; heartbeat 12:19:34.500Z ALERT; commit `817d06a` pushed).
2. 12:18Z watchdog v4 launched → guard → source-integrity heal (upload route restored) → **db-selfheal restore from the published h20333 dump: `selfheal_at=2026-11-09T12:22:19.263Z`** (durable db meta) → `next dev` v16.4.5 at 12:23Z.
3. Verified end-state (12:33Z): server 200, health 200, upload route 403, chain `MAX_HEIGHT 20410` (`integrity_check ok`, contiguous), custom 18,041 rows, `.staging/` refreshed (37,541,680 bytes), `HEAD == origin/main == 817d06a`.

The 12:19:34Z heartbeat still records the pre-recovery ALERT (`recoveryDeficit 16364`) — the next heartbeat will confirm deficit≈0 and the alert should clear.

---

## 14. Unresolved evidence requirements

1. **Exact first-event timestamp** of the regression inside (03:23:49Z, 06:18:43Z) — not provable: earlier selfheal-archive generations and backstop ledger FINAL entries were destroyed by subsequent re-images/turn resets. Bounded by the 05:17:49Z sandbox-death marker.
2. **Platform provisioning order** (image restore → server boot → git sync) is reconstructed from mtimes/reflog/archives, not directly observable from inside the sandbox.
3. **Whether/when the platform base image will be refreshed** — determines recurrence; platform-controlled.
4. **Cloud layer current state** — UNVERIFIED (no credentials); Incident 21 evidence remains the latest verified assessment.
5. Minor count deltas: +69 (live vs dump, 03:18Z) and −36 (post-restore vs dump) custom rows — write-timing/churn; a one-time recount under operator authorization would close them.
6. Full block-by-block parent-hash walk of the 20,333-block dump (spot-verified at the splice point and via the verified restore; a complete walk was outside read-only scope).

---

## 15. Recommended remediation (all gated on operator authorization; NOTHING was changed by this investigation)

- **R-0 (none required for the database):** no manual restoration is needed or permissible — the sanctioned mechanism already forward-recovered the live DB to ≥h20333 (restoring anything now would be older-over-newer, forbidden). Verification-only follow-up: confirm the next heartbeat records `recoveryDeficit=0` and `result` clears to OK as planes pass.
- **R-1 (platform/operator — the actual root cause):** refresh the sandbox base image so any re-provisioned instance carries at least the `48da9bc`-era instrumentation (drift-guard-before-heal) and the T2A manifest-gated recovery; or add a platform pre-boot realignment hook before starting `next dev`. This is the only change that eliminates the class at its source; it cannot be performed from inside the repository.
- **R-2 (repo hardening, small, pre-authorized review):** enforce fail-closed in `selfHealDatabases()` — gate the restore branch on the unusable-note (**F-1**) and treat a missing manifest as fail-closed for published-dump recovery (**F-2**). Isolated regression tests for both.
- **R-3 (monitoring):** add a lightweight DB-deficit read to the monitor contract (**F-3**) so a regressed DB cannot hide behind a fresh heartbeat for ~3h; and consider surfacing `boot_mode=self-healed`/`selfheal_at` from chain meta in the heartbeat planes (it proved to be the single most valuable forensic field).
- **R-4 (cloud):** when credentials are restored to this environment, run `bun run scripts/cloud-db-probe.ts --turso/--neon` to close the UNVERIFIED gap (Incident 21 tracking).

**Repair plan (per §15 of the directive — presented, NOT executed):** source-of-truth to preserve = published h20333 snapshot (already the recovery source); target = live `db/` files (already recovered); proven authority = §3; exact records affected = none remaining; data-loss risk of the completed recovery = none (forward-only, regressed file archived); backup requirement = the git-published snapshot itself + the drift-archive byte copies (all present); rollback plan = the pre-recovery state is preserved in the selfheal-archive stub + archived stale dumps if ever needed; isolated test = the live recovery itself was executed by the sanctioned chain, not by hand. **Operator approval is still required before any further operational-database action; none is proposed.**

---

## 16. Phase acceptance (§14 checklist)

| # | Criterion | Verdict |
|---|---|---|
| 1 | Actual current Git baseline verified | ✓ origin/main `817d06a` (verified again at report time; earlier: `a1a4ae2` + unpushed sweep `3f91941` correctly classified `SAFE_SNAPSHOT_AHEAD` by the live fire) |
| 2 | Every operational database identified | ✓ §2 |
| 3 | Live h3945 database independently inspected | ✓ §4 (pre-recovery probe + meta) |
| 4 | Published h20333 snapshot independently inspected | ✓ §3 (sha256 recomputed, tip, genesis, splice-block identity, live reconstructibility) |
| 5 | Database and chain identities reconciled | ✓ §6 (one genesis, one chain_id, byte-identical splice block) |
| 6 | 16,388-height difference explained | ✓ §5 (stale Nov-6 dump h3941 restored by pre-T2A heal vs published h20333) |
| 7 | Height oscillation explained | ✓ §4 (per-instance restore-to-3941 + variable growth; rows constant by construction) |
| 8 | Every active process's DB path verified | ✓ §7 (fd scan; canonical paths only; no dual-DB hazard) |
| 9 | Server and route failure diagnosed | ✓ §9 (process-absent curl 000; version-mix crash cause; 403 = intended contract) |
| 10 | Every automatic recovery mechanism identified | ✓ §10 (+ latent F-1/F-2 disclosed) |
| 11 | Cloud database state assessed or marked UNVERIFIED | ✓ marked UNVERIFIED with latest verified evidence cited (Incident 21) |
| 12 | Defensible root-cause report delivered | ✓ §11 (proven, contributing, ruled-out; lowest responsible layer identified) |
| 13 | No operational database modified (by this investigation) | ✓ all probes `readonly:true`; the 12:18–12:23Z recovery was the scheduled fire + watchdog (ledger evidence), not the investigation |

**Phase verdict: PHASE_2B_COMPLETE** (all 13 criteria met; items 6/7/11 carry the honest caveats stated above).

---

## 17. Compliance statement

Read-only operations performed: `git fetch` (remote-ref update only), `git show/log/reflog` (reads), file reads (`cat`/`head`/`tail`/`rg`), read-only SQLite probes (`bun:sqlite` `readonly:true` with busy timeout; one transient `SQLITE_BUSY` from the concurrent platform recovery proved a live writer existed — no write was attempted), HTTP GET/POST probes of the already-running server (200/403 observations only). **No:** restore, overwrite, reseed, truncate, delete, WAL/journal touch, migration, initialization, self-heal invocation, recovery-cursor change, snapshot publication, restart/re-image, competing recovery, Git reset/force-push, or monetary/governance/consensus/crypto state change — was performed by this investigation. Forensic evidence preserved: the drift archive (incl. stale dump byte copies), selfheal-archive stubs, db meta `selfheal_at` fields, ledger, and this report. dev.log's pre-truncation crash content is preserved verbatim in §1/§9 of this report (the file rotates per server start via `tee`).

**Production remains unauthorized. TESTNET ONLY · SHADOW MODE.**
