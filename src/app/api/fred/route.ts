// GET /api/fred
//
// Returns the latest economic data from FRED (Federal Reserve Economic Data).
// Free API, no credit card. Used by:
//   - The macro dashboard for official economic indicators
//   - The §6 adaptive macro engine as a supplementary oracle source
//   - The AI briefing for context on market conditions
//
// Series returned: VIX, DXY, Gold (London AM), Treasury 10Y/2Y/3M,
// Breakeven Inflation 10Y, CPI, Fed Funds Rate, Unemployment.
//
// Rate-limited at 60 req/IP/min (RATE_LIMITS.health) — FRED's free tier
// allows 120 req/min, so this is well within bounds.
// Cached for 5 minutes via FRED client's `next: { revalidate: 300 }`.

import { NextResponse } from "next/server";
import { fetchFredBatch, FRED_SERIES } from "@/lib/mtq/fred";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

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

  if (!process.env.FRED_API_KEY) {
    return NextResponse.json(
      { error: "FRED_API_KEY not configured", source: "FRED" },
      { status: 503 },
    );
  }

  try {
    const batch = await fetchFredBatch(
      [
        FRED_SERIES.VIX,
        FRED_SERIES.DXY,
        FRED_SERIES.GOLD_LONDON,
        FRED_SERIES.TREASURY_10Y,
        FRED_SERIES.TREASURY_2Y,
        FRED_SERIES.TREASURY_3M,
        FRED_SERIES.BREAKEVEN_10Y,
        FRED_SERIES.CPI,
        FRED_SERIES.FED_FUNDS,
        FRED_SERIES.UNEMPLOYMENT,
      ],
      5, // last 5 observations each
    );

    const result = {
      source: "FRED (Federal Reserve Economic Data)",
      fetchedAt: new Date().toISOString(),
      series: Object.fromEntries(
        Object.entries(batch).map(([id, s]) => [
          id,
          {
            title: s.title,
            units: s.units,
            frequency: s.frequency,
            latestValue: s.latestValue,
            latestDate: s.latestDate,
            observations: s.observations,
          },
        ]),
      ),
      // Convenience: the key macro signals the §6 engine uses
      macro: {
        vix: batch[FRED_SERIES.VIX]?.latestValue ?? null,
        dxy: batch[FRED_SERIES.DXY]?.latestValue ?? null,
        gold: batch[FRED_SERIES.GOLD_LONDON]?.latestValue ?? null,
        treasury10y: batch[FRED_SERIES.TREASURY_10Y]?.latestValue ?? null,
        treasury2y: batch[FRED_SERIES.TREASURY_2Y]?.latestValue ?? null,
        treasury3m: batch[FRED_SERIES.TREASURY_3M]?.latestValue ?? null,
        breakeven10y: batch[FRED_SERIES.BREAKEVEN_10Y]?.latestValue ?? null,
        cpi: batch[FRED_SERIES.CPI]?.latestValue ?? null,
        fedFunds: batch[FRED_SERIES.FED_FUNDS]?.latestValue ?? null,
        unemployment: batch[FRED_SERIES.UNEMPLOYMENT]?.latestValue ?? null,
      },
    };

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e), source: "FRED" },
      { status: 500 },
    );
  }
}
