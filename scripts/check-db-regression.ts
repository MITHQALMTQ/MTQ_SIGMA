// MTQΣ — Database regression detector (session-open battery check [6/6]).
//
// WHY (incident 2026-11-06, worklog Tasks 39/42): a sandbox re-image event
// wiped the gitignored data layer — db/chain.db re-seeded to genesis (h≈50, 4
// validators) and db/custom.db lost all telemetry (118 rows vs 4,414). Git
// truth survived, but the DB regression was only caught by manual row-count
// comparison long after the fact. This check makes it a SECONDS-level detector.
//
// Task 42 note: recovery is now AUTOMATIC at dev-server boot (node.ts
// self-heal + dev-watchdog.sh pre-boot heal + db-cloud-sync.ts mid-run guard),
// so this detector usually passes by the time a session opens — it remains
// the loud MANUAL gate for sessions that start without those layers having
// run, and the acknowledgment gate for intentional resets.
//
// Invoke:   bun run scripts/check-db-regression.ts
// EXIT:     0 = databases look mature/consistent (or an acknowledged,
//              sentinel-guarded intentional reset is in effect)
//           1 = regression signature (genesis-scale state) — recover BEFORE
//              work: `bun run scripts/db-selfheal.ts` (one command, restores
//              forward-only from the git-tracked cloud dumps)
//
// Thresholds are floors, not expectations:
//   CHAIN_MIN_HEIGHT  500 — a mature chain is h≥1000; a fresh/respawned
//                          genesis sits at tens of blocks within an hour.
//   CUSTOM_MIN_ROWS  4000 — telemetry (DSV/OracleSample/RebalancingDecision)
//                          only grows with ticks; genesis-scale ≈ 100.
// An INTENTIONAL reset runs with the sentinel (db/ALLOW-GENESIS-RESET —
// `bun run scripts/db-selfheal.ts --allow-reset "reason"`); while the
// sentinel is fresh the detector passes with a loud NOTE. Loud-and-
// acknowledged beats silent data loss.

import {
  CHAIN_DB,
  CHAIN_MIN_HEIGHT,
  CUSTOM_DB,
  CUSTOM_MIN_ROWS,
  probeChainHeight,
  probeCustomRows,
  sentinelActive,
} from "../src/lib/db-ops";

const sentinel = sentinelActive();
if (sentinel.malformed) {
  console.warn("[db-check] WARN — malformed sentinel file db/ALLOW-GENESIS-RESET (ignored).");
}

const chain = await probeChainHeight(CHAIN_DB);
const custom = await probeCustomRows(CUSTOM_DB);
const h = chain.ok ? chain.height : null;
const rows = custom.ok ? custom.rows : null;

console.log(
  `[db-check] chain height=${h ?? "UNREADABLE"} (floor ${CHAIN_MIN_HEIGHT}) · custom rows=${rows ?? "UNREADABLE"} (floor ${CUSTOM_MIN_ROWS})`,
);

if (sentinel.active) {
  console.log(
    `[db-check] NOTE — intentional reset acknowledged via sentinel ` +
    `(reason: ${sentinel.reason || "n/a"}, expires ${new Date(sentinel.expiresAt ?? 0).toISOString()}); ` +
    `genesis-scale state is allowed. Record it in worklog.md.`,
  );
  process.exit(0);
}

if (h === null || rows === null) {
  console.error("[db-check] FAIL — database unreadable or missing (fresh re-image?).");
  console.error("           Recover in one command: bun run scripts/db-selfheal.ts");
  console.error("           (forward-only restore from backups/db-snapshots/latest-*.sql — see");
  console.error("            backups/INCIDENT-2026-11-06-DB-REGRESSION.md for the full procedure).");
  process.exit(1);
}
if (h < CHAIN_MIN_HEIGHT || rows < CUSTOM_MIN_ROWS) {
  console.error("[db-check] FAIL — genesis-scale state detected (the 2026-11-06 re-seed signature).");
  console.error("           UNLESS this is an intentional reset: recover in one command —");
  console.error("           bun run scripts/db-selfheal.ts");
  console.error("           (intentional resets: bun run scripts/db-selfheal.ts --allow-reset \"reason\" + worklog.md entry)");
  process.exit(1);
}
console.log("[db-check] OK — mature databases, no regression signature.");
process.exit(0);
