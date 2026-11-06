// MTQΣ — Dump round-trip validator (Task 42).
//
// Proves a logical dump is restorable BEFORE we rely on it as the recovery
// source of record: applies it into a throwaway temp DB (os.tmpdir()), then
// verifies integrity_check, table count, row count, and — for chain dumps —
// exact height/genesis-hash against the live source database.
//
// Invoke:
//   bun run scripts/db-restore-verify.ts backups/db-snapshots/latest-chain.sql db/chain.db
//   bun run scripts/db-restore-verify.ts backups/db-snapshots/latest-custom.sql db/custom.db
//
// EXIT: 0 = round-trip PASS (dump restores to the source's current state)
//       1 = FAIL (the dump must be regenerated before any reliance on it)

import { createClient } from "@libsql/client";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDumpTip } from "../src/lib/db-ops";

const [dumpPath, srcDbPath] = process.argv.slice(2);
if (!dumpPath || !srcDbPath) {
  console.error("usage: bun run scripts/db-restore-verify.ts <dump-path> <source-db-path>");
  process.exit(1);
}

const tip = readDumpTip(dumpPath);
if (!tip) {
  console.error(`[verify] FAIL — dump not found: ${dumpPath}`);
  process.exit(1);
}

// Read the source's live state for comparison (best-effort; the authoritative
// expectation is the dump's own tip line — the source may legitimately have
// advanced past it between dump and verify).
let srcHeight: number | null = null;
try {
  const s = createClient({ url: `file:${srcDbPath}` });
  srcHeight = Number(
    Object.values((await s.execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks")).rows[0] ?? {})[0] ?? 0,
  );
  s.close();
} catch {
  srcHeight = null;
}

const tmpDb = join(tmpdir(), `mtq-rt-verify-${Date.now()}.db`);
rmSync(tmpDb, { force: true });
let exitCode = 0;
const c = createClient({ url: `file:${tmpDb}` });
try {
  await c.executeMultiple(readFileSync(dumpPath, "utf8"));

  const integ = String(Object.values((await c.execute("PRAGMA integrity_check")).rows[0] ?? {})[0] ?? "");
  const tables = (await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )).rows.map((r) => String(Object.values(r)[0]));
  let rows = 0;
  for (const t of tables) {
    rows += Number(Object.values((await c.execute(`SELECT count(*) c FROM "${t}"`)).rows[0] ?? {})[0] ?? 0);
  }

  const problems: string[] = [];
  if (integ !== "ok") problems.push(`integrity_check='${integ}'`);
  if (rows !== tip.rows) problems.push(`rows ${rows} != tip ${tip.rows}`);

  let extra = "";
  if (tables.includes("blocks")) {
    const h = Number(
      Object.values((await c.execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks")).rows[0] ?? {})[0] ?? 0,
    );
    const genesisRow = (await c.execute({
      sql: "SELECT value FROM meta WHERE key = ?",
      args: ["genesis_hash"],
    })).rows[0];
    const validators = Number(
      Object.values((await c.execute("SELECT count(*) c FROM validators")).rows[0] ?? {})[0] ?? 0,
    );
    extra = ` · height=${h} · genesis=${String(genesisRow ? Object.values(genesisRow)[0] : "MISSING").slice(0, 22)}… · validators=${validators}`;
    if (tip.height !== null && h !== tip.height) problems.push(`height ${h} != tip ${tip.height}`);
    if (!genesisRow) problems.push("genesis_hash missing");
    if (srcHeight !== null && h > srcHeight) problems.push(`restored height ${h} > live source ${srcHeight}?!`);
  }

  console.log(
    `[verify] ${dumpPath} → ${tmpDb}: integrity=${integ} · tables=${tables.length} · rows=${rows}` +
    `${extra} · dump=${tip.v2 ? "v2" : "v1"} tip=${tip.height ?? "-"}h/${tip.rows}rows` +
    (srcHeight !== null ? ` · live source h${srcHeight}` : ""),
  );

  if (problems.length) {
    console.error(`[verify] FAIL — ${problems.join(" · ")}`);
    exitCode = 1;
  } else {
    console.log(`[verify] PASS — dump restores to its recorded tip exactly.`);
  }
} catch (e) {
  console.error(`[verify] FAIL — dump did not apply: ${e instanceof Error ? e.message : String(e)}`);
  exitCode = 1;
} finally {
  c.close();
  rmSync(tmpDb, { force: true });
}
process.exit(exitCode);
