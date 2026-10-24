import { NextResponse } from "next/server";
import { getFx } from "@/lib/mtq/pilot-state";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // [Task 24-c hardening] "por" bucket, 60 req/IP/min (same budget as health /
  // PoR public reads). fetchFxSnapshot(false) is TTL-cached in-module, but on
  // cache expiry a single request fans out to 4+ external providers
  // (Frankfurter ×2 fallbacks, gold spot, PAXG 24h volume, FRED/Yahoo VIX+DXY)
  // — the bucket bounds hammering timed to the TTL boundary.
  const rl = await rateLimit(getClientIP(req), "por");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  const fx = await getFx();
  return NextResponse.json(fx);
}
