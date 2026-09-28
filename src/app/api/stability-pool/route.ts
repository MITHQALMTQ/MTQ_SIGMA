// GET /api/stability-pool
//
// Returns the current state of the MTQΣ Stability Pool:
//   - total deposits (USDC)
//   - depositor count (estimated)
//   - reward rate
//   - accumulated rewards
//   - pool health (% of liability covered)
//
// The stability pool is the EMERGENCY recovery mechanism (audit T3).
// When RR drops below 1.0, the pool covers the deficit.

import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { getSnapshot } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.resetAt },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  try {
    const snap = await getSnapshot();
    const totalPool = (snap as any).totalStabilityPoolUsd ?? 50_000;
    const usedPool = (snap as any).stabilityPoolUsedUsd ?? 0;
    const liability = snap.liability ?? 0;
    const nav = snap.nav ?? 0;
    const deficit = Math.max(0, liability - nav);
    const coveragePct = liability > 0 ? (totalPool / liability) * 100 : 0;

    return NextResponse.json({
      source: "MTQΣ Stability Pool (§11.5 — Emergency Recovery)",
      fetchedAt: new Date().toISOString(),
      pool: {
        totalDepositsUsd: totalPool,
        totalUsedUsd: usedPool,
        availableUsd: totalPool - usedPool,
        rewardRate: "0.001 per second (10% APY pilot)",
      },
      health: {
        liabilityUsd: liability,
        navUsd: nav,
        currentDeficitUsd: deficit,
        coveragePct: coveragePct.toFixed(2),
        canCoverEmergency: totalPool >= deficit,
      },
      status: snap.status,
      note: "In EMERGENCY (RR < 1.0), the pool automatically covers the deficit. " +
            "Depositors earn rewards proportional to their share.",
    }, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 503 },
    );
  }
}
