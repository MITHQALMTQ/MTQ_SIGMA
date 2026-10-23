// READ-ONLY forensic probe #4 — precision-truncation hypothesis test.
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const num = (v: any) => Number(v);

// OK rows' float digit lengths
const okIds = ["cmvlc6k63010lwmx0bt9svcb3","cmvlc7xzl015ywmx0quajq6u5","cmvlc8nft018owmx0mrkbk7u7","cmvlc8nt40193wmx0c1tiavd1","cmvlce4n601tswmx0ti786ad4","cmvlcg620020kwmx09ufbvrz0","cmvlci8t90297wmx01qq3rac0","cmvlcp8a102zbwmx0et2v55hx","cmvlcp90h02zjwmx0v29j7tnq","cmvlcpt44031mwmx066fu6tck","cmvlcpxuj0325wmx0mozsu7qp","cmvld0z2o00aqwmpfir1r9mbm","cmvldco50011gwmpfa5tqq1pw","cmvldp1lo01u0wmpfmo56mn2g"];
const okRows = await q(`SELECT id, gfbIndex, mtqPrice, navUsd FROM DailyStateVector WHERE id IN (${okIds.map((_, i) => `?`).join(",")})`);
console.log("=== OK-row float reprs (JSON shortest form + digit count) ===");
for (const r of okRows) {
  const g = num(r.gfbIndex), m = num(r.mtqPrice), n = num(r.navUsd);
  const gs = JSON.stringify(g), ms = JSON.stringify(m), ns = JSON.stringify(n);
  console.log(`  ${String(r.id).slice(0,12)} gfb=${gs} (${gs.replace(/[.\-e]/g,"").length}d) mtq=${ms} (${ms.replace(/[.\-e]/g,"").length}d) nav=${ns} (${ns.replace(/[.\-e]/g,"").length}d)`);
}

// BAD row precision brute-force
const rows = await q(`SELECT * FROM DailyStateVector ORDER BY createdAt DESC LIMIT 1`);
const R: any = rows[0];
const prev = String(R.prevHash ?? "");
const prec = (x: number, p: number) => Number(x.toPrecision(p));
const gRaw = num(R.gfbIndex), mRaw = num(R.mtqPrice), nRaw = num(R.navUsd);
console.log("\n=== BAD-row precision brute-force ===");
console.log("raws:", JSON.stringify({ g: gRaw, m: mRaw, n: nRaw }));
let found: string[] = [];
for (const gp of [15, 16, 17]) for (const mp of [15, 16, 17]) for (const np of [15, 16, 17]) {
  const payload = JSON.stringify({
    gfbIndex: prec(gRaw, gp), mtqPrice: prec(mRaw, mp), nav: prec(nRaw, np),
    rr: num(R.reserveRatio), lcr: num(R.lcr), status: String(R.status),
    circ: num(R.circulatingSupply), bufferState: String(R.bufferState), tickCount: num(R.tickCount),
  });
  const h = sha(prev + payload);
  if (h === String(R.rowHash)) found.push(`g:toPrecision(${gp}) m:toPrecision(${mp}) n:toPrecision(${np})`);
}
console.log("precision-variant matches:", found.length ? found.join(" ; ") : "NONE");

// also try: hashed with Float32 somewhere? (unlikely) — and rounding like Math.round(x*1e6)/1e6 (6dp money)
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const payload6 = JSON.stringify({
  gfbIndex: r6(gRaw), mtqPrice: r6(mRaw), nav: r6(nRaw), rr: num(R.reserveRatio), lcr: num(R.lcr),
  status: String(R.status), circ: num(R.circulatingSupply), bufferState: String(R.bufferState), tickCount: num(R.tickCount),
});
console.log("6dp-round match:", sha(prev + payload6) === String(R.rowHash));

// Try: maybe the hashed snapshot was the PRE-tick snapshot (values differ slightly)?
// Grab the PREVIOUS row's values and try hashing with them (same prevHash chain position):
const prev2 = await q(`SELECT * FROM DailyStateVector WHERE rowHash = '${prev}'`);
if (prev2.length) {
  const Pv: any = prev2[0];
  for (const src of ["prevRowValues"]) {
    const payload = JSON.stringify({
      gfbIndex: num(Pv.gfbIndex), mtqPrice: num(Pv.mtqPrice), nav: num(Pv.navUsd),
      rr: num(Pv.reserveRatio), lcr: num(Pv.lcr), status: String(Pv.status),
      circ: num(Pv.circulatingSupply), bufferState: String(Pv.bufferState), tickCount: num(Pv.tickCount),
    });
    console.log("prev-row-values match:", sha(prev + payload) === String(R.rowHash));
  }
} else console.log("(prev row by hash not found — chain cross-writer link)");

// How many BAD rows become OK when floats are toPrecision(15)-truncated?
const all = await q(`SELECT id, prevHash, rowHash, gfbIndex, mtqPrice, navUsd, reserveRatio, lcr, status, circulatingSupply, bufferState, tickCount FROM DailyStateVector ORDER BY createdAt ASC`);
let baseOK = 0, p15OK = 0;
for (const r of all) {
  const mk = (f: (x: number) => number) => sha(String(r.prevHash ?? "") + JSON.stringify({
    gfbIndex: f(num(r.gfbIndex)), mtqPrice: f(num(r.mtqPrice)), nav: f(num(r.navUsd)),
    rr: num(r.reserveRatio), lcr: num(r.lcr), status: String(r.status),
    circ: num(r.circulatingSupply), bufferState: String(r.bufferState), tickCount: num(r.tickCount),
  }));
  if (mk((x) => x) === String(r.rowHash)) baseOK++;
  else if (mk((x) => Number(x.toPrecision(15))) === String(r.rowHash)) p15OK++;
}
console.log(`\nAll-rows: base OK=${baseOK}, precision15-rescued OK=${p15OK}, still-bad=${all.length - baseOK - p15OK}`);

c.close();
