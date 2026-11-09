// MTQΣ — Database self-heal + cloud-layer sync engine (Task 42 root-cause remediation).
//
// WHY (incident 2026-11-06, worklog Task 39/42): this sandbox is periodically
// RE-IMAGED, and the re-image wipes gitignored paths — db/chain.db and
// db/custom.db are DELETED (chain re-seeds to genesis, custom telemetry is
// wiped). Git-tracked truth (backups/db-snapshots/latest-*.sql) survives.
// Until now recovery was MANUAL: detection only ran at session-open, and the
// dev-server watchdog happily restarted `next dev` onto a wiped DB, which
// silently re-seeded a fresh chain (divergence + forensic mess).
//
// THIS MODULE closes the root-cause loop end-to-end:
//   1. dumpDatabase()      — v2 SELF-CONTAINED dumps (schema + data + tip
//                            line, atomic tmp+rename write) into the
//                            git-tracked cloud-layer paths.
//   2. selfHealDatabases() — forward-only auto-restore: whenever the cloud
//                            dump is STRICTLY AHEAD of the live DB (missing,
//                            corrupt, or genesis-scale), archive the regressed
//                            file and rebuild it from the dump, verified
//                            (integrity + exact tip). NEVER touches a live DB
//                            that is at/ahead of the dump.
//   3. cloudSyncRefresh()  — write-behind refresh of the cloud layer so the
//                            worst-case loss window is bounded (~minutes of
//                            chain, not hours). Refuses to overwrite a dump
//                            that is BETTER than the live DB (a wipe must
//                            never destroy the cloud copy).
//   4. Sentinel            — db/ALLOW-GENESIS-RESET (gitignored, first line =
//                            expiry epoch-ms, second line = reason): the
//                            explicit owner opt-out for an INTENTIONAL reset.
//                            While fresh, auto-heal stands down so a recorded
//                            reset can persist (loud-and-acknowledged beats
//                            silent data loss — same philosophy as the
//                            session-open battery).
//
// Wiring (three independent layers, any one of which is sufficient):
//   - src/lib/chain/node.ts ensureChainNode() → runs selfHealDatabases()
//     BEFORE any schema/genesis work, so the re-seed path is unreachable
//     whenever the cloud layer is ahead (this runs no matter WHO starts the
//     dev server — platform restart, watchdog, or manual).
//   - dev-watchdog.sh → pre-boot `scripts/db-selfheal.ts` before every
//     `next dev` start.
//   - scripts/db-cloud-sync.ts (loop under dev-watchdog.sh) → continuous
//     dump refresh + mid-run regression detection (kills the server so the
//     watchdog reboot heals; only when the watchdog is alive to restart it).
//
// Dependency policy: @libsql/client + node builtins ONLY (importable from
// the Next.js server AND plain bun scripts; no Prisma, no server-only APIs).

import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const moduleInsideBuildOutput = moduleRoot.includes(join(sep, ".next", sep));

/**
 * Canonical deployment root for the data layer (v28 §5 root-cause fix).
 *
 * Production-build acceptance found the standalone server silently
 * operating on a BUILD-TIME COPY of the databases: Turbopack's whole-project
 * tracing (triggered by the dynamic fs access in this module) places db/,
 * config/ and more inside .next/standalone/, and Next's standalone
 * server.js runs `process.chdir(<bundle root>)` at boot — so every
 * cwd-relative resolution inside the server landed on the stale copy.
 * Observed live: the standalone chain node resumed at the build-time tip
 * and appended blocks into the BUNDLE copy (h16764–h16791, then h16836–
 * h16875 across two verification runs) while the canonical db/ — guarded by
 * write-behind dumps, self-heal, cloud-sync and plane-5 monitoring — stayed
 * frozen: a silent data-layer fork.
 *
 * Resolution order (mirrors the MTQ_SIGMA_ROOT override contract already
 * used by src/lib/boot/git-drift.ts):
 *   1. MTQ_SIGMA_ROOT env override (tests / deliberate relocation);
 *   2. when the process runs FROM the in-repo bundle (cwd ends with
 *      .next/standalone — the chdir performed by server.js), the canonical
 *      root is two levels above it;
 *   3. a module that still lives in the source tree (dev server and plain
 *      `bun run scripts/*`) keeps the cwd-independent source-tree
 *      resolution — unchanged behavior;
 *   4. a bundled module launched in place falls back to the launch
 *      directory.
 */
export function canonicalRoot(): string {
  if (process.env.MTQ_SIGMA_ROOT) return resolve(process.env.MTQ_SIGMA_ROOT);
  const cwd = process.cwd();
  if (cwd.endsWith(join(".next", "standalone"))) return resolve(cwd, "..", "..");
  if (!moduleInsideBuildOutput) return moduleRoot;
  return resolve(cwd);
}

const ROOT = canonicalRoot();

// V31 Phase 5 (incidents 5/6): fail-closed boot assertion. The canonical
// databases must NEVER resolve inside build output — a root under .next/
// means cwd-based resolution regressed (Turbopack standalone geometry) and
// every write would land in a bundled copy that dies with the next build,
// silently splitting the database layer. Refuse to boot instead.
// canonicalRoot() already unwinds .next/standalone, so this assertion firing
// means a NEW resolution defect — the loud failure is the point.
assertRootOutsideBuildOutput(ROOT);

export function assertRootOutsideBuildOutput(root: string): void {
  if (
    root.split(sep).includes(".next") ||
    root === ".next" ||
    root.endsWith(sep + ".next")
  ) {
    throw new Error(
      `[db-ops] FAIL-CLOSED BOOT (V31 Phase 5, incidents 5/6): canonical DB root ${root} resolves inside build output (.next/) — refusing to operate on a bundled database copy. Fix path resolution or set MTQ_SIGMA_ROOT to the real repository root.`
    );
  }
}

export const DB_DIR = join(ROOT, "db");
export const CHAIN_DB = join(DB_DIR, "chain.db");
export const CUSTOM_DB = join(DB_DIR, "custom.db");
export const SNAP_DIR = join(ROOT, "backups", "db-snapshots");
export const CHAIN_DUMP = join(SNAP_DIR, "latest-chain.sql");
export const CUSTOM_DUMP = join(SNAP_DIR, "latest-custom.sql");
const ARCHIVE_DIR = join(ROOT, "mtq-sigma-backups", "selfheal-archive");
export const SENTINEL_PATH = join(DB_DIR, "ALLOW-GENESIS-RESET");

// Floors mirror scripts/check-db-regression.ts (the loud session-open gate).
export const CHAIN_MIN_HEIGHT = 500;
export const CUSTOM_MIN_ROWS = 4000;

// F-47-2 (incident #8 — prune-vs-restore kill loop): the audit-trail
// retention prune (pruneAuditTrail: MAX_REBALANCING_DECISIONS 10k ·
// MAX_DAILY_STATE_VECTORS 5k · MAX_ORACLE_SAMPLES 5k, batches of 1000)
// legitimately DELETES rows at runtime, so a live custom row count a few
// rows BELOW the dump tip is NOT a wipe regression. A real regression leaves
// a stub (incident #7: 221KB, < CUSTOM_MIN_ROWS rows) — a ≥10% deficit.
// Tolerating sub-10% deficits keeps every real regression detected (stub at
// ~5-25% of dump → far below the 90% line) while ending the false-positive
// loop: prune → "live behind dump" → kill → restore resurrects pruned rows →
// prune again → kill every 60s. Shared by selfHealDatabases(),
// cloudSyncRefresh() and scripts/db-cloud-sync.ts so all three sites apply
// the SAME semantics.
const PRUNE_TOLERANCE_RATIO = 0.90;

/** True when the live custom row count is MATERIALLY behind the dump tip
 *  (wipe/regression signature), tolerating legitimate retention prune churn.
 *  `liveRows` 0 covers the missing/unreadable probe case. */
export function customBehindDump(liveRows: number, dumpRows: number): boolean {
  const materialFloor = Math.max(
    CUSTOM_MIN_ROWS,
    Math.floor(dumpRows * PRUNE_TOLERANCE_RATIO),
  );
  return liveRows < materialFloor;
}

// Cloud-sync write-behind thresholds: refresh a dump once the live DB has
// moved this far past the dump tip (chain ~1 block/3-5s idle → 60 blocks ≈
// 3-5 min worst-case loss; custom telemetry grows slower, 400 rows ≈ tens
// of minutes). Both bounds are minutes, vs the 2026-11-06 incident's 25h.
const SYNC_CHAIN_DELTA = 60;
const SYNC_CUSTOM_DELTA = 400;

// ─── dump (v2: self-contained schema+data) ───────────────────────────────────

export interface DumpInfo {
  db: string;
  out: string;
  rows: number;
  tables: number;
  height: number | null;
}

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return `X'${Buffer.from(v as Uint8Array).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Data + schema logical dump. Self-contained: restoring needs nothing but an
 * empty file and executeMultiple() — no Prisma db:push, no initSchema().
 * Format:
 *   -- header comments
 *   -- MTQ-DUMP-TIP rows=N height=H tables=T [table:count …]   ← machine-readable
 *   PRAGMA foreign_keys=OFF;
 *   BEGIN TRANSACTION;
 *   CREATE TABLE …;  CREATE INDEX …;                            ← schema
 *   INSERT …;                                                   ← data
 *   COMMIT;
 * Atomic on-disk: written to `<out>.tmp` then renamed, so a concurrent git
 * auto-commit can never snapshot a torn dump.
 */
export async function dumpDatabase(dbPath: string, outPath: string): Promise<DumpInfo> {
  const c = createClient({ url: `file:${dbPath}` });
  try {
    const tables = (await c.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )).rows.map((r) => String(Object.values(r)[0]));
    // NOTE: sqlite_master stores CREATE statements WITHOUT the trailing
    // semicolon — each DDL line must be terminated explicitly or consecutive
    // statements fuse into a syntax error on restore.
    const sem = (s: string) => (s.endsWith(";") ? s : `${s};`);
    const ddlTables = (await c.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )).rows.map((r) => sem(String(r.sql).trim()));
    const ddlIndexes = (await c.execute(
      "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )).rows.map((r) => sem(String(r.sql).trim()));

    let height: number | null = null;
    if (tables.includes("blocks")) {
      height = Number(
        Object.values((await c.execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks")).rows[0] ?? {})[0] ?? 0,
      );
    }

    const stamp = new Date().toISOString();
    const parts: string[] = [
      `-- MTQΣ logical backup (format v2: schema+data, self-contained) ${dbPath} @ ${stamp}`,
      `-- Restore: executeMultiple() this file into an EMPTY sqlite file — schema included.`,
    ];
    let rows = 0;
    const counts: string[] = [];
    const dataParts: string[] = [];
    for (const t of tables) {
      const rs = (await c.execute(`SELECT * FROM "${t}"`)).rows;
      rows += rs.length;
      counts.push(`${t}:${rs.length}`);
      if (rs.length === 0) continue;
      const cols = Object.keys(rs[0] as Record<string, unknown>);
      const colList = cols.map((x) => `"${x}"`).join(",");
      for (const r of rs) {
        const vals = cols.map((k) => sqlValue((r as Record<string, unknown>)[k])).join(",");
        dataParts.push(`INSERT INTO "${t}" (${colList}) VALUES (${vals});`);
      }
    }
    parts.push(`-- MTQ-DUMP-TIP rows=${rows} height=${height ?? "-"} tables=${tables.length} [${counts.join(" ")}]`);
    parts.push(`PRAGMA foreign_keys=OFF;`, `BEGIN TRANSACTION;`, `-- schema`);
    parts.push(...ddlTables, ...ddlIndexes, `-- data`);
    parts.push(...dataParts, `COMMIT;`, ``);

    const tmp = `${outPath}.tmp`;
    writeFileSync(tmp, parts.join("\n") + "\n");
    renameSync(tmp, outPath);
    return { db: dbPath, out: outPath, rows, tables: tables.length, height };
  } finally {
    c.close();
  }
}

// ─── dump tip reader (v2 fast path + v1 fallback) ────────────────────────────

export interface DumpTip {
  v2: boolean;
  rows: number;
  height: number | null;
}

/** Parse the tip of a dump. v2 dumps carry a machine-readable tip line;
 *  legacy v1 dumps (data-only, pre-Task-42) are parsed by scanning INSERTs
 *  (blocks' first column is height). Returns null if the dump is absent. */
export function readDumpTip(dumpPath: string): DumpTip | null {
  if (!existsSync(dumpPath)) return null;
  let text: string;
  try {
    text = readFileSync(dumpPath, "utf8");
  } catch {
    return null;
  }
  const m = text.match(/^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+|-) tables=(\d+)/m);
  if (m) return { v2: true, rows: Number(m[1]), height: m[2] === "-" ? null : Number(m[2]) };
  const insertCount = (text.match(/^INSERT INTO /gm) ?? []).length;
  let height: number | null = null;
  const blocksRe = /^INSERT INTO "blocks" \([^)]*\) VALUES \((\d+),/gm;
  let mm: RegExpExecArray | null;
  while ((mm = blocksRe.exec(text))) {
    const v = Number(mm[1]);
    if (height === null || v > height) height = v;
  }
  return { v2: false, rows: insertCount, height };
}

// ─── safe live-state probes ──────────────────────────────────────────────────

export type ChainProbe = { ok: true; height: number } | { ok: false; reason: "missing" | "unreadable" };
export type CustomProbe = { ok: true; rows: number } | { ok: false; reason: "missing" | "unreadable" };

export async function probeChainHeight(dbPath: string): Promise<ChainProbe> {
  if (!existsSync(dbPath)) return { ok: false, reason: "missing" };
  const c = createClient({ url: `file:${dbPath}` });
  try {
    const r = await c.execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks");
    return { ok: true, height: Number(Object.values(r.rows[0] ?? {})[0] ?? 0) };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    c.close();
  }
}

export async function probeCustomRows(dbPath: string): Promise<CustomProbe> {
  if (!existsSync(dbPath)) return { ok: false, reason: "missing" };
  const c = createClient({ url: `file:${dbPath}` });
  try {
    const tables = (await c.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )).rows.map((r) => String(Object.values(r)[0]));
    let rows = 0;
    for (const t of tables) {
      rows += Number(Object.values((await c.execute(`SELECT count(*) c FROM "${t}"`)).rows[0] ?? {})[0] ?? 0);
    }
    return { ok: true, rows };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    c.close();
  }
}

// ─── sentinel (intentional-reset opt-out) ────────────────────────────────────

export interface SentinelInfo {
  active: boolean;
  expiresAt: number | null;
  reason: string;
  malformed: boolean;
}

export function sentinelActive(): SentinelInfo {
  const none: SentinelInfo = { active: false, expiresAt: null, reason: "", malformed: false };
  try {
    if (!existsSync(SENTINEL_PATH)) return none;
    const text = readFileSync(SENTINEL_PATH, "utf8").trim();
    const nl = text.indexOf("\n");
    const first = nl === -1 ? text : text.slice(0, nl);
    const reason = nl === -1 ? "" : text.slice(nl + 1).trim();
    const exp = Number(first);
    if (!Number.isFinite(exp) || exp <= 0) {
      return { active: false, expiresAt: null, reason, malformed: true };
    }
    return { active: exp > Date.now(), expiresAt: exp, reason, malformed: false };
  } catch {
    return none;
  }
}

export function writeSentinel(hours: number, reason: string): void {
  mkdirSync(dirname(SENTINEL_PATH), { recursive: true });
  const exp = Date.now() + Math.round(hours * 3600_000);
  writeFileSync(SENTINEL_PATH, `${exp}\n${reason}\n`);
}

// ─── restore (forward-only, verified) ────────────────────────────────────────

interface RestoreOpts {
  kind: "chain" | "custom";
  dbPath: string;
  dumpPath: string;
  expectHeight?: number;
  expectRows?: number;
  log?: (s: string) => void;
}

/**
 * Rebuild a database from a dump. Steps:
 *   1. ARCHIVE the current file (+ journal/wal/shm siblings) to
 *      mtq-sigma-backups/selfheal-archive/<ts>-<kind>/ (forensics — never
 *      destroy the regressed state, it may contain unrecoverable post-dump
 *      writes that must be honestly bounded).
 *   2. Create the schema (embedded in v2 dumps; legacy v1 falls back to
 *      initSchema() for chain / `prisma db push` for custom).
 *   3. Apply the dump in one transaction, then VERIFY: integrity_check ok,
 *      exact expected tip/rows. On any failure the half-built file is
 *      REMOVED (nothing may boot on a torn restore) and the error rethrown —
 *      the archive + the git-tracked dump remain intact.
 */
async function restoreDbFromDump(opts: RestoreOpts): Promise<void> {
  const { kind, dbPath, dumpPath } = opts;
  const log = opts.log ?? (() => {});
  const sql = readFileSync(dumpPath, "utf8");
  const selfContained = sql.includes("CREATE TABLE");

  const ts = new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
  const arcDir = join(ARCHIVE_DIR, `${ts}-${kind}`);
  mkdirSync(arcDir, { recursive: true });
  for (const p of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(p)) {
      renameSync(p, join(arcDir, basename(p)));
      log(`[selfheal] archived ${basename(p)} → ${arcDir}`);
    }
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  if (!selfContained) {
    log(`[selfheal] legacy v1 dump (data-only) — creating schema first`);
    if (kind === "chain") {
      const { initSchema } = await import("./chain/store");
      await initSchema();
    } else {
      execSync("bun run db:push", { cwd: ROOT, stdio: "pipe" });
    }
  }

  const c = createClient({ url: `file:${dbPath}` });
  try {
    await c.executeMultiple(sql);
    const integ = await c.execute("PRAGMA integrity_check");
    const integOk = String(Object.values(integ.rows[0] ?? {})[0] ?? "");
    if (integOk !== "ok") throw new Error(`integrity_check returned '${integOk}'`);

    if (kind === "chain") {
      const h = Number(
        Object.values((await c.execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks")).rows[0] ?? {})[0] ?? 0,
      );
      if (opts.expectHeight !== undefined && h !== opts.expectHeight) {
        throw new Error(`restored chain height ${h} != dump tip ${opts.expectHeight}`);
      }
      const stamp = new Date().toISOString();
      await c.execute({
        sql: "INSERT INTO meta (key, value) VALUES ('boot_mode', 'self-healed') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [],
      });
      await c.execute({
        sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: ["selfheal_at", stamp],
      });
      await c.execute({
        sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: ["selfheal_dump", basename(dumpPath)],
      });
    } else {
      const tables = (await c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )).rows.map((r) => String(Object.values(r)[0]));
      let total = 0;
      for (const t of tables) {
        total += Number(Object.values((await c.execute(`SELECT count(*) c FROM "${t}"`)).rows[0] ?? {})[0] ?? 0);
      }
      if (opts.expectRows !== undefined && total !== opts.expectRows) {
        throw new Error(`restored custom rows ${total} != dump rows ${opts.expectRows}`);
      }
    }
  } catch (e) {
    c.close();
    for (const p of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
      if (existsSync(p)) {
        try { rmSync(p, { force: true }); } catch { /* best-effort */ }
      }
    }
    throw e;
  } finally {
    c.close();
  }
}

// ─── self-heal decision engine ───────────────────────────────────────────────

export interface HealAction {
  action: "none" | "restored" | "no-dump" | "sentinel";
  live: string;
  dump: string;
  note?: string;
}

export interface HealReport {
  chain: HealAction;
  custom: HealAction;
  healed: boolean;
  error?: string;
}

/**
 * Forward-only database self-heal. Restores a DB from its git-tracked cloud
 * dump ONLY when the dump is strictly ahead (live missing / unreadable /
 * genesis-scale / behind). A live DB at or ahead of the dump is never
 * touched — this can never roll data back, only forward.
 */
export async function selfHealDatabases(opts: { log?: (s: string) => void } = {}): Promise<HealReport> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const sentinel = sentinelActive();
  const report: HealReport = {
    chain: { action: "none", live: "", dump: "" },
    custom: { action: "none", live: "", dump: "" },
    healed: false,
  };

  if (sentinel.active) {
    report.chain = { action: "sentinel", live: "-", dump: "-", note: "intentional reset acknowledged" };
    report.custom = { action: "sentinel", live: "-", dump: "-", note: "intentional reset acknowledged" };
    log(`[selfheal] sentinel active (expires ${new Date(sentinel.expiresAt ?? 0).toISOString()}, reason: ${sentinel.reason || "n/a"}) — standing down`);
    return report;
  }

  // chain.db
  const chainProbe = await probeChainHeight(CHAIN_DB);
  const chainTip = readDumpTip(CHAIN_DUMP);
  const chainDumpH = chainTip?.height ?? 0;
  const liveChainH = chainProbe.ok ? chainProbe.height : 0;
  report.chain.live = chainProbe.ok ? `h${chainProbe.height}` : chainProbe.reason;
  report.chain.dump = chainTip
    ? `${chainTip.v2 ? "v2" : "v1"} h${chainTip.height ?? 0} · ${chainTip.rows} rows`
    : "none";
  if (chainTip && chainDumpH > liveChainH) {
    try {
      await restoreDbFromDump({ kind: "chain", dbPath: CHAIN_DB, dumpPath: CHAIN_DUMP, expectHeight: chainDumpH, log });
      report.chain.action = "restored";
      report.healed = true;
      log(`[selfheal] chain.db RESTORED from cloud dump (live ${report.chain.live} → h${chainDumpH})`);
    } catch (e) {
      report.error = `chain restore failed: ${e instanceof Error ? e.message : String(e)}`;
      log(`[selfheal] ERROR — ${report.error}`);
    }
  } else if (!chainTip && !chainProbe.ok) {
    report.chain.action = "no-dump";
    report.chain.note = "no DB and no cloud dump — fresh environment, first boot will seed genesis";
  }

  // custom.db
  const customProbe = await probeCustomRows(CUSTOM_DB);
  const customTip = readDumpTip(CUSTOM_DUMP);
  const liveCustomRows = customProbe.ok ? customProbe.rows : 0;
  report.custom.live = customProbe.ok ? `${customProbe.rows} rows` : customProbe.reason;
  report.custom.dump = customTip
    ? `${customTip.v2 ? "v2" : "v1"} ${customTip.rows} rows`
    : "none";
  if (customTip && customBehindDump(liveCustomRows, customTip.rows)) {
    try {
      await restoreDbFromDump({ kind: "custom", dbPath: CUSTOM_DB, dumpPath: CUSTOM_DUMP, expectRows: customTip.rows, log });
      report.custom.action = "restored";
      report.healed = true;
      log(`[selfheal] custom.db RESTORED from cloud dump (live ${report.custom.live} → ${customTip.rows} rows)`);
    } catch (e) {
      report.error = `${report.error ? report.error + " · " : ""}custom restore failed: ${e instanceof Error ? e.message : String(e)}`;
      log(`[selfheal] ERROR — custom restore failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (!customTip && !customProbe.ok) {
    report.custom.action = "no-dump";
    report.custom.note = "no DB and no cloud dump — fresh environment";
  }

  return report;
}

// ─── cloud-layer write-behind sync ───────────────────────────────────────────

export interface SyncDbOutcome {
  refreshed: boolean;
  detail: string;
}

export interface SyncReport {
  chain: SyncDbOutcome;
  custom: SyncDbOutcome;
}

/**
 * Refresh the git-tracked cloud dumps when the live databases have moved
 * past them (bounded write-behind). CRITICAL SAFETY: a dump is NEVER
 * regenerated when the live DB is BEHIND the existing dump — that is the
 * re-image regression signature, and overwriting the good cloud copy with
 * a wiped/genesis-scale dump would destroy the recovery source of record.
 */
export async function cloudSyncRefresh(opts: { log?: (s: string) => void } = {}): Promise<SyncReport> {
  const log = opts.log ?? (() => {});
  const out: SyncReport = {
    chain: { refreshed: false, detail: "" },
    custom: { refreshed: false, detail: "" },
  };

  // chain
  const cp = await probeChainHeight(CHAIN_DB);
  const ct = readDumpTip(CHAIN_DUMP);
  if (!cp.ok) {
    out.chain.detail = `live ${cp.reason} — dump suppressed (self-heal territory)`;
  } else if (ct && (ct.height ?? 0) > cp.height) {
    out.chain.detail = `live h${cp.height} BEHIND dump h${ct.height} — refresh suppressed (regression signature)`;
    log(`[cloud-sync] REGRESSION SIGNATURE — ${out.chain.detail}`);
  } else if (!ct || !ct.v2) {
    const info = await dumpDatabase(CHAIN_DB, CHAIN_DUMP);
    out.chain.refreshed = true;
    out.chain.detail = `dump ${!ct ? "missing" : "legacy v1"} → v2 (h${info.height}, ${info.rows} rows)`;
  } else {
    const delta = cp.height - (ct.height ?? 0);
    if (delta >= SYNC_CHAIN_DELTA) {
      const info = await dumpDatabase(CHAIN_DB, CHAIN_DUMP);
      out.chain.refreshed = true;
      out.chain.detail = `+${delta} blocks past dump tip → refreshed (h${info.height}, ${info.rows} rows)`;
    } else {
      out.chain.detail = `h${cp.height} vs dump h${ct.height ?? "-"} (Δ${delta} < ${SYNC_CHAIN_DELTA})`;
    }
  }

  // custom
  const xp = await probeCustomRows(CUSTOM_DB);
  const xt = readDumpTip(CUSTOM_DUMP);
  if (!xp.ok) {
    out.custom.detail = `live ${xp.reason} — dump suppressed (self-heal territory)`;
  } else if (xt && customBehindDump(xp.rows, xt.rows)) {
    out.custom.detail = `live ${xp.rows} rows BEHIND dump ${xt.rows} (material deficit) — refresh suppressed (regression signature)`;
    log(`[cloud-sync] REGRESSION SIGNATURE — ${out.custom.detail}`);
  } else if (!xt || !xt.v2) {
    const info = await dumpDatabase(CUSTOM_DB, CUSTOM_DUMP);
    out.custom.refreshed = true;
    out.custom.detail = `dump ${!xt ? "missing" : "legacy v1"} → v2 (${info.rows} rows)`;
  } else {
    const delta = xp.rows - xt.rows;
    if (delta >= SYNC_CUSTOM_DELTA) {
      const info = await dumpDatabase(CUSTOM_DB, CUSTOM_DUMP);
      out.custom.refreshed = true;
      out.custom.detail = `+${delta} rows past dump → refreshed (${info.rows} rows)`;
    } else {
      out.custom.detail = `${xp.rows} rows vs dump ${xt.rows} (Δ${delta} < ${SYNC_CUSTOM_DELTA})`;
    }
  }

  return out;
}
