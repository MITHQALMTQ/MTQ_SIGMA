/**
 * v27 re-verification session — live DB measurement (read-only).
 * Measures chain + custom DBs: tips, integrity, genesis, boot_mode, validators,
 * custom per-table row counts. Never writes to the databases.
 * Usage: bun scripts/v27-reverify/measure-db.ts [--json out.json]
 */
import { DatabaseSync } from "node:sqlite";

function measure(path: string, queries: Record<string, string>) {
  const db = new DatabaseSync(path, { readOnly: true });
  const out: Record<string, unknown> = { path };
  for (const [k, q] of Object.entries(queries)) {
    try {
      const r = db.prepare(q).get() as Record<string, unknown> | undefined;
      out[k] = r ? Object.values(r)[0] : null;
    } catch (e) {
      out[k] = `ERR: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  db.close();
  return out;
}

const chain = measure("db/chain.db", {
  tip: "SELECT MAX(height) FROM blocks",
  count: "SELECT COUNT(*) FROM blocks",
  integrity: "PRAGMA integrity_check",
  genesisHash: "SELECT hash FROM blocks WHERE height=0",
  genesisSpec: "SELECT value FROM meta WHERE key='genesis_spec_hash'",
  bootMode: "SELECT value FROM meta WHERE key='boot_mode'",
  chainId: "SELECT value FROM meta WHERE key='chain_id'",
  validators: "SELECT COUNT(*) FROM validators",
  rewardsEnabled: "SELECT value FROM meta WHERE key='rewards_enabled'",
  schemaV: "SELECT value FROM meta WHERE key='schema_version'",
  contiguity:
    "SELECT COUNT(*) AS gaps FROM blocks a WHERE a.height>0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.height=a.height-1)",
});

const custom = measure("db/custom.db", {
  integrity: "PRAGMA integrity_check",
  tableCount:
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations'",
});

// per-table rows (custom)
const cdb = new DatabaseSync("db/custom.db", { readOnly: true });
const tables = cdb
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations' ORDER BY name"
  )
  .all() as { name: string }[];
const rows: Record<string, number | string> = {};
let total = 0;
for (const t of tables) {
  try {
    const n = (cdb.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n;
    rows[t.name] = n;
    total += n;
  } catch (e) {
    rows[t.name] = `ERR: ${(e as Error).message.slice(0, 80)}`;
  }
}
cdb.close();

const result = { measuredAt: new Date().toISOString(), chain, custom: { ...custom, tableRows: rows, totalRows: total } };
console.log(JSON.stringify(result, null, 2));
const idx = process.argv.indexOf("--json");
if (idx > 0 && process.argv[idx + 1]) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.argv[idx + 1], JSON.stringify(result, null, 2) + "\n");
  console.log(`written: ${process.argv[idx + 1]}`);
}
