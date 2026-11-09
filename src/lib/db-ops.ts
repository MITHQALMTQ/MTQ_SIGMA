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
import {
  dumpComplete,
  dumpGenesisOk,
  readManifestFile,
  validateManifestAgainst,
} from "./boot/snapshot-manifest";
import { probeChainDatabase, probeCustomDatabase } from "./boot/db-probe";
import {
  activateGeneration,
  detectForeignWrite,
  prepareGeneration,
  reconcileActivation,
  validateGeneration,
} from "./boot/generation-store";
import { authorizeRecovery } from "./boot/recovery-authorization";

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
// V31 TURN 2A (incident 19 root-cause fix, Phase 5): the write-behind loop
// refreshes UNTRACKED STAGING copies — never the git-tracked published files.
// The tracked latest-*.sql + manifest.json are written ONLY by the validated
// atomic publisher (scripts/snapshot-publish.ts + src/lib/boot/
// snapshot-manifest.ts). This structurally ends the incident-19 loop: the
// platform agent-loop wrapper auto-commits dirty tracked files at every
// agent-turn end, so a perpetually-dirty tracked dump meant uncontrolled
// unpushed snapshot drift on every turn. Staging is gitignored (via
// /backups/db-snapshots/*), transient, and safely re-derivable from the live
// databases.
export const STAGING_DIR = join(SNAP_DIR, ".staging");
export const CHAIN_DUMP_STAGING = join(STAGING_DIR, "latest-chain.sql");
export const CUSTOM_DUMP_STAGING = join(STAGING_DIR, "latest-custom.sql");
export const SNAPSHOT_MANIFEST_PATH = join(SNAP_DIR, "manifest.json");
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
    mkdirSync(dirname(outPath), { recursive: true });
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

// ─── recovery (V31 TURN 3: central authorization + staged generations) ───────
//
// The pre-TURN-3 implementation restored dump-by-dump directly into the
// operational path with locally re-derived per-database decisions (defects
// F-1 refused-note-not-gating, F-2 missing-manifest bypass, and the
// unreadable→height-0 hazard). Restoration now:
//   1. reconciles any interrupted activation (generation-store, §4.4);
//   2. probes BOTH live databases with EXPLICIT outcomes (db-probe, §3.1);
//   3. obtains ONE decision from the central recovery authorization
//      (recovery-authorization, §3.2 — repository identity, runtime source
//      state, manifest/hash/completeness/genesis verification, recovery
//      direction, cross-database generation consistency — fail-closed on
//      every unverified condition; refusal is terminal, never re-derived
//      here, §3.3);
//   4. on authorization ONLY: imports BOTH dumps into an isolated immutable
//      generation directory, fully validates it (integrity, genesis, chain
//      id, height contiguity, parent-hash continuity, exact counts — §4.2),
//      and activates it crash-safely (single atomic active-generation pointer
//      + durable journal + forensic casualty archive — §4.3). A refused or
//      failed restoration leaves the operational databases UNTOUCHED.

export interface HealAction {
  action: "none" | "restored" | "no-dump" | "sentinel" | "refused";
  live: string;
  dump: string;
  note?: string;
}

export interface HealReport {
  chain: HealAction;
  custom: HealAction;
  healed: boolean;
  error?: string;
  /** V31 TURN 3: the central decision record (durable audit evidence). */
  decision?: {
    authorized: boolean;
    action: string;
    refusal?: string;
    sourceOrigin?: string;
    sourceHeight?: number;
    liveChainHeight: number | null;
    controlledRecovery: boolean;
    checks: { check: string; verdict: string; detail: string }[];
  };
  /** V31 TURN 3: active generation pointer state after this run. */
  generation?: { generationId: string; chainTip: number; customRows: number };
  reconciledActivation?: string;
}

function safeText(p: string): string | null {
  try {
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  } catch {
    return null;
  }
}

export async function selfHealDatabases(opts: { log?: (s: string) => void } = {}): Promise<HealReport> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const report: HealReport = {
    chain: { action: "none", live: "", dump: "" },
    custom: { action: "none", live: "", dump: "" },
    healed: false,
  };

  // [0] Reconcile any interrupted activation BEFORE any database consumer
  //     (§4.4): the system always lands on the previous or the new COMPLETE
  //     valid generation — never a mixed or partially imported one.
  try {
    const rec = reconcileActivation(ROOT);
    if (rec.reconciled) {
      report.reconciledActivation = `${rec.outcome}: ${rec.detail}`;
      log(`[selfheal] reconciled interrupted activation — ${rec.detail}`);
    }
  } catch (e) {
    log(`[selfheal] activation reconcile FAILED (continuing fail-closed): ${e instanceof Error ? e.message : String(e)}`);
  }

  const sentinel = sentinelActive();
  if (sentinel.active) {
    report.chain = { action: "sentinel", live: "-", dump: "-", note: "intentional reset acknowledged" };
    report.custom = { action: "sentinel", live: "-", dump: "-", note: "intentional reset acknowledged" };
    log(`[selfheal] sentinel active (expires ${new Date(sentinel.expiresAt ?? 0).toISOString()}, reason: ${sentinel.reason || "n/a"}) — standing down`);
    return report;
  }

  // [1] Explicit live probes — a FAILED read is never a height of zero (§3.1).
  const chainProbe = await probeChainDatabase(CHAIN_DB);
  const customProbe = await probeCustomDatabase(CUSTOM_DB);
  report.chain.live = chainProbe.status === "DATABASE_HEALTHY" ? `h${chainProbe.height}` : chainProbe.status;
  report.custom.live = customProbe.status === "DATABASE_HEALTHY" ? `${customProbe.rows} rows` : customProbe.status;

  // [2] Foreign-write detection (Incident-22 signature aid): live behind the
  //     last activated generation → journalled evidence for the operator.
  if (chainProbe.status === "DATABASE_HEALTHY") {
    try {
      const fw = detectForeignWrite(ROOT, chainProbe.height ?? null, undefined);
      if (fw.foreign) log(`[selfheal] FOREIGN WRITE DETECTED — ${fw.detail}`);
    } catch { /* detection is evidence-only */ }
  }

  // [3] Runtime source state (precondition for any restoration — the git
  //     classification is NEVER sufficient by itself, §3.2).
  let remoteOk = false;
  let gitState = "AUTHORITY_UNVERIFIED";
  try {
    const remote = execSync("git remote get-url origin", { cwd: ROOT, encoding: "utf8", timeout: 15_000 }).trim();
    remoteOk = /MITHQALMTQ\/MTQ_SIGMA/.test(remote);
  } catch { /* fail-closed below */ }
  if (remoteOk) {
    try {
      const { classifyGitState } = await import("./boot/git-state");
      gitState = classifyGitState({ fetch: false, root: ROOT }).state;
    } catch { /* AUTHORITY_UNVERIFIED — fail-closed */ }
  }

  // [4] THE decision — one shared implementation, consumed verbatim (§3.2/§3.3).
  const published = {
    chainText: safeText(CHAIN_DUMP),
    customText: safeText(CUSTOM_DUMP),
    manifestPath: SNAPSHOT_MANIFEST_PATH,
  };
  const staged = { chainText: safeText(CHAIN_DUMP_STAGING), customText: safeText(CUSTOM_DUMP_STAGING) };
  const decision = authorizeRecovery({
    root: ROOT,
    remoteOk,
    gitState,
    chainProbe,
    customProbe,
    sentinelActive: false, // sentinel stand-down already returned above
    published,
    staged,
  });
  report.decision = {
    authorized: decision.authorized,
    action: decision.action,
    refusal: decision.refusal,
    sourceOrigin: decision.source?.origin,
    sourceHeight: decision.source?.chainHeight,
    liveChainHeight: decision.liveChainHeight,
    controlledRecovery: decision.controlledRecovery,
    checks: decision.checks,
  };

  // Fresh-environment first boot: no live databases AND no recovery payloads
  // on disk at all — genesis seeding is the honest first boot (nothing to
  // lose, nothing to recover). Any EXISTING payload without verification is a
  // REFUSAL (F-2 — never an implicit legacy acceptance, §3.4).
  const freshEnvironment =
    decision.refusal === "NO_VERIFIED_RECOVERY_SOURCE" &&
    chainProbe.status === "DATABASE_MISSING" &&
    customProbe.status === "DATABASE_MISSING" &&
    published.chainText === null && published.customText === null &&
    staged.chainText === null && staged.customText === null;
  if (freshEnvironment) {
    report.chain.action = "no-dump";
    report.chain.note = "fresh environment — first boot will seed genesis";
    report.custom.action = "no-dump";
    report.custom.note = "fresh environment";
    log("[selfheal] fresh environment (no databases, no recovery payloads) — first boot will seed genesis");
    return report;
  }

  if (!decision.authorized) {
    if (decision.refusal === "NO_RESTORE_NEEDED") {
      report.chain.dump = decision.source ? `${decision.source.origin} h${decision.source.chainHeight}` : "n/a";
      report.custom.dump = decision.source ? `${decision.source.origin} ${decision.source.customRows} rows` : "n/a";
      log(`[selfheal] OK — live databases at/ahead of every verified recovery source (${report.chain.live} / ${report.custom.live})`);
      return report;
    }
    // TERMINAL refusal — fail-closed; the operational databases stay untouched.
    report.chain.action = "refused";
    report.custom.action = "refused";
    const note = `${decision.refusal}: ${decision.reasons.slice(0, 2).join("; ") || "fail-closed"}`;
    report.chain.note = note;
    report.custom.note = note;
    log(`[selfheal] RECOVERY REFUSED (fail-closed) — ${note}`);
    log(`[selfheal] live chain ${report.chain.live} · live custom ${report.custom.live} — operator adjudication required; databases untouched`);
    return report;
  }

  // [5] Authorized controlled restoration — one validated generation (§4).
  const src = decision.source!;
  report.chain.dump = `${src.origin} h${src.chainHeight} · ${src.customRows} custom rows${src.manifestVersion !== null ? ` · manifest v${src.manifestVersion}` : ""}`;
  report.custom.dump = report.chain.dump;
  try {
    const prepared = await prepareGeneration({
      root: ROOT,
      chainDumpSql: src.chainText,
      customDumpSql: src.customText,
      sourceOrigin: src.origin,
      manifestVersion: src.manifestVersion,
      chainSha256: null,
      customSha256: null,
    });
    const validation = await validateGeneration(ROOT, prepared, src.origin, src.manifestVersion);
    if (!validation.ok) {
      report.error = `generation validation failed: ${validation.reasons.slice(0, 2).join("; ")}`;
      log(`[selfheal] ERROR — ${report.error} (generation discarded; live databases untouched)`);
      return report;
    }
    const activation = await activateGeneration(ROOT, prepared, src.origin);
    // Post-activation verification — the final state is measured, not assumed.
    const reChain = await probeChainDatabase(CHAIN_DB);
    const reCustom = await probeCustomDatabase(CUSTOM_DB);
    if (reChain.status !== "DATABASE_HEALTHY" || reChain.height !== activation.chainTip) {
      report.error = `post-activation probe mismatch: ${reChain.status} h${reChain.height ?? "?"} != activated h${activation.chainTip}`;
      log(`[selfheal] ERROR — ${report.error}`);
      return report;
    }
    report.chain.action = "restored";
    report.custom.action = "restored";
    report.healed = true;
    report.chain.live = `h${reChain.height}`;
    report.custom.live = `${reCustom.status === "DATABASE_HEALTHY" ? reCustom.rows : "?"} rows`;
    report.generation = { generationId: activation.generationId, chainTip: activation.chainTip, customRows: activation.customRows };
    log(`[selfheal] generation RESTORED — ${activation.detail} (live chain → h${activation.chainTip}); casualty archive kept`);
  } catch (e) {
    report.error = `generation restore failed: ${e instanceof Error ? e.message : String(e)}`;
    log(`[selfheal] ERROR — ${report.error} (live databases untouched; dump sources intact)`);
  }
  return report;
}

// ─── cloud-layer write-behind sync ───────────────────────────────────────────
//
// V31 TURN 2A (incident 19 root-cause fix, Phase 5): the write-behind loop
// refreshes the UNTRACKED STAGING dumps (backups/db-snapshots/.staging/), NOT
// the git-tracked published files. The tracked latest-*.sql + manifest.json
// are written exclusively by the validated atomic publisher
// (scripts/snapshot-publish.ts). The regression-suppression reference is the
// BEST dump on disk (staged or published, whichever is ahead) — a wipe is
// still never allowed to overwrite a better dump.

export interface SyncDbOutcome {
  refreshed: boolean;
  detail: string;
}

export interface SyncReport {
  chain: SyncDbOutcome;
  custom: SyncDbOutcome;
}

/** Best (freshest) tip among staged + published dumps for one database. */
function bestDumpTip(staged: DumpTip | null, published: DumpTip | null): DumpTip | null {
  if (!staged) return published;
  if (!published) return staged;
  const key = (t: DumpTip) => (t.height ?? 0) * 1_000_000_000 + t.rows;
  return key(staged) >= key(published) ? staged : published;
}

/**
 * Refresh the STAGED write-behind dumps when the live databases have moved
 * past the best existing dump (bounded write-behind). CRITICAL SAFETY: a dump
 * is NEVER regenerated when the live DB is BEHIND the existing dump — that is
 * the re-image regression signature, and overwriting the good copy with a
 * wiped/genesis-scale dump would destroy the recovery source of record.
 */
export async function cloudSyncRefresh(opts: { log?: (s: string) => void } = {}): Promise<SyncReport> {
  const log = opts.log ?? (() => {});
  const out: SyncReport = {
    chain: { refreshed: false, detail: "" },
    custom: { refreshed: false, detail: "" },
  };

  // chain
  const cp = await probeChainHeight(CHAIN_DB);
  const stagedCT = readDumpTip(CHAIN_DUMP_STAGING);
  const publishedCT = readDumpTip(CHAIN_DUMP);
  const ct = bestDumpTip(stagedCT, publishedCT);
  if (!cp.ok) {
    out.chain.detail = `live ${cp.reason} — dump suppressed (self-heal territory)`;
  } else if (ct && (ct.height ?? 0) > cp.height) {
    out.chain.detail = `live h${cp.height} BEHIND best dump h${ct.height} — refresh suppressed (regression signature)`;
    log(`[cloud-sync] REGRESSION SIGNATURE — ${out.chain.detail}`);
  } else if (!ct || !ct.v2) {
    const info = await dumpDatabase(CHAIN_DB, CHAIN_DUMP_STAGING);
    out.chain.refreshed = true;
    out.chain.detail = `staged dump ${!ct ? "missing" : "legacy v1"} → v2 (h${info.height}, ${info.rows} rows)`;
  } else {
    const delta = cp.height - (ct.height ?? 0);
    if (delta >= SYNC_CHAIN_DELTA) {
      const info = await dumpDatabase(CHAIN_DB, CHAIN_DUMP_STAGING);
      out.chain.refreshed = true;
      out.chain.detail = `+${delta} blocks past dump tip → staged refreshed (h${info.height}, ${info.rows} rows)`;
    } else {
      out.chain.detail = `h${cp.height} vs best dump h${ct.height ?? "-"} (Δ${delta} < ${SYNC_CHAIN_DELTA})`;
    }
  }

  // custom
  const xp = await probeCustomRows(CUSTOM_DB);
  const stagedXT = readDumpTip(CUSTOM_DUMP_STAGING);
  const publishedXT = readDumpTip(CUSTOM_DUMP);
  const xt = bestDumpTip(stagedXT, publishedXT);
  if (!xp.ok) {
    out.custom.detail = `live ${xp.reason} — dump suppressed (self-heal territory)`;
  } else if (xt && customBehindDump(xp.rows, xt.rows)) {
    out.custom.detail = `live ${xp.rows} rows BEHIND best dump ${xt.rows} (material deficit) — refresh suppressed (regression signature)`;
    log(`[cloud-sync] REGRESSION SIGNATURE — ${out.custom.detail}`);
  } else if (!xt || !xt.v2) {
    const info = await dumpDatabase(CUSTOM_DB, CUSTOM_DUMP_STAGING);
    out.custom.refreshed = true;
    out.custom.detail = `staged dump ${!xt ? "missing" : "legacy v1"} → v2 (${info.rows} rows)`;
  } else {
    const delta = xp.rows - xt.rows;
    if (delta >= SYNC_CUSTOM_DELTA) {
      const info = await dumpDatabase(CUSTOM_DB, CUSTOM_DUMP_STAGING);
      out.custom.refreshed = true;
      out.custom.detail = `+${delta} rows past dump → staged refreshed (${info.rows} rows)`;
    } else {
      out.custom.detail = `${xp.rows} rows vs best dump ${xt.rows} (Δ${delta} < ${SYNC_CUSTOM_DELTA})`;
    }
  }

  return out;
}
