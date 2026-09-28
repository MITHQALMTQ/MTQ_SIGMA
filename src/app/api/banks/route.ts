// GET /api/banks
//
// Returns the list of authorized banks in the MTQΣ Bank Registry.
// Only authorized banks can request MTQ issuance via the MBG gateway.
// This is the permissioned access control list (blueprint §3.3 Three-Actor Rule).

import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { BANK_REGISTRY, getAuthorizedBanks } from "@/lib/mtq/bank-registry";

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
    const authorized = getAuthorizedBanks();

    return NextResponse.json({
      source: "MTQΣ Bank Registry (§3.3 — Permissioned Wholesale)",
      fetchedAt: new Date().toISOString(),
      totalBanks: BANK_REGISTRY.length,
      authorizedBanks: authorized.length,
      banks: authorized.map((b) => ({
        address: b.address,
        name: b.name,
        jurisdiction: b.jurisdiction,
        isAuthorized: b.isAuthorized,
        dailyMintCapUsd: b.dailyMintCap,
        dailyMintUsedUsd: b.dailyMintUsed,
        dailyMintRemainingUsd: b.dailyMintCap - b.dailyMintUsed,
        authorizedAt: new Date(b.authorizedAt).toISOString(),
      })),
      note: "Only authorized banks can request MTQ issuance via the MBG gateway " +
            "(POST /api/mbg/mint-request). Customer-level KYC/KYB is performed by " +
            "the bank, not by MITHQAL (blueprint §0.2).",
    }, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 503 },
    );
  }
}
