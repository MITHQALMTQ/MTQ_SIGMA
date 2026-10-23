import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const num = (v: any) => Number(v);
const all = await q(`SELECT * FROM DailyStateVector ORDER BY createdAt ASC`);
let ok = 0, bad = 0; const badTs: string[] = [], okTs: string[] = [];
for (const r of all) {
  const h = sha(String(r.prevHash ?? "") + JSON.stringify({ gfbIndex: num(r.gfbIndex), mtqPrice: num(r.mtqPrice), nav: num(r.navUsd), rr: num(r.reserveRatio), lcr: num(r.lcr), status: String(r.status), circ: num(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: num(r.tickCount) }));
  if (h === String(r.rowHash)) { ok++; okTs.push(new Date(num(r.createdAt)).toISOString()); } else { bad++; badTs.push(new Date(num(r.createdAt)).toISOString()); }
}
console.log(`FINAL DSV recount: OK=${ok} BAD=${bad} of ${all.length}`);
console.log("last 3 OK:", okTs.slice(-3).join(", "));
console.log("last 3 BAD:", badTs.slice(-3).join(", "));
// RD with rawInfinity formula (the tree-correct one: payload hashes raw reserveRatio)
const rd = await q(`SELECT * FROM RebalancingDecision WHERE rowHash IS NOT NULL ORDER BY createdAt ASC`);
let rok = 0, rbad = 0;
for (const r of rd) {
  const rrRaw = num(r.reserveRatio) === 0 ? Infinity : num(r.reserveRatio);
  const h = sha(String(r.prevHash ?? "") + JSON.stringify({ tickCount: num(r.tickCount), navUsd: num(r.navUsd), reserveRatio: rrRaw, observedGoldWeight: num(r.observedGoldWeight), targetGoldWeight: num(r.targetGoldWeight), deviationPct: num(r.deviationPct), applied: Boolean(r.applied), shouldRebalance: Boolean(r.shouldRebalance), direction: num(r.direction), tradeUsd: num(r.tradeUsd), reason: String(r.reason) }));
  if (h === String(r.rowHash)) rok++; else rbad++;
}
console.log(`FINAL RD recount (raw-Inf formula): OK=${rok} BAD=${rbad} of ${rd.length}`);
c.close();
