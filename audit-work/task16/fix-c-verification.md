# Task 16-fix-C — Data-Integrity Fixes: Verification Evidence

**Agent:** Fix Agent 16-fix-C (data integrity) · **Date:** 2026-10-23 (~20:35–20:50 UTC)
**Scope:** 16d-001 (HIGH, hash chain unverifiable), 16d-002 (HIGH, multi-engine write races), 16d-003 (MED, MARP chain resets), 16d-006/007 (MED, backups), 16d-008 (MED, MetricSample dead-table claim).
**Posture:** evidence-preserving — **zero historical rows rewritten, deleted or mutated**; all fixes are write-path/verify-path changes + new tooling + docs corrections.

Files changed (mine only): `src/lib/mtq/audit-trail.ts`, `src/lib/mtq/pilot-state.ts` (ensureStore area), `scripts/backup-sqlite.ts` (NEW), `scripts/check-audit-trail.ts` (chain-verify extension), `prisma/schema.prisma` (comment only), `RUNBOOK.md`, `backups/BACKUP-MANIFEST-2026-10-23.md` (appended entry), `audit-work/task16/probes/fix-c-canon-proof.ts` (NEW read-only evidence probe). NOT touched: `src/app/api/**`, `src/components/**`, engine/fx/rate-limit/brand/format, package.json, next.config.

---

## 1. 16d-001 — Canonical hashing (HIGH): FIXED, verified exact end-to-end

### Root cause recap (16-d, live-proven)
v2.0 hashed RAW in-memory Float64 doubles; the Prisma classic-engine wire protocol serializes Float64 to ~16 significant digits, so SQLite stores a *different double* than the one hashed (API `1.1773827143799516` → stored `1.177382714379952`). Recomputation from stored data failed for 95.6% DSV / 99.2% RD chained rows; only ±1-3 ULP tolerance "verified" (defeats tamper-evidence).

### Fix (write path + verify path share ONE canonicalization)
`src/lib/mtq/audit-trail.ts` v2.1:
- `canonNum(x) = Number.isFinite(x) ? Number(x.toPrecision(15)) : 0` — canonical 15-significant-digit serializer; `canonicalJson()` applies it to every numeric leaf of the hashed payload.
- Writers (`persistDailyStateVector`, `persistRebalancingDecision`, `persistMarpDecisions`) build the CANONICAL payload, hash it, and write the **same canonical values** to the hashed columns → the stored row reproduces `rowHash` bit-exactly.
- v2.1 semantics note (documented in code): RD `reserveRatio` is now hashed **fin-coerced** (0 at genesis), matching the stored value; v2.0 hashed the raw value (Infinity → JSON `null`) while storing 0 — a write/read mismatch the verifier's legacy variant undoes for old rows.
- New exported `verifyAuditChain()` (raw `@libsql` reads — bypasses the Prisma read rounding so forensics see exact stored bits; read-only) classifies every row: **verified** (exact, canonical — the only tamper-evident class), **legacy-float** (pre-fix: bit-exact or within a *bounded, documented* ±ULP search under v2.0 semantics — NOT counted as verified), **broken** (no variant reproduces), **unhashed** (NULL rowHash — pre-16d-003 MARP rows).
- Old rows were NOT migrated (evidence-preserving).

### Evidence A — mathematical stability of the canon (probe: `probes/fix-c-canon-proof.ts`, 13/13 PASS)
- The audit's two live-proof values canonicalize to values that survive the modeled wire rounding exactly: `1.1773827143799516 → canon 1.17738271437995` (raw would have stored `…52`); `1112794.8589673354 → canon 1112794.85896734`.
- **1,000,000 random doubles** (mantissas 1..10, exponents 1e-6..1e15, ± signs) through `RT16(v)=Number(v.toPrecision(16))`: `RT16(canon(v)) === canon(v)` — **0 violations** (write path) and `canon(RT16(canon(v))) === canon(v)` (read path).
- **110 adversarial near-power-of-10 mantissas** (9.99999999999999 etc. — the region where 16-digit serialization is most lossy): **0 violations**.
- Raw `@libsql` SQLite REAL write→read: bit-exact (6/6) — confirms the lossy hop is the Prisma wire, not SQLite storage, so the verifier's raw reads see true bits.
- In-memory writer↔verifier round-trip on a synthetic canonical payload through simulated storage: **EXACT hash match**.

### Evidence B — live end-to-end proof through the REAL Prisma→SQLite write path
Hot-reloaded the fixes into the running dev server (store re-init at **20:41:59Z**, see §2), let the natural engine tick write rows (cadence: DSV 30s, OS 30s, MARP 60s, RD advisory every ~4s tick — fresh rows within seconds, no forced runs), then re-verified from stored data:

| Table | rows | chained | **verified (exact, canonical)** | legacy-float (exact / tolerance-only) | broken | unhashed |
|---|---|---|---|---|---|---|
| DailyStateVector | 482 | 482 | **14** — every row written after the fix; span 20:41:59.510Z → 20:48:32.572Z; newest row verified | 445 (18 / 427) | 23 | 0 |
| RebalancingDecision | 5,564 | 3,835 | **155** — every row written after the fix; span 20:41:59.424Z → 20:48:36.495Z; includes MARP batch rows | 1,727 (29 / 1,698) | 1,953 | 1,729 |

- **100% of post-fix rows in both tables verify EXACTLY** (verified counts grow with every tick; all `broken`/`legacy-float` rows predate the fix).
- Legacy classification cross-check against **audit 16-d's own probes on the same live DB**: their `16d-ulp-all.ts` reports DSV `exact=23` (= my 18 legacy-exact + 5 canonical rows that also reproduce raw, as canon is a fixed point) and RD `exact=29` (= my 29 legacy-exact exactly); their RD ±1-ULP rescue 1,541 ⊆ my 1,698 tolerance-only. Consistent.
- Honest caveats, stated in the verifier output itself: `legacy-float` is **not** tamper-evidence (tolerance match only); `broken` on pre-fix rows is consistent with multi-field rounding beyond the bounded search (RD search is ±1 ULP on 6 float leaves per base, mirroring 16-d's published RD method; DSV search is ±3 ULP on {gfbIndex,mtqPrice,nav} × ±1 ULP on {circ,rr,lcr} per base — DSV `broken`=23 are pre-fix rows outside that bound, incl. the known multi-writer-era cross-snapshot rows; not evidence of tampering, and not rewritten).
- Operator surface: `bun run scripts/check-audit-trail.ts` (extended — prints counts + classification + honesty notes). The API read-surface gap (16d-009) remains open — `/api/evidence` and `/api/tests` do NOT verify the chain; routes are agent A/orchestrator-owned. **Note for orchestrator:** consider a `/api/audit-chain` route calling `verifyAuditChain()`.

---

## 2. 16d-002 — ensureStore create-race (HIGH): FIXED, single-flight

### Fix (`src/lib/mtq/pilot-state.ts`)
- `ensureStore` now SINGLE-FLIGHT: `globalThis.__MTQ_PILOT_INIT__` (in-flight promise) is claimed **synchronously before any await**; concurrent callers await the same construction. Rejection releases the slot (retry possible); all awaiters see the error.
- Construction extracted to `buildStore()` (no globalThis side effects) — the single-flight wrapper is the only construction path; `startLoop` runs exactly once, in the `.then()`.
- Teardown (`teardownStaleStore`): clears the stale store's interval **and every interval in a new `__MTQ_PILOT_LOOPS__` registry** before any await, drops the store + init guard, logs. Defense-in-depth against pathological double-starts.
- Defensive log lines (greppable): one per teardown, one per loop start.
- `STATE_SCHEMA_VERSION` 16 → **18** (17 = the fix itself; 18 = comment-only probe bump). The bump makes hot reload retire stores built by pre-fix module code — required so the live server actually starts writing canonical rows.

### Evidence (hot-reload live tests on the running dev server; no restart/build/tsc)
- **Re-init 1** (v16→v17, first request after edit): `dev.log` shows exactly one `stale pilot store torn down (schema v16 ≠ v17) … intervals cleared` + one `engine tick loop started (schema v17, tick 4000ms, single-flight guard active)`.
- **Re-init 2** (v17→v18, **6 parallel requests** fired into the rebuild window): all 6 → HTTP 200, and exactly ONE teardown + ONE loop-start (pre-fix code produced 3 loops from 3 concurrent arrivals — audit 16-d, 18:54:26.942/.943/.945). Log sequence shows the 6 requests queued on the in-flight init (render ~1.6s during the FX fetch) then all served by the single store.
- Totals in `dev.log`: `engine tick loop started` = **2**, `stale pilot store torn down` = **2** — one pair per re-init, none extra, despite 20+ concurrent requests fired across the session.
- Loop multiplicity from the data side (same method as the audit): v18 era DSV = **exactly 1 row per 30s window, 1 distinct tickCount per window**, monotonic single series (tc 1→9→17 at the 30s throttle) — vs the audit's 3-rows-in-3ms / 2.8× rate era.
- Health after each hot reload: `GET /` → 200; `/api/metrics` → 200, `status: NORMAL`.
- Chain continuity across re-inits: the first post-v18 DSV row threads `prevHash` onto the pre-v18 chain head (verified: `prev=dab7be40fd0e…` == pre-v18 head rowHash) — re-init does not reset the chain.
- Code-reasoning (as mandated, since interval handles can't be `ss`-inspected): JS is single-threaded — the stale-check, teardown and the synchronous claim of `__MTQ_PILOT_INIT__` all complete before the first `await` inside `ensureStore`, so no interleaving between check and claim is possible; the only `await`-to-publish gap is inside the shared promise, which every caller awaits. Orphan intervals are impossible because (a) only one store is ever constructed per init and (b) its handle is both stored on the store and registered in the globalThis loop registry that teardown clears.

---

## 3. 16d-003 — MARP rows reset the chain 193× (MED): FIXED, same-chain threading

**Policy choice (documented in code):** ONE chain per table. MARP advisory rows are decisions too (§24.4 covers every rebalancing decision, advisory or not), and the existing schema's single nullable `prevHash`/`rowHash` pair fits one-chain-per-table with **zero migration** — smaller change than a separate MARP series (which would need a series discriminator and an interleaved dual-chain verifier).

**Changes** (`persistMarpDecisions`): batch head chains onto `latestRowHash("rebalancingDecision")`; rows thread sequentially within the batch (row k hashes with prev = row k−1's hash); `tickAt` stamped `batchNow+i` (1 ms apart) so intra-batch order is recoverable and `latestRowHash` deterministically returns the batch tail; payloads use the SAME canonical shape as `persistRebalancingDecision` (every field derivable from the stored row → one verifier formula for all RD rows). Belt-and-braces: `latestRowHash` now filters `rowHash NOT NULL`, so legacy NULL-hash MARP rows at the table head can never again yield `""` and reset the chain.

**Evidence (live DB, read-only):** post-fix MARP rows: **35 written, 0 NULL rowHash, 0 genesis prevHash**; post-fix RD rows with `prevHash=''`: **0** (was 193 resets pre-fix); post-fix DSV rows with `prevHash=''`: **0**; batch tickAt stagger confirmed (…3671,…3672,…3673,…3674,…3675,…3676,…3677); intra-batch linkage confirmed (row k prevHash == row k−1 rowHash for the whole batch); a post-fix MARP row recomputed from stored columns reproduces its `rowHash` EXACTLY (canonical). Legacy NULL-hash MARP rows (1,729) are frozen as `unhashed` — classified, counted, not rewritten.

---

## 4. 16d-006/007 — Backups (MED): NEW all-9-table local backup, run once

**New file:** `scripts/backup-sqlite.ts` — dumps ALL 9 Prisma models (adds `IssuanceEvent` + 3 `Mbz*` mirrors missing from the 5-table Turso list) via Prisma, `createdAt ASC`, to one timestamped JSON under `backups/`, with per-table row counts and a SHA-256 manifest line. BigInt→string, Date→ISO; artifact self-documents the as-of-snapshot caveat (engine live during dump; each table one consistent SELECT).

**Real artifact produced (run once, 20:42:35Z):**
- Path: `backups/sqlite-backup-20261023T204235Z.json` (8.07 MB)
- SHA-256: `56b59907f4d48019bc3114d1797760ca55f5eebad30b9b770fabd700be8ed917`
- Rows: PilotTrial=10 · MetricSample=0 · DailyStateVector=470 · RebalancingDecision=5,426 · OracleSample=2,814 · IssuanceEvent=28 · MbzMintRequest=0 · MbzBackingCertificate=0 · MbzBank=0 · **total=8,748**
- Gitignore: already covered by the existing `/backups/*` rule (verified with `git check-ignore`; no .gitignore change needed).
- Manifest: dated entry with SHA-256 + counts + honest gaps appended to the tracked `backups/BACKUP-MANIFEST-2026-10-23.md` (repo convention: manifests tracked so fingerprints live in the audit trail).
- Command (NOT wired into package.json — orchestrator-owned; suggested entry `"db:backup": "bun run scripts/backup-sqlite.ts"`): `bun run scripts/backup-sqlite.ts`
- Honest gaps that REMAIN: no schedule, no offsite push (no cloud remote exists in this environment), no restore-test yet. Also noted for orchestrator (out of my ownership): the inngest "daily-backup" function is still the broken 500s / 5-table / 100-row version (`src/lib/inngest/functions.ts`).

(Concurrent-work note: PilotTrial/IssuanceEvent counts grew during my session — Fix Agent A's failed-trial persistence work on `/api/simulate`; their rows are untouched by me and captured as-is in the backup.)

---

## 5. 16d-008 — MetricSample dead-table claim (MED): FIXED in both claim sites

- `RUNBOOK.md` §2.1, **before:** "2. `MetricSample` — dashboard metric ticks (currently 0 — populated by keeper)"
  **after:** "2. `MetricSample` — **deprecated/reserved** (currently 0 rows — NO writer and NO reader; the keeper does not write it and dashboard sparklines render in-memory engine history; audit 16d-008. Kept in the dump for completeness/restore fidelity)"
- `prisma/schema.prisma` (comment-only, zero schema/DB impact), **before:** "The dashboard sparklines read the latest N samples by createdAt, and the risk-status filter narrows by status. Both would full-scan at scale (the pilot-state tick loop writes one row per ~4s → ~21k rows/day)."
  **after:** "DEPRECATED / RESERVED (audit 16d-008, 2026-10-23): this table currently has NO writer and NO reader — 0 rows. The earlier claims were false … Retained as a reserved table; the indexes below are kept for whenever a writer is actually wired. Do not present this table as a live data source."
- No writer was wired (per mandate). RUNBOOK also gained §2.1.1 documenting the new local backup path (docs-accuracy, same file I was mandated to fix).

---

## 6. Residue & deferred (honest)

- Historical rows: **zero rewrites/deletes** — legacy-float/broken/unhashed classes are frozen evidence; pruning continues on the existing caps (windowed-retention posture unchanged).
- Deferred to other owners: package.json script entries (orchestrator); any API read surface for the chain / 16d-009 (agent A routes / orchestrator); inngest backup function (out of my file ownership); 16d-012 Float64→fixed-point money migration; 16d-011 retention-test still points at the live DB; offsite/scheduled backup push; prisma migrate discipline (16d-016).
- My DB writes: NONE. All DB work was read-only SELECTs + reading rows the live engine wrote through its own natural tick path. Evidence probe writes went to a throwaway `/tmp/fix-c-rt-*.db` only.
