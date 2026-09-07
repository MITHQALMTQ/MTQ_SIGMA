import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url); const fmt = url.searchParams.get("format") ?? "json"; const lim = Math.min(Number(url.searchParams.get("limit")??"1000"),5000);
  const trials = await db.pilotTrial.findMany({ orderBy:{createdAt:"desc"}, take: lim });
  if (fmt === "csv") {
    const h = ["id","createdAt","type","chain","inputAmount","inputSymbol","outputAmount","outputSymbol","gfbIndex","mtqPrice","nav","reserveRatio","lcr","status","ok","reason","wallet"];
    const rows = trials.map(t => [t.id,t.createdAt.toISOString(),t.type,t.chain,t.inputAmount,t.inputSymbol,t.outputAmount,t.outputSymbol,t.gfbIndex,t.mtqPrice,t.nav,t.reserveRatio,t.lcr,t.status,t.ok,t.reason??"",t.wallet??""]);
    return new NextResponse([h.join(","),...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(","))].join("\n"),{headers:{"Content-Type":"text/csv","Content-Disposition":`attachment; filename="mtqs-trials.csv"`}});
  }
  return NextResponse.json({ count: trials.length, trials });
}
