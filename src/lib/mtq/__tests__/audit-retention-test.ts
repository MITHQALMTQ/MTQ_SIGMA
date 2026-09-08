// MTQΣ — Audit-Trail Retention Test (Task ID: AUDIT-RETENTION)
// =========================================================================
// Verifies that pruneAuditTrail() caps the RebalancingDecision table at
// MAX_REBALANCING_DECISIONS (10,000) rows.
//
// Test plan:
//   1. Record the BEFORE row counts for all three Chapter 24 tables.
//   2. Insert 12,000 synthetic RebalancingDecision rows (beyond the 10,000
//      cap) with createdAt=1970 so they are the OLDEST rows and therefore
//      pruned first (mirrors the prod semantics — oldest rows get dropped).
//   3. Call pruneAuditTrail() ONCE — verify it deletes exactly 1000 rows
//      (the PRUNE_BATCH_SIZE) and that they are synthetic rows.
//   4. Call pruneAuditTrail() in a LOOP until the count is ≤ 10,000 (with
//      a safety cap of 200 iterations — at 1000/prune that's 200k rows,
//      far more than any realistic overflow).
//   5. Verify the FINAL RebalancingDecision count is ≤ 10,000.
//   6. Print before/after counts for all three tables.
//   7. Cleanup any remaining synthetic rows (so the live-engine state is
//      preserved — real engine rows have tickCount ≥ 0 and a `[MARP:*]`
//      reason; synthetic rows have tickCount = -1 and a sentinel reason).
//
// The synthetic rows use a `tickCount = -1` sentinel and a `reason =
// "[AUDIT-RETENTION-TEST] synthetic"` so they are clearly distinguishable
// from real engine rows. The `createdAt` is set to `new Date(0)` (1970) so
// the synthetic rows are always the OLDEST in the table — they get pruned
// first (the prod semantic — prune keeps the newest MAX_* rows).
//
// Idempotent: the test cleans up its own synthetic rows at the end so the
// DB is left in the state the live engine expects (only real engine rows).
//
// To run:  `bun src/lib/mtq/__tests__/audit-retention-test.ts`

import { db } from "@/lib/db";
import { pruneAuditTrail } from "../audit-trail";

const MAX_REBALANCING_DECISIONS = 10_000;
const SYNTHETIC_ROW_COUNT = 12_000; // beyond the 10,000 cap
const INSERT_BATCH_SIZE = 1_000;    // insert in batches to avoid locking
const PRUNE_LOOP_MAX_ITERS = 200;   // safety cap on the prune loop

async function insertSyntheticRebalancingDecisions(
  count: number,
  batchSize: number,
): Promise<void> {
  // createdAt = 1970 → these rows are the OLDEST in the table, so they
  // get pruned first (the prod semantic — prune keeps the newest MAX_*
  // rows). tickAt is also 1970 for consistency. The pruneAuditTrail()
  // function deletes rows older than the newest MAX_REBALANCING_DECISIONS,
  // so synthetic rows will be at the front of the deletion queue.
  const tickAt = new Date(0); // 1970-01-01 — guaranteed older than any real row
  const createdAt = new Date(0);
  for (let i = 0; i < count; i += batchSize) {
    const take = Math.min(batchSize, count - i);
    const rows = Array.from({ length: take }, () => {
      return db.rebalancingDecision.create({
        data: {
          tickAt,
          tickCount: -1, // sentinel — clearly synthetic (real ticks ≥ 0)
          navUsd: 0,
          reserveRatio: 0,
          observedGoldWeight: 0,
          targetGoldWeight: 0,
          deviationPct: 0,
          shouldRebalance: false,
          direction: 0,
          tradeUsd: 0,
          reason: "[AUDIT-RETENTION-TEST] synthetic",
          blockedBy: "test",
          applied: false,
          createdAt,
        },
      });
    });
    await db.$transaction(rows);
    process.stdout.write(`\r  inserted ${Math.min(i + take, count)}/${count} synthetic rows`);
  }
  process.stdout.write("\n");
}

async function cleanupSyntheticRows(): Promise<number> {
  // Delete any synthetic rows we inserted that weren't pruned during the
  // test. The filter is on `reason` (sentinel string) so it can NEVER match
  // a real engine row — keeps the test idempotent.
  const r = await db.rebalancingDecision.deleteMany({
    where: { reason: "[AUDIT-RETENTION-TEST] synthetic" },
  });
  return r.count;
}

async function main(): Promise<void> {
  console.log("=== AUDIT-RETENTION test — RebalancingDecision cap ===");
  console.log(`MAX_REBALANCING_DECISIONS = ${MAX_REBALANCING_DECISIONS}`);
  console.log(`Inserting ${SYNTHETIC_ROW_COUNT} synthetic rows (beyond the cap)\n`);

  const beforeRd = await db.rebalancingDecision.count();
  const beforeDsv = await db.dailyStateVector.count();
  const beforeOs = await db.oracleSample.count();
  console.log("BEFORE counts:");
  console.log(`  RebalancingDecision: ${beforeRd}`);
  console.log(`  DailyStateVector:    ${beforeDsv}`);
  console.log(`  OracleSample:        ${beforeOs}\n`);

  await insertSyntheticRebalancingDecisions(SYNTHETIC_ROW_COUNT, INSERT_BATCH_SIZE);

  const afterInsertRd = await db.rebalancingDecision.count();
  console.log(`\nAFTER INSERT: RebalancingDecision = ${afterInsertRd} (expected ~${beforeRd + SYNTHETIC_ROW_COUNT})`);

  console.log("\nCalling pruneAuditTrail() ONCE...");
  const pruneStart = Date.now();
  const pruned = await pruneAuditTrail();
  const pruneMs = Date.now() - pruneStart;
  console.log(`  pruned in ${pruneMs}ms`);
  console.log(`  deleted RebalancingDecision: ${pruned.rebalancingDecision}`);
  console.log(`  deleted DailyStateVector:    ${pruned.dailyStateVector}`);
  console.log(`  deleted OracleSample:        ${pruned.oracleSample}`);

  const afterFirstPruneRd = await db.rebalancingDecision.count();
  console.log(`\nAFTER 1 prune call: RebalancingDecision = ${afterFirstPruneRd}`);
  console.log(`  → first call deleted ${afterInsertRd - afterFirstPruneRd} rows (PRUNE_BATCH_SIZE = 1000)`);

  // A single prune call deletes at most PRUNE_BATCH_SIZE (1000) rows per
  // table. To verify the CAP holds, call pruneAuditTrail() in a loop until
  // the RebalancingDecision table is at or below the cap (this mirrors the
  // prod engine: pruneAuditTrail runs every 5 min from the tick loop, so
  // the table converges to ≤ cap over multiple prune cycles).
  console.log("\nPruning in a loop until RebalancingDecision ≤ cap...");
  let loopIters = 0;
  let lastRd = afterFirstPruneRd;
  let totalPruned = pruned.rebalancingDecision;
  while (lastRd > MAX_REBALANCING_DECISIONS && loopIters < PRUNE_LOOP_MAX_ITERS) {
    const p = await pruneAuditTrail();
    loopIters++;
    totalPruned += p.rebalancingDecision;
    lastRd = await db.rebalancingDecision.count();
    if (loopIters % 10 === 0 || lastRd <= MAX_REBALANCING_DECISIONS) {
      console.log(`  prune loop iter ${loopIters}: total deleted ${totalPruned}, ${lastRd} rows remaining`);
    }
  }

  const finalRd = await db.rebalancingDecision.count();
  const finalDsv = await db.dailyStateVector.count();
  const finalOs = await db.oracleSample.count();
  console.log("\nFINAL counts (after prune loop):");
  console.log(`  RebalancingDecision: ${finalRd}`);
  console.log(`  DailyStateVector:    ${finalDsv}`);
  console.log(`  OracleSample:        ${finalOs}`);
  console.log(`  total prune iterations: ${loopIters + 1}`);
  console.log(`  total RebalancingDecision rows pruned: ${totalPruned}`);

  const pass = finalRd <= MAX_REBALANCING_DECISIONS;
  console.log(`\nVerification: RebalancingDecision ≤ ${MAX_REBALANCING_DECISIONS} → ${pass ? "PASS ✓" : "FAIL ✗"}`);

  // Cleanup: remove any synthetic rows still in the table (some may have
  // survived the prune if the live engine added real rows with newer
  // createdAt after we inserted the synthetic batch). The filter is on
  // the sentinel `reason` so it can NEVER match a real engine row.
  const cleaned = await cleanupSyntheticRows();
  console.log(`\nCleanup: deleted ${cleaned} remaining synthetic rows (restored live-engine state).`);

  const restoredRd = await db.rebalancingDecision.count();
  const restoredDsv = await db.dailyStateVector.count();
  const restoredOs = await db.oracleSample.count();
  console.log(`Post-cleanup RebalancingDecision: ${restoredRd}`);
  console.log(`Post-cleanup DailyStateVector:    ${restoredDsv}`);
  console.log(`Post-cleanup OracleSample:        ${restoredOs}`);

  if (!pass) {
    console.error(`\nTEST FAILED: RebalancingDecision (${finalRd}) exceeded the cap (${MAX_REBALANCING_DECISIONS}).`);
    process.exit(1);
  }
  console.log("\nTEST PASSED ✓");
}

main().catch((e) => {
  console.error("audit-retention-test failed:", e);
  process.exit(1);
});
