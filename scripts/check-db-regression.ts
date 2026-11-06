// MTQΣ — Database regression detector (session-open battery check [6/6]).
//
// WHY (incident 2026-11-06, worklog Task 39): a sandbox re-image event wiped
// the gitignored data layer — db/chain.db re-seeded to genesis (h≈50, 4
// validators) and db/custom.db lost all telemetry (118 rows vs 4,414). Git
// truth survived, but the DB regression was only caught by manual row-count
// comparison long after the fact. This check makes it a SECONDS-level detector.
//
// Invoke:   bun run scripts/check-db-regression.ts
// EXIT:     0 = databases look mature/consistent
//           1 = regression signature (genesis-scale state) — recover BEFORE work
//
// Thresholds are floors, not expectations:
//   CHAIN_MIN_HEIGHT  500 — a mature chain is h≥1000; a fresh/respawned
//                          genesis sits at tens of blocks within an hour.
//   CUSTOM_MIN_ROWS  4000 — telemetry (DSV/OracleSample/RebalancingDecision)
//                          only grows with ticks; genesis-scale ≈ 100.
// An INTENTIONAL reset (scripts/chain-reset.ts / pilot-state restore) trips
// this too — that is by design: record the intentional reset in worklog.md,
// then proceed; loud-and-acknowledged beats silent data loss.

import { createClient } from "@libsql/client";

const CHAIN_MIN_HEIGHT = 500;
const CUSTOM_MIN_ROWS = 4000;

async function readHeight(): Promise<number | null> {
  try {
    const c = createClient({ url: "file:db/chain.db" });
    const h = Number(Object.values((await c.execute("SELECT max(height) h FROM blocks")).rows[0])[0]);
    c.close();
    return h;
  } catch {
    return null;
  }
}

async function readCustomRows(): Promise<number | null> {
  try {
    const c = createClient({ url: "file:db/custom.db" });
    const t = (await c.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )).rows.map((r) => String(Object.values(r)[0]));
    let rows = 0;
    for (const x of t) {
      rows += Number(Object.values((await c.execute(`SELECT count(*) c FROM "${x}"`)).rows[0])[0]);
    }
    c.close();
    return rows;
  } catch {
    return null;
  }
}

const h = await readHeight();
const rows = await readCustomRows();

console.log(`[db-check] chain height=${h ?? "UNREADABLE"} (floor ${CHAIN_MIN_HEIGHT}) · custom rows=${rows ?? "UNREADABLE"} (floor ${CUSTOM_MIN_ROWS})`);

if (h === null || rows === null) {
  console.error("[db-check] FAIL — database unreadable or missing (fresh re-image?).");
  console.error("           Recover forward-only from backups/db-snapshots/latest-*.sql (see");
  console.error("           backups/INCIDENT-2026-11-06-DB-REGRESSION.md for the procedure).");
  process.exit(1);
}
if (h < CHAIN_MIN_HEIGHT || rows < CUSTOM_MIN_ROWS) {
  console.error("[db-check] FAIL — genesis-scale state detected (the 2026-11-06 re-seed signature).");
  console.error("           UNLESS this was an intentional recorded reset: recover from");
  console.error("           backups/db-snapshots/latest-*.sql per the incident manifest BEFORE any work.");
  process.exit(1);
}
console.log("[db-check] OK — mature databases, no regression signature.");
process.exit(0);
