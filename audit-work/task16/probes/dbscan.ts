// READ-ONLY database inspector — Audit Agent 16-d.
// NO writes. Only SELECT / PRAGMA. Run: bun /home/z/my-project/audit-work/task16/probes/dbscan.ts
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const DB_PATH = "/home/z/my-project/db/custom.db";
const c = createClient({ url: `file:${DB_PATH}` }); // local file, read-only usage

const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const J = (r: any) => (r === null || r === undefined ? null : typeof r === "object" ? JSON.stringify(r) : String(r));

// ---------- 1. sqlite_master ----------
console.log("=== SQLITE_MASTER (tables) ===");
const master = await q(
  `SELECT type, name FROM sqlite_master WHERE type IN ('table','index') ORDER BY type DESC, name`
);
const tables = master.filter((r) => r.type === "table").map((r) => String(r.name));
const idxs = master.filter((r) => r.type === "index").map((r) => String(r.name));
console.log("TABLES:", tables.join(", "));
console.log("INDEX COUNT:", idxs.length);
console.log("INDEXES:", idxs.join(", "));

// ---------- 2. per-table info ----------
console.log("\n=== TABLE_INFO ===");
for (const t of tables) {
  const info = await q(`PRAGMA table_info("${t}")`);
  const cnt = await q(`SELECT COUNT(*) AS n FROM "${t}"`);
  console.log(`\n-- ${t} (rows=${J(cnt[0].n)})`);
  for (const col of info) {
    console.log(`   ${J(col.name)} ${J(col.type)} notnull=${J(col.notnull)} pk=${J(col.pk)} dflt=${J(col.dflt_value)}`);
  }
}

// ---------- 3. index details ----------
console.log("\n=== INDEX_DETAILS ===");
for (const t of tables) {
  const il = await q(`PRAGMA index_list("${t}")`);
  for (const ix of il) {
    const cols = await q(`PRAGMA index_info("${J(ix.name)}")`);
    console.log(`${t}: ${J(ix.name)} unique=${J(ix.unique)} cols=[${cols.map((x) => J(x.name)).join(",")}]`);
  }
}

// ---------- 4. row counts ----------
console.log("\n=== COUNTS ===");
for (const t of tables) {
  const cnt = await q(`SELECT COUNT(*) AS n FROM "${t}"`);
  console.log(`${t}: ${J(cnt[0].n)}`);
}

// ---------- 5. PilotTrial quality ----------
console.log("\n=== PILOTRIAL QUALITY ===");
let r = await q(`SELECT type, ok, COUNT(*) n FROM PilotTrial GROUP BY type, ok`);
for (const x of r) console.log(`type=${J(x.type)} ok=${J(x.ok)} n=${J(x.n)}`);
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE wallet IS NULL`);
console.log("wallet NULL:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE reason IS NULL`);
console.log("reason NULL:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE basketJson IS NULL`);
console.log("basketJson NULL:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE inputAmount <= 0 OR outputAmount < 0`);
console.log("inputAmount<=0 OR outputAmount<0:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE inputAmount > 1e12 OR ABS(gfbIndex) > 1e12 OR ABS(nav) > 1e15`);
console.log("huge values:", J(r[0].n));
r = await q(`SELECT MIN(createdAt) mn, MAX(createdAt) mx FROM PilotTrial`);
console.log("createdAt min/max (raw):", J(r[0].mn), J(r[0].mx));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE createdAt > CAST(strftime('%s','now') AS INTEGER)*1000`);
console.log("FUTURE createdAt:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM PilotTrial WHERE createdAt < 1000`);
console.log("epoch-0 createdAt (<1000ms):", J(r[0].n));
// duplicates by (type,chain,inputAmount,second)
r = await q(
  `SELECT type, chain, inputAmount, CAST(createdAt/1000 AS INTEGER) sec, COUNT(*) n
   FROM PilotTrial GROUP BY type, chain, inputAmount, CAST(createdAt/1000 AS INTEGER) HAVING n > 1`
);
console.log("DUPLICATE groups (type,chain,inputAmount,second):", r.length);
for (const x of r) console.log(`  dup: type=${J(x.type)} chain=${J(x.chain)} amt=${J(x.inputAmount)} sec=${J(x.sec)} n=${J(x.n)}`);
r = await q(`SELECT id, type, chain, inputAmount, outputAmount, wallet, createdAt, ok, reason, status FROM PilotTrial ORDER BY createdAt ASC LIMIT 5`);
for (const x of r) console.log("first:", JSON.stringify(x));
r = await q(`SELECT id, type, chain, inputAmount, outputAmount, wallet, createdAt, ok, reason, status FROM PilotTrial ORDER BY createdAt DESC LIMIT 12`);
for (const x of r) console.log("last:", JSON.stringify(x));

// ---------- 6. MetricSample ----------
console.log("\n=== METRICSAMPLE ===");
r = await q(`SELECT COUNT(*) n FROM MetricSample`);
console.log("MetricSample rows:", J(r[0].n));

// ---------- 7. DailyStateVector ----------
console.log("\n=== DAILYSTATEVECTOR ===");
r = await q(`SELECT MIN(createdAt) mn, MAX(createdAt) mx, MIN(tickCount) mnt, MAX(tickCount) mxt, COUNT(*) n FROM DailyStateVector`);
console.log("count:", J(r[0].n), "createdAt", J(r[0].mn), "→", J(r[0].mx), "tickCount", J(r[0].mnt), "→", J(r[0].mxt));
r = await q(`SELECT COUNT(*) n FROM DailyStateVector WHERE prevHash IS NULL OR rowHash IS NULL`);
console.log("NULL hash rows:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM DailyStateVector WHERE reserveRatio = 0 OR lcr = 0`);
console.log("reserveRatio=0 OR lcr=0 rows:", J(r[0].n));
r = await q(`SELECT status, bufferState, COUNT(*) n FROM DailyStateVector GROUP BY status, bufferState`);
for (const x of r) console.log(`status=${J(x.status)} buffer=${J(x.bufferState)} n=${J(x.n)}`);
r = await q(`SELECT COUNT(*) n FROM DailyStateVector WHERE createdAt > CAST(strftime('%s','now') AS INTEGER)*1000`);
console.log("FUTURE createdAt:", J(r[0].n));

// ---------- 8. RebalancingDecision ----------
console.log("\n=== REBALANCINGDECISION ===");
r = await q(`SELECT COUNT(*) n FROM RebalancingDecision`);
console.log("count:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM RebalancingDecision WHERE prevHash IS NULL AND rowHash IS NULL`);
console.log("MARP (NULL-hash) rows:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM RebalancingDecision WHERE rowHash IS NOT NULL`);
console.log("chained rows:", J(r[0].n));
r = await q(`SELECT shouldRebalance, applied, COUNT(*) n FROM RebalancingDecision WHERE rowHash IS NOT NULL GROUP BY shouldRebalance, applied`);
for (const x of r) console.log(`chained: should=${J(x.shouldRebalance)} applied=${J(x.applied)} n=${J(x.n)}`);
r = await q(`SELECT shouldRebalance, applied, COUNT(*) n FROM RebalancingDecision WHERE rowHash IS NULL GROUP BY shouldRebalance, applied`);
for (const x of r) console.log(`marp: should=${J(x.shouldRebalance)} applied=${J(x.applied)} n=${J(x.n)}`);
r = await q(`SELECT MIN(createdAt) mn, MAX(createdAt) mx FROM RebalancingDecision`);
console.log("createdAt", J(r[0].mn), "→", J(r[0].mx));

// ---------- 9. OracleSample ----------
console.log("\n=== ORACLESAMPLE ===");
r = await q(`SELECT COUNT(*) n FROM OracleSample`);
console.log("count:", J(r[0].n));
r = await q(`SELECT pair, method, paused, COUNT(*) n FROM OracleSample GROUP BY pair, method, paused ORDER BY pair`);
for (const x of r) console.log(`pair=${J(x.pair)} method=${J(x.method)} paused=${J(x.paused)} n=${J(x.n)}`);
r = await q(`SELECT COUNT(*) n FROM OracleSample WHERE finalPrice < 0`);
console.log("negative finalPrice:", J(r[0].n));

// ---------- 10. IssuanceEvent ----------
console.log("\n=== ISSUANCEEVENT ===");
r = await q(`SELECT COUNT(*) n FROM IssuanceEvent`);
console.log("count:", J(r[0].n));
r = await q(`SELECT kind, COUNT(*) n FROM IssuanceEvent GROUP BY kind ORDER BY n DESC`);
for (const x of r) console.log(`kind=${J(x.kind)} n=${J(x.n)}`);
r = await q(`SELECT COUNT(*) n FROM IssuanceEvent WHERE grossAmount NOT GLOB '[0-9]*.[0-9][0-9][0-9][0-9][0-9][0-9]'`);
console.log("grossAmount NOT 6-decimal format:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM IssuanceEvent WHERE requestId = ''`);
console.log("empty requestId:", J(r[0].n));
r = await q(`SELECT COUNT(*) n FROM IssuanceEvent WHERE payload IS NULL OR payload = ''`);
console.log("empty payload:", J(r[0].n));
// payload JSON validity (sample all)
const pl = await q(`SELECT id, payload FROM IssuanceEvent`);
let badJson = 0, badPayloads: string[] = [];
for (const x of pl) {
  try { JSON.parse(String(x.payload)); } catch { badJson++; if (badPayloads.length < 3) badPayloads.push(String(x.id)); }
}
console.log("invalid payload JSON:", badJson, badPayloads.join(","));
r = await q(`SELECT COUNT(DISTINCT requestId) n FROM IssuanceEvent`);
console.log("distinct requestIds:", J(r[0].n));
r = await q(`SELECT MIN(createdAt) mn, MAX(createdAt) mx FROM IssuanceEvent`);
console.log("createdAt", J(r[0].mn), "→", J(r[0].mx));

// ---------- 11. MBG tables ----------
console.log("\n=== MBG TABLES ===");
for (const t of ["MbzBank", "MbzBackingCertificate", "MbzMintRequest"]) {
  r = await q(`SELECT COUNT(*) n FROM "${t}"`);
  console.log(`${t}: ${J(r[0].n)}`);
}

// ---------- 12. hash-chain verification ----------
console.log("\n=== HASH CHAIN VERIFICATION ===");
function auditHash(prevHash: string, payload: unknown): string {
  const h = createHash("sha256");
  h.update(prevHash);
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}
// DailyStateVector chain (payload per audit-trail.ts persistDailyStateVector)
const dsv = await q(`SELECT id, tickAt, tickCount, prevHash, rowHash, gfbIndex, mtqPrice, navUsd, reserveRatio, lcr, status, circulatingSupply, bufferState, createdAt FROM DailyStateVector ORDER BY createdAt ASC`);
let dsvSelfOk = 0, dsvSelfBad = 0, dsvLinkOk = 0, dsvLinkBreak = 0, dsvLinkSkip = 0;
let dsvBadExamples: string[] = [];
for (const row of dsv) {
  if (!row.rowHash) { dsvLinkSkip++; continue; }
  const payload = {
    gfbIndex: Number(row.gfbIndex), mtqPrice: Number(row.mtqPrice), nav: Number(row.navUsd),
    rr: Number(row.reserveRatio), lcr: Number(row.lcr), status: String(row.status),
    circ: Number(row.circulatingSupply), bufferState: String(row.bufferState), tickCount: Number(row.tickCount),
  };
  const expect = auditHash(String(row.prevHash ?? ""), payload);
  if (expect === String(row.rowHash)) dsvSelfOk++; else { dsvSelfBad++; if (dsvBadExamples.length < 2) dsvBadExamples.push(`${row.id} prev=${String(row.prevHash).slice(0,12)} row=${String(row.rowHash).slice(0,12)} expect=${expect.slice(0,12)}`); }
}
let prevRowHash: string | null = null;
for (const row of dsv) {
  if (!row.rowHash) { dsvLinkSkip++; prevRowHash = null; continue; }
  if (prevRowHash !== null && String(row.prevHash ?? "") !== prevRowHash) dsvLinkBreak++;
  else if (prevRowHash !== null) dsvLinkOk++;
  prevRowHash = String(row.rowHash);
}
console.log(`DSV rows=${dsv.length} selfHash OK=${dsvSelfOk} BAD=${dsvSelfBad} | linkage OK=${dsvLinkOk} BREAK-after-prune-or-gap=${dsvLinkBreak} skipped=${dsvLinkSkip}`);
for (const b of dsvBadExamples) console.log("  DSV bad:", b);

// RebalancingDecision chain (payload per persistRebalancingDecision)
const rd = await q(`SELECT id, tickAt, tickCount, prevHash, rowHash, navUsd, reserveRatio, observedGoldWeight, targetGoldWeight, deviationPct, applied, shouldRebalance, direction, tradeUsd, reason, createdAt FROM RebalancingDecision ORDER BY createdAt ASC`);
let rdSelfOk = 0, rdSelfBad = 0, rdResetToEmpty = 0, rdLinkBreak = 0, rdMarpNull = 0;
let rdBadExamples: string[] = [];
for (const row of rd) {
  if (!row.rowHash) { rdMarpNull++; continue; }
  const payload = {
    tickCount: Number(row.tickCount), navUsd: Number(row.navUsd), reserveRatio: Number(row.reserveRatio),
    observedGoldWeight: Number(row.observedGoldWeight), targetGoldWeight: Number(row.targetGoldWeight),
    deviationPct: Number(row.deviationPct), applied: Boolean(row.applied), shouldRebalance: Boolean(row.shouldRebalance),
    direction: Number(row.direction), tradeUsd: Number(row.tradeUsd), reason: String(row.reason),
  };
  const expect = auditHash(String(row.prevHash ?? ""), payload);
  if (expect === String(row.rowHash)) rdSelfOk++;
  else { rdSelfBad++; if (rdBadExamples.length < 2) rdBadExamples.push(`${row.id} prev="${String(row.prevHash ?? "").slice(0,12)}" row=${String(row.rowHash).slice(0,12)} expect=${expect.slice(0,12)} reason="${String(row.reason).slice(0,60)}"`); }
  if (String(row.prevHash ?? "") === "") rdResetToEmpty++;
}
let prevRdHash: string | null = null;
for (const row of rd) {
  if (!row.rowHash) { prevRdHash = null; continue; } // MARP row severs linkage
  if (prevRdHash !== null && String(row.prevHash ?? "") !== prevRdHash) rdLinkBreak++;
  prevRdHash = String(row.rowHash);
}
console.log(`RD rows=${rd.length} chained=${rdSelfOk + rdSelfBad} selfHash OK=${rdSelfOk} BAD=${rdSelfBad} | MARP-null rows=${rdMarpNull} | prevHash=='' (chain resets) among chained=${rdResetToEmpty} | linkage breaks (excl. MARP severs)=${rdLinkBreak}`);
for (const b of rdBadExamples) console.log("  RD bad:", b);

// how many chained rows immediately follow a MARP row (=> chain reset by MARP)
let afterMarp = 0;
let sawMarp = false;
for (const row of rd) {
  if (!row.rowHash) { sawMarp = true; continue; }
  if (sawMarp && String(row.prevHash ?? "") === "") afterMarp++;
  sawMarp = false;
}
console.log(`chained rows whose prevHash=='' immediately AFTER a MARP row: ${afterMarp}`);

// ---------- 13. growth samples ----------
console.log("\n=== GROWTH (rows per hour, DSV) ===");
r = await q(`SELECT CAST(createdAt/3600000 AS INTEGER) hr, COUNT(*) n FROM DailyStateVector GROUP BY hr ORDER BY hr`);
for (const x of r) console.log(`hour=${J(x.hr)} n=${J(x.n)}`);
r = await q(`SELECT CAST(createdAt/3600000 AS INTEGER) hr, COUNT(*) n FROM OracleSample GROUP BY hr ORDER BY hr`);
for (const x of r) console.log(`OS hour=${J(x.hr)} n=${J(x.n)}`);
r = await q(`SELECT CAST(createdAt/3600000 AS INTEGER) hr, COUNT(*) n FROM RebalancingDecision GROUP BY hr ORDER BY hr`);
for (const x of r) console.log(`RD hour=${J(x.hr)} n=${J(x.n)}`);

c.close();
console.log("\nDONE (read-only scan complete)");
