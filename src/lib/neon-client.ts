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
    const start = Date.now();
    const rows = await fn(sql, params);
    return { rows: rows as any[], rowCount: rows.length, latencyMs: Date.now() - start };
  },

  /** Sync latest data from Turso → Neon (called by Inngest hourly) */
  async syncFromTurso(data: {
    dsv: any[];
    rd: any[];
    os: any[];
  }): Promise<{ rows: number; table: string }> {
    const fn = getSql();
    if (!fn) throw new Error("Neon not configured");

    // Create tables if they don't exist (idempotent)
    await fn(`
      CREATE TABLE IF NOT EXISTS mtq_daily_state_vector (
        id TEXT PRIMARY KEY,
        tick_at TIMESTAMPTZ,
        tick_count INTEGER,
        gfb_index REAL,
        mtq_price REAL,
        nav_usd REAL,
        reserve_ratio REAL,
        lcr REAL,
        status TEXT,
        vix REAL,
        dxy REAL,
        buffer_state TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await fn(`
      CREATE TABLE IF NOT EXISTS mtq_rebalancing_decision (
        id TEXT PRIMARY KEY,
        tick_at TIMESTAMPTZ,
        tick_count INTEGER,
        nav_usd REAL,
        reserve_ratio REAL,
        should_rebalance BOOLEAN,
        direction INTEGER,
        trade_usd REAL,
        reason TEXT,
        applied BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await fn(`
      CREATE TABLE IF NOT EXISTS mtq_oracle_sample (
        id TEXT PRIMARY KEY,
        tick_at TIMESTAMPTZ,
        tick_count INTEGER,
        pair TEXT,
        valid_count INTEGER,
        final_price REAL,
        method TEXT,
        spread_bps INTEGER,
        paused BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Insert data (upsert)
    let totalRows = 0;
    for (const row of data.dsv) {
      await fn(
        `INSERT INTO mtq_daily_state_vector (id, tick_at, tick_count, gfb_index, mtq_price, nav_usd, reserve_ratio, lcr, status, vix, dxy, buffer_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.tickAt, row.tickCount, row.gfbIndex, row.mtqPrice, row.navUsd, row.reserveRatio, row.lcr, row.status, row.vix, row.dxy, row.bufferState],
      );
      totalRows++;
    }

    return { rows: totalRows, table: "all" };
  },

  /** Heavy analytical query: daily state vector aggregation */
  async getDailyAggregates(days: number = 30): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn(`
      SELECT
        DATE(tick_at) as date,
        AVG(nav_usd) as avg_nav,
        MIN(reserve_ratio) as min_rr,
        MAX(reserve_ratio) as max_rr,
        AVG(vix) as avg_vix,
        AVG(dxy) as avg_dxy,
        COUNT(*) as tick_count
      FROM mtq_daily_state_vector
      WHERE tick_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(tick_at)
      ORDER BY date DESC
    `);
  },

  /** Heavy analytical query: rebalancing decisions summary */
  async getRebalancingSummary(days: number = 30): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn(`
      SELECT
        DATE(tick_at) as date,
        COUNT(*) as total_decisions,
        SUM(CASE WHEN should_rebalance THEN 1 ELSE 0 END) as rebalances,
        SUM(CASE WHEN applied THEN 1 ELSE 0 END) as applied,
        SUM(trade_usd) as total_trade_usd,
        AVG(reserve_ratio) as avg_rr
      FROM mtq_rebalancing_decision
      WHERE tick_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(tick_at)
      ORDER BY date DESC
    `);
  },

  /** Heavy analytical query: oracle health over time */
  async getOracleHealthHistory(days: number = 7): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    return await fn(`
      SELECT
        pair,
        DATE(tick_at) as date,
        COUNT(*) as samples,
        SUM(CASE WHEN paused THEN 1 ELSE 0 END) as paused_count,
        AVG(final_price) as avg_price,
        STDDEV(final_price) as price_stddev,
        AVG(spread_bps) as avg_spread_bps
      FROM mtq_oracle_sample
      WHERE tick_at > NOW() - INTERVAL '${days} days'
      GROUP BY pair, DATE(tick_at)
      ORDER BY pair, date DESC
    `);
  },

  /** Get table sizes (for monitoring) */
  async getTableSizes(): Promise<any[] | null> {
    const fn = getSql();
    if (!fn) return null;
    const result = await fn(`SELECT schemaname as schema, relname as table, n_live_tup as row_count,
       pg_size_pretty(pg_total_relation_size(relid)) as size
       FROM pg_stat_user_tables ORDER BY n_live_tup DESC`);
    return Array.isArray(result) ? result as any[] : [];
  },
};
