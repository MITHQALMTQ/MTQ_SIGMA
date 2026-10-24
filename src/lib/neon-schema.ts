// MTQΣ — Neon Schema Mirror (single source of truth)
//
// The authoritative Neon (PostgreSQL) mirror of the Prisma/Turso tables.
// Consumed by BOTH sync paths so the analytical replica always has one shape:
//   1. src/lib/neon-client.ts  → syncFromTurso()  — INCREMENTAL hourly tail
//      sync (latest rows, INSERT … ON CONFLICT (id) DO NOTHING — idempotent).
//      Called by the Inngest "turso-neon-sync" cron on Vercel.
//   2. scripts/full-neon-sync.ts — FULL table re-sync (DROP+CREATE, all
//      rows, parity check). Manual/maintenance path.
//
// Extracted 2026-10-24 (Task 20) from scripts/full-neon-sync.ts where the
// definitions originally lived — the two paths previously drifted: the
// incremental path created REDUCED 12-column tables while the full path
// created the complete 35-column mirror. After the extraction both share
// these defs verbatim; the reduced-table drift is dead.
//
// Column lists are the Prisma camelCase field names (Turso/SQLite stores
// camelCase); the Postgres DDL below uses the snake_case equivalents.
// Prisma hash-chain columns (prevHash/rowHash) are intentionally NOT
// mirrored (UPSCALE-1 design; unchanged).

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

export interface NeonTableDef {
  /** Postgres table name (mtq_*). */
  name: string;
  /** Prisma model name (Turso table name — camelCase). */
  prismaModel: string;
  /** DDL for CREATE TABLE IF NOT EXISTS (snake_case columns). */
  createTable: string;
  /** Index DDLs (CREATE INDEX IF NOT EXISTS …). */
  indexes: string[];
  /** Prisma camelCase field names, in the same order as the DDL columns. */
  columns: string[];
}

export const NEON_TABLES: NeonTableDef[] = [
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

/** The three tables the hourly incremental sync covers (the audit-trail trio). */
export const SYNC_TABLES = ["DailyStateVector", "RebalancingDecision", "OracleSample"] as const;

// ---------------------------------------------------------------------------
// Coercion helpers — value coercion for Postgres INSERT parameters.
// Handle BOTH input shapes uniformly: Prisma client rows (Date objects for
// DateTime fields) and raw libsql/Turso rows (ISO strings or epoch-ms
// numbers, depending on the driver).
// ---------------------------------------------------------------------------

/** Coerce a cell value into a Postgres-safe parameter value. */
export function coerceParam(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Uint8Array) return Array.from(v);
  if (typeof v === "object" && v !== null && "toString" in v) return String(v);
  return v;
}

/** Convert date-ish cell values (Date | epoch ms | ISO string) to ISO strings. */
export function coerceDateParam(v: unknown): string | null {
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

/** Prisma camelCase fields that are DateTime (need date coercion). */
export const DATE_COLUMNS = new Set([
  "createdAt", "tickAt", "authorizedAt", "mintedAt",
]);

/** Convert a Prisma camelCase field name to its snake_case Neon column. */
export function camelToSnake(camel: string): string {
  return camel.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

/** Look up a table def by its Prisma model name. */
export function tableByModel(prismaModel: string): NeonTableDef | undefined {
  return NEON_TABLES.find((t) => t.prismaModel === prismaModel);
}
