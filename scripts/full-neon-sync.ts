// ============================================================================
//  MTQΣ — Full Turso → Neon Sync (UPSCALE-1)
//  ----------------------------------------------------------------------------
//  Reads ALL rows from Turso (not just the latest 50) and writes them to Neon.
//  Creates proper indexes on Neon tables. Reports total synced.
//
//  Run:   bun run scripts/full-neon-sync.ts
//
//  Tables synced (matches prisma/schema.prisma):
//    - PilotTrial
//    - MetricSample
//    - DailyStateVector
//    - RebalancingDecision
//    - OracleSample
//
//  Strategy:
//    1. Connect to Turso (libsql) and Neon (serverless Postgres).
//    2. For each table: read all rows from Turso via SELECT * (chunked by
//       LIMIT/OFFSET to keep memory bounded for 20K+ row tables).
//    3. CREATE TABLE IF NOT EXISTS on Neon (mirrors Prisma schema columns).
//    4. TRUNCATE then INSERT in batches of 500 (multi-row VALUES).
//    5. CREATE INDEX IF NOT EXISTS for the same indexes defined in Prisma.
//    6. Print per-table counts + grand total.
//
//  Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NEON_DATABASE_URL.
//  Safe to re-run (idempotent — TRUNCATE + INSERT).
// ============================================================================

import { createClient } from "@libsql/client";
import { neon } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Env + config
// ---------------------------------------------------------------------------

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const NEON_URL = process.env.NEON_DATABASE_URL;

if (!TURSO_URL) {
  console.error("FATAL: TURSO_DATABASE_URL must be set");
  process.exit(1);
}
if (!NEON_URL) {
  console.error("FATAL: NEON_DATABASE_URL must be set");
  process.exit(1);
}

const CHUNK_SIZE = 1000; // rows per Turso SELECT
const INSERT_BATCH = 500; // rows per Neon INSERT

// ---------------------------------------------------------------------------
// Schema mirror — Neon DDL for each table (matches prisma/schema.prisma).
// Postgres types: TEXT for String, REAL for Float, INTEGER for Int,
// BOOLEAN for Boolean, TIMESTAMPTZ for DateTime, BIGINT for BigInt.
// ---------------------------------------------------------------------------

interface TableDef {
  name: string;
  prismaModel: string;
  createTable: string;
  indexes: string[];
  // Maps Turso row → flat array of values matching the column order in createTable.
  // (column order is parsed out of the CREATE TABLE statement.)
  columns: string[];
}

const TABLES: TableDef[] = [
  {
    name: "mtq_pilot_trial",
    prismaModel: "PilotTrial",
    columns: [
      "id", "type", "chain", "inputAmount", "inputSymbol", "outputAmount", "outputSymbol",
      "gfbIndex", "mtqPrice", "nav", "reserveRatio", "lcr", "status", "basketJson",
      "ok", "reason", "wallet", "createdAt",
    ],
    createTable: `CREATE TABLE IF NOT EXISTS mtq_pilot_trial (
      id TEXT PRIMARY KEY,
      type TEXT,
      chain TEXT,
      input_amount REAL,
      input_symbol TEXT,
      output_amount REAL,
      output_symbol TEXT,
      gfb_index REAL,
      mtq_price REAL,
      nav REAL,
      reserve_ratio REAL,
      lcr REAL,
      status TEXT,
      basket_json TEXT,
      ok BOOLEAN,
      reason TEXT,
      wallet TEXT,
      created_at TIMESTAMPTZ
    );`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_mtq_pilot_trial_wallet ON mtq_pilot_trial(wallet);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_pilot_trial_status ON mtq_pilot_trial(status);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_pilot_trial_chain ON mtq_pilot_trial(chain);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_pilot_trial_created_at ON mtq_pilot_trial(created_at);",
    ],
  },
  {
    name: "mtq_metric_sample",
    prismaModel: "MetricSample",
    columns: [
      "id", "gfbIndex", "mtqPrice", "nav", "reserveRatio", "lcr", "status", "vix", "dxy",
      "targetGold", "bufferState", "createdAt",
    ],
    createTable: `CREATE TABLE IF NOT EXISTS mtq_metric_sample (
      id TEXT PRIMARY KEY,
      gfb_index REAL,
      mtq_price REAL,
      nav REAL,
      reserve_ratio REAL,
      lcr REAL,
      status TEXT,
      vix REAL,
      dxy REAL,
      target_gold REAL,
      buffer_state TEXT,
      created_at TIMESTAMPTZ
    );`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_mtq_metric_sample_created_at ON mtq_metric_sample(created_at);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_metric_sample_status ON mtq_metric_sample(status);",
    ],
  },
  {
    name: "mtq_daily_state_vector",
    prismaModel: "DailyStateVector",
    columns: [
      "id", "tickAt", "tickCount", "gfbIndex", "mtqPrice", "priceInBand", "navUsd",
      "liabilityUsd", "reserveRatio", "lcr", "status", "circulatingSupply", "totalSupply",
      "usdNet", "eurNet", "gbpNet", "jpyNet", "cnyNet", "chfNet", "goldNet", "fiatNet",
      "vix", "dxy", "zVix", "zDxy", "rawTheta", "smoothedGoldWeight", "targetGoldWeight",
      "observedGoldWeight", "bufferState", "bufferGoldRatio", "ejectStage", "pegHealthJson",
      "createdAt",
    ],
    createTable: `CREATE TABLE IF NOT EXISTS mtq_daily_state_vector (
      id TEXT PRIMARY KEY,
      tick_at TIMESTAMPTZ,
      tick_count INTEGER,
      gfb_index REAL,
      mtq_price REAL,
      price_in_band BOOLEAN,
      nav_usd REAL,
      liability_usd REAL,
      reserve_ratio REAL,
      lcr REAL,
      status TEXT,
      circulating_supply REAL,
      total_supply REAL,
      usd_net REAL,
      eur_net REAL,
      gbp_net REAL,
      jpy_net REAL,
      cny_net REAL,
      chf_net REAL,
      gold_net REAL,
      fiat_net REAL,
      vix REAL,
      dxy REAL,
      z_vix REAL,
      z_dxy REAL,
      raw_theta REAL,
      smoothed_gold_weight REAL,
      target_gold_weight REAL,
      observed_gold_weight REAL,
      buffer_state TEXT,
      buffer_gold_ratio REAL,
      eject_stage INTEGER,
      peg_health_json TEXT,
      created_at TIMESTAMPTZ
    );`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_mtq_dsv_tick_at ON mtq_daily_state_vector(tick_at);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_dsv_status ON mtq_daily_state_vector(status);",
    ],
  },
  {
    name: "mtq_rebalancing_decision",
    prismaModel: "RebalancingDecision",
    columns: [
      "id", "tickAt", "tickCount", "navUsd", "reserveRatio", "observedGoldWeight",
      "targetGoldWeight", "deviationPct", "shouldRebalance", "direction", "tradeUsd",
      "reason", "blockedBy", "applied", "preGoldNet", "postGoldNet", "preFiatNet",
      "postFiatNet", "postReserveRatio", "postObservedGoldWeight", "createdAt",
    ],
    createTable: `CREATE TABLE IF NOT EXISTS mtq_rebalancing_decision (
      id TEXT PRIMARY KEY,
      tick_at TIMESTAMPTZ,
      tick_count INTEGER,
      nav_usd REAL,
      reserve_ratio REAL,
      observed_gold_weight REAL,
      target_gold_weight REAL,
      deviation_pct REAL,
      should_rebalance BOOLEAN,
      direction INTEGER,
      trade_usd REAL,
      reason TEXT,
      blocked_by TEXT,
      applied BOOLEAN,
      pre_gold_net REAL,
      post_gold_net REAL,
      pre_fiat_net REAL,
      post_fiat_net REAL,
      post_reserve_ratio REAL,
      post_observed_gold_weight REAL,
      created_at TIMESTAMPTZ
    );`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_mtq_rd_tick_at ON mtq_rebalancing_decision(tick_at);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_rd_should_rebalance ON mtq_rebalancing_decision(should_rebalance);",
    ],
  },
  {
    name: "mtq_oracle_sample",
    prismaModel: "OracleSample",
    columns: [
      "id", "tickAt", "tickCount", "pair", "chainlinkValid", "chainlinkPrice",
      "pythValid", "pythPrice", "chronicleValid", "chroniclePrice", "validCount",
      "finalPrice", "method", "spreadBps", "paused", "discardReasons", "createdAt",
    ],
    createTable: `CREATE TABLE IF NOT EXISTS mtq_oracle_sample (
      id TEXT PRIMARY KEY,
      tick_at TIMESTAMPTZ,
      tick_count INTEGER,
      pair TEXT,
      chainlink_valid BOOLEAN,
      chainlink_price REAL,
      pyth_valid BOOLEAN,
      pyth_price REAL,
      chronicle_valid BOOLEAN,
      chronicle_price REAL,
      valid_count INTEGER,
      final_price REAL,
      method TEXT,
      spread_bps INTEGER,
      paused BOOLEAN,
      discard_reasons TEXT,
      created_at TIMESTAMPTZ
    );`,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_mtq_os_tick_at ON mtq_oracle_sample(tick_at);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_os_pair ON mtq_oracle_sample(pair);",
      "CREATE INDEX IF NOT EXISTS idx_mtq_os_paused ON mtq_oracle_sample(paused);",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers — value coercion for Postgres INSERT
// ---------------------------------------------------------------------------

/** Coerce a Turso cell value into a Postgres-safe parameter value. */
function coerce(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Uint8Array) return Array.from(v);
  if (typeof v === "object" && v !== null && "toString" in v) return String(v);
  return v;
}

/** Convert epoch-ms numbers to ISO strings for date columns. */
function coerceDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number" || typeof v === "bigint") {
    const n = Number(v);
    // epoch ms (>= year 2001) → ISO; epoch seconds also supported below 1e12
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof v === "string") {
    // already ISO?
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms).toISOString();
    }
    return v;
  }
  return null;
}

/** Columns that are DateTime in Prisma (need ISO string conversion). */
const DATE_COLUMNS = new Set([
  "createdAt", "tickAt", "authorizedAt", "mintedAt",
]);

/** Convert a Prisma camelCase column name to its snake_case Neon column. */
function snake(camel: string): string {
  return camel.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

// ---------------------------------------------------------------------------
// Main sync logic
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const turso = createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
  const sql = neon(NEON_URL!);

  console.log(`[full-neon-sync] Turso: ${TURSO_URL!.replace(/\?auth=.*/, "")}`);
  console.log(`[full-neon-sync] Neon:  ${NEON_URL!.replace(/:[^:@/]+@/, ":***@")}`);
  console.log(`[full-neon-sync] Tables to sync: ${TABLES.map((t) => t.prismaModel).join(", ")}`);

  let grandTotal = 0;
  const perTable: Record<string, number> = {};

  for (const t of TABLES) {
    console.log(`\n[full-neon-sync] === ${t.prismaModel} → Neon ${t.name} ===`);

    // 1. DROP + CREATE TABLE + INDEXES on Neon (clean re-create to handle schema drift).
    await sql.query(`DROP TABLE IF EXISTS ${t.name} CASCADE;`, []);
    await sql.query(t.createTable, []);
    for (const idx of t.indexes) {
      try { await sql.query(idx, []); } catch (e: any) {
        console.warn(`[full-neon-sync]   index warning: ${e?.message?.slice(0, 120)}`);
      }
    }

    // 3. Stream all rows from Turso via LIMIT/OFFSET chunks.
    let offset = 0;
    let tableTotal = 0;
    const cols = t.columns.map(snake);
    const colList = cols.join(", ");
    const paramList = (n: number) => `(${cols.map((_, i) => `$${n * cols.length + i + 1}`).join(", ")})`;
    const insertHeader = `INSERT INTO ${t.name} (${colList}) VALUES `;

    while (true) {
      const res = await turso.execute({
        sql: `SELECT * FROM "${t.prismaModel}" ORDER BY "createdAt" ASC LIMIT ${CHUNK_SIZE} OFFSET ${offset};`,
        args: [],
      });
      if (res.rows.length === 0) break;

      // Insert in sub-batches of INSERT_BATCH to keep parameter counts sane
      // (Neon serverless limits ~65535 params per query; 33 cols × 500 rows = 16500, well under).
      for (let i = 0; i < res.rows.length; i += INSERT_BATCH) {
        const slice = res.rows.slice(i, i + INSERT_BATCH);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        slice.forEach((row, n) => {
          placeholders.push(paramList(n));
          for (const c of t.columns) {
            const cell = (row as Record<string, unknown>)[c];
            values.push(DATE_COLUMNS.has(c) ? coerceDate(cell) : coerce(cell));
          }
        });
        const q = `${insertHeader}${placeholders.join(", ")} ON CONFLICT (id) DO NOTHING;`;
        try {
          await sql.query(q, values as any[]);
        } catch (e: any) {
          console.error(`[full-neon-sync]   INSERT failed at offset ${offset + i}: ${e?.message?.slice(0, 200)}`);
          throw e;
        }
      }

      tableTotal += res.rows.length;
      offset += res.rows.length;
      if (res.rows.length < CHUNK_SIZE) break; // last page
      process.stdout.write(`\r[full-neon-sync]   ${t.prismaModel}: ${tableTotal} rows synced`);
    }
    process.stdout.write(`\r[full-neon-sync]   ${t.prismaModel}: ${tableTotal} rows synced ✓\n`);
    perTable[t.prismaModel] = tableTotal;
    grandTotal += tableTotal;
  }

  // 4. Final summary.
  console.log("\n[full-neon-sync] ============================================");
  console.log("[full-neon-sync]  Sync complete.");
  for (const [k, v] of Object.entries(perTable)) {
    console.log(`[full-neon-sync]   ${k.padEnd(22)} ${String(v).padStart(8)} rows`);
  }
  console.log(`[full-neon-sync]   ${"TOTAL".padEnd(22)} ${String(grandTotal).padStart(8)} rows`);
  console.log("[full-neon-sync] ============================================");

  // 5. Verify Neon row counts (parity check vs Turso).
  console.log("\n[full-neon-sync] Verifying Neon row counts...");
  for (const t of TABLES) {
    const rows = await sql.query(`SELECT COUNT(*) AS n FROM ${t.name};`, []);
    const n = (rows?.[0] as Record<string, unknown> | undefined)?.n ?? 0;
    const parity = Number(n) === perTable[t.prismaModel] ? "OK" : "MISMATCH";
    console.log(`[full-neon-sync]   ${t.name.padEnd(28)} ${String(n).padStart(8)} rows  [${parity}]`);
  }
}

main().catch((err) => {
  console.error("[full-neon-sync] FATAL:", err);
  process.exit(1);
});
