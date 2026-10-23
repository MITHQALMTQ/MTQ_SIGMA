import { createClient } from "@libsql/client";
const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
console.log("=== FINAL COUNTS + concurrency rows ===");
for (const t of ["PilotTrial","MetricSample","DailyStateVector","RebalancingDecision","OracleSample","IssuanceEvent","MbzBank","MbzBackingCertificate","MbzMintRequest"]) {
  const r = await q(`SELECT COUNT(*) n FROM "${t}"`);
  console.log(`${t}: ${Number(r[0].n)}`);
}
const cc = await q(`SELECT id, type, inputAmount, wallet, createdAt, ok FROM PilotTrial WHERE wallet LIKE 'audit-16d-conc-%' ORDER BY createdAt ASC`);
for (const r of cc) console.log("conc-row:", JSON.stringify({ id: String(r.id), type: String(r.type), amt: Number(r.inputAmount), wallet: String(r.wallet), at: new Date(Number(r.createdAt)).toISOString(), ok: Number(r.ok) }));
// growth: rows per hour current
for (const t of ["DailyStateVector","RebalancingDecision","OracleSample"]) {
  const r = await q(`SELECT CAST(createdAt/3600000 AS INTEGER) hr, COUNT(*) n FROM "${t}" GROUP BY hr ORDER BY hr`);
  console.log(`${t} per-hour:`, r.map((x:any)=>`hr=${Number(x.hr)}:${Number(x.n)}`).join(" "));
}
c.close();
