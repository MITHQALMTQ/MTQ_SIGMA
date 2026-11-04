// MTQΣ — /api/chain/tx?hash=<tx_…> — single transaction + execution receipt.
// GET  recent:  /api/chain/tx?recent=1          — latest 25 txs
// GET  by-sender/from: /api/chain/tx?from=<addr>

import { NextResponse } from "next/server";
import { getTxDetail, store } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("recent")) {
      return NextResponse.json({ txs: await store.getRecentTxs(25) });
    }
    const from = url.searchParams.get("from");
    if (from) {
      return NextResponse.json({ txs: await store.getTxsByAddress(from, 25) });
    }
    const hash = url.searchParams.get("hash") ?? "";
    if (!hash.startsWith("tx_")) return NextResponse.json({ error: "missing ?hash=tx_…" }, { status: 400 });
    const tx = await getTxDetail(hash);
    if (!tx) return NextResponse.json({ error: "tx not found", hash }, { status: 404 });
    return NextResponse.json(tx);
  } catch (e) {
    return NextResponse.json({ error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
