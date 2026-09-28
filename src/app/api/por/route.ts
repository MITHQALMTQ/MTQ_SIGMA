import { NextResponse } from "next/server";
import { getPorStatus, fetchReserveAttestation } from "@/lib/mtq/proof-of-reserve";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

// MTQΣ — Proof of Reserve (PoR) Public API
// =========================================================================
// Returns the current Proof of Reserve status: the latest reserve
// attestation, the reserve ratio (RR), and whether the reserves are
// sufficient (RR ≥ 1.0 hard floor / 1.30 production target).
//
// This is a PUBLIC GOOD — anyone can verify the backing is real.
//
// Production target: integrate with a Chainlink Proof of Reserve feed
// (see fetchReserveAttestationFromChainlink). Testnet pilot: falls back
// to the in-process pilot state (NOT production-safe — clearly marked
// in the response).
//
// GET /api/por              → protocol-wide PoR (bank = 0x0)
// GET /api/por?bank=0x...   → per-bank PoR
//
// Rate-limited (60 req/min per IP) — public good, but not free.
export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "por");
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
    // Optional ?bank=0x... query param for per-bank attestations.
    const url = new URL(req.url);
    const bankParam = url.searchParams.get("bank");
    const bank = bankParam && /^0x[a-fA-F0-9]{40}$/.test(bankParam)
      ? bankParam
      : "0x0000000000000000000000000000000000000000";

    const attestation = await fetchReserveAttestation(bank);
    const status = await getPorStatus(attestation);

    return NextResponse.json(
      {
        protocol: "MTQΣ",
        module: "proof-of-reserve",
        version: "v1.0",
        status: status.status,
        summary: status.summary,
        reserveRatio: status.reserveRatio,
        liabilityUsd: status.liabilityUsd,
        sufficient: status.sufficient,
        attestation: {
          attestationId: status.latestAttestation.attestationId,
          bank: status.latestAttestation.bank,
          totalBackingUsd: status.latestAttestation.totalBackingUsd,
          composition: status.latestAttestation.composition,
          custodian: status.latestAttestation.custodian,
          custodianAddress: status.latestAttestation.custodianAddress,
          timestamp: status.latestAttestation.timestamp,
          expiry: status.latestAttestation.expiry,
          verified: status.latestAttestation.verified,
          hasSignature: status.latestAttestation.custodianSignature.length > 0,
        },
        targets: {
          rrHardFloor: 1.0,
          rrProductionTarget: 1.30,
          fiatTarget: 0.80,
          goldTarget: 0.18,
          digitalTarget: 0.02,
        },
        computedAt: new Date(status.computedAt).toISOString(),
        // IMPORTANT: clearly mark the pilot fallback so downstream consumers
        // do NOT treat the testnet pilot response as production proof.
        pilot: status.status === "unverified",
        disclaimer:
          "MTQΣ Proof of Reserve — public good. Testnet pilot uses an in-process fallback (NOT production-safe). Production deployments MUST integrate a Chainlink Proof of Reserve feed.",
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rl.remaining),
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        protocol: "MTQΣ",
        module: "proof-of-reserve",
        status: "error",
        error: e instanceof Error ? e.message : "PoR status unavailable",
        computedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
