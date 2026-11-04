// MTQΣ — /api/chain — Sovereign Devnet summary (NOC data source).
// All metrics originate from the in-process chain node's actual state.

import { NextResponse } from "next/server";
import { getSummary } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const summary = await getSummary();
    return NextResponse.json(summary, { headers: { "X-RateLimit-Remaining": String(rl.remaining) } });
  } catch (e) {
    return NextResponse.json(
      { error: "chain node unavailable", detail: String(e) },
      { status: 503 },
    );
  }
}
