import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Body {
  amount: number;
  chain: string;
  wallet?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    }
    const chain = body.chain ?? "monad";
    const resp = await applyTrial({ type: "MINT", amount, chain, wallet: body.wallet });
    if (resp.mint && resp.ok) {
      try {
        await db.pilotTrial.create({
          data: {
            type: "MINT",
            chain,
            inputAmount: amount,
            inputSymbol: "USDC",
            outputAmount: resp.mint.mtqMinted,
            outputSymbol: "MTQ",
            gfbIndex: resp.snapshot.gfbIndex,
            mtqPrice: resp.snapshot.mtqPrice,
            nav: resp.snapshot.nav,
            reserveRatio: resp.snapshot.reserveRatio,
            lcr: resp.snapshot.lcr,
            status: resp.snapshot.status,
            ok: resp.mint.ok,
            reason: resp.mint.reason,
            wallet: body.wallet ?? null,
          },
        });
      } catch (e) {
        console.error("trial log failed:", e);
      }
    }
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
