import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    const chain = body.chain ?? "monad";
    const resp = await applyTrial({ type: "REDEEM", amount, chain, wallet: body.wallet });
    try {
      const { db } = await import("@/lib/db");
      if (resp.redeem?.ok) {
        await db.pilotTrial.create({ data: { type: "REDEEM", chain, inputAmount: amount, inputSymbol: "MTQ", outputAmount: resp.redeem.netUsd, outputSymbol: "BASKET", gfbIndex: resp.snapshot.gfbIndex, mtqPrice: resp.snapshot.mtqPrice, nav: resp.snapshot.nav, reserveRatio: resp.snapshot.reserveRatio, lcr: resp.snapshot.lcr, status: resp.snapshot.status, basketJson: JSON.stringify(resp.redeem.basket), ok: resp.redeem.ok, reason: resp.redeem.reason, wallet: body.wallet ?? null } });
      }
    } catch (dbErr) { console.error("DB log failed (non-fatal):", (dbErr as Error).message?.slice(0,80)); }
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
