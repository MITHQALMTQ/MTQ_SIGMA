import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

// [16a-009/16d-005 fix, Task 16-fix-A] OWASP CSV injection (formula
// injection) neutralization: spreadsheet apps (Excel, Google Sheets,
// LibreOffice) interpret a cell whose value STARTS with "=", "+", "-", "@"
// or TAB as a FORMULA. chain/wallet are user-supplied free text that
// round-trips through this export (audit 16a-009: a 1e15-mint row's wallet
// field re-exports verbatim), so any such cell gets a leading "'" — the
// standard OWASP mitigation — which forces text interpretation. The quote
// is part of the cell value (visible in the raw CSV; nothing is hidden).
function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-\t@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  // [Task 24-c hardening] "evidence" bucket, 10 req/IP/min — each request
  // reads up to 5,000 pilot-trial rows from SQLite and (format=csv) builds
  // the full export string in memory; unbounded hammering stalls the single
  // writer connection shared with live mint/redeem logging.
  const rl = await rateLimit(getClientIP(req), "evidence");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  // [16a-008 fix, Task 16-fix-A] Strict limit parsing — same class as
  // /api/trials: garbage no longer masquerades as a DB outage (NaN into
  // Prisma `take` threw and was reported as "Database not available").
  const rawLimit = url.searchParams.get("limit") ?? "1000";
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: "limit must be an integer 1-5000" }, { status: 400 });
  }
  const limit = Math.min(5000, Math.max(1, parsed));

  try {
    const trials = await db.pilotTrial.findMany({ orderBy: { createdAt: "desc" }, take: limit });

    if (format === "csv") {
      const headers = ["id","createdAt","type","chain","inputAmount","inputSymbol","outputAmount","outputSymbol","gfbIndex","mtqPrice","nav","reserveRatio","lcr","status","ok","reason","wallet"];
      const rows = trials.map((t) => [t.id,t.createdAt.toISOString(),t.type,t.chain,t.inputAmount,t.inputSymbol,t.outputAmount,t.outputSymbol,t.gfbIndex,t.mtqPrice,t.nav,t.reserveRatio,t.lcr,t.status,t.ok,t.reason??"",t.wallet??""]);
      const csv = [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="mtqs-trials.csv"` } });
    }

    return NextResponse.json({ count: trials.length, trials });
  } catch (e: any) {
    // Reached only on a real DB failure now.
    console.error("trials export error:", e?.message?.slice(0, 100));
    if (format === "csv") {
      return new NextResponse("id,createdAt,type,chain\n", { headers: { "Content-Type": "text/csv" } });
    }
    return NextResponse.json({ count: 0, trials: [], error: "Database not available" });
  }
}
