import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";
export const dynamic = "force-dynamic";

// MTQΣ — GFB Index Public API (free, no key)
// Returns the current GFB Index value + all 7 component prices + weights.
// This is a PUBLIC GOOD — anyone can use it to reference global purchasing power.
//
// AUDIT-FIX F-1 (equation-by-equation audit, EQ-011/013 — P0-1): the weights
// below are EXPLICITLY labeled as the STRATEGIC PRIOR (§3.2 soft anchor —
// genesis initialization + EMA anchor only), NEVER as live composition. The
// LIVE weights (the operative chain-index weights used in the §9.2 recursion)
// are published separately in `liveWeights` (= chainIndex.prevWeights), and
// the MASE smoothed target in `smoothedWeights`. Weight states are four
// distinct things (Prior ≠ Target ≠ Smooth ≠ Execution — Invariant I3:
// methodology fixed, weights ADAPTIVE).
export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json({
      gfbIndex: snap.gfbIndex,
      mtqPrice: snap.mtqPrice,
      priceInBand: snap.priceInBand,
      // W^Prior (§3.2 strategic prior — soft anchor, NOT live composition).
      components: {
        USD: { weight: 0.27, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: 1.0 },
        EUR: { weight: 0.20, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.EUR_USD ?? null },
        JPY: { weight: 0.09, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.JPY_USD ?? null },
        GBP: { weight: 0.08, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.GBP_USD ?? null },
        CNY: { weight: 0.05, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.CNY_USD ?? null },
        CHF: { weight: 0.05, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.CHF_USD ?? null },
        Gold: { weight: 0.26, weightLabel: "W^Prior (§3.2 — strategic prior, not live)", price: snap.fx?.XAU_USD ?? null },
      },
      // W^Live — the weights in force in the chain-index recursion (§9.2 form B:
      // start-of-period weights). These are the operative index weights.
      liveWeights: snap.chainIndex?.prevWeights ?? null,
      // W^Smooth — the MASE smoothed target (the constitutional live state the
      // index commits to and mints allocate at).
      smoothedWeights: snap.weightStates?.smoothed ?? null,
      // W^Execution — the observed reserve-portfolio NAV shares.
      executionWeights: snap.weightStates?.execution ?? null,
      chainIndex: snap.chainIndex ?? null,
      // AUDIT-FIX EQ-072..075 — §9.4 per-component contributions + §9.5 effects.
      attribution: snap.attribution ?? null,
      timestamp: new Date().toISOString(),
      status: snap.status,
      methodology: "Chain-linked recursive (§9.2 COO-16) — I_t = I_{t-1} × Σ W_{i,t-1} × (P_{i,t}/P_{i,t-1})",
      disclaimer: "MTQΣ GFB Index — public good, free to use. Not financial advice. PAR = 1 basket-unit (unit of account); NOT a USD peg.",
    });
  } catch (e) {
    return NextResponse.json({ error: "GFB Index not ready" }, { status: 503 });
  }
}
