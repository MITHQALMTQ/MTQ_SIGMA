// MTQΣ — /api/chain/oracle — on-chain oracle consensus view (§17.10 reference):
// published multi-family price records, observation provenance, thresholds, and
// the verbatim honest disclosure. Observations are submitted ONLY via genuine
// signed validator txs (POST /api/chain/submit, type oracle_observe).

import { NextResponse } from "next/server";
import { getOracleView } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  try {
    return NextResponse.json(await getOracleView());
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
