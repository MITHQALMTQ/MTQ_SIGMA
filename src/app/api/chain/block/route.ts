// MTQΣ — /api/chain/block?id=<height|hash> — single block with txs + QC.

import { NextResponse } from "next/server";
import { getBlockDetail } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "missing ?id (height or blk_… hash)" }, { status: 400 });
  try {
    const block = await getBlockDetail(id);
    if (!block) return NextResponse.json({ error: "block not found", id }, { status: 404 });
    return NextResponse.json(block);
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
