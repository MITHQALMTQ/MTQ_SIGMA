// MTQΣ — Neon Serverless PostgreSQL Client
//
// Neon is the analytical database — handles heavy read queries, aggregations,
// and reporting that would be too expensive on Turso (edge libSQL).
//
// Hybrid architecture:
//   - Turso: fast edge reads (dashboard, API routes, real-time state)
//   - Neon: heavy analytics (reports, backtesting, historical queries, JOINs)
//   - Inngest: hourly sync from Turso → Neon (keeps analytical replica fresh)
//
// Neon uses serverless Postgres with connection pooling over WebSockets —
// perfect for Vercel serverless functions (no connection limit issues).

import { neon } from "@neondatabase/serverless";
import {
  camelToSnake,
  coerceParam,
  coerceDateParam,
  DATE_COLUMNS,
  tableByModel,
} from "@/lib/neon-schema";

let _sql: any = null;

function getSql(): any {
  if (_sql) return _sql;
  const url = process.env.NEON_DATABASE_URL;
  if (!url) return null;
  _sql = neon(url);
  return _sql;
}

export interface NeonQueryResult {
  rows: any[];
  rowCount: number;
  latencyMs: number;
}

export const neonClient = {
  /** Check if Neon is configured */
  isConfigured(): boolean {
    return !!process.env.NEON_DATABASE_URL;
  },

  /** Execute a raw SQL query on Neon (analytical) */
  async query(sql: string, params?: any[]): Promise<NeonQueryResult | null> {
    const fn = getSql();
    if (!fn) return null;
    // [Task 20] The installed @neondatabase/serverless requires the
    // conventional fn.query(string, params) form — fn(string, params) throws
    // "tagged-template only". (Latent bug in the old dead code path.)
    const start = Date.now();
    const rows = await fn.query(sql, params ?? []);
    return { rows: rows as any[], rowCount: rows.length, latencyMs: Date.now() - start };
  },

  /**
   * Incremental Turso → Neon sync (called by the Inngest "turso-neon-sync"
   * hourly cron, and by scripts/full-neon-sync.ts's incremental sibling path).
   *
   * [Task 20, 2026-10-24] Complete rewrite. Previously this method was a
   * half-implemented stub: it created REDUCED 12-column tables and only
   * inserted DSV rows — its column shape drifted from the authoritative
   * full mirror built by scripts/full-neon-sync.ts (35/21/17 columns).
   * Both paths now share src/lib/neon-schema.ts verbatim, so the analytical
   * replica keeps ONE shape. Full Prisma column set is mirrored; hash-chain
   * columns (prevHash/rowHash) are intentionally excluded (UPSCALE-1 design).
   *
   * Input rows may come from the Prisma client (Date objects) or raw
   * libsql/Turso reads (ISO strings / epoch-ms numbers) — both are coerced
   * uniformly (see neon-schema.ts).
   *
   * Idempotent: INSERT … ON CONFLICT (id) DO NOTHING — safe to re-run.
   * NON-destructive: never updates or deletes existing Neon rows.
   */
  async syncFromTurso(data: {
    dsv: any[];
    rd: any[];
    os: any[];
  }): Promise<{
    tables: Record<string, { read: number; written: number }>;
    total: { read: number; written: number };
  }> {
    const fn = getSql();
    if (!fn) throw new Error("Neon not configured");

    const batches: Array<{ model: string; rows: any[] }> = [
      { model: "DailyStateVector", rows: data.dsv ?? [] },
      { model: "RebalancingDecision", rows: data.rd ?? [] },
      { model: "OracleSample", rows: data.os ?? [] },
    ];

    const BATCH_ROWS = 50; // 50 rows × 35 cols = 1750 params — well under limits
    const tables: Record<string, { read: number; written: number }> = {};
    let totalRead = 0;
    let totalWritten = 0;

    for (const { model, rows } of batches) {
      const def = tableByModel(model);
      if (!def) throw new Error(`Unknown sync table: ${model}`);
      const cols = def.columns.map(camelToSnake);
      const colList = cols.join(", ");

      // Ensure the table + indexes exist (self-bootstrapping; matches the
      // full-sync shape exactly since both share neon-schema.ts).
      await fn.query(def.createTable.replace(/;\s*$/, ""), []);
      for (const idx of def.indexes) {
        try { await fn.query(idx, []); } catch { /* index warnings are non-fatal */ }
      }

      let written = 0;
      for (let i = 0; i < rows.length; i += BATCH_ROWS) {
        const slice = rows.slice(i, i + BATCH_ROWS);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        slice.forEach((row, n) => {
          placeholders.push(
            `(${cols.map((_, c) => `$${n * cols.length + c + 1}`).join(", ")})`,
          );
          for (const c of def.columns) {
            const cell = row?.[c];
            values.push(DATE_COLUMNS.has(c) ? coerceDateParam(cell) : coerceParam(cell));
          }
        });
        await fn.query(
          `INSERT INTO ${def.name} (${colList}) VALUES ${placeholders.join(", ")} ON CONFLICT (id) DO NOTHING`,
          values as any[],
        );
        written += slice.length; // attempted; conflicts are silently ignored
      }

      tables[model] = { read: rows.length, written };
      totalRead += rows.length;
      totalWritten += written;
    }

    return { tables, total: { read: totalRead, written: totalWritten } };
  },

  /** Heavy analytical query: daily state vector aggregation */
  async getDailyAggregates(days: number = 30): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn.query(`
      SELECT
        DATE(tick_at) as date,
        AVG(nav_usd) as avg_nav,
        MIN(reserve_ratio) as min_rr,
        MAX(reserve_ratio) as max_rr,
        AVG(vix) as avg_vix,
        AVG(dxy) as avg_dxy,
        COUNT(*) as tick_count
      FROM mtq_daily_state_vector
      WHERE tick_at > NOW() - make_interval(days => $1)
      GROUP BY DATE(tick_at)
      ORDER BY date DESC
    `, [days]);
  },

  /** Heavy analytical query: rebalancing decisions summary */
  async getRebalancingSummary(days: number = 30): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn.query(`
      SELECT
        DATE(tick_at) as date,
        COUNT(*) as total_decisions,
        SUM(CASE WHEN should_rebalance THEN 1 ELSE 0 END) as rebalances,
        SUM(CASE WHEN applied THEN 1 ELSE 0 END) as applied,
        SUM(trade_usd) as total_trade_usd,
        AVG(reserve_ratio) as avg_rr
      FROM mtq_rebalancing_decision
      WHERE tick_at > NOW() - make_interval(days => $1)
      GROUP BY DATE(tick_at)
      ORDER BY date DESC
    `, [days]);
  },

  /** Heavy analytical query: oracle health over time */
  async getOracleHealthHistory(days: number = 7): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn.query(`
      SELECT
        pair,
        DATE(tick_at) as date,
        COUNT(*) as samples,
        SUM(CASE WHEN paused THEN 1 ELSE 0 END) as paused_count,
        AVG(final_price) as avg_price,
        STDDEV(final_price) as price_stddev,
        AVG(spread_bps) as avg_spread_bps
      FROM mtq_oracle_sample
      WHERE tick_at > NOW() - make_interval(days => $1)
      GROUP BY pair, DATE(tick_at)
      ORDER BY pair, date DESC
    `, [days]);
  },

  /** Get table sizes (for monitoring) */
  async getTableSizes(): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    const result = await fn.query(`SELECT schemaname as schema, relname as table, n_live_tup as row_count,
       pg_size_pretty(pg_total_relation_size(relid)) as size
       FROM pg_stat_user_tables ORDER BY n_live_tup DESC`, []);
    return Array.isArray(result) ? result as any[] : [];
  },
};
