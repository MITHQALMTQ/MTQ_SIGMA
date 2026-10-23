// MTQΣ — Chapter 24 Audit Trail Persistence (§24.1-24.3)
//
// Three async helpers that write rows into the Chapter 24 audit-trail tables:
//   - persistDailyStateVector  → DailyStateVector (§24.1, throttled 30s)
//   - persistRebalancingDecision → RebalancingDecision (§24.2, every eval)
//   - persistOracleSamples      → OracleSample (§24.3, throttled 30s, batched)
//   - persistMarpDecisions      → RebalancingDecision (§24.2 + §10 MARP per-component, throttled 60s)
//   - pruneAuditTrail           → retention cleanup (caps each table's row count)
//
// All persistence is best-effort: callers MUST wrap calls in try/catch so the
// engine tick loop keeps running even if the audit DB is unavailable. The
// Chapter 24 audit trail is logging-only — it MUST NOT change monetary
// behaviour.
//
// Schema reconciliation notes (the snapshot vs the DailyStateVector table):
//   - `pegHealth` is a {USD,EUR,GBP,JPY,CNY} map → stored as `pegHealthJson` (String).
//   - `ejectStage` on the snapshot is the per-currency map (ReserveState["ejectStage"]),
//     but the table column is a single `Int`. We store the MAX stage across
//     currencies as the worst-case severity indicator (an honest single-Int
//     summary of the per-currency ladder state).
//   - `reserveRatio` / `lcr` can be `Infinity` at genesis (no circulating supply
//     → liability = 0 → RR = NAV/0). SQLite cannot store Infinity/NaN, and
//     Prisma strips `Infinity` for non-nullable Float fields (validation treats
//     it as "missing"). We coerce non-finite values to 0 with a clear convention:
//     `reserveRatio = 0` in the audit log means "N/A — no circulating supply".
//     Once the first mint occurs, circulating supply > 0 and the real finite
//     ratio is persisted.
//   - All other fields are 1:1 with MetricsSnapshot; field-name adaptations
//     are commented inline.

import { db } from "@/lib/db";
import type { MetricsSnapshot, RebalanceDecision } from "./engine";
import type { OracleBoard } from "./oracle";

const DAILY_VECTOR_THROTTLE_MS = 30_000; // persist DailyStateVector at most every 30s
const ORACLE_SAMPLE_THROTTLE_MS = 30_000; // persist OracleSample batch at most every 30s
const MARP_ADVISORY_THROTTLE_MS = 60_000; // persist MARP advisory rows at most every 60s

// Module-level fallback for the MARP advisory throttle. The caller is
// supposed to pass `lastPersistedAt` and store the return value back into
// its PilotStore. If the caller is a stale tick closure from before the
// v13 schema bump (i.e. it doesn't have `lastMarpAdvisoryAt` on its store
// and calls `persistMarpDecisions(tickCount, snap)` with the OLD 2-arg
// signature, leaving `lastPersistedAt` undefined), the throttle would be
// bypassed because `now - undefined = NaN` and `NaN < 60_000` is `false`.
// To prevent that, we fall back to this module-level variable so the
// throttle still works even when the caller doesn't track the timestamp.
// This is a defensive measure for the dev-server hot-reload scenario
// where orphaned tick closures from a previous module version may still
// be running; in production (where there's only one engine and one
// module version) the caller always passes a valid `lastPersistedAt`.
// === §24.2/§24.4/§18.3 integrity chain (v2.1 — CANONICAL, fix 16d-001) ======
// Every DailyStateVector and RebalancingDecision row carries
//   rowHash = sha256(prevHash ‖ canonicalPayload)
// forming a per-table hash chain: retroactive edits break every subsequent
// row's hash. (The pilot's windowed retention remains disclosed — pruning
// removes OLDEST rows and therefore severs history; the UI states this.)
//
// v2.1 CANONICAL NUMERIC SERIALIZATION (audit 16d-001 fix, 2026-10-23):
// v2.0 hashed the RAW in-memory Float64 doubles. The Prisma classic-engine
// wire protocol serializes Float64 with ~16 significant decimal digits, so
// the double that comes back from SQLite ("1.177382714379952") is a
// DIFFERENT double from the one that was hashed ("1.1773827143799516") —
// independent recomputation failed for 95.6% of DailyStateVector and 99.2%
// of chained RebalancingDecision rows, and only verified within ±1-3 ULP
// tolerance (which defeats tamper-evidence). v2.1 fixes the root cause:
// every numeric leaf of the hashed payload is canonicalized to 15
// significant digits (Number(x.toPrecision(15))) — a fixed point of the
// 16-digit wire serialization — and the SAME canonicalized values are what
// get written to the hashed columns. Rows written by v2.1 therefore verify
// EXACTLY from stored data.
//
// HONESTY POSTURE (evidence-preserving): pre-v2.1 rows are NOT rewritten.
// `verifyAuditChain()` (bottom of this file) classifies every row as
//   verified     — exact match under canonical v2.1 semantics (post-fix rows)
//   legacy-float — pre-fix rows: bit-exact OR within a bounded ±ULP search
//                  under the v2.0 raw-double semantics (NOT counted as
//                  verified — tolerance is not tamper-evidence)
//   broken       — no variant reproduces the stored hash
//   unhashed     — rowHash IS NULL (pre-fix MARP advisory rows, 16d-003)
import { createHash } from "node:crypto";

// Canonical numeric serializer: round every finite double to 15 significant
// digits. Rationale (see header): a 15-significant-digit decimal parses to a
// double whose 16-digit serialization re-parses to the SAME double, so the
// value survives the Prisma→SQLite wire round-trip bit-exactly — on both the
// write path (client→engine) and the read path (engine→client).
// Non-finite values follow the §24 fin() convention (0 = "N/A at genesis").
export function canonNum(x: number): number {
  return Number.isFinite(x) ? Number(x.toPrecision(15)) : 0;
}

// Canonical JSON: serialize a payload with every numeric leaf canonicalized.
// Idempotent — canonicalizing an already-canonical payload is a no-op.
export function canonicalJson(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) =>
    typeof v === "number" ? canonNum(v) : v,
  );
}

function auditHash(prevHash: string, payload: unknown): string {
  const h = createHash("sha256");
  h.update(prevHash);
  h.update(canonicalJson(payload));
  return h.digest("hex");
}

async function latestRowHash(
  table: "dailyStateVector" | "rebalancingDecision",
): Promise<string> {
  // 16d-003 fix: consider only CHAINED rows (rowHash NOT NULL). Pre-fix
  // MARP advisory rows carry NULL hashes; without this filter the newest row
  // was often a MARP row, latestRowHash returned "" and the next writer reset
  // the chain to genesis (193 observed resets). With the filter the chain
  // head is always a real hash.
  const row = await (table === "dailyStateVector"
    ? db.dailyStateVector.findFirst({
        where: { rowHash: { not: null } },
        orderBy: { tickAt: "desc" },
        select: { rowHash: true },
      })
    : db.rebalancingDecision.findFirst({
        where: { rowHash: { not: null } },
        orderBy: { tickAt: "desc" },
        select: { rowHash: true },
      }));
  return row?.rowHash ?? "";
}

let LAST_MARP_PERSIST_AT_FALLBACK = 0;

// Retention caps — keep the audit-trail tables bounded so the SQLite file
// doesn't grow unbounded during a long pilot run. When a table exceeds its
// cap, the oldest rows (by `createdAt` descending sort, i.e. the rows that
// fall outside the most-recent MAX_* window) are deleted in batches of
// `PRUNE_BATCH_SIZE` to avoid locking the DB for too long.
const MAX_REBALANCING_DECISIONS = 10_000;
const MAX_DAILY_STATE_VECTORS = 5_000;
const MAX_ORACLE_SAMPLES = 5_000;
const PRUNE_BATCH_SIZE = 1_000; // delete in batches of 1000 to avoid locking

// Coerce non-finite numbers (Infinity/NaN) to 0 for SQLite Float storage.
// Used for `reserveRatio` / `lcr` / `postReserveRatio` which are Infinity at
// genesis (no circulating supply). See header for the convention.
function fin(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

// Worst-case eject stage across all currencies (0..4).
// Snapshot.ejectStage is a per-currency map; the table column is a single Int,
// so we collapse it to the max as the severity indicator.
function maxEjectStage(snap: MetricsSnapshot): number {
  const stages = Object.values(snap.ejectStage);
  return stages.length ? Math.max(...stages) : 0;
}

// §24.1 — Persist a DailyStateVector row from a snapshot. Throttled by tickAt.
// Returns the timestamp to use as the next `lastPersistedAt` (the prior value
// is returned unchanged when throttled, so callers can always assign the
// return value back to the store field).
export async function persistDailyStateVector(
  snapshot: MetricsSnapshot,
  tickCount: number,
  lastPersistedAt: number,
): Promise<number> {
  const now = Date.now();
  if (now - lastPersistedAt < DAILY_VECTOR_THROTTLE_MS) return lastPersistedAt;
  const prevHash = await latestRowHash("dailyStateVector");
  // 16d-001: build the CANONICAL payload first, hash it, and write the very
  // same canonicalized values to the hashed columns — the stored row then
  // reproduces rowHash bit-exactly (see verifyAuditChain below).
  const payload = {
    gfbIndex: canonNum(snapshot.gfbIndex), mtqPrice: canonNum(snapshot.mtqPrice),
    nav: canonNum(snapshot.nav),
    rr: canonNum(fin(snapshot.reserveRatio)), lcr: canonNum(fin(snapshot.lcr)),
    status: snapshot.status,
    circ: canonNum(snapshot.circulatingSupply), bufferState: snapshot.bufferState, tickCount,
  };
  const rowHash = auditHash(prevHash, payload);
  await db.dailyStateVector.create({
    data: {
      tickAt: new Date(now),
      tickCount,
      prevHash,
      rowHash,
      gfbIndex: payload.gfbIndex,
      mtqPrice: payload.mtqPrice,
      priceInBand: snapshot.priceInBand,
      navUsd: payload.nav,
      liabilityUsd: snapshot.liability,
      reserveRatio: payload.rr,
      lcr: payload.lcr,
      status: snapshot.status,
      circulatingSupply: payload.circ,
      totalSupply: snapshot.totalSupply,
      usdNet: snapshot.reserve.usdNet,
      eurNet: snapshot.reserve.eurNet,
      gbpNet: snapshot.reserve.gbpNet,
      jpyNet: snapshot.reserve.jpyNet,
      cnyNet: snapshot.reserve.cnyNet,
      chfNet: snapshot.reserve.chfNet,
      goldNet: snapshot.reserve.goldNet,
      fiatNet: snapshot.reserve.fiatNet,
      vix: snapshot.macro.vix,
      dxy: snapshot.macro.dxy,
      zVix: snapshot.macro.zVix,
      zDxy: snapshot.macro.zDxy,
      rawTheta: snapshot.macro.rawTheta,
      smoothedGoldWeight: snapshot.macro.smoothedTarget,
      targetGoldWeight: snapshot.targetGoldWeight,
      observedGoldWeight: snapshot.observedGoldWeight,
      bufferState: snapshot.bufferState,
      bufferGoldRatio: snapshot.bufferGoldRatio,
      ejectStage: maxEjectStage(snapshot),
      pegHealthJson: JSON.stringify(snapshot.pegHealth),
    },
  });
  return now;
}

// §24.2 — Persist one RebalancingDecision row (called when a rebalance is
// evaluated). `applied` indicates whether the trade was actually applied.
// `postTrade*` fields are filled only when `applied === true`.
export async function persistRebalancingDecision(
  tickCount: number,
  decision: RebalanceDecision,
  navUsd: number,
  reserveRatio: number,
  observedGoldWeight: number,
  targetGoldWeight: number,
  deviationPct: number,
  applied: boolean,
  postTrade?: {
    preGoldNet: number;
    postGoldNet: number;
    preFiatNet: number;
    postFiatNet: number;
    postReserveRatio: number;
    postObservedGoldWeight: number;
  },
): Promise<void> {
  // 16d-001: canonical payload — hash it and write the same canonical values
  // to the hashed columns. NOTE the v2.1 semantics change: reserveRatio is
  // hashed FIN-COERCED (0 at genesis), matching what is stored. v2.0 hashed
  // the raw in-memory value (Infinity → JSON null at genesis) while storing
  // 0 — a write/read mismatch that verifyAuditChain's legacy variant undoes.
  const payload = {
    tickCount,
    navUsd: canonNum(navUsd),
    reserveRatio: canonNum(fin(reserveRatio)),
    observedGoldWeight: canonNum(observedGoldWeight),
    targetGoldWeight: canonNum(targetGoldWeight),
    deviationPct: canonNum(deviationPct),
    applied,
    shouldRebalance: decision.shouldRebalance,
    direction: decision.direction,
    tradeUsd: canonNum(decision.tradeUsd),
    reason: decision.reason,
  };
  const prevHash = await latestRowHash("rebalancingDecision");
  const rowHash = auditHash(prevHash, payload);
  await db.rebalancingDecision.create({
    data: {
      tickAt: new Date(),
      tickCount,
      prevHash,
      rowHash,
      navUsd: payload.navUsd,
      reserveRatio: payload.reserveRatio,
      observedGoldWeight: payload.observedGoldWeight,
      targetGoldWeight: payload.targetGoldWeight,
      deviationPct: payload.deviationPct,
      shouldRebalance: decision.shouldRebalance,
      direction: decision.direction,
      tradeUsd: payload.tradeUsd,
      reason: decision.reason,
      blockedBy: decision.shouldRebalance ? null : decision.reason,
      applied,
      preGoldNet: postTrade?.preGoldNet ?? null,
      postGoldNet: postTrade?.postGoldNet ?? null,
      preFiatNet: postTrade?.preFiatNet ?? null,
      postFiatNet: postTrade?.postFiatNet ?? null,
      postReserveRatio: postTrade ? fin(postTrade.postReserveRatio) : null,
      postObservedGoldWeight: postTrade?.postObservedGoldWeight ?? null,
    },
  });
}

// §24.3 — Persist one OracleSample per pair (5 pairs per tick). Throttled by
// tickAt. Uses a single transaction so the 5 rows are atomic.
export async function persistOracleSamples(
  oracle: OracleBoard,
  tickCount: number,
  lastPersistedAt: number,
): Promise<number> {
  const now = Date.now();
  if (now - lastPersistedAt < ORACLE_SAMPLE_THROTTLE_MS) return lastPersistedAt;
  await db.$transaction(
    oracle.pairs.map((p) => {
      const chainlink = p.feeds.find((f) => f.source === "CHAINLINK");
      const pyth = p.feeds.find((f) => f.source === "PYTH");
      const chronicle = p.feeds.find((f) => f.source === "CHRONICLE");
      const discardReasons: Record<string, string> = {};
      p.feeds.forEach((f) => {
        if (!f.valid && f.discardReason) discardReasons[f.source] = f.discardReason;
      });
      return db.oracleSample.create({
        data: {
          tickAt: new Date(now),
          tickCount,
          pair: p.pair,
          chainlinkValid: chainlink?.valid ?? false,
          chainlinkPrice: chainlink?.price ?? 0,
          pythValid: pyth?.valid ?? false,
          pythPrice: pyth?.price ?? 0,
          chronicleValid: chronicle?.valid ?? false,
          chroniclePrice: chronicle?.price ?? 0,
          validCount: p.validCount,
          finalPrice: p.finalPrice,
          method: p.method,
          spreadBps: p.spreadBps,
          paused: p.paused,
          discardReasons:
            Object.keys(discardReasons).length > 0 ? JSON.stringify(discardReasons) : null,
        },
      });
    }),
  );
  return now;
}

// §10 + §24.2 — Persist MARP per-component decisions as RebalancingDecision rows
// (one row per component per tick). Each row encodes the MARP decision:
//   - shouldRebalance ← decision.shouldTrade
//   - direction        ← "buy"→+1, "sell"→-1, "hold"→0
//   - tradeUsd         ← decision.tradeUsd
//   - reason           ← `[MARP:{component}] {reason}`
//   - blockedBy        ← reason when !shouldTrade
// The shared decision-input fields (nav/RR/observed/target/deviation) come from
// the snapshot; per-component deviations are not stored separately (the
// `reason` field already encodes them textually).
//
// THROTTLED — called every tick (4s) but only persists at most every
// `MARP_ADVISORY_THROTTLE_MS` (60s). The throttle matches the DailyStateVector
// cadence so the audit-trail stays bounded without losing the per-component
// MARP picture. The function signature mirrors `persistDailyStateVector` /
// `persistOracleSamples`: callers pass the previous `lastPersistedAt` (0 = never
// persisted) and assign the return value back to the store field. When the
// throttle suppresses a write, the prior `lastPersistedAt` is returned
// unchanged so callers can always reassign. Returns the new `lastPersistedAt`
// timestamp (the prior value when throttled, `now` when persisted or when the
// snapshot has no MARP decisions to log this tick).
// 16d-003 fix (same-chain threading): MARP rows are now FIRST-CLASS links of
// the single §24.4 RebalancingDecision chain. v2.0 wrote them with NULL
// prevHash/rowHash, which (a) left 1,435+ rows outside the chain and
// (b) reset the chain head to genesis 193× once latestRowHash started
// returning "" whenever the newest row was a MARP row. Policy choice: ONE
// chain per table — MARP advisory rows are decisions too (§24.4 covers every
// rebalancing decision, advisory or not), and the existing schema's single
// nullable prevHash/rowHash pair fits one-chain-per-table with zero
// migration. Within a batch the rows thread sequentially (row k chains onto
// row k-1's hash); the batch head chains onto the table's previous head.
// tickAt is stamped batchNow+i (1 ms apart) so the intra-batch chain order
// is recoverable and `latestRowHash` deterministically returns the batch tail.
export async function persistMarpDecisions(
  tickCount: number,
  snapshot: MetricsSnapshot,
  lastPersistedAt: number,
): Promise<number> {
  const now = Date.now();
  // Defensive: if `lastPersistedAt` is not a finite number (e.g. undefined
  // because the caller is a stale tick closure from before the v13 schema
  // bump that didn't have `lastMarpAdvisoryAt`), fall back to the module-
  // level variable so the throttle still works. Without this, `now -
  // undefined = NaN` and `NaN < 60_000` is `false`, which would bypass the
  // throttle entirely. See LAST_MARP_PERSIST_AT_FALLBACK doc above.
  const lastTime =
    Number.isFinite(lastPersistedAt) && lastPersistedAt > 0
      ? lastPersistedAt
      : LAST_MARP_PERSIST_AT_FALLBACK;
  if (now - lastTime < MARP_ADVISORY_THROTTLE_MS) {
    return Number.isFinite(lastPersistedAt) && lastPersistedAt > 0
      ? lastPersistedAt
      : LAST_MARP_PERSIST_AT_FALLBACK;
  }
  const decisions = snapshot.marp?.decisions ?? [];
  if (decisions.length === 0) {
    LAST_MARP_PERSIST_AT_FALLBACK = now;
    return now;
  }
  const dir = (d: string): number => (d === "buy" ? 1 : d === "sell" ? -1 : 0);
  const batchNow = Date.now();
  let prevHash = await latestRowHash("rebalancingDecision");
  await db.$transaction(
    decisions.map((d, i) => {
      // 16d-001: canonical payload — same shape as persistRebalancingDecision
      // so the verifier recomputes every RD row with one formula. Every field
      // is derivable from the stored row.
      const payload = {
        tickCount,
        navUsd: canonNum(snapshot.nav),
        reserveRatio: canonNum(fin(snapshot.reserveRatio)),
        observedGoldWeight: canonNum(snapshot.observedGoldWeight),
        targetGoldWeight: canonNum(snapshot.targetGoldWeight),
        deviationPct: 0, // per-component deviation is encoded in `reason`
        applied: false, // MARP decisions are advisory in the pilot — not executed as trades
        shouldRebalance: d.shouldTrade,
        direction: dir(d.direction),
        tradeUsd: canonNum(d.tradeUsd),
        reason: `[MARP:${d.component}] ${d.reason}`,
      };
      const rowHash = auditHash(prevHash, payload);
      const rowPrevHash = prevHash;
      prevHash = rowHash; // thread the next batch row onto this one
      return db.rebalancingDecision.create({
        data: {
          tickAt: new Date(batchNow + i), // +i ms: stable intra-batch chain order
          tickCount,
          prevHash: rowPrevHash,
          rowHash,
          navUsd: payload.navUsd,
          reserveRatio: payload.reserveRatio,
          observedGoldWeight: payload.observedGoldWeight,
          targetGoldWeight: payload.targetGoldWeight,
          deviationPct: payload.deviationPct,
          shouldRebalance: d.shouldTrade,
          direction: payload.direction,
          tradeUsd: payload.tradeUsd,
          reason: payload.reason,
          blockedBy: d.shouldTrade ? null : d.reason,
          applied: false, // MARP decisions are advisory in the pilot — not executed as trades
          preGoldNet: null,
          postGoldNet: null,
          preFiatNet: null,
          postFiatNet: null,
          postReserveRatio: null,
          postObservedGoldWeight: null,
        },
      });
    }),
  );
  LAST_MARP_PERSIST_AT_FALLBACK = now;
  return now;
}

// §24 — Audit-trail retention cleanup. Caps each Chapter 24 table at a
// reasonable row count so the SQLite file stays bounded during a long pilot
// run. When a table exceeds its cap, the OLDEST rows (i.e. the rows that fall
// outside the most-recent MAX_* window when sorted by `createdAt` DESC) are
// deleted in batches of `PRUNE_BATCH_SIZE` (1000) to avoid locking the DB.
//
// Returns the number of rows deleted per table. Idempotent — calling it on
// tables that are already under their caps is a no-op (returns 0/0/0).
//
// Best-effort: callers MUST wrap in try/catch so the tick loop survives a
// prune failure (e.g. transient DB lock).
export async function pruneAuditTrail(): Promise<{
  rebalancingDecision: number;
  dailyStateVector: number;
  oracleSample: number;
}> {
  // RebalancingDecision — cap at MAX_REBALANCING_DECISIONS rows.
  const rdOldIds = await db.rebalancingDecision.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_REBALANCING_DECISIONS,
    take: PRUNE_BATCH_SIZE,
    select: { id: true },
  });
  const rd = rdOldIds.length
    ? await db.rebalancingDecision.deleteMany({
        where: { id: { in: rdOldIds.map((r) => r.id) } },
      })
    : { count: 0 };

  // DailyStateVector — cap at MAX_DAILY_STATE_VECTORS rows.
  const dsvOldIds = await db.dailyStateVector.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_DAILY_STATE_VECTORS,
    take: PRUNE_BATCH_SIZE,
    select: { id: true },
  });
  const dsv = dsvOldIds.length
    ? await db.dailyStateVector.deleteMany({
        where: { id: { in: dsvOldIds.map((r) => r.id) } },
      })
    : { count: 0 };

  // OracleSample — cap at MAX_ORACLE_SAMPLES rows.
  const osOldIds = await db.oracleSample.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_ORACLE_SAMPLES,
    take: PRUNE_BATCH_SIZE,
    select: { id: true },
  });
  const os = osOldIds.length
    ? await db.oracleSample.deleteMany({
        where: { id: { in: osOldIds.map((r) => r.id) } },
      })
    : { count: 0 };

  return {
    rebalancingDecision: rd.count,
    dailyStateVector: dsv.count,
    oracleSample: os.count,
  };
}

// === §24.4 chain VERIFICATION (16d-001 verify side) =========================
// Recomputes every stored row's hash FROM THE STORED COLUMN VALUES and
// classifies each row:
//   verified     — sha256(prevHash ‖ canonicalPayload) reproduces rowHash
//                  EXACTLY under the v2.1 canonical semantics (post-2026-10-23
//                  rows). This is the only class that counts as tamper-evident.
//   legacy-float — pre-v2.1 row: reproduces bit-exactly OR within a bounded
//                  ±ULP neighborhood search under the v2.0 raw-double
//                  semantics. Consistent with the documented Float64 storage
//                  rounding (audit 16d-001) — NOT counted as verified,
//                  because tolerance-matching is not tamper-evidence.
//   broken       — no variant reproduces the stored hash. For pre-fix rows
//                  this is consistent with multi-field rounding beyond the
//                  bounded search (or the multi-writer-era linkage defects
//                  16d-002) — not, by itself, evidence of tampering.
//   unhashed     — rowHash IS NULL: pre-16d-003 MARP advisory rows that were
//                  written outside the chain. Frozen historical residue.
//
// Reads go through the RAW @libsql driver (NOT Prisma): the Prisma wire
// protocol re-rounds Float64 to ~16 digits on read, which would perturb the
// forensics; raw SQLite reads return the exact stored double bits. READ-ONLY
// (SELECTs only) — safe to run against the live DB at any time.
//
// Search bounds (documented honestly, mirrors audit 16-d's method):
//   DailyStateVector     — exact over 4 fin-variant bases; then ±3 ULP on
//                          {gfbIndex, mtqPrice, nav} × ±1 ULP on {circ} per base.
//   RebalancingDecision  — exact over 2 raw-Infinity bases; then ±1 ULP on the
//                          6 float leaves per base.
export type ChainRowClass = "verified" | "legacy-float" | "broken" | "unhashed";

export interface ChainVerifyResult {
  table: "DailyStateVector" | "RebalancingDecision";
  rows: number; // total rows examined
  chained: number; // rows with rowHash NOT NULL
  verified: number; // exact under canonical v2.1 semantics
  legacyFloat: number; // pre-fix rows: exact-or-tolerance under v2.0 semantics
  legacyExact: number; //   subset of legacyFloat: bit-exact under v2.0 semantics
  legacyTolerance: number; // subset of legacyFloat: rescued by the bounded ±ULP search only
  broken: number; // no variant reproduces the stored hash
  unhashed: number; // rowHash IS NULL (pre-16d-003 MARP rows)
  firstVerifiedTickAt: number | null;
  lastVerifiedTickAt: number | null;
  newestRowTickAt: number | null;
  recentVerifiedIds: string[]; // last ≤5 verified row ids (iteration = createdAt ASC)
  notes: string[];
}

// --- ULP neighborhood helpers (bit-exact Float64 stepping) -------------------
const ulpView = new DataView(new ArrayBuffer(8));
function ulpUp(x: number): number {
  ulpView.setFloat64(0, x);
  let lo = ulpView.getUint32(4);
  let hi = ulpView.getUint32(0);
  if (hi === 0 && lo === 0) return 5e-324; // +0 → smallest denormal
  if (hi < 0x80000000) {
    if (lo === 0xffffffff) { hi++; lo = 0; } else lo++;
  } else {
    if (lo === 0) { lo = 0xffffffff; hi--; } else lo--;
  }
  ulpView.setUint32(0, hi);
  ulpView.setUint32(4, lo);
  return ulpView.getFloat64(0);
}
function ulpDown(x: number): number {
  return x === 0 ? -5e-324 : -ulpUp(-x);
}
/** [x, ±1 .. ±k ULP neighbors of x] — x first. */
function ulpNeighborhood(x: number, k: number): number[] {
  const out = [x];
  let up = x;
  let dn = x;
  for (let i = 0; i < k; i++) {
    up = ulpUp(up);
    dn = ulpDown(dn);
    out.push(up, dn);
  }
  return out;
}

// v2.0 legacy hash — raw JSON of the payload, exactly what the pre-fix
// writer fed to sha256.
function legacyHash(prevHash: string, payload: unknown): string {
  const h = createHash("sha256");
  h.update(prevHash);
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}

// Bounded product search: does ANY combination of candidate field values
// (fields given as [key, candidates] pairs) reproduce rowHash?
function toleranceSearch(
  prevHash: string,
  base: Record<string, unknown>,
  fields: [string, number[]][],
  rowHash: string,
): boolean {
  const dims: unknown[][] = fields.map(([, cands]) => cands);
  const idx = new Array(fields.length).fill(0);
  const payload: Record<string, unknown> = { ...base };
  for (let d = 0; d < fields.length; d++) payload[fields[d][0]] = dims[d][0];
  // iterate the full cartesian product (sizes: DSV ≤ 343·3, RD ≤ 729)
  for (;;) {
    if (legacyHash(prevHash, payload) === rowHash) return true;
    let d = fields.length - 1;
    for (;;) {
      idx[d]++;
      if (idx[d] < dims[d].length) {
        payload[fields[d][0]] = dims[d][idx[d]];
        break;
      }
      idx[d] = 0;
      payload[fields[d][0]] = dims[d][0];
      d--;
      if (d < 0) return false;
    }
  }
}

async function rawRows(url: string, sql: string): Promise<Record<string, unknown>[]> {
  const { createClient } = await import("@libsql/client");
  const isRemote = url.startsWith("libsql://") || url.startsWith("wss://");
  const client = createClient(
    isRemote ? { url, authToken: process.env.TURSO_AUTH_TOKEN } : { url },
  );
  try {
    return (await client.execute({ sql, args: [] })).rows as unknown as Record<string, unknown>[];
  } finally {
    client.close();
  }
}

async function verifyDsv(url: string): Promise<ChainVerifyResult> {
  const rows = await rawRows(
    url,
    `SELECT id, tickAt, prevHash, rowHash, gfbIndex, mtqPrice, navUsd, reserveRatio, lcr,
            status, circulatingSupply, bufferState, tickCount, createdAt
     FROM DailyStateVector ORDER BY createdAt ASC`,
  );
  const res: ChainVerifyResult = {
    table: "DailyStateVector", rows: rows.length, chained: 0, verified: 0,
    legacyFloat: 0, legacyExact: 0, legacyTolerance: 0, broken: 0, unhashed: 0,
    firstVerifiedTickAt: null, lastVerifiedTickAt: null, newestRowTickAt: null,
    recentVerifiedIds: [],
    notes: [
      "verified = EXACT sha256(prevHash ‖ canonical(v2.1) payload) from stored values",
      "legacy-float = v2.0 raw-double semantics: bit-exact over 4 fin-variant bases, else rescued within ±3 ULP on {gfbIndex,mtqPrice,nav} × ±1 ULP on {circulatingSupply,rr,lcr when finite} per base (bounded search; extends audit 16-d's DSV method with rr/lcr coverage for finite post-mint rows)",
      "legacy-float is NOT counted as verified — tolerance is not tamper-evidence",
    ],
  };
  for (const r of rows) {
    const gfb = Number(r.gfbIndex), mtq = Number(r.mtqPrice), nav = Number(r.navUsd);
    const rr = Number(r.reserveRatio), lcr = Number(r.lcr), circ = Number(r.circulatingSupply);
    const status = String(r.status), bufferState = String(r.bufferState);
    const tickCount = Number(r.tickCount);
    const prev = String(r.prevHash ?? "");
    const tickAt = Number(r.tickAt);
    res.newestRowTickAt = tickAt;
    if (r.rowHash === null || r.rowHash === undefined) { res.unhashed++; continue; }
    const rowHash = String(r.rowHash);
    res.chained++;
    // 1) canonical v2.1 semantics
    if (auditHash(prev, {
      gfbIndex: canonNum(gfb), mtqPrice: canonNum(mtq), nav: canonNum(nav),
      rr: canonNum(rr), lcr: canonNum(lcr), status, circ: canonNum(circ),
      bufferState, tickCount,
    }) === rowHash) {
      res.verified++;
      if (res.firstVerifiedTickAt === null) res.firstVerifiedTickAt = tickAt;
      res.lastVerifiedTickAt = tickAt;
      res.recentVerifiedIds.push(String(r.id));
      if (res.recentVerifiedIds.length > 5) res.recentVerifiedIds.shift();
      continue;
    }
    // 2) legacy v2.0 semantics — fin-variant bases (stored 0 may have been
    //    hashed as Infinity→null by the pre-fix writer at genesis)
    const base = { gfbIndex: gfb, mtqPrice: mtq, nav, rr, lcr, status, circ, bufferState, tickCount };
    const bases: Record<string, unknown>[] = [base];
    if (rr === 0) bases.push({ ...base, rr: Infinity });
    if (lcr === 0) bases.push({ ...base, lcr: Infinity });
    if (rr === 0 && lcr === 0) bases.push({ ...base, rr: Infinity, lcr: Infinity });
    let exact = false;
    for (const b of bases) {
      if (legacyHash(prev, b) === rowHash) { exact = true; break; }
    }
    if (exact) { res.legacyFloat++; res.legacyExact++; continue; }
    // 3) bounded ±ULP tolerance search (classification only — NOT verified).
    //    Field lists are built PER BASE: a base that models rr/lcr as Infinity
    //    (pre-fix writer hashed raw Infinity → JSON null) must keep it Infinity
    //    — varying it around the stored 0 would silently destroy that variant.
    let rescued = false;
    for (const b of bases) {
      const fields: [string, number[]][] = [
        ["gfbIndex", ulpNeighborhood(gfb, 3)],
        ["mtqPrice", ulpNeighborhood(mtq, 3)],
        ["nav", ulpNeighborhood(nav, 3)],
        ["circ", ulpNeighborhood(circ, 1)],
      ];
      if (Number.isFinite(Number(b.rr))) fields.push(["rr", ulpNeighborhood(Number(b.rr), 1)]);
      if (Number.isFinite(Number(b.lcr))) fields.push(["lcr", ulpNeighborhood(Number(b.lcr), 1)]);
      if (toleranceSearch(prev, b, fields, rowHash)) { rescued = true; break; }
    }
    if (rescued) { res.legacyFloat++; res.legacyTolerance++; continue; }
    res.broken++;
  }
  return res;
}

async function verifyRd(url: string): Promise<ChainVerifyResult> {
  const rows = await rawRows(
    url,
    `SELECT id, tickAt, prevHash, rowHash, navUsd, reserveRatio, observedGoldWeight,
            targetGoldWeight, deviationPct, applied, shouldRebalance, direction,
            tradeUsd, reason, tickCount, createdAt
     FROM RebalancingDecision ORDER BY createdAt ASC`,
  );
  const res: ChainVerifyResult = {
    table: "RebalancingDecision", rows: rows.length, chained: 0, verified: 0,
    legacyFloat: 0, legacyExact: 0, legacyTolerance: 0, broken: 0, unhashed: 0,
    firstVerifiedTickAt: null, lastVerifiedTickAt: null, newestRowTickAt: null,
    recentVerifiedIds: [],
    notes: [
      "verified = EXACT sha256(prevHash ‖ canonical(v2.1) payload) from stored values (unified payload shape — covers §7 advisory, applied and MARP rows alike)",
      "legacy-float = v2.0 raw-double semantics: bit-exact over 2 raw-Infinity-rr bases, else rescued within ±1 ULP on the 6 float leaves per base (bounded search; matches audit 16-d's RD method)",
      "unhashed = pre-16d-003 MARP advisory rows written outside the chain (rowHash NULL) — frozen historical residue, not rewritten",
      "legacy-float is NOT counted as verified — tolerance is not tamper-evidence",
    ],
  };
  for (const r of rows) {
    const navUsd = Number(r.navUsd), rr = Number(r.reserveRatio);
    const ogw = Number(r.observedGoldWeight), tgw = Number(r.targetGoldWeight);
    const dev = Number(r.deviationPct), tradeUsd = Number(r.tradeUsd);
    const applied = Boolean(r.applied), shouldRebalance = Boolean(r.shouldRebalance);
    const direction = Number(r.direction), reason = String(r.reason);
    const tickCount = Number(r.tickCount);
    const prev = String(r.prevHash ?? "");
    const tickAt = Number(r.tickAt);
    res.newestRowTickAt = tickAt;
    if (r.rowHash === null || r.rowHash === undefined) { res.unhashed++; continue; }
    const rowHash = String(r.rowHash);
    res.chained++;
    // 1) canonical v2.1 semantics (fin-coerced rr, same shape for every writer)
    if (auditHash(prev, {
      tickCount, navUsd: canonNum(navUsd), reserveRatio: canonNum(rr),
      observedGoldWeight: canonNum(ogw), targetGoldWeight: canonNum(tgw),
      deviationPct: canonNum(dev), applied, shouldRebalance, direction,
      tradeUsd: canonNum(tradeUsd), reason,
    }) === rowHash) {
      res.verified++;
      if (res.firstVerifiedTickAt === null) res.firstVerifiedTickAt = tickAt;
      res.lastVerifiedTickAt = tickAt;
      res.recentVerifiedIds.push(String(r.id));
      if (res.recentVerifiedIds.length > 5) res.recentVerifiedIds.shift();
      continue;
    }
    // 2) legacy v2.0 semantics — the pre-fix writer hashed RAW reserveRatio
    //    (Infinity → JSON null at genesis) while storing fin()=0
    const base = {
      tickCount, navUsd, reserveRatio: rr, observedGoldWeight: ogw,
      targetGoldWeight: tgw, deviationPct: dev, applied, shouldRebalance,
      direction, tradeUsd, reason,
    };
    const bases: Record<string, unknown>[] = [base];
    if (rr === 0) bases.push({ ...base, reserveRatio: Infinity });
    let exact = false;
    for (const b of bases) {
      if (legacyHash(prev, b) === rowHash) { exact = true; break; }
    }
    if (exact) { res.legacyFloat++; res.legacyExact++; continue; }
    // 3) bounded ±1 ULP tolerance search over the float leaves, built PER BASE
    //    (the raw-Infinity base must keep reserveRatio = Infinity → null; the
    //    audit's ±1-ULP RD method varies the other 5 fields around that base).
    let rescued = false;
    for (const b of bases) {
      const fields: [string, number[]][] = [
        ["navUsd", ulpNeighborhood(navUsd, 1)],
        ["observedGoldWeight", ulpNeighborhood(ogw, 1)],
        ["targetGoldWeight", ulpNeighborhood(tgw, 1)],
        ["deviationPct", ulpNeighborhood(dev, 1)],
        ["tradeUsd", ulpNeighborhood(tradeUsd, 1)],
      ];
      const brr = Number(b.reserveRatio);
      if (Number.isFinite(brr)) fields.push(["reserveRatio", ulpNeighborhood(brr, 1)]);
      if (toleranceSearch(prev, b, fields, rowHash)) { rescued = true; break; }
    }
    if (rescued) { res.legacyFloat++; res.legacyTolerance++; continue; }
    res.broken++;
  }
  return res;
}

/**
 * Verify the §24.2/§24.4 hash chains of DailyStateVector and
 * RebalancingDecision from stored data. READ-ONLY. See the section header
 * above for the classification semantics.
 */
export async function verifyAuditChain(opts?: {
  dbUrl?: string;
}): Promise<{ dailyStateVector: ChainVerifyResult; rebalancingDecision: ChainVerifyResult }> {
  const url = opts?.dbUrl ?? process.env.DATABASE_URL ?? "file:/home/z/my-project/db/custom.db";
  const [dailyStateVector, rebalancingDecision] = await Promise.all([
    verifyDsv(url),
    verifyRd(url),
  ]);
  return { dailyStateVector, rebalancingDecision };
}
