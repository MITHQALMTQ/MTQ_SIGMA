// READ-ONLY forensic probe #3 — brute-force hash construction on specific rows.
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// One post-restart BAD row (single writer era) — latest DSV row
const rows = await q(`SELECT * FROM DailyStateVector ORDER BY createdAt DESC LIMIT 1`);
const R: any = rows[0];
console.log("TARGET row:", JSON.stringify(R, (_k, v) => (typeof v === "bigint" ? String(v) : v)));

const prev = String(R.prevHash ?? "");
const num = (v: any) => Number(v);

const payloadBase: Record<string, unknown> = {
  gfbIndex: num(R.gfbIndex), mtqPrice: num(R.mtqPrice), nav: num(R.navUsd),
  rr: num(R.reserveRatio), lcr: num(R.lcr), status: String(R.status),
  circ: num(R.circulatingSupply), bufferState: String(R.bufferState), tickCount: num(R.tickCount),
};

const variants: Record<string, string> = {};
const P = (o: Record<string, unknown>) => JSON.stringify(o);

// construction variants on base payload
variants["prev+json"] = sha(prev + P(payloadBase));
variants["json+prev"] = sha(P(payloadBase) + prev);
variants["prev\\n+json"] = sha(prev + "\n" + P(payloadBase));
variants["prev|json"] = sha(prev + "|" + P(payloadBase));
variants["prev+json(double)"] = sha(sha(prev + P(payloadBase)));
variants["prev+json(upper)"] = sha(prev + P(payloadBase)).toUpperCase();

// omit-one variants
for (const k of Object.keys(payloadBase)) {
  const o = { ...payloadBase } as any; delete o[k];
  variants[`omit:${k}`] = sha(prev + P(o));
}
// raw Infinity where 0 (rr, lcr)
const infPayload = { ...payloadBase, rr: num(R.reserveRatio) === 0 ? Infinity : num(R.reserveRatio), lcr: num(R.lcr) === 0 ? Infinity : num(R.lcr) } as Record<string, unknown>;
variants["rr/lcr=Infinity"] = sha(prev + P(infPayload));

// alternate key names
variants["fullnames"] = sha(prev + P({
  gfbIndex: num(R.gfbIndex), mtqPrice: num(R.mtqPrice), navUsd: num(R.navUsd),
  reserveRatio: num(R.reserveRatio), lcr: num(R.lcr), status: String(R.status),
  circulatingSupply: num(R.circulatingSupply), bufferState: String(R.bufferState), tickCount: num(R.tickCount),
}));
// tickAt included (ISO + ms)
variants["+tickAtISO"] = sha(prev + P({ ...payloadBase, tickAt: new Date(num(R.tickAt)).toISOString() }));
variants["+tickAtMs"] = sha(prev + P({ ...payloadBase, tickAt: num(R.tickAt) }));
variants["+createdAtISO"] = sha(prev + P({ ...payloadBase, createdAt: new Date(num(R.createdAt)).toISOString() }));
// full stored-row-as-data-object shape (like create data, with Date→ISO)
variants["fullRowData"] = sha(prev + P({
  tickAt: new Date(num(R.tickAt)).toISOString(), tickCount: num(R.tickCount), prevHash: prev,
  gfbIndex: num(R.gfbIndex), mtqPrice: num(R.mtqPrice), priceInBand: Boolean(R.priceInBand),
  navUsd: num(R.navUsd), liabilityUsd: num(R.liabilityUsd), reserveRatio: num(R.reserveRatio),
  lcr: num(R.lcr), status: String(R.status), circulatingSupply: num(R.circulatingSupply),
  totalSupply: num(R.totalSupply), usdNet: num(R.usdNet), eurNet: num(R.eurNet), gbpNet: num(R.gbpNet),
  jpyNet: num(R.jpyNet), cnyNet: num(R.cnyNet), chfNet: num(R.chfNet), goldNet: num(R.goldNet),
  fiatNet: num(R.fiatNet), vix: num(R.vix), dxy: num(R.dxy), zVix: num(R.zVix), zDxy: num(R.zDxy),
  rawTheta: num(R.rawTheta), smoothedGoldWeight: num(R.smoothedGoldWeight),
  targetGoldWeight: num(R.targetGoldWeight), observedGoldWeight: num(R.observedGoldWeight),
  bufferState: String(R.bufferState), bufferGoldRatio: num(R.bufferGoldRatio),
  ejectStage: num(R.ejectStage), pegHealthJson: String(R.pegHealthJson),
}));
// key order: tickCount first
variants["order:tcFirst"] = sha(prev + P({
  tickCount: num(R.tickCount), gfbIndex: num(R.gfbIndex), mtqPrice: num(R.mtqPrice), nav: num(R.navUsd),
  rr: num(R.reserveRatio), lcr: num(R.lcr), status: String(R.status),
  circ: num(R.circulatingSupply), bufferState: String(R.bufferState),
}));
// no prev in hash at all
variants["jsonOnly"] = sha(P(payloadBase));

let matched = false;
for (const [name, hash] of Object.entries(variants)) {
  if (hash === String(R.rowHash)) { console.log(`*** MATCH: ${name} ***`); matched = true; }
}
if (!matched) {
  console.log("NO MATCH among", Object.keys(variants).length, "variants. target rowHash:", String(R.rowHash));
  console.log("prevHash:", JSON.stringify(prev), "payload:", P(payloadBase));
  console.log("computed prev+json:", variants["prev+json"]);
}

// sanity: verify method against one of the 18 OK rows
const okRows = await q(`SELECT * FROM DailyStateVector WHERE id = 'cmvlc6k63010lwmx0bt9svcb3'`);
if (okRows.length) {
  const O: any = okRows[0];
  const p = {
    gfbIndex: num(O.gfbIndex), mtqPrice: num(O.mtqPrice), nav: num(O.navUsd),
    rr: num(O.reserveRatio), lcr: num(O.lcr), status: String(O.status),
    circ: num(O.circulatingSupply), bufferState: String(O.bufferState), tickCount: num(O.tickCount),
  };
  const h = sha(String(O.prevHash ?? "") + JSON.stringify(p));
  console.log("\nSANITY OK-row recompute:", h === String(O.rowHash) ? "MATCH ✓ (method correct)" : "NO MATCH?!");
}

c.close();
