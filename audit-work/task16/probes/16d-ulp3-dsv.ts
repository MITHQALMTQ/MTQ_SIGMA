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
const around = (x: number) => { const out = [x]; let u = x, d = x; for (let i=0;i<3;i++){ u=nUp(u); d=nDn(d); out.push(u,d);} return out; };
const dsv = await q(`SELECT * FROM DailyStateVector ORDER BY createdAt ASC`);
let exact=0, r1=0, r2=0, r3=0, fail=0;
for (const row of dsv) {
  const base = { gfbIndex: num(row.gfbIndex), mtqPrice: num(row.mtqPrice), nav: num(row.navUsd), rr: num(row.reserveRatio), lcr: num(row.lcr), status: String(row.status), circ: num(row.circulatingSupply), bufferState: String(row.bufferState), tickCount: num(row.tickCount) };
  const prev = String(row.prevHash ?? "");
  if (sha(prev + JSON.stringify(base)) === String(row.rowHash)) { exact++; continue; }
  let found = 0;
  const G = around(num(row.gfbIndex)), M = around(num(row.mtqPrice)), N = around(num(row.navUsd));
  outer: for (const g of G) for (const m of M) for (const n of N) {
    const j = JSON.stringify({ ...base, gfbIndex: g, mtqPrice: m, nav: n });
    if (sha(prev + j) === String(row.rowHash)) { found = 1; break outer; }
  }
  if (found) { r3++; continue; }
  fail++;
}
console.log(`DSV ±3ULP(3 floats): exact=${exact} rescued=${r3} fail=${fail} total=${dsv.length}`);
c.close();
