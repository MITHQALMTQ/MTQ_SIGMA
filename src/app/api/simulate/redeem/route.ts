import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

// REDEEM-API-FIX (Task MINT-API-FIX + FULL-UI-AUDIT):
// The V3 engine's `applyRedeem` returns RedeemResult with V3 field names
// (`mtqPrice`, `newCirculatingSupply`, `newReserveRatio`). The RedeemSimulator
// UI already uses these V3 names correctly. But some legacy callers expect the
// V2 `price` alias. We add the V2 alias alongside the V3 fields so BOTH work —
// the V3 fields stay authoritative, the V2 alias is a convenience copy that
// always mirrors the V3 value. This is a backward-compat shim; the V3 engine
// is unchanged.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    const chain = body.chain ?? "monad";
    const resp = await applyTrial({ type: "REDEEM", amount, chain, wallet: body.wallet });
    // Add V2 alias fields to the redeem sub-object so both V2 and V3 callers work.
    const redeem = resp.redeem
      ? {
          ...resp.redeem,
          // V2 aliases (mirror the authoritative V3 fields):
          price: resp.redeem.mtqPrice,
          newCirculating: resp.redeem.newCirculatingSupply,
          newRR: resp.redeem.newReserveRatio,
        }
      : undefined;
    try {
      const { db } = await import("@/lib/db");
      if (resp.redeem?.ok) {
        await db.pilotTrial.create({ data: { type: "REDEEM", chain, inputAmount: amount, inputSymbol: "MTQ", outputAmount: resp.redeem.netUsd, outputSymbol: "BASKET", gfbIndex: resp.snapshot.gfbIndex, mtqPrice: resp.snapshot.mtqPrice, nav: resp.snapshot.nav, reserveRatio: resp.snapshot.reserveRatio, lcr: resp.snapshot.lcr, status: resp.snapshot.status, basketJson: JSON.stringify(resp.redeem.basket), ok: resp.redeem.ok, reason: resp.redeem.reason, wallet: body.wallet ?? null } });
      }
    } catch (dbErr) { console.error("DB log failed (non-fatal):", (dbErr as Error).message?.slice(0,80)); }
    return NextResponse.json({ ...resp, redeem });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
