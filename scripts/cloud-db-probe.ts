// MTQΣ — Cloud Database Availability Probe (V31 Phase 2/3/4)
//
// READ-ONLY. Never issues a write to either cloud database.
// Purpose: verify availability + schema presence + row inventory of the
// hybrid cloud layer (Turso primary / Neon analytical mirror) WITHOUT
// switching the live sandbox app off local SQLite (the dev stack stays
// authoritative until monetary/governance acceptance is granted).
//
// Usage (env passed inline; secrets NEVER hardcoded):
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
//     bun run scripts/cloud-db-probe.ts --turso
//   NEON_DATABASE_URL=postgres://... \
//     bun run scripts/cloud-db-probe.ts --neon
//
// Output: one JSON verdict line on stdout (CLOUD_DB_PROBE {...}).
// Exit codes: 0 = reachable + schema verified; 2 = unreachable or
// misconfigured; 3 = reachable but expected schema missing.

const EXPECTED_TURSO_TABLES = [
  "PilotTrial",
  "MetricSample",
  "DailyStateVector",
  "RebalancingDecision",
  "OracleSample",
  "MbzMintRequest",
  "MbzBackingCertificate",
  "MbzBank",
  "IssuanceEvent",
  "ScoringUpload",
  "AiModelCatalog",
  "ConsensusRun",
  "ConsensusVote",
];

const EXPECTED_NEON_TABLES = [
  "mtq_pilot_trial",
  "mtq_metric_sample",
  "mtq_daily_state_vector",
  "mtq_rebalancing_decision",
  "mtq_oracle_sample",
];

function verdict(obj: Record<string, unknown>): never {
  console.log(`CLOUD_DB_PROBE ${JSON.stringify(obj)}`);
  process.exit(obj.reachable && obj.schemaOk ? 0 : obj.reachable ? 3 : 2);
}

async function probeTurso(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    verdict({ target: "turso", reachable: false, schemaOk: false, error: "TURSO_DATABASE_URL/TURSO_AUTH_TOKEN not set" });
  }
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: url!, authToken: authToken! });
  const t0 = Date.now();
  try {
    // 1. Reachability + full table inventory (read-only catalog query)
    const master = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tables = master.rows.map((r) => String(r.name));
    // 2. Row inventory on expected tables (retention-capped sizes: COUNT is cheap)
    const counts: Record<string, number> = {};
    for (const t of EXPECTED_TURSO_TABLES) {
      if (tables.includes(t)) {
        try {
          const c = await client.execute(`SELECT COUNT(*) AS n FROM "${t}"`);
          counts[t] = Number(c.rows[0]?.n ?? -1);
        } catch (e: any) {
          counts[t] = -1;
        }
      }
    }
    // 3. Freshness watermark on the engine state table (if present)
    let latestTickAt: string | null = null;
    if (tables.includes("DailyStateVector")) {
      try {
        const tip = await client.execute(
          'SELECT tickAt FROM "DailyStateVector" ORDER BY tickAt DESC LIMIT 1'
        );
        const v = tip.rows[0]?.tickAt;
        latestTickAt = v == null ? null : String(v);
      } catch {
        latestTickAt = null;
      }
    }
    const missing = EXPECTED_TURSO_TABLES.filter((t) => !tables.includes(t));
    verdict({
      target: "turso",
      reachable: true,
      latencyMs: Date.now() - t0,
      tableCount: tables.length,
      expectedTablesFound: EXPECTED_TURSO_TABLES.length - missing.length,
      missingExpected: missing,
      schemaOk: missing.length === 0,
      rowCounts: counts,
      latestDailyStateVectorTickAt: latestTickAt,
      extraTables: tables.filter((t) => !EXPECTED_TURSO_TABLES.includes(t)).slice(0, 20),
    });
  } catch (e: any) {
    verdict({ target: "turso", reachable: false, schemaOk: false, error: String(e?.message ?? e).slice(0, 300) });
  }
}

async function probeNeon(): Promise<void> {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    verdict({ target: "neon", reachable: false, schemaOk: false, error: "NEON_DATABASE_URL not set" });
  }
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url!);
  const t0 = Date.now();
  try {
    // 1. Reachability
    await sql`SELECT 1`;
    // 2. Table inventory (public schema, read-only catalog)
    const tbl = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    const tables = tbl.map((r: any) => String(r.table_name));
    // 3. Row inventory on expected mtq_* tables
    const counts: Record<string, number> = {};
    for (const t of EXPECTED_NEON_TABLES) {
      if (tables.includes(t)) {
        try {
          const c = await sql.raw(`SELECT COUNT(*) AS n FROM "${t}"`);
          counts[t] = Number(c[0]?.n ?? -1);
        } catch {
          counts[t] = -1;
        }
      }
    }
    // 4. Sync cursor state (durable high-water mark of the Turso→Neon mirror)
    let syncState: Record<string, unknown> | null = null;
    if (tables.includes("mtq_sync_state")) {
      try {
        const rows = await sql`SELECT * FROM mtq_sync_state ORDER BY 1 LIMIT 10`;
        syncState = rows as any;
      } catch {
        syncState = null;
      }
    }
    const missing = EXPECTED_NEON_TABLES.filter((t) => !tables.includes(t));
    verdict({
      target: "neon",
      reachable: true,
      latencyMs: Date.now() - t0,
      tableCount: tables.length,
      expectedTablesFound: EXPECTED_NEON_TABLES.length - missing.length,
      missingExpected: missing,
      schemaOk: missing.length === 0,
      rowCounts: counts,
      syncState,
      extraTables: tables.filter((t) => !EXPECTED_NEON_TABLES.includes(t)).slice(0, 20),
    });
  } catch (e: any) {
    verdict({ target: "neon", reachable: false, schemaOk: false, error: String(e?.message ?? e).slice(0, 300) });
  }
}

const mode = process.argv[2] ?? "";
if (mode === "--turso") await probeTurso();
else if (mode === "--neon") await probeNeon();
else {
  console.error("usage: cloud-db-probe.ts --turso | --neon");
  process.exit(2);
}
