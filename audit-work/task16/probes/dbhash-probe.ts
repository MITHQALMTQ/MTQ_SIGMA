// READ-ONLY forensic probe #2 — hash-chain payload brute-force. Audit Agent 16-d.
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const J = (r: any) => (r === null || r === undefined ? null : String(r));

function H(prev: string, payload: unknown): string {
  const h = createHash("sha256");
  h.update(prev);
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}

// ---- DSV forensics ----
const dsv = await q(`SELECT id, tickCount, prevHash, rowHash, gfbIndex, mtqPrice, navUsd, reserveRatio, lcr, status, circulatingSupply, bufferState, createdAt FROM DailyStateVector ORDER BY createdAt ASC`);

// classify OK rows under the CURRENT-code payload (fin-coerced)
const cur = (r: any) => H(String(r.prevHash ?? ""), {
  gfbIndex: Number(r.gfbIndex), mtqPrice: Number(r.mtqPrice), nav: Number(r.navUsd),
  rr: Number(r.reserveRatio), lcr: Number(r.lcr), status: String(r.status),
  circ: Number(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: Number(r.tickCount),
});
// variant A: raw Infinity (stored 0 -> hashed null)
const rawFin = (v: any) => (Number(v) === 0 ? Infinity : Number(v));
const varA = (r: any) => H(String(r.prevHash ?? ""), {
  gfbIndex: Number(r.gfbIndex), mtqPrice: Number(r.mtqPrice), nav: Number(r.navUsd),
  rr: rawFin(r.reserveRatio), lcr: rawFin(r.lcr), status: String(r.status),
  circ: Number(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: Number(r.tickCount),
});
// variant B: rr raw only; variant C: lcr raw only
const varB = (r: any) => H(String(r.prevHash ?? ""), {
  gfbIndex: Number(r.gfbIndex), mtqPrice: Number(r.mtqPrice), nav: Number(r.navUsd),
  rr: rawFin(r.reserveRatio), lcr: Number(r.lcr), status: String(r.status),
  circ: Number(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: Number(r.tickCount),
});
const varC = (r: any) => H(String(r.prevHash ?? ""), {
  gfbIndex: Number(r.gfbIndex), mtqPrice: Number(r.mtqPrice), nav: Number(r.navUsd),
  rr: Number(r.reserveRatio), lcr: rawFin(r.lcr), status: String(r.status),
  circ: Number(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: Number(r.tickCount),
});

let okRows: any[] = [], curOK = 0, aOK = 0, bOK = 0, cOK = 0, none = 0;
for (const r of dsv) {
  const m1 = cur(r) === String(r.rowHash); if (m1) curOK++;
  const mA = varA(r) === String(r.rowHash); if (mA) aOK++;
  const mB = varB(r) === String(r.rowHash); if (mB) bOK++;
  const mC = varC(r) === String(r.rowHash); if (mC) cOK++;
  if (m1) okRows.push(r);
  if (!m1 && !mA && !mB && !mC) none++;
}
console.log(`DSV rows=${dsv.length}: current-code-shape OK=${curOK} | rawInfinity(rr,lcr) OK=${aOK} | rr-raw-only OK=${bOK} | lcr-raw-only OK=${cOK} | NO-VARIANT-MATCH=${none}`);
console.log("\nDSV current-shape-OK rows detail (id, createdAt, tickCount, rr, lcr):");
for (const r of okRows) console.log(`  ${J(r.id)} at=${J(r.createdAt)} tc=${J(r.tickCount)} rr=${J(r.reserveRatio)} lcr=${J(r.lcr)}`);

// ---- RD forensics ----
const rd = await q(`SELECT id, tickCount, prevHash, rowHash, navUsd, reserveRatio, observedGoldWeight, targetGoldWeight, deviationPct, applied, shouldRebalance, direction, tradeUsd, reason, createdAt FROM RebalancingDecision WHERE rowHash IS NOT NULL ORDER BY createdAt ASC`);
const rdCur = (r: any) => H(String(r.prevHash ?? ""), {
  tickCount: Number(r.tickCount), navUsd: Number(r.navUsd), reserveRatio: Number(r.reserveRatio),
  observedGoldWeight: Number(r.observedGoldWeight), targetGoldWeight: Number(r.targetGoldWeight),
  deviationPct: Number(r.deviationPct), applied: Boolean(r.applied), shouldRebalance: Boolean(r.shouldRebalance),
  direction: Number(r.direction), tradeUsd: Number(r.tradeUsd), reason: String(r.reason),
});
const rdA = (r: any) => H(String(r.prevHash ?? ""), {
  tickCount: Number(r.tickCount), navUsd: Number(r.navUsd), reserveRatio: rawFin(r.reserveRatio),
  observedGoldWeight: Number(r.observedGoldWeight), targetGoldWeight: Number(r.targetGoldWeight),
  deviationPct: Number(r.deviationPct), applied: Boolean(r.applied), shouldRebalance: Boolean(r.shouldRebalance),
  direction: Number(r.direction), tradeUsd: Number(r.tradeUsd), reason: String(r.reason),
});
let rdCurOK = 0, rdAOK = 0, rdNone = 0, rdFinite = 0;
let rdOKrows: any[] = [];
for (const r of rd) {
  const rr = Number(r.reserveRatio);
  if (rr !== 0) rdFinite++;
  const m1 = rdCur(r) === String(r.rowHash); if (m1) { rdCurOK++; rdOKrows.push(r); }
  const mA = rdA(r) === String(r.rowHash); if (mA) rdAOK++;
  if (!m1 && !mA) rdNone++;
}
console.log(`\nRD chained rows=${rd.length}: finite-RR rows=${rdFinite} | current-shape OK=${rdCurOK} | rawInfinity-rr OK=${rdAOK} | NO-MATCH=${rdNone}`);
console.log("\nRD OK rows detail:");
for (const r of rdOKrows.slice(0, 25)) console.log(`  ${J(r.id)} at=${J(r.createdAt)} tc=${J(r.tickCount)} rr=${J(r.reserveRatio)}`);

// ---- tick interleaving: are there multiple independent tickCount series? ----
console.log("\n=== DSV tickCount interleave (last 45 rows by createdAt) ===");
const last = dsv.slice(-45);
for (const r of last) {
  const t = Number(r.createdAt);
  console.log(`  at=${new Date(t).toISOString()} tc=${J(r.tickCount)} rr=${J(r.reserveRatio)} status=${J(r.status)}`);
}

// ---- RD tickCount series count (group by 10-min window, distinct tickCount deltas) ----
console.log("\n=== DSV tickCount range per 5-min window (detect parallel loops) ===");
const win = await q(`SELECT CAST(createdAt/300000 AS INTEGER) w, COUNT(*) n, MIN(tickCount) mn, MAX(tickCount) mx FROM DailyStateVector GROUP BY w ORDER BY w DESC LIMIT 8`);
for (const x of win) console.log(`  win=${J(x.w)} rows=${J(x.n)} tc ${J(x.mn)}→${J(x.mx)}`);

c.close();
console.log("\nDONE probe2");
