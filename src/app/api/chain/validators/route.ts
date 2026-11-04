// MTQΣ — /api/chain/validators — validator set with voting power + proposer rotation.

import { NextResponse } from "next/server";
import { getValidatorList } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  try {
    return NextResponse.json({ validators: await getValidatorList() });
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
