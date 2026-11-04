// MTQΣ — /api/chain/submit — submit a CLIENT-SIGNED transaction.
//
// The server NEVER sees private keys: the Wallet UI signs in the browser
// (ed25519 via @noble/curves) and posts the finished Tx here. The node
// re-verifies the signature, admits it to the mempool and the consensus
// round executes it. POST body = full Tx JSON {type, from, nonce, fee,
// payload, sig, pub_key}.

import { NextResponse } from "next/server";
import { submitTx } from "@/lib/chain/rpc";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import type { Tx } from "@/lib/chain/shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain-submit");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rl.resetAt }, { status: 429 });
  }
  let tx: Tx;
  try {
    tx = (await req.json()) as Tx;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  // structural sanity before handing to the mempool
  if (typeof tx?.type !== "string" || typeof tx?.from !== "string" ||
      typeof tx?.sig !== "string" || typeof tx?.pub_key !== "string") {
    return NextResponse.json({ ok: false, error: "malformed tx (type/from/sig/pub_key required)" }, { status: 400 });
  }
  try {
    const res = await submitTx(tx);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "chain node unavailable", detail: String(e) }, { status: 503 });
  }
}
