// MTQΣ — /api/chain/gov — on-chain governance: proposals, votes, params, events.
// Network-governance ONLY (constitutional guard elsewhere); MTQ monetary
// governance lives in its own section/domain and cannot be reached here.

import { NextResponse } from "next/server";
import { getGovernanceView } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  try {
    return NextResponse.json(await getGovernanceView());
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
