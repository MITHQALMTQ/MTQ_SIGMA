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
//    3. DROP + CREATE TABLE on Neon (clean re-create, mirrors Prisma schema
//       columns — shared verbatim with the incremental sync via
//       src/lib/neon-schema.ts since Task 20).
//    4. INSERT in batches of 500 (multi-row VALUES).
//    5. CREATE INDEX IF NOT EXISTS for the same indexes defined in Prisma.
//    6. Print per-table counts + grand total + parity check.
//
//  Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NEON_DATABASE_URL.
//  NOTE: full sync DROPs and re-creates Neon tables (destructive to the
//  replica only — never to Turso). For the idempotent incremental tail
//  sync see src/lib/neon-client.ts syncFromTurso() (Inngest hourly cron).
// ============================================================================

import { createClient } from "@libsql/client";
import { neon } from "@neondatabase/serverless";
import {
  NEON_TABLES,
  camelToSnake,
  coerceParam,
  coerceDateParam,
  DATE_COLUMNS,
  type NeonTableDef,
} from "../src/lib/neon-schema";

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

// Shared schema mirror (single source of truth with the incremental path).
const TABLES: NeonTableDef[] = NEON_TABLES;

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
    const cols = t.columns.map(camelToSnake);
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
            values.push(DATE_COLUMNS.has(c) ? coerceDateParam(cell) : coerceParam(cell));
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
