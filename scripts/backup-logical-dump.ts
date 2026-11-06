// MTQΣ — Logical SQL dump generator for the dual-layer backup protocol.
//
// Produces a data-only .sql dump (same format as backups/db-snapshots/latest-*.sql):
//   header comment · PRAGMA foreign_keys=OFF · BEGIN TRANSACTION ·
//   per-table INSERT statements (quoted identifiers, ''-escaped strings) · COMMIT
//
// Tables must already exist in the target at restore time:
//   - db/custom.db → created by `bun run db:push` (Prisma schema)
//   - db/chain.db  → created by `initSchema()` (src/lib/chain/store.ts)
//
// Invoke:
//   bun run scripts/backup-logical-dump.ts db/custom.db backups/db-snapshots/latest-custom.sql
//   bun run scripts/backup-logical-dump.ts db/chain.db  backups/db-snapshots/latest-chain.sql
//
// Honesty notes:
//   - "As-of" logical snapshot: tables are read sequentially on a live DB, so
//     cross-table skew is bounded by the dump duration (<seconds). The
//     per-table row count is printed in the comment for verification.
//   - Read-only against the source (SELECTs only).
//   - Integers up to 2^53 serialize exactly as JS numbers; all MTQΣ columns
//     fit that range (checked against schema: µ-units, ms epochs, powers).

import { createClient } from "@libsql/client";
import { writeFileSync } from "node:fs";

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  // string — escape single quotes
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const [dbPath, outPath] = process.argv.slice(2);
  if (!dbPath || !outPath) {
    console.error("usage: bun run scripts/backup-logical-dump.ts <db-path> <out-path>");
    process.exit(1);
  }
  const c = createClient({ url: `file:${dbPath}` });
  const tables = (await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )).rows.map((r) => String(Object.values(r)[0]));

  const stamp = new Date().toISOString();
  const parts: string[] = [
    `-- MTQΣ logical backup ${dbPath} @ ${stamp}`,
    `-- Restore: apply to a schema-initialized db (prisma db push / initSchema)`,
    `PRAGMA foreign_keys=OFF;`,
    `BEGIN TRANSACTION;`,
    ``,
  ];
  let total = 0;
  for (const t of tables) {
    const rows = (await c.execute(`SELECT * FROM "${t}"`)).rows;
    total += rows.length;
    parts.push(`-- table ${t}: ${rows.length} rows`);
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0] as Record<string, unknown>);
    const colList = cols.map((x) => `"${x}"`).join(",");
    for (const r of rows) {
      const vals = cols.map((k) => sqlValue((r as Record<string, unknown>)[k])).join(",");
      parts.push(`INSERT INTO "${t}" (${colList}) VALUES (${vals});`);
    }
    parts.push(``);
  }
  parts.push(`COMMIT;`);
  writeFileSync(outPath, parts.join("\n") + "\n");
  console.log(`[dump] ${dbPath} → ${outPath}: ${total} rows / ${tables.length} tables`);
  c.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
