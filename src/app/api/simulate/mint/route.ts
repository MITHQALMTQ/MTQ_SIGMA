import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

// MINT-API-FIX (Task MINT-API-FIX + FULL-UI-AUDIT):
// The V3 engine's `applyMint` returns MintResult with V3 field names
// (`mtqPrice`, `newCirculatingSupply`, `newReserveRatio`). The MintSimulator
// UI already uses these V3 names correctly. But some legacy callers (and the
// verification curl) use V2 names (`price`, `newCirculating`, `newRR`).
// We add the V2 aliases alongside the V3 fields so BOTH work — the V3 fields
// stay authoritative, the V2 aliases are convenience copies that always mirror
// the V3 values. This is a backward-compat shim; the V3 engine is unchanged.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    const chain = body.chain ?? "monad";
    const resp = await applyTrial({ type: "MINT", amount, chain, wallet: body.wallet });
    // Add V2 alias fields to the mint sub-object so both V2 and V3 callers work.
    const mint = resp.mint
      ? {
          ...resp.mint,
          // V2 aliases (mirror the authoritative V3 fields):
          price: resp.mint.mtqPrice,
          newCirculating: resp.mint.newCirculatingSupply,
          newRR: resp.mint.newReserveRatio,
        }
      : undefined;
    // Try to log to DB, but don't fail if DB is unavailable
    try {
      const { db } = await import("@/lib/db");
      if (resp.mint?.ok) {
        await db.pilotTrial.create({ data: { type: "MINT", chain, inputAmount: amount, inputSymbol: "USDC", outputAmount: resp.mint.mtqMinted, outputSymbol: "MTQ", gfbIndex: resp.snapshot.gfbIndex, mtqPrice: resp.snapshot.mtqPrice, nav: resp.snapshot.nav, reserveRatio: resp.snapshot.reserveRatio, lcr: resp.snapshot.lcr, status: resp.snapshot.status, ok: resp.mint.ok, reason: resp.mint.reason, wallet: body.wallet ?? null } });
      }
    } catch (dbErr) { console.error("DB log failed (non-fatal):", (dbErr as Error).message?.slice(0,80)); }
    return NextResponse.json({ ...resp, mint });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
