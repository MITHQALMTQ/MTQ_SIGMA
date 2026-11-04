// MTQΣ — /api/chain/blocks — paginated block list (Explorer data source).

import { NextResponse } from "next/server";
import { getBlocksPage } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") ?? 15) || 15));
  try {
    return NextResponse.json(await getBlocksPage(page, pageSize));
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
