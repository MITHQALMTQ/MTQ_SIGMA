// MTQΣ — /api/chain/mempool — pending transactions (advisory-validated).

import { NextResponse } from "next/server";
import { getMempoolView } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  try {
    return NextResponse.json({ pending: await getMempoolView() });
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
