import { createClient } from "@libsql/client";
const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const rows = await q(`SELECT * FROM PilotTrial ORDER BY createdAt ASC`);
console.log("ALL PilotTrial rows:", rows.length);
for (const r of rows) {
  console.log(JSON.stringify({
    id: String(r.id), type: String(r.type), chain: String(r.chain),
    inputAmount: Number(r.inputAmount), inputSymbol: String(r.inputSymbol),
    outputAmount: Number(r.outputAmount), outputSymbol: String(r.outputSymbol),
    gfbIndex: Number(r.gfbIndex), mtqPrice: Number(r.mtqPrice), nav: Number(r.nav),
    reserveRatio: Number(r.reserveRatio), lcr: Number(r.lcr), status: String(r.status),
    ok: Number(r.ok), reason: r.reason === null ? null : String(r.reason),
    wallet: r.wallet === null ? null : String(r.wallet),
    basketJsonLen: r.basketJson === null ? null : String(r.basketJson).length,
    createdAt: new Date(Number(r.createdAt)).toISOString(),
  }));
}
// basketJson deep-check for the redeem row
const rd = rows.filter(r => String(r.type) === "REDEEM");
for (const r of rd) {
  const bj = JSON.parse(String(r.basketJson));
  console.log("\nREDEEM basketJson parsed:", bj.length, "components; first:", JSON.stringify(bj[0]));
  const api = require("/tmp/redeem-resp2.json");
  const apiBasket = api.redeem.basket;
  const same = JSON.stringify(bj) === JSON.stringify(apiBasket);
  console.log("basketJson === API response basket (deep-equal):", same);
  console.log("row.outputAmount === api.netUsd:", Number(r.outputAmount) === api.redeem.netUsd);
  console.log("row.ok === api.redeem.ok:", Number(r.ok) === 1 && api.redeem.ok === true);
  console.log("row.reason:", JSON.stringify(r.reason === null ? null : String(r.reason)), "| api.reason:", JSON.stringify(api.redeem.reason));
}
// mint row vs api
const mt = rows.filter(r => String(r.type) === "MINT" && String(r.wallet) === "audit-16d-dbtrace");
const apiM = require("/tmp/mint-resp.json");
for (const r of mt) {
  console.log("\nMINT row vs API: outputAmount==mtqMinted:", Number(r.outputAmount) === apiM.mint.mtqMinted,
    "| mtqPrice==snap.mtqPrice:", Number(r.mtqPrice) === apiM.snapshot.mtqPrice,
    "| nav==snap.nav:", Number(r.nav) === apiM.snapshot.nav,
    "| gfbIndex==snap.gfbIndex:", Number(r.gfbIndex) === apiM.snapshot.gfbIndex,
    "| ok:", Number(r.ok) === 1, "| reason:", JSON.stringify(r.reason));
}
c.close();
