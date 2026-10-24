// ============================================================================
// Turso restore script (RUNBOOK §2.2 / §6 — automated cold recovery)
// ----------------------------------------------------------------------------
// Restores a 9-table Turso backup JSON (produced by scripts/backup-turso.ts,
// schemaVersion 2) into a Turso database — or any SQLite/libsql file target.
//
// Run (dry-run — validates + reports, writes NOTHING):
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
//     bun run scripts/restore-turso.ts --file backups/turso-backup-….json
//
// Run (restore — required for any write):
//   … bun run scripts/restore-turso.ts --file backups/… --apply
//   … bun run scripts/restore-turso.ts --release backup-2026-10-24 --apply
//
// Flags:
//   --file <path>      backup JSON file (mutually exclusive with --release)
//   --release <tag>    GitHub Release tag (e.g. backup-2026-10-24); the newest
//                      matching `turso-backup-*.json` asset is downloaded via
//                      the GitHub API (needs GITHUB_TOKEN / GH_TOKEN env in
//                      addition to GITHUB_REPOSITORY or --repo).
//   --asset <name>     exact asset name (optional; default: newest match)
//   --repo <o/r>       GitHub repo override (default: GITHUB_REPOSITORY env)
//   --url <url>        target DB override (default: TURSO_DATABASE_URL env;
//                      accepts `file:/path/to.db` for local drill restores)
//   --token <tok>      target auth token override (default: TURSO_AUTH_TOKEN)
//   --apply            actually write (without it: dry-run)
//   --wipe             DESTRUCTIVE: DELETE every row from each table before
//                      inserting (true cold recovery). Without --wipe the
//                      restore MERGES: INSERT OR IGNORE (idempotent — existing
//                      rows are never overwritten; live-written rows newer
//                      than the backup are preserved).
//
// Safety properties:
//   - Dry-run by default; --apply is required for ANY write.
//   - Idempotent in both modes (INSERT OR IGNORE + primary keys).
//   - Missing tables are auto-created (CREATE TABLE IF NOT EXISTS) so a
//     completely fresh Turso database can be cold-recovered. DDL below was
//     captured verbatim from production Turso (sqlite_master, 2026-10-24,
//     Task 22) — including the hash-chain columns fixed in Task 21 and the
//     non-Prisma keeper_audit legacy evidence table.
//   - Never touches tables not present in the backup JSON.
//   - Parity report at the end (per-table before/after/backup counts).
//   - --wipe against a LIVE production DB is warned against loudly: the
//     engine (keeper-tick) writes new rows every minute, so a wiped live DB
//     immediately diverges from the backup. Wipe only into a paused/quiesced
//     DB or a scratch target.
// ============================================================================

import { createClient } from "@libsql/client";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Config / argv
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return argv.includes(flag);
}
if (hasFlag("--help") || hasFlag("-h")) {
  console.log(
    "usage: bun run scripts/restore-turso.ts (--file <path> | --release <tag> [--asset <name>])" +
      " [--repo <o/r>] [--url <url>] [--token <tok>] [--apply] [--wipe]",
  );
  process.exit(0);
}

const FILE = argValue("--file");
const RELEASE = argValue("--release");
const ASSET = argValue("--asset");
const REPO_OVERRIDE = argValue("--repo");
const URL_OVERRIDE = argValue("--url");
const TOKEN_OVERRIDE = argValue("--token");
const APPLY = hasFlag("--apply");
const WIPE = hasFlag("--wipe");

if (!!FILE === !!RELEASE) {
  console.error("FATAL: provide exactly one of --file <path> or --release <tag>.");
  process.exit(1);
}

const TARGET_URL = URL_OVERRIDE ?? process.env.TURSO_DATABASE_URL;
const TARGET_TOKEN = TOKEN_OVERRIDE ?? process.env.TURSO_AUTH_TOKEN;
if (!TARGET_URL) {
  console.error("FATAL: no target DB. Set TURSO_DATABASE_URL or pass --url <url>.");
  process.exit(1);
}
if (!TARGET_TOKEN && !TARGET_URL.startsWith("file:")) {
  console.error("FATAL: no auth token for remote target. Set TURSO_AUTH_TOKEN or pass --token <tok>.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Table DDL — captured verbatim from production Turso sqlite_master
// (2026-10-24, Task 22). CREATE TABLE IF NOT EXISTS makes fresh-DB cold
// recovery self-contained. keeper_audit is the legacy non-Prisma evidence
// table (sole-copy rows of the retired keeper service — never lose these).
// ---------------------------------------------------------------------------

const DDL: Record<string, string> = {
  PilotTrial: `CREATE TABLE IF NOT EXISTS PilotTrial ( id TEXT PRIMARY KEY, type TEXT NOT NULL, chain TEXT NOT NULL, inputAmount REAL NOT NULL, inputSymbol TEXT NOT NULL, outputAmount REAL NOT NULL, outputSymbol TEXT NOT NULL, gfbIndex REAL NOT NULL, mtqPrice REAL NOT NULL, nav REAL NOT NULL, reserveRatio REAL NOT NULL, lcr REAL NOT NULL, status TEXT NOT NULL, basketJson TEXT, ok INTEGER NOT NULL DEFAULT 1, reason TEXT, wallet TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')) )`,
  MetricSample: `CREATE TABLE IF NOT EXISTS MetricSample ( id TEXT PRIMARY KEY, gfbIndex REAL NOT NULL, mtqPrice REAL NOT NULL, nav REAL NOT NULL, reserveRatio REAL NOT NULL, lcr REAL NOT NULL, status TEXT NOT NULL, vix REAL NOT NULL, dxy REAL NOT NULL, targetGold REAL NOT NULL, bufferState TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')) )`,
  DailyStateVector: `CREATE TABLE IF NOT EXISTS "DailyStateVector" ( "id" TEXT PRIMARY KEY NOT NULL, "tickAt" DATETIME NOT NULL, "tickCount" INTEGER NOT NULL, "gfbIndex" REAL NOT NULL, "mtqPrice" REAL NOT NULL, "priceInBand" BOOLEAN NOT NULL, "navUsd" REAL NOT NULL, "liabilityUsd" REAL NOT NULL, "reserveRatio" REAL NOT NULL, "lcr" REAL NOT NULL, "status" TEXT NOT NULL, "circulatingSupply" REAL NOT NULL, "totalSupply" REAL NOT NULL, "usdNet" REAL NOT NULL, "eurNet" REAL NOT NULL, "gbpNet" REAL NOT NULL, "jpyNet" REAL NOT NULL, "cnyNet" REAL NOT NULL, "chfNet" REAL NOT NULL, "goldNet" REAL NOT NULL, "fiatNet" REAL NOT NULL, "vix" REAL NOT NULL, "dxy" REAL NOT NULL, "zVix" REAL NOT NULL, "zDxy" REAL NOT NULL, "rawTheta" REAL NOT NULL, "smoothedGoldWeight" REAL NOT NULL, "targetGoldWeight" REAL NOT NULL, "observedGoldWeight" REAL NOT NULL, "bufferState" TEXT NOT NULL, "bufferGoldRatio" REAL NOT NULL, "ejectStage" INTEGER NOT NULL, "pegHealthJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , "prevHash" TEXT, "rowHash" TEXT)`,
  RebalancingDecision: `CREATE TABLE IF NOT EXISTS "RebalancingDecision" ( "id" TEXT PRIMARY KEY NOT NULL, "tickAt" DATETIME NOT NULL, "tickCount" INTEGER NOT NULL, "navUsd" REAL NOT NULL, "reserveRatio" REAL NOT NULL, "observedGoldWeight" REAL NOT NULL, "targetGoldWeight" REAL NOT NULL, "deviationPct" REAL NOT NULL, "shouldRebalance" BOOLEAN NOT NULL, "direction" INTEGER NOT NULL, "tradeUsd" REAL NOT NULL, "reason" TEXT NOT NULL, "blockedBy" TEXT, "applied" BOOLEAN NOT NULL DEFAULT 0, "preGoldNet" REAL, "postGoldNet" REAL, "preFiatNet" REAL, "postFiatNet" REAL, "postReserveRatio" REAL, "postObservedGoldWeight" REAL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP , "prevHash" TEXT, "rowHash" TEXT)`,
  OracleSample: `CREATE TABLE IF NOT EXISTS "OracleSample" ( "id" TEXT PRIMARY KEY NOT NULL, "tickAt" DATETIME NOT NULL, "tickCount" INTEGER NOT NULL, "pair" TEXT NOT NULL, "chainlinkValid" BOOLEAN NOT NULL, "chainlinkPrice" REAL NOT NULL, "pythValid" BOOLEAN NOT NULL, "pythPrice" REAL NOT NULL, "chronicleValid" BOOLEAN NOT NULL, "chroniclePrice" REAL NOT NULL, "validCount" INTEGER NOT NULL, "finalPrice" REAL NOT NULL, "method" TEXT NOT NULL, "spreadBps" INTEGER NOT NULL, "paused" BOOLEAN NOT NULL, "discardReasons" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP )`,
  MbzBackingCertificate: `CREATE TABLE IF NOT EXISTS "MbzBackingCertificate" ( "id" TEXT NOT NULL PRIMARY KEY, "certificateId" TEXT NOT NULL, "bank" TEXT NOT NULL, "amountUsd" REAL NOT NULL, "custodianAttestationHash" TEXT NOT NULL, "custodianAttestationExpiry" BIGINT NOT NULL, "reserveAssetBreakdownHash" TEXT NOT NULL, "issuedAt" BIGINT NOT NULL, "verified" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP )`,
  MbzBank: `CREATE TABLE IF NOT EXISTS "MbzBank" ( "id" TEXT NOT NULL PRIMARY KEY, "address" TEXT NOT NULL, "name" TEXT NOT NULL, "jurisdiction" TEXT NOT NULL, "isAuthorized" BOOLEAN NOT NULL DEFAULT false, "dailyMintCap" REAL NOT NULL, "dailyMintUsed" REAL NOT NULL DEFAULT 0, "authorizedAt" DATETIME, "apiKeyHash" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP )`,
  MbzMintRequest: `CREATE TABLE IF NOT EXISTS "MbzMintRequest" ( "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL, "bank" TEXT NOT NULL, "corporateCustomerHash" TEXT NOT NULL, "amountUsd" REAL NOT NULL, "backingCertificateId" TEXT NOT NULL, "jurisdiction" TEXT NOT NULL, "nonce" BIGINT NOT NULL, "expiry" BIGINT NOT NULL, "state" TEXT NOT NULL DEFAULT 'BM01_PENDING', "rejectReason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "authorizedAt" BIGINT, "mintedAt" BIGINT, "mintedAmount" REAL, "apiAuthMethod" TEXT NOT NULL DEFAULT 'hmac', "apiRemoteIp" TEXT, "apiUserAgent" TEXT )`,
  keeper_audit: `CREATE TABLE IF NOT EXISTS keeper_audit ( id INTEGER PRIMARY KEY AUTOINCREMENT, tick_at INTEGER NOT NULL, tick_epoch INTEGER NOT NULL, step TEXT NOT NULL, status TEXT NOT NULL, tx_hash TEXT, gas_used INTEGER, message TEXT, keeper TEXT NOT NULL, contract TEXT NOT NULL )`,
};

const CHUNK = 50; // rows per multi-INSERT (DSV: 37 cols × 50 = 1,850 params — well under limits)

// ---------------------------------------------------------------------------
// Value coercion — inverse of backup-turso.ts normalizeRow
// ---------------------------------------------------------------------------

function coerceValue(table: string, col: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0; // SQLite BOOLEAN storage
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
  if (Array.isArray(v)) {
    // Uint8Array/BLOB columns were normalized to byte arrays by the backup.
    if (v.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 255)) {
      return Buffer.from(v as number[]);
    }
    console.warn(`[restore-turso] WARN: ${table}.${col} — non-byte array value JSON-stringified`);
    return JSON.stringify(v);
  }
  console.warn(`[restore-turso] WARN: ${table}.${col} — object value JSON-stringified`);
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// GitHub release asset download (--release path)
// ---------------------------------------------------------------------------

async function downloadFromRelease(): Promise<string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const repo = REPO_OVERRIDE ?? process.env.GITHUB_REPOSITORY;
  if (!token) throw new Error("--release needs GITHUB_TOKEN (or GH_TOKEN) env");
  if (!repo) throw new Error("--release needs GITHUB_REPOSITORY env or --repo <owner/repo>");

  const api = "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const relRes = await fetch(`${api}/repos/${repo}/releases/tags/${RELEASE}`, { headers });
  if (!relRes.ok) throw new Error(`get release ${RELEASE}: ${relRes.status}`);
  const rel = (await relRes.json()) as {
    assets: { id: number; name: string; created_at: string; size: number }[];
  };
  const assets = (rel.assets ?? [])
    .filter((a) => (ASSET ? a.name === ASSET : /^turso-backup.*\.json$/.test(a.name)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (assets.length === 0) throw new Error(`no matching turso-backup asset on release ${RELEASE}`);
  const asset = assets[0];
  console.log(`[restore-turso] Downloading ${asset.name} (${asset.size} bytes) from ${repo}@${RELEASE}…`);

  const dlRes = await fetch(`${api}/repos/${repo}/releases/assets/${asset.id}`, {
    headers: { ...headers, Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!dlRes.ok) throw new Error(`download asset ${asset.id}: ${dlRes.status}`);
  const bytes = Buffer.from(await dlRes.arrayBuffer());
  const head = bytes.subarray(0, 200).toString("utf8");
  if (!head.includes('"schemaVersion"')) {
    throw new Error(`asset does not look like a Turso backup JSON (head: ${head.slice(0, 80)}…)`);
  }
  const dir = join(tmpdir(), "mtq-restore");
  await mkdir(dir, { recursive: true });
  const path = join(dir, asset.name);
  await writeFile(path, bytes);
  console.log(`[restore-turso] Saved to ${path}`);
  return path;
}

// ---------------------------------------------------------------------------
// Main restore logic
// ---------------------------------------------------------------------------

interface Backup {
  schemaVersion?: number;
  exportedAt?: string;
  tursoUrl?: string;
  tables: Record<string, Record<string, unknown>[]>;
  rowCounts?: Record<string, number>;
  totalRows?: number;
}

async function main() {
  const backupPath = FILE ?? (await downloadFromRelease());
  const raw = await readFile(backupPath, "utf8");
  const backup = JSON.parse(raw) as Backup;

  if (!backup.tables || typeof backup.tables !== "object") {
    throw new Error("backup JSON has no `tables` object — wrong file?");
  }
  const tables = Object.keys(backup.tables).filter((t) => backup.tables[t]);
  console.log(
    `[restore-turso] Backup: schemaVersion=${backup.schemaVersion} exportedAt=${backup.exportedAt} ` +
      `tables=${tables.length} totalRows=${backup.totalRows ?? "(n/a)"}`,
  );
  console.log(`[restore-turso] Target: ${TARGET_URL.replace(/\?auth=.*/, "")}`);
  console.log(`[restore-turso] Mode: ${APPLY ? (WIPE ? "APPLY + WIPE (destructive!)" : "APPLY (merge — INSERT OR IGNORE)") : "DRY-RUN (no writes)"}`);

  if (WIPE && APPLY && !TARGET_URL.startsWith("file:")) {
    console.warn(
      "[restore-turso] ⚠️  --wipe against a LIVE remote DB: the engine writes every minute — the target\n" +
        "   will diverge from the backup immediately after the wipe. Wipe only a paused/quiesced DB\n" +
        "   (emergency-pause the engine first, see RUNBOOK §3) or a scratch target.",
    );
  }

  const client = createClient(
    TARGET_URL.startsWith("file:") ? { url: TARGET_URL } : { url: TARGET_URL, authToken: TARGET_TOKEN },
  );

  // DDL check + pre-counts. DDL (CREATE TABLE IF NOT EXISTS) only runs in
  // APPLY mode — a dry-run performs ZERO writes, so it can be pointed at a
  // fresh empty target to plan a cold recovery safely.
  const before: Record<string, number> = {};
  const missingTables: string[] = [];
  for (const t of tables) {
    if (!DDL[t]) {
      throw new Error(`table "${t}" is not in the restore DDL map — refusing (unknown table)`);
    }
    if (APPLY) {
      await client.execute(DDL[t]); // CREATE TABLE IF NOT EXISTS (no-op on existing)
    }
    try {
      const c = await client.execute(`SELECT COUNT(*) AS c FROM "${t}"`);
      before[t] = Number((c.rows[0] as Record<string, unknown>).c);
    } catch {
      before[t] = 0;
      missingTables.push(t);
    }
  }
  if (missingTables.length > 0) {
    console.log(
      `[restore-turso] Note: tables not present on target (will be created by --apply): ${missingTables.join(", ")}`,
    );
  }

  console.log("\n[restore-turso] Plan (per table): backup rows → target before → action");
  for (const t of tables) {
    const n = backup.tables[t].length;
    console.log(
      `  ${t.padEnd(24)} ${String(n).padStart(7)} rows | target has ${String(before[t]).padStart(7)} | ` +
        (APPLY ? (WIPE ? "WIPE + insert" : "merge (OR IGNORE)") : "dry-run"),
    );
  }
  if (!APPLY) {
    console.log("\n[restore-turso] DRY-RUN complete — no rows written. Re-run with --apply to restore.");
    return;
  }

  // Wipe (destructive mode).
  if (WIPE) {
    for (const t of tables) {
      await client.execute(`DELETE FROM "${t}"`);
    }
    console.log("\n[restore-turso] --wipe: all target rows deleted from the listed tables.");
  }

  // Insert in chunks of multi-row INSERT OR IGNORE statements.
  const inserted: Record<string, number> = {};
  for (const t of tables) {
    const rows = backup.tables[t];
    let count = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const cols = [...new Set(chunk.flatMap((r) => Object.keys(r)))];
      if (cols.length === 0) continue;
      const placeholders = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
      const sql = `INSERT OR IGNORE INTO "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders}`;
      const params: unknown[] = [];
      for (const row of chunk) {
        for (const c of cols) params.push(coerceValue(t, c, row[c] ?? null));
      }
      const res = await client.execute({ sql, args: params });
      count += Number(res.rowsAffected ?? 0);
    }
    inserted[t] = count;
    console.log(`[restore-turso]   ${t.padEnd(24)} inserted ${String(count).padStart(7)} new rows`);
  }

  // Parity report.
  console.log("\n[restore-turso] Parity report (target-after vs backup):");
  let ok = true;
  for (const t of tables) {
    const c = await client.execute(`SELECT COUNT(*) AS c FROM "${t}"`);
    const after = Number((c.rows[0] as Record<string, unknown>).c);
    const want = backup.tables[t].length;
    // Merge mode: target must hold at least the backup's rows (live DBs only grow).
    // Wipe mode: target should equal the backup (concurrent writes can only add).
    const pass = WIPE ? after >= want : after >= want && after >= before[t];
    if (!pass) ok = false;
    console.log(
      `  ${t.padEnd(24)} after=${String(after).padStart(7)} backup=${String(want).padStart(7)} ` +
        `before=${String(before[t]).padStart(7)} new=${String(inserted[t]).padStart(6)} ${pass ? "OK" : "MISMATCH"}`,
    );
  }
  console.log(
    ok
      ? "\n[restore-turso] Restore complete — parity OK."
      : "\n[restore-turso] Restore finished WITH MISMATCHES — inspect the report above.",
  );
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[restore-turso] FATAL:", err);
  process.exit(1);
});
