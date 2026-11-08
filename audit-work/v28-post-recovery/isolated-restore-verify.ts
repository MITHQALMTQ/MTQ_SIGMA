// v28 §3 — ISOLATED restore of the exact committed dumps + full reconciliation.
// Read-only against production: extracts dumps from origin/main, restores into
// throwaway /tmp DBs, verifies everything, and reconciles table-by-table
// (committed-authoritative vs live). Never writes db/.
//
// PHASES (process isolation — REQUIRED):
//   bun isolated-restore-verify.ts restore   → extract + restore, then exit
//   bun isolated-restore-verify.ts verify    → fresh process: verify + reconcile
//
// WHY TWO PROCESSES: bun 1.3.14 transiently fails statement PREPARE with
// "no such table: X" for tables created by a huge multi-statement exec WHEN
// the verify queries run in the SAME PROCESS (reproduced 3×: chain.db
// 'accounts' in live-battery, custom.db 'AiModelCatalog' here — even on
// fresh readonly connections inside the polluted process). A separate
// process reading the restored file always passes, and the file itself
// passes PRAGMA integrity_check every time. Restore and verify are therefore
// split across process boundaries by design, plus a small per-query retry.
//
// NOTE (v28): restore uses bun:sqlite native multi-statement exec — the
// @libsql/client executeMultiple path aborted with SQLITE_IOERR_DELETE_NOENT
// on the 29.5MB chain dump (libsql local-client journal cleanup bug).
// NOTE: `git show` is streamed to disk via shell redirection — capturing the
// 29.5MB dump through the spawn buffer is unreliable (execFileSync ENOBUFS).
import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = "/home/z/my-project";
const OUT = "/tmp/v28-restore";
const PHASE = process.argv[2] ?? "all";
mkdirSync(OUT, { recursive: true });

const log = (s: string) => console.log(`[v28-restore ${new Date().toISOString()}] ${s}`);
const sh = (cmd: string) => execFileSync("/bin/bash", ["-c", cmd], { encoding: "utf8", cwd: ROOT }).trim();

const chainPath = `${OUT}/committed-chain.sql`;
const customPath = `${OUT}/committed-custom.sql`;

if (PHASE === "restore") {
  execFileSync("/bin/bash", ["-c", `git show origin/main:backups/db-snapshots/latest-chain.sql > ${chainPath}`], { cwd: ROOT });
  execFileSync("/bin/bash", ["-c", `git show origin/main:backups/db-snapshots/latest-custom.sql > ${customPath}`], { cwd: ROOT });
  const chainSql = readFileSync(chainPath, "utf8");
  const customSql = readFileSync(customPath, "utf8");
  log(`extracted committed dumps: chain=${chainSql.length}B custom=${customSql.length}B`);
  rmSync(`${OUT}/restored-chain.db`, { force: true });
  rmSync(`${OUT}/restored-custom.db`, { force: true });
  const a = new Database(`${OUT}/restored-chain.db`);
  a.exec(chainSql);
  a.close();
  log(`chain dump restored.`);
  const b = new Database(`${OUT}/restored-custom.db`);
  b.exec(customSql);
  b.close();
  log(`custom dump restored.`);
  log(`restore phase complete (verify in a FRESH process).`);
  process.exit(0);
}

// ================= verify phase (fresh process) =================
if (!existsSync(`${OUT}/restored-chain.db`) || !existsSync(`${OUT}/restored-custom.db`)) {
  console.error("restored DBs missing — run the restore phase first");
  process.exit(2);
}
const sha256 = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const chainSha = sha256(chainPath);
const customSha = sha256(customPath);
log(`sha256 chain=${chainSha}`);
log(`sha256 custom=${customSha}`);
const chainBlob = sh("git rev-parse origin/main:backups/db-snapshots/latest-chain.sql");
const customBlob = sh("git rev-parse origin/main:backups/db-snapshots/latest-custom.sql");
const tipLineOf = (p: string) => readFileSync(p, "utf8").split("\n")[2];

// retry wrapper for the residual bun/filesystem settle transient:
// a freshly-restored multi-MB file can briefly fail prepare with
// "no such table" for new opens (~seconds), while the file itself passes
// integrity_check and counts fine once settled — retry with real backoff
const countN = (db: Database, sql: string, tries = 8): number => {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return (db.query(sql).get() as { n: number }).n;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) Bun.sleepSync(1000);
    }
  }
  throw lastErr;
};

// ---------- 1. Verify restored chain DB ----------
const rc = new Database(`${OUT}/restored-chain.db`, { readonly: true });
const rcm = new Database(`${OUT}/restored-custom.db`, { readonly: true });
const rInteg = rc.query("PRAGMA integrity_check").all();
const rFk = rc.query("PRAGMA foreign_key_check").all();
const rMin = (rc.query("SELECT MIN(height) h FROM blocks").get() as { h: number }).h;
const rTip = rc.query("SELECT MAX(height) h, COUNT(*) n FROM blocks").get() as { h: number; n: number };
const rGaps = (
  rc.query(
    "SELECT COUNT(*) n FROM (SELECT height, LAG(height) OVER (ORDER BY height) prev FROM blocks) WHERE height-prev != 1"
  ).get() as { n: number }
).n;
const rGenesis = rc.query("SELECT hash, header FROM blocks WHERE height=?").get(rMin) as { hash: string; header: string };
const rgh = JSON.parse(rGenesis.header);
const rB2 = rc.query("SELECT hash, header FROM blocks WHERE height=?").get(rMin + 1) as { hash: string; header: string };
const rMeta = Object.fromEntries(
  (rc.query("SELECT key, value FROM meta").all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
);
const rValidators = rc.query("SELECT * FROM validators ORDER BY 1").all();
const rTables = (rc.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(
  (r) => r.name
);
log(`restored chain: integrity=${JSON.stringify(rInteg)} tip=${rTip.h} rows=${rTip.n} gaps=${rGaps} validators=${rValidators.length}`);

// ---------- 2. Live DBs (read-only) ----------
const lc = new Database(`${ROOT}/db/chain.db`, { readonly: true });
const lm = new Database(`${ROOT}/db/custom.db`, { readonly: true });
const liveMin = (lc.query("SELECT MIN(height) h FROM blocks").get() as { h: number }).h;
const liveTip = lc.query("SELECT MAX(height) h, COUNT(*) n FROM blocks").get() as { h: number; n: number };
const liveGaps = (
  lc.query(
    "SELECT COUNT(*) n FROM (SELECT height, LAG(height) OVER (ORDER BY height) prev FROM blocks) WHERE height-prev != 1"
  ).get() as { n: number }
).n;
const liveInteg = lc.query("PRAGMA integrity_check").all();
const liveGenesis = lc.query("SELECT hash, header FROM blocks WHERE height=?").get(liveMin) as { hash: string; header: string };
const liveMeta = Object.fromEntries(
  (lc.query("SELECT key, value FROM meta").all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
);
const liveValidators = lc.query("SELECT * FROM validators ORDER BY 1").all();
const liveSchemaChain = lc
  .query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string; sql: string }[];
const rSchemaChain = rc
  .query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string; sql: string }[];
const schemaEq = (a: { name: string; sql: string }[], b: { name: string; sql: string }[]) =>
  JSON.stringify(a.map((x) => [x.name, x.sql])) === JSON.stringify(b.map((x) => [x.name, x.sql]));

// chain.db per-table row counts, restored vs live
const chainTableCounts: Record<string, unknown> = {};
const chainTables = rTables.filter((t) => !t.startsWith("sqlite_"));
for (const t of chainTables) {
  try {
    chainTableCounts[t] = { restored: countN(rc, `SELECT COUNT(*) n FROM "${t}"`), live: countN(lc, `SELECT COUNT(*) n FROM "${t}"`) };
  } catch (e) {
    chainTableCounts[t] = { restored: -1, live: -1, error: String(e) };
  }
}

// ---------- 3. Custom DB reconciliation (table-by-table) ----------
const liveCustomTables = (
  lm.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as { name: string }[]
).map((r) => r.name);
const rCustomTables = (
  rcm.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as { name: string }[]
).map((r) => r.name);

const orderKey: Record<string, string> = {
  AiModelCatalog: "id",
  ConsensusRun: "id",
  ConsensusVote: "id",
  DailyStateVector: "id",
  IssuanceEvent: "id",
  MbzBackingCertificate: "id",
  MbzBank: "id",
  MbzMintRequest: "id",
  MetricSample: "id",
  OracleSample: "id",
  PilotTrial: "id",
  RebalancingDecision: "id",
  ScoringUpload: "id",
};
const TELEMETRY = new Set(["DailyStateVector", "OracleSample", "RebalancingDecision"]);
const CAPS: Record<string, number> = { RebalancingDecision: 10000, DailyStateVector: 5000, OracleSample: 5000 };

type TableDelta = {
  table: string;
  class: "PROTECTED" | "TELEMETRY";
  committedRows: number;
  liveRows: number;
  verdict: string;
};
const deltas: TableDelta[] = [];

const liveCustomSchema = lm
  .query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name")
  .all() as { name: string; sql: string }[];
const rCustomSchema = rcm
  .query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name")
  .all() as { name: string; sql: string }[];

for (const t of rCustomTables) {
  log(`reconciling table ${t}…`);
  const key = orderKey[t] ?? "id";
  const committedRows = countN(rcm, `SELECT COUNT(*) n FROM "${t}"`);
  const liveRows = countN(lm, `SELECT COUNT(*) n FROM "${t}"`);
  const isTel = TELEMETRY.has(t);
  let verdict = "";
  if (isTel) {
    const cap = CAPS[t];
    verdict =
      liveRows <= cap
        ? `retention-capped (cap ${cap}); committed ${committedRows} → live ${liveRows}, within cap`
        : `LIVE EXCEEDS CAP ${cap}`;
  } else {
    const committedContent = (rcm.query(`SELECT * FROM "${t}" ORDER BY "${key}"`).all() as object[])
      .map((r) => JSON.stringify(r))
      .join("\n");
    const liveContent = (lm.query(`SELECT * FROM "${t}" ORDER BY "${key}"`).all() as object[])
      .map((r) => JSON.stringify(r))
      .join("\n");
    const hC = createHash("sha256").update(committedContent).digest("hex").slice(0, 16);
    const hL = createHash("sha256").update(liveContent).digest("hex").slice(0, 16);
    verdict = committedContent === liveContent ? `EXACT-MATCH (sha ${hC})` : `MISMATCH committed:${hC} live:${hL}`;
  }
  deltas.push({ table: t, class: (isTel ? "TELEMETRY" : "PROTECTED") as TableDelta["class"], committedRows, liveRows, verdict });
}

const onlyLive = liveCustomTables.filter((t) => !rCustomTables.includes(t));
const onlyCommitted = rCustomTables.filter((t) => !liveCustomTables.includes(t));
const customIntegrity = rcm.query("PRAGMA integrity_check").all();
const liveCustomIntegrity = lm.query("PRAGMA integrity_check").all();

// ---------- 4. Final tips + dual lag ----------
const diskTipLine = readFileSync(`${ROOT}/backups/db-snapshots/latest-chain.sql`, "utf8").split("\n")[2];
const diskTipH = Number(/height=(\d+)/.exec(diskTipLine)?.[1] ?? 0);
const committedTipH = rTip.h;
const liveTipH = liveTip.h;
const unbackedAhead = Math.max(0, liveTipH - committedTipH);
const recoveryDeficit = Math.max(0, committedTipH - liveTipH);

const dumpCommit = sh("git log -1 --format='%cI %h' -- backups/db-snapshots/latest-chain.sql");
const dumpCommitIso = dumpCommit.split(" ")[0];
const dumpAgeMin = Math.round((Date.now() - Date.parse(dumpCommitIso)) / 60000);

const report = {
  generatedAtIso: new Date().toISOString(),
  committedDumps: {
    originSha: sh("git rev-parse origin/main"),
    chain: { sha256: chainSha, gitBlob: chainBlob, tipLine: tipLineOf(chainPath), bytes: readFileSync(chainPath).length },
    custom: { sha256: customSha, gitBlob: customBlob, tipLine: tipLineOf(customPath), bytes: readFileSync(customPath).length },
  },
  restoredChain: {
    integrity: rInteg,
    foreignKeyCheckViolations: rFk.length,
    minHeight: rMin,
    tip: rTip,
    gaps: rGaps,
    contiguous: rGaps === 0 && rTip.n === rTip.h - rMin + 1,
    genesisBlockHash: rGenesis.hash,
    genesisChainId: rgh.chain_id,
    genesisPrevHash: rgh.prev_hash,
    b2LinksGenesis: JSON.parse(rB2.header as string).prev_hash === rGenesis.hash,
    meta: rMeta,
    validators: rValidators.length,
    validatorIdentities: rValidators,
    tables: rTables,
  },
  liveChain: {
    minHeight: liveMin,
    tip: liveTip,
    gaps: liveGaps,
    integrity: liveInteg,
    genesisBlockHash: liveGenesis.hash,
    meta: liveMeta,
    validators: liveValidators.length,
  },
  crossChecks: {
    genesisHashMatch: rGenesis.hash === liveGenesis.hash,
    chainIdMatch: rgh.chain_id === JSON.parse(liveGenesis.header as string).chain_id,
    metaGenesisMatch: rMeta.genesis_hash === liveMeta.genesis_hash,
    validatorSetsEqual: JSON.stringify(rValidators) === JSON.stringify(liveValidators),
    schemaChainEqual: schemaEq(rSchemaChain, liveSchemaChain),
    schemaCustomEqual: JSON.stringify(rCustomSchema) === JSON.stringify(liveCustomSchema),
    restoredCustomIntegrity: customIntegrity,
    liveCustomIntegrity: liveCustomIntegrity,
    bootMode: rMeta.boot_mode,
    genesisSpec: rMeta.genesis_hash,
  },
  chainTableCounts,
  tipsAndLag: {
    liveTip: liveTipH,
    diskDumpTip: diskTipH,
    committedDumpTip: committedTipH,
    unbackedAhead,
    recoveryDeficit,
    dumpBearingCommit: dumpCommit,
    dumpCommitAgeMin: dumpAgeMin,
  },
  customReconciliation: {
    committedTables: rCustomTables,
    liveTables: liveCustomTables,
    onlyInLive: onlyLive,
    onlyInCommitted: onlyCommitted,
    deltas,
  },
};

const outPath = `${ROOT}/audit-work/v28-post-recovery/restore-verify.json`;
writeFileSync(outPath, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
log(`report written to ${outPath}`);
rc.close();
rcm.close();
lc.close();
lm.close();
rmSync(`${OUT}/restored-chain.db`, { force: true });
rmSync(`${OUT}/restored-custom.db`, { force: true });
