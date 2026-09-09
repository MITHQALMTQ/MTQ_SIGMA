import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";
export const dynamic = "force-dynamic";

// MTQΣ — GFB Index Public API (free, no key)
// Returns the current GFB Index value + all 7 component prices + weights.
// This is a PUBLIC GOOD — anyone can use it to reference global purchasing power.
export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json({
      gfbIndex: snap.gfbIndex,
      mtqPrice: snap.mtqPrice,
      priceInBand: snap.priceInBand,
      components: {
        USD: { weight: 0.27, price: 1.0 },
        EUR: { weight: 0.20, price: snap.fx?.EUR_USD ?? null },
        JPY: { weight: 0.09, price: snap.fx?.JPY_USD ?? null },
        GBP: { weight: 0.08, price: snap.fx?.GBP_USD ?? null },
        CNY: { weight: 0.05, price: snap.fx?.CNY_USD ?? null },
        CHF: { weight: 0.05, price: snap.fx?.CHF_USD ?? null },
        Gold: { weight: 0.26, price: snap.fx?.XAU_USD ?? null },
      },
      chainIndex: snap.chainIndex ?? null,
      timestamp: new Date().toISOString(),
      status: snap.status,
      methodology: "Chain-linked recursive (§9.2 COO-16)",
      disclaimer: "MTQΣ GFB Index — public good, free to use. Not financial advice.",
    });
  } catch (e) {
    return NextResponse.json({ error: "GFB Index not ready" }, { status: 503 });
  }
}
