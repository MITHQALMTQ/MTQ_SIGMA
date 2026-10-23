import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const num = (v: any) => Number(v);
const f64 = new DataView(new ArrayBuffer(8));
const nUp = (x: number) => { f64.setFloat64(0, x); let lo = f64.getUint32(4), hi = f64.getUint32(0);
  if (hi === 0 && lo === 0) return 5e-324;
  if (hi < 0x80000000) { if (lo === 0xffffffff) { hi++; lo = 0; } else lo++; } else { if (lo === 0) { lo = 0xffffffff; hi--; } else lo--; }
  f64.setUint32(0, hi); f64.setUint32(4, lo); return f64.getFloat64(0); };
const nDn = (x: number) => (x === 0 ? -5e-324 : -nUp(-x));
const tri = (x: number) => [x, nUp(x), nDn(x)];

// DSV: 3 float fields (gfb, mtq, nav) ± 1 ULP each (rr/lcr/circ are 0 — try ±ulp too? keep 0 exact)
const dsv = await q(`SELECT * FROM DailyStateVector ORDER BY createdAt ASC`);
let exact = 0, ulp1 = 0, fail = 0;
for (const r of dsv) {
  const base = { gfbIndex: num(r.gfbIndex), mtqPrice: num(r.mtqPrice), nav: num(r.navUsd), rr: num(r.reserveRatio), lcr: num(r.lcr), status: String(r.status), circ: num(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: num(r.tickCount) };
  const p = JSON.stringify(base);
  if (sha(String(r.prevHash ?? "") + p) === String(r.rowHash)) { exact++; continue; }
  let hit = false;
  outer: for (const g of tri(num(r.gfbIndex))) for (const m of tri(num(r.mtqPrice))) for (const n of tri(num(r.navUsd))) {
    const pj = JSON.stringify({ ...base, gfbIndex: g, mtqPrice: m, nav: n });
    if (sha(String(r.prevHash ?? "") + pj) === String(r.rowHash)) { hit = true; break outer; }
  }
  if (hit) ulp1++; else fail++;
}
console.log(`DSV: exact=${exact} ulp1-rescued=${ulp1} still-fail=${fail} / ${dsv.length}`);

// RD: floats navUsd, observedGoldWeight, targetGoldWeight, deviationPct, tradeUsd (reserveRatio handled raw-Inf) ± 1 ULP
const rd = await q(`SELECT * FROM RebalancingDecision WHERE rowHash IS NOT NULL ORDER BY createdAt ASC`);
let rexact = 0, rulp = 0, rfail = 0;
for (const r of rd) {
  const rrRaw = num(r.reserveRatio) === 0 ? Infinity : num(r.reserveRatio);
  const base: any = { tickCount: num(r.tickCount), navUsd: num(r.navUsd), reserveRatio: rrRaw, observedGoldWeight: num(r.observedGoldWeight), targetGoldWeight: num(r.targetGoldWeight), deviationPct: num(r.deviationPct), applied: Boolean(r.applied), shouldRebalance: Boolean(r.shouldRebalance), direction: num(r.direction), tradeUsd: num(r.tradeUsd), reason: String(r.reason) };
  if (sha(String(r.prevHash ?? "") + JSON.stringify(base)) === String(r.rowHash)) { rexact++; continue; }
  let hit = false;
  const N = [tri(num(r.navUsd)), tri(num(r.observedGoldWeight)), tri(num(r.targetGoldWeight)), tri(num(r.deviationPct)), tri(num(r.tradeUsd))];
  outer: for (const a of N[0]) for (const b of N[1]) for (const cc of N[2]) for (const d of N[3]) for (const e of N[4]) {
    const pj = JSON.stringify({ ...base, navUsd: a, observedGoldWeight: b, targetGoldWeight: cc, deviationPct: d, tradeUsd: e });
    if (sha(String(r.prevHash ?? "") + pj) === String(r.rowHash)) { hit = true; break outer; }
  }
  if (hit) rulp++; else rfail++;
}
console.log(`RD: exact=${rexact} ulp1-rescued=${rulp} still-fail=${rfail} / ${rd.length}`);
c.close();
