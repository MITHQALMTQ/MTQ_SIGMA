// Chapter 24 audit-trail verification script (Task P0-B; extended by fix
// 16-fix-C). Two jobs, both READ-ONLY against the DB:
//   1. Row counts for the five trial/audit tables + the last row of each
//      audit series (confirms the engine tick loop is persisting rows).
//   2. FULL §24.2/§24.4 hash-chain verification via
//      `verifyAuditChain()` (src/lib/mtq/audit-trail.ts) — recomputes every
//      DailyStateVector / RebalancingDecision row hash from stored values and
//      classifies rows as verified / legacy-float / broken / unhashed.
//      This is the operator-facing checkable-integrity surface for the chain
//      (16d-009's API read-surface gap remains open — agent A/orchestrator
//      own the routes).
//
// Invoke with `bun run scripts/check-audit-trail.ts` (NOT in package.json —
// one-shot verification, not a dev workflow; orchestrator may add
// "db:verify": "bun run scripts/check-audit-trail.ts").

import { PrismaClient } from "@prisma/client";
import { verifyAuditChain } from "../src/lib/mtq/audit-trail";

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db" } },
});

const iso = (ms: unknown) => new Date(Number(ms)).toISOString();

(async () => {
  const [pt, ms, dsv, rd, os] = await Promise.all([
    db.pilotTrial.count(),
    db.metricSample.count(),
    db.dailyStateVector.count(),
    db.rebalancingDecision.count(),
    db.oracleSample.count(),
  ]);
  console.log("PilotTrial:", pt);
  console.log("MetricSample:", ms, "(deprecated/reserved — no writer, no reader)");
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
    console.log("  chained:", last?.rowHash ? `rowHash=${String(last?.rowHash).slice(0, 16)}… prev=${String(last?.prevHash ?? "").slice(0, 16)}…` : "UNHASHED (pre-16d-003 row)");
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
    console.log("  chained:", lastRd?.rowHash ? `rowHash=${String(lastRd?.rowHash).slice(0, 16)}… prev=${String(lastRd?.prevHash ?? "").slice(0, 16)}…` : "UNHASHED (pre-16d-003 row)");
  }

  console.log("\n=== §24.2/§24.4 hash-chain verification (16d-001 verify side) ===");
  const { dailyStateVector: d, rebalancingDecision: r } = await verifyAuditChain();
  for (const res of [d, r]) {
    console.log(`\n${res.table}: rows=${res.rows} chained=${res.chained}`);
    console.log(
      `  verified=${res.verified} (EXACT, canonical v2.1 — the only tamper-evident class)` +
      ` | legacy-float=${res.legacyFloat} (exact=${res.legacyExact}, tolerance-only=${res.legacyTolerance})` +
      ` | broken=${res.broken} | unhashed=${res.unhashed}`,
    );
    if (res.firstVerifiedTickAt !== null) {
      console.log(
        `  verified rows span ${iso(res.firstVerifiedTickAt)} → ${iso(res.lastVerifiedTickAt)}` +
        ` (newest row ${iso(res.newestRowTickAt)})`,
      );
    }
    for (const n of res.notes) console.log("  ·", n);
  }
  console.log(
    "\nHonesty note: legacy-float rows are pre-2026-10-23 rows that reproduce only" +
      "\nunder the old raw-double hashing (bit-exactly or within the bounded ±ULP" +
      "\nsearch) — consistent with the documented Prisma→SQLite 16-digit float" +
      "\nrounding (audit 16d-001), NOT counted as verified. Historical rows are" +
      "\npreserved as-is (no rewrite). New rows must verify EXACTLY.",
  );
})().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
}).finally(() => db.$disconnect());
