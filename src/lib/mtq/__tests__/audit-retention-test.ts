// MTQΣ — Audit-Trail Retention Test (Task ID: AUDIT-RETENTION)
// =========================================================================
// CORRECTED in V31 §9 Phase 6 (2026-11-10):
//   • The old version hardcoded MAX_REBALANCING_DECISIONS = 10,000 — the
//     PRE-§9 cap. The actual configured cap is the shared exported
//     RETENTION_CAPS (src/lib/mtq/audit-trail.ts; local full-history node
//     defaults: RD 75,000 / DSV 25,000 / OS 50,000, env-overridable via
//     MTQ_AUDIT_RETENTION_*). This test now reads that configuration.
//   • The old version inserted synthetic rows into the LIVE database.
//     This version runs ONLY in an ISOLATED TEMPORARY database (fresh
//     mkdtemp SQLite file, schema via `prisma db push`) — the live
//     db/custom.db is never touched (guarded below).
//
// Test plan (all against the isolated temp DB):
//   0. Defaults check (subprocess, clean env): RETENTION_CAPS must equal the
//      ACTUAL configured caps (75_000 / 25_000 / 50_000).
//   1. Env-specific configuration check: with MTQ_AUDIT_RETENTION_* set to
//      small test caps, RETENTION_CAPS reflects the overrides (the
//      production capped-window policy surface from Phase 6).
//   2. Insert synthetic rows beyond the (overridden) RD cap, with createdAt
//      = 1970 so they are the OLDEST rows (prod prune semantics: oldest
//      rows get dropped first), plus a handful of "engine-like" newer rows.
//   3. Call pruneAuditTrail() ONCE — verify it deletes exactly
//      PRUNE_BATCH_SIZE (1000) RD rows (incremental batch — never a
//      big-bang delete) and that DSV/OS converge in the same call when
//      their over-cap amount is below the batch size.
//   4. Prune in a LOOP until RD ≤ cap — verify convergence and that ONLY
//      the oldest synthetic rows were deleted (the engine-like rows and
//      the newest synthetic rows survive).
//   5. Verify final counts ≤ caps for all three tables; cleanup.
//
// The synthetic rows use `tickCount = -1` and reason =
// "[AUDIT-RETENTION-TEST] synthetic" sentinels so they are clearly
// distinguishable from real engine rows.
//
// To run:  `bun src/lib/mtq/__tests__/audit-retention-test.ts`
// (also self-invokes with --check-defaults under a clean env — internal.)

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const LIVE_CUSTOM_DB = join(REPO_ROOT, "db", "custom.db");

// ── internal mode: parent-invoked defaults check (clean env, no overrides)
// ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--check-defaults")) {
  // DATABASE_URL is provided by the parent (a temp file — createDb() needs a
  // url at import time; no query is issued, the Prisma client connects lazily).
  const { RETENTION_CAPS } = await import("../audit-trail");
  console.log("RETENTION_CAPS_DEFAULTS " + JSON.stringify(RETENTION_CAPS));
  process.exit(0);
}

// ── isolated environment ───────────────────────────────────────────────────
const tmpDir = mkdtempSync(join(tmpdir(), "mtq-audit-retention-"));
const tmpDb = join(tmpDir, "custom.db");

// Small test caps via the env-specific configuration surface (Phase 6) —
// exercising the same override path a production capped-window deployment
// would use, while keeping the synthetic volume tiny and fast.
const TEST_CAP_RD = 100;
const TEST_CAP_DSV = 60;
const TEST_CAP_OS = 80;

process.env.DATABASE_URL = `file:${tmpDb}`;
delete process.env.TURSO_DATABASE_URL; // NEVER the remote, even if inherited
process.env.MTQ_AUDIT_RETENTION_REBALANCING_DECISION = String(TEST_CAP_RD);
process.env.MTQ_AUDIT_RETENTION_DAILY_STATE_VECTOR = String(TEST_CAP_DSV);
process.env.MTQ_AUDIT_RETENTION_ORACLE_SAMPLE = String(TEST_CAP_OS);

// Isolation guard: refuse to run if the URL somehow points at the live DB.
if (process.env.DATABASE_URL.includes(LIVE_CUSTOM_DB)) {
  console.error("TEST FAILED: DATABASE_URL points at the LIVE db — refusing.");
  process.exit(1);
}

// ── 0. defaults check (subprocess with a clean env, no overrides) ───────────
const defaultsOut = execFileSync(
  "bun",
  [fileURLToPath(import.meta.url), "--check-defaults"],
  { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000,
    env: { PATH: process.env.PATH ?? "", DATABASE_URL: `file:${tmpDb}`, NODE_ENV: "test" } },
).trim();
const defaultsLine = defaultsOut.split("\n").find((l) => l.startsWith("RETENTION_CAPS_DEFAULTS"));
if (!defaultsLine) {
  console.error("TEST FAILED: defaults subprocess produced no RETENTION_CAPS_DEFAULTS line.");
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}
const defaults = JSON.parse(defaultsLine.slice("RETENTION_CAPS_DEFAULTS ".length)) as Record<string, number>;
console.log("=== AUDIT-RETENTION test — RebalancingDecision cap (isolated temp DB) ===");
console.log(`Defaults (clean env): RD=${defaults.rebalancingDecision} DSV=${defaults.dailyStateVector} OS=${defaults.oracleSample}`);
const defaultsOk =
  defaults.rebalancingDecision === 75_000 &&
  defaults.dailyStateVector === 25_000 &&
  defaults.oracleSample === 50_000;
console.log(`  → actual configured caps (local full-history node policy): ${defaultsOk ? "OK ✓" : "MISMATCH ✗"}`);

// ── schema: prisma db push into the EMPTY temp file ─────────────────────────
console.log("\nPushing prisma schema into the isolated temp DB…");
let pushOut = "";
try {
  // NOTE: Bun spawns children with the BOOT env unless `env` is given —
  // process.env mutations (DATABASE_URL → temp file above) do NOT propagate
  // implicitly. Spread the CURRENT process.env so the child sees the temp DB.
  pushOut = execFileSync(
    "bun",
    ["x", "prisma", "db", "push", "--accept-data-loss"],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 180_000, stdio: "pipe",
      env: { ...process.env } },
  );
} catch (e) {
  const err = e as { status?: number; stdout?: string; stderr?: string };
  pushOut = `prisma db push FAILED (exit ${err.status ?? "?"}): ${err.stdout ?? ""} ${err.stderr ?? ""}`;
}

// ── imports AFTER the env is pointed at the temp DB ─────────────────────────
const { pruneAuditTrail, RETENTION_CAPS } = await import("../audit-trail");
const { db } = await import("@/lib/db");

// ── 1. env-specific configuration surface ───────────────────────────────────
const envCapsOk =
  RETENTION_CAPS.rebalancingDecision === TEST_CAP_RD &&
  RETENTION_CAPS.dailyStateVector === TEST_CAP_DSV &&
  RETENTION_CAPS.oracleSample === TEST_CAP_OS;
console.log(`\nEnv overrides honored (MTQ_AUDIT_RETENTION_*): ${envCapsOk ? "OK ✓" : "MISMATCH ✗"}`);
console.log(`  RETENTION_CAPS = ${JSON.stringify(RETENTION_CAPS)}`);

// ── 2. synthetic rows (raw sqlite insert — fast, temp-only) ─────────────────
const SYN_REASON = "[AUDIT-RETENTION-TEST] synthetic";
const T0 = 0; // 1970 — oldest possible createdAt → pruned first (prod semantics)
const NOW = Date.now();

if (!existsSync(tmpDb)) {
  console.error("TEST FAILED: prisma db push did not create the isolated temp DB.");
  console.error("prisma db push output (tail):", pushOut.slice(-600));
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}
const rawDb = new Database(tmpDb);
rawDb.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;");
const insertRd = rawDb.prepare(
  `INSERT INTO "RebalancingDecision"
   ("id","tickAt","tickCount","navUsd","reserveRatio","observedGoldWeight","targetGoldWeight",
    "deviationPct","shouldRebalance","direction","tradeUsd","reason","blockedBy","applied","createdAt")
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
const insertDsv = rawDb.prepare(
  `INSERT INTO "DailyStateVector"
   ("id","tickAt","tickCount","gfbIndex","mtqPrice","priceInBand","navUsd","liabilityUsd","reserveRatio","lcr",
    "status","circulatingSupply","totalSupply","usdNet","eurNet","gbpNet","jpyNet","cnyNet","chfNet","goldNet",
    "fiatNet","vix","dxy","zVix","zDxy","rawTheta","smoothedGoldWeight","targetGoldWeight","observedGoldWeight",
    "bufferState","bufferGoldRatio","ejectStage","pegHealthJson","createdAt")
   VALUES (?,?,?,?,?,?,?,0,0,0,'NORMAL',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'BASE',0,0,'{}',?)`,
);
const insertOs = rawDb.prepare(
  `INSERT INTO "OracleSample"
   ("id","tickAt","tickCount","pair","chainlinkValid","chainlinkPrice","pythValid","pythPrice",
    "chronicleValid","chroniclePrice","validCount","finalPrice","method","spreadBps","paused","createdAt")
   VALUES (?,?,?,?,0,1,0,1,0,1,3,1,'median',0,0,?)`,
);
const RD_SYNTHETIC = 2_600; // > cap+2×PRUNE_BATCH_SIZE → exercises batching + loop
const RD_ENGINE = 20; // "engine-like" NEWEST rows — must survive every prune
const DSV_SYNTHETIC = 120; // cap 60 → over-cap 60 (< batch size → one call)
const OS_SYNTHETIC = 200; // cap 80 → over-cap 120 (< batch size → one call)

rawDb.transaction(() => {
  for (let i = 0; i < RD_SYNTHETIC; i++) {
    insertRd.run(`syn-rd-${i}`, T0, -1, 0, 0, 0, 0, 0, 0, 0, 0, SYN_REASON, "test", 0, T0);
  }
  for (let i = 0; i < RD_ENGINE; i++) {
    insertRd.run(`syn-eng-${i}`, NOW, i, 1, 1, 0.2, 0.2, 0.1, 0, 0, 0, "[MARP:*] engine-like", null, 0, NOW + i);
  }
  for (let i = 0; i < DSV_SYNTHETIC; i++) {
    // 8 placeholders: id, tickAt, tickCount, gfbIndex, mtqPrice, priceInBand, navUsd, createdAt
    insertDsv.run(`syn-dsv-${i}`, T0, -1, 1, 1, 1, 1, T0);
  }
  for (let i = 0; i < OS_SYNTHETIC; i++) {
    insertOs.run(`syn-os-${i}`, T0, -1, "USD/MTQ", T0);
  }
})();
rawDb.close();

const count = async (m: "rebalancingDecision" | "dailyStateVector" | "oracleSample"): Promise<number> => {
  if (m === "rebalancingDecision") return db.rebalancingDecision.count();
  if (m === "dailyStateVector") return db.dailyStateVector.count();
  return db.oracleSample.count();
};
const beforeRd = await count("rebalancingDecision");
const beforeDsv = await count("dailyStateVector");
const beforeOs = await count("oracleSample");
console.log(`\nBEFORE counts: RD=${beforeRd} (cap ${TEST_CAP_RD}) DSV=${beforeDsv} (cap ${TEST_CAP_DSV}) OS=${beforeOs} (cap ${TEST_CAP_OS})`);
console.log(`  inserted synthetic: RD=${RD_SYNTHETIC}+${RD_ENGINE}engine DSV=${DSV_SYNTHETIC} OS=${OS_SYNTHETIC}`);

// ── 3. ONE prune call — incremental batch (PRUNE_BATCH_SIZE = 1000) ─────────
console.log("\nCalling pruneAuditTrail() ONCE…");
const first = await pruneAuditTrail();
const afterFirstRd = await count("rebalancingDecision");
console.log(`  deleted: RD=${first.rebalancingDecision} DSV=${first.dailyStateVector} OS=${first.oracleSample}`);
console.log(`  RD after first call: ${afterFirstRd}`);
const batchOk = first.rebalancingDecision === 1_000; // PRUNE_BATCH_SIZE — documented constant
const dsvOneCallOk = first.dailyStateVector === DSV_SYNTHETIC - TEST_CAP_DSV; // 60 (below batch size)
const osOneCallOk = first.oracleSample === OS_SYNTHETIC - TEST_CAP_OS; // 120 (below batch size)
console.log(`  → first call deleted exactly PRUNE_BATCH_SIZE(1000) RD rows: ${batchOk ? "OK ✓" : "FAIL ✗"}`);
console.log(`  → DSV/OS converged in one call (over-cap < batch): ${dsvOneCallOk && osOneCallOk ? "OK ✓" : "FAIL ✗"}`);

// ── 4. prune LOOP until RD ≤ cap (mirrors the 5-min prod cadence) ───────────
let loopIters = 0;
let lastRd = afterFirstRd;
let totalRdPruned = first.rebalancingDecision;
while (lastRd > TEST_CAP_RD && loopIters < 200) {
  const p = await pruneAuditTrail();
  loopIters++;
  totalRdPruned += p.rebalancingDecision;
  lastRd = await count("rebalancingDecision");
}
const finalRd = await count("rebalancingDecision");
const finalDsv = await count("dailyStateVector");
const finalOs = await count("oracleSample");
console.log(`\nPrune loop: ${loopIters} extra iterations · RD pruned total ${totalRdPruned}`);
console.log(`FINAL counts: RD=${finalRd} DSV=${finalDsv} OS=${finalOs}`);

// Oldest-first semantics: every surviving RD row must have createdAt > 0
// (the 1970 synthetic rows are gone except the newest window) and the
// engine-like rows must ALL survive.
const survivors = await db.rebalancingDecision.findMany({
  where: { reason: "[MARP:*] engine-like" },
  select: { id: true },
});
const engineSurvived = survivors.length === RD_ENGINE;
const oldSyntheticLeft = await db.rebalancingDecision.count({ where: { createdAt: { equals: new Date(0) } } });
console.log(`  engine-like rows survived: ${engineSurvived ? "OK ✓" : "LOST ✗"} (${survivors.length}/${RD_ENGINE})`);
console.log(`  1970-dated synthetic rows remaining (newest-window overflow): ${oldSyntheticLeft}`);

const pass =
  defaultsOk && envCapsOk && batchOk && dsvOneCallOk && osOneCallOk &&
  finalRd <= TEST_CAP_RD && finalDsv <= TEST_CAP_DSV && finalOs <= TEST_CAP_OS &&
  engineSurvived && lastRd === TEST_CAP_RD;
console.log(`\nVerification: caps hold + oldest-first + incremental batches + env config → ${pass ? "PASS ✓" : "FAIL ✗"}`);

await db.$disconnect();
rmSync(tmpDir, { recursive: true, force: true });
console.log("Isolated temp DB removed.");

if (!pass) {
  console.error(`\nTEST FAILED (see above).`);
  process.exit(1);
}
console.log("\nTEST PASSED ✓");
