import { createClient } from "@libsql/client";
const c = createClient({ url: "file:/home/z/my-project/db/custom.db" });
const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;
const rows = await q(`SELECT kind, grossAmount, feeAmount, netAmount, quote, issuedAmount, supplyAfter, requestId, state, instrument FROM IssuanceEvent ORDER BY createdAt ASC`);
for (const r of rows) console.log(JSON.stringify({kind:String(r.kind),gross:String(r.grossAmount),fee:String(r.feeAmount),net:String(r.netAmount),quote:String(r.quote),issued:String(r.issuedAmount),supplyAfter:String(r.supplyAfter),req:String(r.requestId).slice(0,18),state:String(r.state),inst:String(r.instrument)}));
c.close();
