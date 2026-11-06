// MTQΣ — Logical SQL dump generator for the dual-layer backup protocol.
//
// Thin CLI over src/lib/db-ops.ts dumpDatabase() (Task 42): emits the v2
// SELF-CONTAINED format (schema + data + machine-readable tip line, atomic
// tmp+rename write) — restoring needs only an empty file + executeMultiple().
//
// Invoke:
//   bun run scripts/backup-logical-dump.ts db/custom.db backups/db-snapshots/latest-custom.sql
//   bun run scripts/backup-logical-dump.ts db/chain.db  backups/db-snapshots/latest-chain.sql
//
// Honesty notes:
//   - "As-of" logical snapshot: tables are read sequentially on a live DB, so
//     cross-table skew is bounded by the dump duration (<seconds). Per-table
//     row counts are printed in the tip line for verification.
//   - Read-only against the source (SELECTs only).
//   - SAFETY: do NOT run this against a DB that is BEHIND its existing dump
//     (the re-image regression signature) — you would overwrite the recovery
//     source of record. The automatic loop (scripts/db-cloud-sync.ts) refuses
//     to do so; this manual tool trusts the operator (use the
//     --allow-reset sentinel if the regression is intentional).

import { dumpDatabase } from "../src/lib/db-ops";

const [dbPath, outPath] = process.argv.slice(2);
if (!dbPath || !outPath) {
  console.error("usage: bun run scripts/backup-logical-dump.ts <db-path> <out-path>");
  process.exit(1);
}

const info = await dumpDatabase(dbPath, outPath);
console.log(`[dump] ${dbPath} → ${outPath}: ${info.rows} rows / ${info.tables} tables${info.height !== null ? ` · tip h${info.height}` : ""} (format v2 self-contained)`);
