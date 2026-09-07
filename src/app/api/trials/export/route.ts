import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "1000"), 5000);
  
  try {
    const trials = await db.pilotTrial.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    
    if (format === "csv") {
      const headers = ["id","createdAt","type","chain","inputAmount","inputSymbol","outputAmount","outputSymbol","gfbIndex","mtqPrice","nav","reserveRatio","lcr","status","ok","reason","wallet"];
      const rows = trials.map((t) => [t.id,t.createdAt.toISOString(),t.type,t.chain,t.inputAmount,t.inputSymbol,t.outputAmount,t.outputSymbol,t.gfbIndex,t.mtqPrice,t.nav,t.reserveRatio,t.lcr,t.status,t.ok,t.reason??"",t.wallet??""]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(","))].join("\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="mtqs-trials.csv"` } });
    }
    
    return NextResponse.json({ count: trials.length, trials });
  } catch (e: any) {
    console.error("trials export error:", e?.message?.slice(0, 100));
    if (format === "csv") {
      return new NextResponse("id,createdAt,type,chain\n", { headers: { "Content-Type": "text/csv" } });
    }
    return NextResponse.json({ count: 0, trials: [], error: "Database not available" });
  }
}
