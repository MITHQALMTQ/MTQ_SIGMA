// MTQΣ — landing live-stats API (Task 58 — re-applied on the task55-57 tree).
// Compact live telemetry for the landing page stats bar: the SAME canonical
// engine snapshot that drives the Pilot Command Center (getSnapshot() from
// pilot-state.ts), mapped down to four live numbers + oracle feed health.
// No new data path, no fabrication: every value is computed live at request
// time and the response is never cached.
import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET() {
  try {
    const snap = await getSnapshot();
    const pairs = snap.oracle?.pairs ?? [];
    let liveFeeds = 0;
    let totalFeeds = 0;
    let pairsLive = 0;
    for (const p of pairs) {
      totalFeeds += p.feeds.length;
      if (!p.paused) {
        liveFeeds += p.validCount;
        pairsLive += 1;
      }
    }
    const eurUsd = pairs.find((p) => p.pair === "EUR/USD");

    return NextResponse.json(
      {
        live: {
          referenceIndex: snap.gfbIndex,
          mtqPrice: snap.mtqPrice,
          nav: snap.nav,
          goldWeight: snap.observedGoldWeight,
          status: snap.status,
          eurUsdConsensus: eurUsd ? eurUsd.finalPrice : null,
          oracle: {
            liveFeeds,
            totalFeeds,
            pairsLive,
            pairsTotal: pairs.length,
          },
          servedAt: Date.now(),
        },
      },
      { headers: PRIVATE_RESPONSE_HEADERS },
    );
  } catch (error) {
    // Keep operational details in server-side logs without returning exception
    // messages, database details, or provider metadata to public callers.
    console.error("[api/landing-stats] snapshot unavailable", {
      errorType: error instanceof Error ? error.name : typeof error,
    });

    return NextResponse.json(
      { error: "Engine not ready" },
      { status: 503, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}
