// MTQΣ — Chapter 24 Audit Trail Persistence (§24.1-24.3)
//
// Three async helpers that write rows into the Chapter 24 audit-trail tables:
//   - persistDailyStateVector  → DailyStateVector (§24.1, throttled 30s)
//   - persistRebalancingDecision → RebalancingDecision (§24.2, every eval)
//   - persistOracleSamples      → OracleSample (§24.3, throttled 30s, batched)
//   - persistMarpDecisions      → RebalancingDecision (§24.2 + §10 MARP per-component)
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
  await db.dailyStateVector.create({
    data: {
      tickAt: new Date(now),
      tickCount,
      gfbIndex: snapshot.gfbIndex,
      mtqPrice: snapshot.mtqPrice,
      priceInBand: snapshot.priceInBand,
      navUsd: snapshot.nav,
      liabilityUsd: snapshot.liability,
      reserveRatio: fin(snapshot.reserveRatio),
      lcr: fin(snapshot.lcr),
      status: snapshot.status,
      circulatingSupply: snapshot.circulatingSupply,
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
  await db.rebalancingDecision.create({
    data: {
      tickAt: new Date(),
      tickCount,
      navUsd,
      reserveRatio: fin(reserveRatio),
      observedGoldWeight,
      targetGoldWeight,
      deviationPct,
      shouldRebalance: decision.shouldRebalance,
      direction: decision.direction,
      tradeUsd: decision.tradeUsd,
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
// `reason` field already encodes them textually). Returns the number of rows
// written (0 when there are no MARP decisions to log).
export async function persistMarpDecisions(
  tickCount: number,
  snapshot: MetricsSnapshot,
): Promise<number> {
  const decisions = snapshot.marp?.decisions ?? [];
  if (decisions.length === 0) return 0;
  const dir = (d: string): number => (d === "buy" ? 1 : d === "sell" ? -1 : 0);
  await db.$transaction(
    decisions.map((d) =>
      db.rebalancingDecision.create({
        data: {
          tickAt: new Date(),
          tickCount,
          navUsd: snapshot.nav,
          reserveRatio: fin(snapshot.reserveRatio),
          observedGoldWeight: snapshot.observedGoldWeight,
          targetGoldWeight: snapshot.targetGoldWeight,
          deviationPct: 0, // per-component deviation is encoded in `reason`
          shouldRebalance: d.shouldTrade,
          direction: dir(d.direction),
          tradeUsd: d.tradeUsd,
          reason: `[MARP:${d.component}] ${d.reason}`,
          blockedBy: d.shouldTrade ? null : d.reason,
          applied: false, // MARP decisions are advisory in the pilot — not executed as trades
          preGoldNet: null,
          postGoldNet: null,
          preFiatNet: null,
          postFiatNet: null,
          postReserveRatio: null,
          postObservedGoldWeight: null,
        },
      }),
    ),
  );
  return decisions.length;
}
