# Task 16-d — Database + Data-Integrity Audit (mandate §7)

**Agent:** Audit Agent 16-d · **Date:** 2026-10-23 · **Mode:** READ-ONLY (evidence probes in `audit-work/task16/probes/`; the only DB writes were 4 clearly-labeled rows inserted via the app's own write path — `audit-16d-dbtrace`, `=16d-csv-inject-test`, `audit-16d-conc-a/b` — as mandated for write-path tracing).

**Environment:** Prisma 6.11.1 + SQLite, `DATABASE_URL = file:/home/z/my-project/db/custom.db` (local file, no token). Client: `src/lib/db.ts` — module singleton via `globalThis` (dev); for `file:` URLs a classic-engine `PrismaClient({ datasources })` is used (the `@prisma/adapter-libsql` path is only for `libsql://`); no reconnect logic; local file ⇒ no pool exhaustion. DB file: 2.85 MB, no `-wal`/`-shm` present. Dev server: `next dev` (Next 16.1.3) via watchdog, port 3000, up throughout.

---

## A. Schema ↔ DB reconciliation

All 9 Prisma models exist as tables; **column sets match the schema exactly (0 drift)**; all declared `@@index` and `@unique` constraints exist. Verified via `sqlite_master` + `PRAGMA table_info` + `PRAGMA index_list/index_info` (probe: `probes/dbscan.ts`).

| Model | Table | Cols (schema=stored) | Declared indexes | Unique | Rows @ audit end |
|---|---|---|---|---|---|
| PilotTrial | ✓ | 18 = 18 | wallet, status, chain, createdAt | — (id PK) | 5 |
| MetricSample | ✓ | 12 = 12 | createdAt, status | — | **0 (dead)** |
| DailyStateVector | ✓ | 34 = 34 | tickAt, status | — | 411 |
| RebalancingDecision | ✓ | 22 = 22 | tickAt, shouldRebalance | — | 4,734 |
| OracleSample | ✓ | 18 = 18 | tickAt, pair, paused | — | 2,460 |
| IssuanceEvent | ✓ | 13 = 13 | requestId, kind, state, createdAt | — | 14 |
| MbzMintRequest | ✓ | 20 = 20 | bank, state, createdAt, jurisdiction | requestId | 0 |
| MbzBackingCertificate | ✓ | 11 = 11 | bank, verified, custodianAttestationExpiry | certificateId | 0 |
| MbzBank | ✓ | 11 = 11 | isAuthorized, jurisdiction | address | 0 |

- 38 index objects total (9 PK autoindexes + 4 unique + 25 declared). Everything the schema declares exists on disk.
- Storage types: `DATETIME` columns hold **ms-epoch UTC integers** (e.g. `1792784697971`); `BOOLEAN` 0/1; `REAL` Float64; `BIGINT` for Mbz nonce/expiry.
- **No relations/FKs anywhere** (9 standalone tables) — no FK orphans possible, no referential integrity enforced (Mbz mirrors reference banks by address with no constraint).

### Migration discipline (honest)
- **`prisma/migrations/` does not exist.** The project uses `db:push` = `prisma db push --accept-data-loss` (package.json). `db:migrate` (`prisma migrate dev`) and `db:reset` scripts exist but have never produced a migration. Implication: no migration history, no reproducible schema timeline, and the standard workflow explicitly accepts data loss. Currently schema↔DB are in sync, so no *live* drift — but any future `db push` with a destructive change will silently drop audit-trail data (see E/16d-015 for evidence this already happened once today).

---

## B. Data-quality findings

Counts (end of audit): PilotTrial 5 · MetricSample 0 · DSV 411 · RD 4,734 · OS 2,460 · IssuanceEvent 14 · Mbz* 0+0+0.

**PilotTrial** (5 rows, all from today, all `ok=1`):
- 3 pre-existing (16-a's 1e15 EMERGENCY-mint residue `cmvldpy7n…`) + 4 inserted by this audit (labeled). No duplicates by (type,chain,inputAmount,second): 0 groups. No negatives, no future/1970 timestamps.
- `reason` is NULL on 100% of rows; `ok` is 1 on 100% of rows — **failed trials are never persisted** (route gates the insert on `resp.mint?.ok` / `resp.redeem?.ok`; live-proven: a failed redeem attempt "Insufficient circulating supply" wrote no row). The `ok`/`reason` columns are effectively dead.
- `basketJson` written only for REDEEM (NULL on all MINTs — by design in the routes).
- Float precision: the 1e15 row shows float artifacts (`outputAmount 848490511601428.5`); `reserveRatio` 0.9907 stored with `status NORMAL` (risk machine advanced next tick — honest snapshot-of-the-moment, no defect).

**MetricSample: 0 rows — dead table.** No runtime code writes or reads it (grep whole repo: only scripts/ + inngest backup list + the schema comment). RUNBOOK.md's "populated by keeper" is **false** (keeper `mini-services/keeper/index.ts` has no Prisma/DB writes); the schema comment's "dashboard sparklines read the latest N samples" is **false** (zero readers; charts are synthetic-labeled).

**DailyStateVector / RebalancingDecision / OracleSample:**
- Timestamps all sane (UTC ms, no future/1970 in live tables). 5 DSV rows record the 19:45–19:47 EMERGENCY episode (RR 0.9907) — while **other rows at the same wall-clock seconds record NORMAL / RR=0 (genesis)** — the multi-writer contradiction (16d-002).
- Infinity handling: 384/389 early DSV rows have `reserveRatio=0 OR lcr=0` — the documented `fin()` coercion ("0 = N/A at genesis"); no NaN/Inf can be stored (NOT NULL + Prisma strips non-finite).
- OS: 6 pairs × 388 batches, all `filtered-mean`, 0 paused, 0 negative prices.

**IssuanceEvent** (14 rows, all from 16-a's single POST demo, 13 ms span): money fields are exact 6-decimal strings where applicable (`10000.000000`/`10.000000`/`9990.000000`/`4995.000000`), empty-string for not-applicable lifecycle events (PROGRAM/ATTESTATION/early states) — **not** format violations; all payloads valid JSON; `supplyAfter` monotonic 0→4995.000000. Clean.

### §24.2/§24.4/§18.3 hash chain — VERIFICATION FAILED (top finding, root cause live-proven)
Independent recomputation `rowHash = sha256(prevHash ‖ JSON(payload))` per the committed formula (git 77edda7, the only version that ever had the chain):

| Table | Rows (chained) | Exact match | ±1 ULP | ±3 ULP | Note |
|---|---|---|---|---|---|
| DailyStateVector | 412 | **18 (4.4%)** | +177 (48%) | **+386 (98%)** | 8 residual failures (multi-writer era cross-snapshot) |
| RebalancingDecision | 3,192 | **26 (0.8%)** | +1,465 (47%) | — | using the raw-Infinity reserveRatio semantics (24 exact) |

**Root cause (live-proven in the app's own write path):** the Prisma→SQLite write path **lossily rounds Float64 to ~16 significant decimal digits**. Mint API returned `mtqPrice 1.1773827143799516`; the DB row stores `1.177382714379952` (16 digits — a different double). The chain hashes the raw in-memory doubles; the DB stores the rounded ones → ~95% of rows fail bit-exact recomputation and only verify with ULP tolerance, which **defeats tamper-evidence** (an attacker altering a value within the rounding envelope is indistinguishable). The 18 exact rows are those whose doubles happened to have ≤16-digit shortest reprs.

**Chain-linkage defects** (independent of the rounding):
- 1,435+ RD rows (MARP advisory) carry NULL prevHash/rowHash; `latestRowHash` returns `""` whenever the newest row is a MARP row → **193 observed chain resets to the genesis hash** (MARP batches land every 60 s on top of the chain). The schema claim "two rows never share a predecessor" is false in practice.
- Multi-writer era produced cross-writer prevHash links (8 DSV linkage breaks besides resets).
- Prune deletes OLDEST rows → chain head survives but the anchor's predecessor is deleted (disclosed in UI as windowed retention — OK by design).

**Multi-writer evidence (16d-002):** at 18:54:26.942/.943/.945 three DSV rows with identical `tickCount=1` were written within 3 ms — three engine tick loops born at server start (ensureStore has no mutex; concurrent first requests each build a store + `startLoop`; loser intervals are never cleared). Write rates 18:54→19:49 were ~2.8× the single-loop rate (DSV 334/h vs 120/h; RD 3,871/h vs ~1,140/h; OS 1,998/h vs 720/h), and the 1e15 mint mutated only ONE instance (EMERGENCY rows alongside NORMAL rows at the same seconds). Post-restart (19:49:44) the server runs a single loop (one row per ~32 s, tc=1→385+). Root cause is the **ensureStore create-race**; in dev, Next 16 worker/compilation topology multiplies it.

---

## C. Write/read path traces (live evidence)

**Write trace — MINT 100** (`POST /api/simulate/mint`, wallet `audit-16d-dbtrace`): route → `applyTrial` → `applyMint` (sync) → `pilotTrial.create` (only if `mint.ok`). Response `mtqMinted 84.84921579013552`; DB row `cmvlem6kb…` `outputAmount` **exact match** ✓, `ok=1` ✓. But `mtqPrice`/`gfbIndex`/`nav` stored as `1.177382714379952` / `1112794.858967335` vs API `1.1773827143799516` / `1112794.8589673354` — **the live proof of the 16-digit storage rounding** (16d-001/16d-012).

**Write trace — REDEEM 50** (wallet `=16d-csv-inject-test`): response `netUsd 654749.0096891944`, 7-component basket; DB row `cmvlemdrp…` `outputAmount` exact ✓, `basketJson` (896 bytes) **deep-equal to the API response basket** ✓, `ok=1` ✓. (Note the engine economics: 50 MTQ redeemed for $654,749 because per-token NAV ≈ $13.1K at 34.8 circulating — genesis-supply artifact, engine-side, recorded honestly.) A first redeem of 100 MTQ failed ("Insufficient circulating supply") and **wrote no row** — failed trials are invisible to the DB audit trail (16d-004).

**Read paths:**
- `/api/trials?limit=N`: orderBy `createdAt desc` + `take` enforced in Prisma (no post-filtering) — but **no filter/sort/pagination params exist at all** (no wallet/status/chain filter despite the schema comments claiming those indexes serve `/api/trials/export → where: {wallet}` — the actual export has no wallet filter; 3 of 4 PilotTrial indexes are unused by any runtime query). `limit=abc` → `Math.min(NaN,200)=NaN` → Prisma throws → misleading `"Database not available on this deployment"` with HTTP 200 (DB is fine — 16a P2 confirmed from the DB side).
- `/api/trials/export?format=csv`: take ≤ 5000 (bounded size); header injection N/A (fixed header); **formula injection live-verified** — my labeled row exports as `"=16d-csv-inject-test"` (quote-escaping only; no `=`/`+`/`-`/`@` neutralization) → executes as a formula in Excel/Sheets (16d-005).
- MetricSample: no writer, no reader (see B).
- IssuanceEvent: written by the Prisma sink (`ledger.ts`) on every issuance event (14/call); read by `GET /api/issuance` (last 50 + count).
- **DSV/RD/OS have NO application read surface**: readers are only the chain writer itself (`latestRowHash`), `pruneAuditTrail`, and the inngest backup function (which 500s — broken; and only takes 100 rows/table anyway). No API exposes the §24 audit trail (16d-009).

**Concurrency (mandate step 8):** 2 parallel mints of 100 fired simultaneously: A applied on pre-state (supply 34.849→119.695), B applied on post-A state (119.695→204.541); post-metrics supply = B's reported `newCirculatingSupply` **exactly** → **no double-apply/lost update**. Mechanism: after `await ensureStore()`, `applyTrial`'s snapshot+`applyMint`+snapshot run as one synchronous block (single-threaded event loop) → trial mutations are effectively serialized. Both rows persisted (162 ms apart, both `ok=1`). The genuine concurrency defect is the **ensureStore create-race** (multi-loop, 16d-002), not supply math.

**Persistence across restarts:** DB file persists (16-a's 19:44 row survived the 19:49:44 restart; all rows from both eras coexist). Engine state resets to genesis on restart (in-memory) — the DB is a log/mirror, nothing reads it back into the engine.

---

## D. Defect list

| ID | Severity | Finding | Evidence | Minimal fix |
|---|---|---|---|---|
| 16d-001 | **HIGH** | §24.2/§24.4 integrity hash chain unverifiable from stored data: 95.6% DSV / 99.2% RD rows fail the published sha256 recomputation; root cause = Prisma→SQLite write path rounds Float64 to ~16 sig digits while the chain hashes raw in-memory doubles (98% of DSV verify only within ±3 ULP — tolerance defeats tamper-evidence) | B table above; live proof: API `1.1773827143799516` → stored `1.177382714379952`; probes `dbhash-*.ts` | Hash canonicalized values (round-trip doubles through the same serialization before hashing, or store the exact payload TEXT and hash that, or move money to fixed-point TEXT like IssuanceEvent) |
| 16d-002 | **HIGH** | Up to 3 concurrent engine tick loops (ensureStore create-race; loser intervals never cleared) wrote contradictory simultaneous audit rows (NORMAL/RR=0 next to EMERGENCY/RR=0.9907 at 19:45–19:47) at 2.8× single-loop rates | 3 DSV rows tc=1 within 3 ms at 18:54:26; per-hour rates; EMERGENCY/NORMAL same-second rows | Single-flight promise guard in `ensureStore`; tear down losing intervals |
| 16d-003 | MEDIUM | MARP advisory rows (NULL hashes) reset the RD chain: 193 observed resets to genesis hash (latestRowHash returns "" when newest row is MARP); "two rows never share a predecessor" is false | RD probe counts (1,435 NULL-hash rows, 193 post-MARP resets) | Filter `rowHash NOT NULL` in `latestRowHash`, or chain MARP rows too, or move them to their own table |
| 16d-004 | MEDIUM | PilotTrial audit-trail gap: only ok=true trials persisted; `ok` (always 1) and `reason` (always NULL) are dead columns; failed/unsuccessful trials invisible to the DB audit trail | Route code gates `if (resp.mint?.ok)`; live: failed redeem wrote no row; 100% reason-NULL across rows | Persist failed attempts (ok=false + reason), or drop the columns |
| 16d-005 | MEDIUM | CSV formula injection live-verified in `/api/trials/export` (free-text wallet exported verbatim with `=` prefix; only quote-escaping) | Labeled row `"=16d-csv-inject-test"` in export output | Neutralize leading `=`,`+`,`-`,`@` (prefix `'` or wrap per OWASP) |
| 16d-006 | MEDIUM | **No backup of the live local DB exists.** The 2026-10-23T12:55Z artifacts (sqlite byte-copy + JSON dump, SHA-256s in `backups/BACKUP-MANIFEST-2026-10-23.md`) are GONE from the filesystem; no cloud remote was ever configured (manifest says nothing was pushed). `scripts/backup-turso.ts` targets Turso only (creds unset) and there is no local-file backup script | `backups/` contains only the manifest; glob for `mtqsigma-*2026*` → 0 hits | Scheduled local `VACUUM INTO`/`.backup` + offsite push; restore-test |
| 16d-007 | MEDIUM | Backup coverage gaps: `backup-turso.ts` + inngest backup list only 5 tables — IssuanceEvent, MbzBank, MbzBackingCertificate, MbzMintRequest excluded; inngest "backup" also takes only 100 rows/table | scripts/backup-turso.ts TABLES; inngest/functions.ts:47-49,65 | Include all 9 models, full dumps |
| 16d-008 | MEDIUM | MetricSample is a dead table (0 rows; no writer, no reader); RUNBOOK ("populated by keeper") and schema comment ("sparklines read…") are both false | grep entire repo; keeper has no DB writes; 0 rows | Wire it or drop it (fix the docs either way) |
| 16d-009 | MEDIUM-LOW | §24 audit-trail tables have NO application read surface — no API/operator path exposes DSV/RD/OS; the UI's "checkable integrity" has no read path (transparency cards read the in-memory snapshot) | grep: only chain writer/pruner/broken-inngest read them | Add a read API + a verify endpoint that recomputes the chain |
| 16d-010 | LOW | Retention windows very short at pilot rates: caps RD 10k ≈ 8.8 h, DSV 5k ≈ 42 h, OS 5k ≈ 7 h of single-loop history (~3× shorter at observed multi-loop rates); PilotTrial & IssuanceEvent have NO cap/prune (IssuanceEvent +14 rows per unauthenticated POST — compounds 16a-001/003) | rate math from per-hour buckets; prune code caps | Size caps to intended windows; add IssuanceEvent cap |
| 16d-011 | LOW | `audit-retention-test.ts` runs against the LIVE DB (imports `@/lib/db` → custom.db): inserts 12,000 synthetic 1970-dated rows and triggers real prunes (deleting real audit rows); running it per its own header mutates production data | test source lines 30-142 | Point the test at a temp DB file |
| 16d-012 | LOW | Float64 for all monetary values (PilotTrial/DSV/RD/OS/Mbz*): 1e15-scale rows show float artifacts (`848490511601428.5`), and the 16-digit storage rounding means stored values can differ from engine truth by 1-3 ULP; IssuanceEvent's exact 6-decimal TEXT is the correct pattern this repo already has | 1e15 row; 16d-001 live proof | Migrate money columns to fixed-point TEXT/INTEGER |
| 16d-013 | INFO | `/api/trials?limit=abc` → misleading "Database not available" (NaN take) with HTTP 200; no filters/sort/pagination beyond `limit`; 3 of 4 PilotTrial indexes (wallet/status/chain) serve no runtime query — schema comments describe queries that don't exist | live curl; route source; index list | NaN-guard the limit; drop or actually use the indexes |
| 16d-014 | INFO | Zero FK/relations across 9 tables — by design for mirrors; no orphan checks possible; noted for the record | schema | n/a (document) |
| 16d-015 | INFO | DB history discontinuity: earliest live row is 18:47:26Z today, while the 12:55Z backup manifest documented PilotTrial=2 / DSV=219 / RD=2,536 / OS=1,314 / IssuanceEvent=297 → the local DB was wiped/recreated between 12:55 and 18:47 (cause unlogged — consistent with environment rebuild or `db push --accept-data-loss`); pre-18:47 history lost locally AND the backup that held it is gone (16d-006) | row minima vs manifest | Log DB resets; keep immutable backups |
| 16d-016 | INFO | Migration discipline: no `prisma/migrations/`; workflow is `db push --accept-data-loss`; no schema history exists (currently in sync — no live drift) | prisma dir; package.json | Adopt `prisma migrate dev` for auditability |

**Positive results (honest):** schema↔DB fully in sync (0 drift); write/read path end-to-end exact for basketJson/outputAmount/ok; concurrency correctly serialized in supply math; no duplicates, no orphan possibility, no timestamp anomalies, no negative/NaN/Inf values in live tables; Infinity coercion convention (0 = N/A) applied consistently; IssuanceEvent data internally consistent (exact 6-decimal strings, monotonic supplyAfter, valid JSON payloads); prune machinery code-verified (caps/batches/5-min interval) though not yet triggered (counts below caps; RD will hit its 10k cap ≈ 03:30Z tonight at current rates).

---

## E. Mandate answers

1. **Does data persist across restarts?** YES for the DB file (SQLite at `db/custom.db`; rows from before and after the 19:49:44 restart coexist and were re-read). The in-memory engine resets to genesis on restart — the DB is an append-only log/mirror; nothing loads it back into the engine.
2. **Any integrity violations found?** YES: the §24.4 hash chain fails independent verification for ~95% of rows (root cause live-proven: lossy 16-digit float serialization, plus MARP-resets and multi-writer contradictions). Also: failed trials never recorded; one unlogged DB wipe lost all pre-18:47 history; no duplicate/orphan/FK violations (none possible — no constraints).
3. **Is growth bounded anywhere?** YES for the 3 audit-trail tables (pruneAuditTrail caps RD 10k / DSV 5k / OS 5k, batched 1,000, every 5 min) — but the windows those caps buy are ≈ 8.8 h / 42 h / 7 h at single-loop rate. NOT bounded: PilotTrial (human-triggered, slow) and IssuanceEvent (+14 rows per unauthenticated POST, no rate limit, no cap, excluded from backups). MetricSample: zero growth (dead).

**Suggested fix order:** 16d-001 (chain canonicalization) + 16d-002 (ensureStore mutex) first — both corrupt the §24 auditability story; then 16d-006/007 (backup), 16d-003/004/005 (chain MARP policy, failed-trial persistence, CSV neutralization), then the LOWs.

**Probe scripts (read-only):** `audit-work/task16/probes/dbscan.ts` (master scan), `dbhash-probe.ts` / `dbhash-brute.ts` / `dbhash-precision.ts` (chain forensics), plus /tmp one-offs documented here. No source files were modified; DB residue = 4 clearly-labeled PilotTrial rows via the app's own API.
