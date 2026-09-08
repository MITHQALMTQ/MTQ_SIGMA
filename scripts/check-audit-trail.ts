// One-off Chapter 24 audit-trail verification script (Task P0-B).
// Counts rows in DailyStateVector / RebalancingDecision / OracleSample so we
// can confirm the engine tick loop is actually persisting audit rows.
//
// Invoke once with `bun run scripts/check-audit-trail.ts` (NOT added to
// package.json — this is a one-shot verification, not a dev workflow).

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db" } },
});

(async () => {
  const [pt, ms, dsv, rd, os] = await Promise.all([
    db.pilotTrial.count(),
    db.metricSample.count(),
    db.dailyStateVector.count(),
    db.rebalancingDecision.count(),
    db.oracleSample.count(),
  ]);
  console.log("PilotTrial:", pt);
  console.log("MetricSample:", ms);
  console.log("DailyStateVector:", dsv);
  console.log("RebalancingDecision:", rd);
  console.log("OracleSample:", os);
  if (dsv > 0) {
    const last = await db.dailyStateVector.findFirst({ orderBy: { tickAt: "desc" } });
    console.log("--- last DailyStateVector ---");
    console.log("  tickAt:", last?.tickAt.toISOString(), "tickCount:", last?.tickCount);
    console.log("  gfbIndex:", last?.gfbIndex, "mtqPrice:", last?.mtqPrice);
    console.log("  navUsd:", last?.navUsd, "reserveRatio:", last?.reserveRatio, "lcr:", last?.lcr);
    console.log("  status:", last?.status, "bufferState:", last?.bufferState);
  }
  if (os > 0) {
    const lastOs = await db.oracleSample.findFirst({ orderBy: { tickAt: "desc" } });
    console.log("--- last OracleSample ---");
    console.log("  pair:", lastOs?.pair, "method:", lastOs?.method, "validCount:", lastOs?.validCount, "finalPrice:", lastOs?.finalPrice);
  }
  if (rd > 0) {
    const lastRd = await db.rebalancingDecision.findFirst({ orderBy: { tickAt: "desc" } });
    console.log("--- last RebalancingDecision ---");
    console.log("  shouldRebalance:", lastRd?.shouldRebalance, "direction:", lastRd?.direction, "tradeUsd:", lastRd?.tradeUsd, "applied:", lastRd?.applied, "reason:", lastRd?.reason);
  }
})().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
});
