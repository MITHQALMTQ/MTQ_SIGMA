// GET /api/v3
//
// Returns the MTQΣ V3 contract status — the production-aligned architecture
// implementing the MITHQAL Master Blueprint v25.3.
//
// V3 features:
//   - Permissioned bank-mediated mint (16-step Bank Minting Workflow)
//   - 7-layer settlement finality
//   - AvailableBackingCertificate verification
//   - Non-custodial (banks hold their own reserves)
//   - 130% RR target, 80/18/2 reserve composition
//   - Stability pool + fee separation + circuit breaker
//   - Real oracle adapters (Chainlink/Pyth/Chronicle)

import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { getHonestStatus, getValidationGates } from "@/lib/mtq/honest-status";

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
    const honest = getHonestStatus();
    const gates = getValidationGates();

    return NextResponse.json({
      source: "MTQΣ V3 — Blueprint v25.3 Architecture",
      fetchedAt: new Date().toISOString(),
      contract: {
        name: "MTQSigmaV3",
        version: "v25.3-testnet",
        deployed: process.env.MTQ_V3_CONTRACT_ADDRESS ? true : false,
        address: process.env.MTQ_V3_CONTRACT_ADDRESS || null,
        chain: process.env.RPC_URL ? "configured" : "not configured",
      },
      architecture: {
        type: "Permissioned wholesale institutional settlement infrastructure",
        mintFlow: "16-step Bank Minting Workflow (BM-01 → BM-16)",
        finality: "7-layer enforcement (L1-L7, 10/10 bypass routes blocked)",
        custody: "Non-custodial — banks hold reserves with qualified custodians",
        kyc: "Banks do KYC (not MITHQAL) — blueprint §0.2",
        reserveRatioTarget: "130%",
        reserveComposition: "80% fiat / 18% gold / 2% digital liquidity",
        settlementInstrument: "MTQ — permissioned, not a cryptocurrency, not a stablecoin",
      },
      features: {
        permissionedMint: true,
        bankRegistry: true,
        availableBackingCertificate: true,
        workflowStateMachine: true,
        sevenLayerFinality: true,
        oracleAdapters: {
          chainlink: "contracts/adapters/ChainlinkAdapter.sol (71 lines)",
          pyth: "contracts/adapters/PythAdapter.sol (80 lines)",
          chronicle: "contracts/adapters/ChronicleAdapter.sol (67 lines)",
        },
        stabilityPool: true,
        feeSeparation: true,
        circuitBreaker: true,
        slippageProtection: true,
        perTxCap: "$500K",
        dailyRedeemCap: "$500K",
        proofOfReserve: "GET /api/por",
        mbgGateway: "POST /api/mbg/mint-request",
      },
      honestStatus: {
        status: honest.status,
        isProductionAuthorized: honest.isProductionAuthorized,
        implementedMask: "0x" + honest.implementedMask.toString(16),
        authorizedMask: "0x" + honest.authorizedMask.toString(16),
        version: honest.version,
        validationGatesPassed: gates.filter((g) => g.passed).length,
        validationGatesTotal: gates.length,
      },
      validationGates: gates.map((g) => ({
        id: g.id,
        name: g.name,
        passed: g.passed,
        evidence: g.evidence,
      })),
      note: "APPROVED CANDIDATE FOR CONTROLLED TESTING — NOT PRODUCTION-AUTHORIZED. " +
            "All 12 critical blockers resolved. All audit findings implemented. " +
            "External audit + legal entity + insurance + bank pilot remain.",
    }, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 503 },
    );
  }
}
