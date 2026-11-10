// MTQΣ — Cloud→Local additive DB import (V31 TURN 3 §9, operator-directed
// 2026-11-10: "upgrade the local server with all databases that are available
// on cloud that are not on local server").
//
// DECISION CONTEXT (audit-work/v31-root-cause/cloud-access-check-20261110.md):
// the cloud layer holds a NON-IDENTICAL, NON-CURRENT dataset — Turso (rw,
// different schema generation: keeper_audit absent locally) and Neon (mirror
// frozen 2026-10-29T02:01:16Z, much deeper history: DSV 15,962 / OS 34,958 /
// RD 56,513). A blind overwrite would violate the forward-only principle.
// This import is the deliberate §9 alternative:
//
//   ADDITIVE — INSERT OR IGNORE by primary key ONLY. Never UPDATE, never
//     DELETE, never replaces a local row with a cloud copy of the same id.
//     A newer validated live state is NEVER replaced by older cloud data.
//   FORWARD-ONLY — db/chain.db is NEVER touched (the cloud holds no chain
//     data; the local chain h22xxx is 12+ days ahead of the frozen stack).
//   NORMALIZED — cloud ISO-8601 timestamps are converted to the local
//     epoch-ms INTEGER convention; Postgres booleans to SQLite 0/1, so the
//     app's typed queries (WHERE ok = 1, ORDER BY tickAt) stay correct.
//   IDEMPOTENT — safe to re-run; conflicts are ignored by primary key.
//   NEW TABLES — keeper_audit (Turso) and mtq_sync_state (Neon mirror
//     high-water mark) are CREATED locally and imported in full. Neon's
//     `local_cache` is deliberately SKIPPED: it is pg_prewarm platform
//     telemetry (pageoffs/relfilenode buffer stats), not MTQΣ data.
//
// Credentials: inline env ONLY (TURSO_URL, TURSO_TOKEN, NEON_PG) — same
// convention as scripts/cloud-db-probe.ts; never hardcoded, never committed.
//
// V31 §9 Phase 2 CORRECTION (2026-11-10): insertion totals were computed from
// before/after row COUNTS — a method that silently absorbs concurrent app
// writes and retention prunes into the "inserted" figure (the re-run of
// 2026-11-09 23:2xZ reported inserted=8,650 while live moved 123,558→132,223,
// a +15 residual of concurrent ticks; per-table counts were polluted the
// same way). The method is now corrected to STATEMENT-LEVEL affected-row
// counts (Σ ResultSet.rowsAffected of the INSERT OR IGNORE batches — 1 per
// actually-inserted row, 0 per PK-ignored row). The before/after counts are
// still taken and reported as a CROSS-CHECK, and their difference from the
// statement total is reported explicitly as `concurrent` (concurrent
// application writes minus retention prunes during the import window).
// Per-pass log lines now print PER-PASS contributions and running totals
// separately — the old lines printed the ACCUMULATED tally on the second
// (Turso) pass, which read as if the accumulated total were that source's
// own contribution (the "DSV +2,997 (neon) +3,000 (turso)" double-counting).
//
// Invoke:
//   export $(grep -v '^#' /tmp/cloud.env | xargs)
//   bun run scripts/cloud-to-local-import.ts [--dry-run]
//
// Safety gate: refuses to run against a missing/genesis-scale local custom.db
// (CUSTOM_MIN_ROWS floor, mirrors check-db-regression.ts), and aborts loudly
// on any unexpected error — a partial import is safe (idempotent) but must be
// visible. A pre-import safety backup is expected under
// mtq-sigma-backups/cloud-import-<ts>/ (gitignored vault).

import { createClient } from "@libsql/client";
import { CUSTOM_MIN_ROWS, CUSTOM_DB, probeCustomRows } from "../src/lib/db-ops";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── shared-table mapping (cloud → local custom.db) ─────────────────────────
// Neon (Postgres, snake_case) → local camelCase. Column lists verified against
// information_schema 2026-11-10 (cloud-access-check) + local PRAGMA table_info.
const NEON_TABLES: { from: string; to: string; cols: Record<string, string> }[] = [
  {
    from: "mtq_daily_state_vector",
    to: "DailyStateVector",
    cols: {
      id: "id", tick_at: "tickAt", tick_count: "tickCount", gfb_index: "gfbIndex",
      mtq_price: "mtqPrice", price_in_band: "priceInBand", nav_usd: "navUsd",
      liability_usd: "liabilityUsd", reserve_ratio: "reserveRatio", lcr: "lcr",
      status: "status", circulating_supply: "circulatingSupply",
      total_supply: "totalSupply", usd_net: "usdNet", eur_net: "eurNet",
      gbp_net: "gbpNet", jpy_net: "jpyNet", cny_net: "cnyNet", chf_net: "chfNet",
      gold_net: "goldNet", fiat_net: "fiatNet", vix: "vix", dxy: "dxy",
      z_vix: "zVix", z_dxy: "zDxy", raw_theta: "rawTheta",
      smoothed_gold_weight: "smoothedGoldWeight",
      target_gold_weight: "targetGoldWeight",
      observed_gold_weight: "observedGoldWeight", buffer_state: "bufferState",
      buffer_gold_ratio: "bufferGoldRatio", eject_stage: "ejectStage",
      peg_health_json: "pegHealthJson", created_at: "createdAt",
    },
  },
  {
    from: "mtq_oracle_sample",
    to: "OracleSample",
    cols: {
      id: "id", tick_at: "tickAt", tick_count: "tickCount", pair: "pair",
      chainlink_valid: "chainlinkValid", chainlink_price: "chainlinkPrice",
      pyth_valid: "pythValid", pyth_price: "pythPrice",
      chronicle_valid: "chronicleValid", chronicle_price: "chroniclePrice",
      valid_count: "validCount", final_price: "finalPrice", method: "method",
      spread_bps: "spreadBps", paused: "paused",
      discard_reasons: "discardReasons", created_at: "createdAt",
    },
  },
  {
    from: "mtq_rebalancing_decision",
    to: "RebalancingDecision",
    cols: {
      id: "id", tick_at: "tickAt", tick_count: "tickCount",
      nav_usd: "navUsd", reserve_ratio: "reserveRatio",
      observed_gold_weight: "observedGoldWeight",
      target_gold_weight: "targetGoldWeight", deviation_pct: "deviationPct",
      should_rebalance: "shouldRebalance", direction: "direction",
      trade_usd: "tradeUsd", reason: "reason", blocked_by: "blockedBy",
      applied: "applied", pre_gold_net: "preGoldNet",
      post_gold_net: "postGoldNet", pre_fiat_net: "preFiatNet",
      post_fiat_net: "postFiatNet", post_reserve_ratio: "postReserveRatio",
      post_observed_gold_weight: "postObservedGoldWeight",
      created_at: "createdAt",
    },
  },
  {
    from: "mtq_pilot_trial",
    to: "PilotTrial",
    cols: {
      id: "id", type: "type", chain: "chain", input_amount: "inputAmount",
      input_symbol: "inputSymbol", output_amount: "outputAmount",
      output_symbol: "outputSymbol", gfb_index: "gfbIndex",
      mtq_price: "mtqPrice", nav: "nav", reserve_ratio: "reserveRatio",
      lcr: "lcr", status: "status", basket_json: "basketJson", ok: "ok",
      reason: "reason", wallet: "wallet", created_at: "createdAt",
    },
  },
  {
    from: "mtq_metric_sample",
    to: "MetricSample",
    cols: {
      id: "id", gfb_index: "gfbIndex", mtq_price: "mtqPrice", nav: "nav",
      reserve_ratio: "reserveRatio", lcr: "lcr", status: "status",
      vix: "vix", dxy: "dxy", target_gold: "targetGold",
      buffer_state: "bufferState", created_at: "createdAt",
    },
  },
];

// Turso (SQLite, already camelCase) — shared tables; columns are intersected
// with the LOCAL schema at runtime (Turso's DSV/RD carry prevHash/rowHash that
// local also has; local-only tables like AiModelCatalog are simply not listed).
const TURSO_TABLES = [
  "DailyStateVector", "OracleSample", "RebalancingDecision", "PilotTrial",
  "MetricSample", "IssuanceEvent", "MbzBackingCertificate", "MbzBank",
  "MbzMintRequest",
];

// New tables created locally from cloud DDL (verbatim structure).
const NEW_TABLE_DDL = [
  // Turso keeper_audit — production keeper telemetry absent from local schema.
  `CREATE TABLE IF NOT EXISTS keeper_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tick_at     INTEGER NOT NULL,
    tick_epoch  INTEGER NOT NULL,
    step        TEXT NOT NULL,
    status      TEXT NOT NULL,
    tx_hash     TEXT,
    gas_used    INTEGER,
    message     TEXT,
    keeper      TEXT NOT NULL,
    contract    TEXT NOT NULL
  )`,
  // Neon mtq_sync_state — the frozen mirror's durable high-water cursors.
  `CREATE TABLE IF NOT EXISTS mtq_sync_state (
    prisma_model TEXT PRIMARY KEY,
    last_tick_at INTEGER NOT NULL,
    last_id      TEXT,
    updated_at   INTEGER NOT NULL
  )`,
];

// Local columns that store epoch-ms INTEGER timestamps (normalization targets).
const TS_LOCAL_COLS = new Set(["tickAt", "createdAt", "tick_at", "last_tick_at", "updated_at"]);
// Local columns that store SQLite 0/1 booleans (Postgres true/false → 0/1).
const BOOL_LOCAL_COLS = new Set([
  "priceInBand", "chainlinkValid", "pythValid", "chronicleValid", "paused",
  "shouldRebalance", "applied", "ok",
]);

function toMs(v: unknown, col: string): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v; // already epoch-ms / int
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (Number.isNaN(ms)) throw new Error(`unparseable timestamp col=${col} val=${v.slice(0, 40)}`);
    return ms;
  }
  if (v instanceof Date) return v.getTime(); // Neon serverless driver timestamptz
  throw new Error(`unexpected timestamp type col=${col} typeof=${typeof v}`);
}

function to01(v: unknown, col: string): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "string") return v === "true" || v === "1" ? 1 : v === "false" || v === "0" ? 0 : undefined;
  throw new Error(`unexpected boolean type col=${col} typeof=${typeof v}`);
}

function normalize(localCol: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (TS_LOCAL_COLS.has(localCol)) return toMs(v, localCol);
  if (BOOL_LOCAL_COLS.has(localCol)) return to01(v, localCol);
  return v;
}

interface Tally {
  before: number;
  fetched: number;          // rows fetched from cloud sources (accumulated)
  inserted: number;         // STATEMENT-level inserted (Σ rowsAffected; accumulated)
  ignored: number;          // PK-conflict ignored by INSERT OR IGNORE (fetched-attempted − inserted)
  netDelta: number;        // Σ (after − before) row-count deltas (cross-check)
}

// Per-pass contribution snapshot (printed on each source's log line so an
// accumulated tally can never be misread as that pass's own contribution).
interface PassDelta {
  fetched: number;
  inserted: number;
  ignored: number;
  netDelta: number;
}

async function localColumns(c: ReturnType<typeof createClient>, table: string): Promise<string[]> {
  const rs = await c.execute(`PRAGMA table_info("${table}")`);
  return rs.rows.map((r) => String(r.name)).filter(Boolean);
}

async function countOf(c: ReturnType<typeof createClient>, table: string): Promise<number> {
  try {
    const rs = await c.execute(`SELECT COUNT(*) AS n FROM "${table}"`);
    return Number(Object.values(rs.rows[0] ?? {})[0] ?? 0);
  } catch (e: unknown) {
    if (String((e as { message?: string })?.message ?? e).includes("no such table")) return 0; // dry-run pre-DDL
    throw e;
  }
}

async function retryBusy<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 6; i++) {
    try { return await fn(); } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e);
      if (/BUSY|LOCKED|SQLITE_BUSY/i.test(msg)) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error(`[import] ${label}: still busy after retries: ${String(lastErr)}`);
}

// ─── main ───────────────────────────────────────────────────────────────────
const tursoUrl = process.env.TURSO_URL;
const tursoToken = process.env.TURSO_TOKEN;
const neonUrl = process.env.NEON_PG;
if (!neonUrl) { console.error("[import] FAIL — NEON_PG not set (inline env only; see /tmp/cloud.env convention)"); process.exit(2); }
if (!tursoUrl || !tursoToken) { console.error("[import] FAIL — TURSO_URL/TURSO_TOKEN not set"); process.exit(2); }

const local = createClient({ url: `file:${CUSTOM_DB}` });
try { await local.execute("PRAGMA busy_timeout=10000"); } catch { /* best-effort */ }

// Safety gate: live custom.db must be mature (never import onto a stub).
const liveProbe = await probeCustomRows(CUSTOM_DB);
if (!liveProbe.ok || liveProbe.rows < CUSTOM_MIN_ROWS) {
  console.error(`[import] FAIL — local custom.db unreadable or below floor (${liveProbe.ok ? liveProbe.rows : "unreadable"} < ${CUSTOM_MIN_ROWS}); refusing.`);
  process.exit(1);
}
console.log(`[import] preflight OK — live custom rows=${liveProbe.rows} (floor ${CUSTOM_MIN_ROWS}) · mode=${DRY_RUN ? "DRY-RUN" : "EXECUTE"}`);

const turso = createClient({ url: tursoUrl, authToken: tursoToken });
const neonModule = await import("@neondatabase/serverless");
const neonFn = neonModule.neon(neonUrl) as unknown as { query: (q: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };
const pg = (q: string, p: unknown[] = []): Promise<Record<string, unknown>[]> => neonFn.query(q, p);

const tallies = new Map<string, Tally>();
const bump = (t: string, d: Partial<PassDelta>) => {
  const cur = tallies.get(t) ?? { before: 0, fetched: 0, inserted: 0, ignored: 0, netDelta: 0 };
  cur.fetched += d.fetched ?? 0;
  cur.inserted += d.inserted ?? 0;
  cur.ignored += d.ignored ?? 0;
  cur.netDelta += d.netDelta ?? 0;
  tallies.set(t, cur);
};

const passLine = (table: string, source: string, pass: PassDelta, t: Tally): string =>
  `[import] ${table} ← ${source}: pass(+) fetched=${pass.fetched} inserted=${pass.inserted} ` +
  `ignored=${pass.ignored} net=${pass.netDelta} | totals fetched=${t.fetched} inserted=${t.inserted} ` +
  `ignored=${t.ignored} net=${t.netDelta} (before=${t.before})`;

async function insertRows(
  table: string,
  localCols: string[],
  rows: Record<string, unknown>[],
): Promise<{ inserted: number; before: number; after: number }> {
  // rows are keyed by LOCAL column names, values already normalized.
  // Returns the STATEMENT-LEVEL inserted count (Σ rowsAffected — the V31 §9
  // Phase 2 correction: immune to concurrent app writes / retention prunes)
  // alongside the before/after counts (kept as a cross-check; their delta may
  // legitimately differ from the statement count when the app writes or a
  // prune runs during the import window).
  if (rows.length === 0) return { inserted: 0, before: NaN, after: NaN };
  const cols = localCols.filter((c) => rows.some((r) => r[c] !== undefined));
  const placeholders = cols.map(() => "?").join(", ");
  const sqlStmt = `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
  const before = await countOf(local, table);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const stmts = chunk.map((r) => ({
      sql: sqlStmt,
      args: cols.map((c) => (r[c] === undefined ? null : r[c])),
    }));
    const results = await retryBusy(() => local.batch(stmts, "write"), `${table} chunk ${i / 500}`);
    for (const r of results) inserted += Number(r?.rowsAffected ?? 0);
  }
  const after = await countOf(local, table);
  return { inserted, before, after };
}

// ─── pass 1: Neon (deepest history) ────────────────────────────────────────
for (const map of NEON_TABLES) {
  const localCols = await localColumns(local, map.to);
  if (localCols.length === 0) { console.log(`[import] ${map.to}: no local table — skipping Neon ${map.from}`); continue; }
  const before = await countOf(local, map.to);
  tallies.set(map.to, { before, fetched: 0, inserted: 0, ignored: 0, netDelta: 0 });
  const neonCols = Object.keys(map.cols);
  const colList = neonCols.map((c) => `"${c}"`).join(", ");
  let lastId = "";
  let fetched = 0;
  const pending: Record<string, unknown>[] = [];
  for (;;) {
    const page = await pg(`SELECT ${colList} FROM ${map.from} WHERE id > $1 ORDER BY id LIMIT 2000`, [lastId]) as Record<string, unknown>[];
    if (page.length === 0) break;
    for (const r of page) {
      const out: Record<string, unknown> = {};
      for (const [nc, lc] of Object.entries(map.cols)) {
        if (!localCols.includes(lc)) continue;
        out[lc] = normalize(lc, r[nc]);
      }
      pending.push(out);
      lastId = String(r.id);
    }
    fetched += page.length;
    if (page.length < 2000) break;
  }
  const pass: PassDelta = { fetched, inserted: 0, ignored: 0, netDelta: 0 };
  bump(map.to, pass);
  if (!DRY_RUN) {
    const r = await insertRows(map.to, localCols, pending);
    pass.inserted = r.inserted;
    pass.ignored = Math.max(0, fetched - r.inserted);
    pass.netDelta = Number.isFinite(r.after) && Number.isFinite(r.before) ? r.after - r.before : 0;
    bump(map.to, pass);
  }
  console.log(passLine(map.to, `neon/${map.from}`, pass, tallies.get(map.to)!));
}

// ─── pass 2: Turso (newer window + keeper_audit) ────────────────────────────
const tursoMaster = (await turso.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map((r) => String(r.name));
for (const t of TURSO_TABLES) {
  if (!tursoMaster.includes(t)) { console.log(`[import] ${t}: absent in Turso — skipping`); continue; }
  const localCols = await localColumns(local, t);
  if (localCols.length === 0) { console.log(`[import] ${t}: no local table — skipping Turso`); continue; }
  if (!tallies.has(t)) tallies.set(t, { before: await countOf(local, t), fetched: 0, inserted: 0, ignored: 0, netDelta: 0 });
  const cols = localCols; // import every column the LOCAL schema has
  const colList = cols.map((c) => `"${c}"`).join(", ");
  let lastId = "";
  let fetched = 0;
  const pending: Record<string, unknown>[] = [];
  for (;;) {
    const page = (await turso.execute({ sql: `SELECT ${colList} FROM "${t}" WHERE id > ? ORDER BY id LIMIT 2000`, args: [lastId] })).rows as unknown as Record<string, unknown>[];
    if (page.length === 0) break;
    for (const r of page) {
      const out: Record<string, unknown> = {};
      for (const c of cols) out[c] = normalize(c, r[c]);
      pending.push(out);
      lastId = String(r.id);
    }
    fetched += page.length;
    if (page.length < 2000) break;
  }
  const pass: PassDelta = { fetched, inserted: 0, ignored: 0, netDelta: 0 };
  bump(t, pass);
  if (!DRY_RUN) {
    const r = await insertRows(t, localCols, pending);
    pass.inserted = r.inserted;
    pass.ignored = Math.max(0, fetched - r.inserted);
    pass.netDelta = Number.isFinite(r.after) && Number.isFinite(r.before) ? r.after - r.before : 0;
    bump(t, pass);
  }
  console.log(passLine(t, "turso", pass, tallies.get(t)!));
}

// ─── pass 3: new tables (keeper_audit ← Turso · mtq_sync_state ← Neon) ─────
if (!DRY_RUN) {
  for (const ddl of NEW_TABLE_DDL) await retryBusy(() => local.execute(ddl), "new-table ddl");
}

// keeper_audit (integer PK pagination)
{
  const before = await countOf(local, "keeper_audit");
  tallies.set("keeper_audit", { before, fetched: 0, inserted: 0, ignored: 0, netDelta: 0 });
  const cols = ["id", "tick_at", "tick_epoch", "step", "status", "tx_hash", "gas_used", "message", "keeper", "contract"];
  const colList = cols.join(", ");
  let lastId = 0;
  let fetched = 0;
  const pending: Record<string, unknown>[] = [];
  for (;;) {
    const page = (await turso.execute({ sql: `SELECT ${colList} FROM keeper_audit WHERE id > ? ORDER BY id LIMIT 2000`, args: [lastId] })).rows as unknown as Record<string, unknown>[];
    if (page.length === 0) break;
    for (const r of page) {
      const out: Record<string, unknown> = {};
      for (const c of cols) out[c] = normalize(c, r[c]);
      pending.push(out);
      lastId = Number(r.id);
    }
    fetched += page.length;
    if (page.length < 2000) break;
  }
  const pass: PassDelta = { fetched, inserted: 0, ignored: 0, netDelta: 0 };
  bump("keeper_audit", pass);
  if (!DRY_RUN) {
    const r = await insertRows("keeper_audit", cols, pending);
    pass.inserted = r.inserted;
    pass.ignored = Math.max(0, fetched - r.inserted);
    pass.netDelta = Number.isFinite(r.after) && Number.isFinite(r.before) ? r.after - r.before : 0;
    bump("keeper_audit", pass);
  }
  console.log(passLine("keeper_audit", "turso", pass, tallies.get("keeper_audit")!));
}

// mtq_sync_state (mirror high-water cursors; 3 rows)
{
  const rows = await pg(`SELECT prisma_model, last_tick_at, last_id, updated_at FROM mtq_sync_state ORDER BY prisma_model`) as Record<string, unknown>[];
  const before = await countOf(local, "mtq_sync_state");
  tallies.set("mtq_sync_state", { before, fetched: rows.length, inserted: 0, ignored: 0, netDelta: 0 });
  const pass: PassDelta = { fetched: rows.length, inserted: 0, ignored: 0, netDelta: 0 };
  if (!DRY_RUN && rows.length > 0) {
    const pending = rows.map((r) => ({
      prisma_model: r.prisma_model,
      last_tick_at: toMs(r.last_tick_at, "last_tick_at"),
      last_id: r.last_id,
      updated_at: toMs(r.updated_at, "updated_at"),
    }));
    const r = await insertRows("mtq_sync_state", ["prisma_model", "last_tick_at", "last_id", "updated_at"], pending);
    pass.inserted = r.inserted;
    pass.ignored = Math.max(0, rows.length - r.inserted);
    pass.netDelta = Number.isFinite(r.after) && Number.isFinite(r.before) ? r.after - r.before : 0;
    bump("mtq_sync_state", pass);
  }
  console.log(passLine("mtq_sync_state", "neon", pass, tallies.get("mtq_sync_state")!));
}

// Neon local_cache (701 rows) deliberately SKIPPED: pg_prewarm platform telemetry.
console.log("[import] local_cache ← neon: SKIPPED (pg_prewarm platform buffer stats — not MTQΣ application data)");

// ─── final verification ─────────────────────────────────────────────────────
let integrity = "n/a";
if (!DRY_RUN) {
  const qc = await local.execute("PRAGMA quick_check");
  integrity = String(Object.values(qc.rows[0] ?? {})[0] ?? "unknown");
}
// Statement-level totals (V31 §9 Phase 2 correction) + count-method cross-check:
//   inserted      = Σ rowsAffected — actual INSERT OR IGNORE insertions
//   ignored       = fetched − inserted — PK-conflict skips (identical-content
//                   vs different-content classification requires a source-vs-
//                   local row comparison; the importer never overwrites a
//                   local row, so conflicts are preserved, not lost)
//   netDelta      = Σ (after − before) — the old count-based figure
//   concurrent    = netDelta − inserted — app writes minus retention prunes
//                   that the old count-based method silently absorbed
const totalInserted = [...tallies.values()].reduce((a, t) => a + t.inserted, 0);
const totalFetched = [...tallies.values()].reduce((a, t) => a + t.fetched, 0);
const totalIgnored = [...tallies.values()].reduce((a, t) => a + t.ignored, 0);
const totalNetDelta = [...tallies.values()].reduce((a, t) => a + t.netDelta, 0);
const finalRows = await probeCustomRows(CUSTOM_DB);

console.log(
  `CLOUD_IMPORT_DONE result=OK mode=${DRY_RUN ? "DRY-RUN" : "EXECUTE"} ` +
  `sources=neon+turso tables=${tallies.size} fetched=${totalFetched} ` +
  `inserted=${totalInserted} ignored=${totalIgnored} netDelta=${totalNetDelta} ` +
  `concurrent=${totalNetDelta - totalInserted} ` +
  `customRows=${finalRows.ok ? finalRows.rows : "unreadable"} integrity=${integrity} ` +
  `chainUntouched=yes skipped=local_cache(neon-platform-internal)`,
);
local.close();
turso.close();
