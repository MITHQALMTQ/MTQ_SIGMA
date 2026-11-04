// MTQΣ — /api/chain/faucet — devnet faucet (POST { address }).
// The faucet SIGNS A REAL send tx from the faucet key and submits it through
// the normal consensus path (it is an ordinary network participant, not a
// privileged minter). uMTQD is a testnet-only credit with no value.
// Rate limits: per-IP + one drip per fresh address (checked again on-chain).

import { NextResponse } from "next/server";
import { faucetDrip } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "faucet");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rl.resetAt }, { status: 429 });
  }
  let address = "";
  try {
    const body = (await req.json()) as { address?: string };
    address = String(body.address ?? "");
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const res = await faucetDrip(address);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    method: "POST",
    body: { address: "mtq1…" },
    drip: "10,000 MTQD (testnet-only credit)",
    policy: "one drip per address with zero balance; per-IP rate limit; faucet submits a real signed tx through consensus",
  });
}
