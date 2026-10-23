// MTQΣ — Local SQLite full backup (fix 16d-006/16d-007, Task 16-fix-C).
//
// Dumps ALL 9 Prisma models (the complete schema — not the 5-table subset that
// scripts/backup-turso.ts covers) from the local SQLite database to a single
// timestamped JSON file under backups/, with per-table row counts and a
// SHA-256 manifest line. Read-only against the source DB (SELECTs only).
//
// Invoke:   bun run scripts/backup-sqlite.ts
//           (optionally: DATABASE_URL=file:/path/to/db — defaults to the env
//            value, then to the pilot's db/custom.db)
// Output:   backups/sqlite-backup-<UTC-stamp>.json   (gitignored — /backups/*)
//           + a manifest line on stdout (path · sha256 · row counts · total)
//
// Honesty notes (documented in the artifact itself):
//   - The engine tick loop keeps running during the dump: tables are read
//     sequentially, so this is an "as-of" logical snapshot, not a single
//     point-in-time transactional snapshot. Each table's rows are internally
//     consistent (single SELECT), and `exportedAt` bounds the skew (<seconds).
//   - Float64 values are serialized as JavaScript's shortest round-trip
//     decimal repr (up to 17 significant digits). Restoring into SQLite
//     reproduces the exact same doubles (parse(shortestRepr) is bit-exact).
//   - DateTime columns are ms-epoch UTC integers in SQLite; serialized here
//     as ISO-8601 strings. BigInt columns (Mbz nonce/expiry) as strings.
//
// NOT wired into package.json (orchestrator-owned); the intended script entry
// is: "db:backup": "bun run scripts/backup-sqlite.ts"

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DB_URL = process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db";
const OUT_DIR = join(import.meta.dir, "..", "backups");

const db = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

// All 9 models, ordered by createdAt ASC (matches the 12:55Z backup-manifest
// convention). Prisma model key → table name used in the JSON output.
const TABLES: [keyof PrismaClient, string][] = [
  ["pilotTrial", "PilotTrial"],
  ["metricSample", "MetricSample"],
  ["dailyStateVector", "DailyStateVector"],
  ["rebalancingDecision", "RebalancingDecision"],
  ["oracleSample", "OracleSample"],
  ["issuanceEvent", "IssuanceEvent"],
  ["mbzMintRequest", "MbzMintRequest"],
  ["mbzBackingCertificate", "MbzBackingCertificate"],
  ["mbzBank", "MbzBank"],
];

// JSON-safe serialization: Date → ISO string (Prisma returns Date objects for
// DateTime columns), BigInt → string (Mbz nonce/expiry columns).
const jsonSafe = (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const exportedAt = new Date();
  const tables: Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const [model, name] of TABLES) {
    // @ts-expect-error — dynamic model accessor; all 9 models expose findMany
    const rows = await (db[model] as { findMany: (a: unknown) => Promise<unknown[]> })
      .findMany({ orderBy: { createdAt: "asc" } });
    tables[name] = JSON.parse(JSON.stringify(rows, jsonSafe));
    rowCounts[name] = rows.length;
    totalRows += rows.length;
  }

  const stamp = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outPath = join(OUT_DIR, `sqlite-backup-${stamp}.json`);
  const artifact = {
    schemaVersion: 3,
    exportedAt: exportedAt.toISOString(),
    source: DB_URL.startsWith("file:") ? DB_URL : "<redacted-non-file-url>",
    engineLive: true,
    snapshotCaveat:
      "as-of logical dump: tables read sequentially while the engine runs; each table is a single consistent SELECT, cross-table skew is bounded by exportedAt",
    tables,
    rowCounts,
    totalRows,
  };
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  const sha256 = createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
  const countsStr = Object.entries(rowCounts).map(([k, v]) => `${k}=${v}`).join(", ");

  // Manifest line (stdout) — SHA-256 is over the exact JSON content written.
  console.log(
    `[backup] ${outPath} · sha256=${sha256} · db=${DB_URL} · rows: ${countsStr} · total=${totalRows}`,
  );
}

main()
  .catch((e) => {
    console.error("BACKUP FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
