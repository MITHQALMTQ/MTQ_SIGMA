// MTQΣ — /api/chain/account?a=<mtq1…> — balances, nonce, stakes, validator role, recent txs.

import { NextResponse } from "next/server";
import { getAccountInfo } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const a = new URL(req.url).searchParams.get("a") ?? "";
  if (!/^mtq1[0-9a-f]{40}$/.test(a)) {
    return NextResponse.json({ error: "invalid address (expected mtq1 + 40 hex)" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getAccountInfo(a));
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
