// MTQΣ — Honest Status API (§25.5)
// =========================================================================
// Public endpoint returning the honest validation-gate status of the protocol.
//
//   GET /api/honest-status
//
// Response (200):
//   {
//     "protocol": "MTQΣ",
//     "module": "honest-status",
//     "version": "v25.3-testnet",
//     "status": "NOT PRODUCTION-AUTHORIZED",
//     "isProductionAuthorized": false,
//     "implementedMask": 4095,        // 0xFFF — 12 bits of implemented features
//     "authorizedMask": 0,            // 0 = no gates passed
//     "validationGates": [ { id, name, description, passed, evidence } × 11 ],
//     "computedAt": "<ISO timestamp>"
//   }
//
// On testnet, isProductionAuthorized is ALWAYS false. The protocol is honest
// about its status — it must NOT report production-authorized until every
// one of the 11 §25.5 validation gates passes governance review.
//
// Rate-limited (60 req/min per IP) via the "health" bucket.

import { NextResponse } from "next/server";
import { getHonestStatus, getValidationGates } from "@/lib/mtq/honest-status";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // --- Rate limit (health bucket: 60 req/min per IP) ---
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  try {
    const honest = getHonestStatus();
    const gates = getValidationGates();

    const passed = gates.filter((g) => g.passed).length;
    const total = gates.length;

    return NextResponse.json(
      {
        protocol: "MTQΣ",
        module: "honest-status",
        // §25.5 honest status fields — verbatim from getHonestStatus().
        status: honest.status,
        isProductionAuthorized: honest.isProductionAuthorized,
        implementedMask: honest.implementedMask,
        authorizedMask: honest.authorizedMask,
        version: honest.version,
        // The 11 validation gates with their per-gate evidence strings.
        validationGates: gates,
        // Convenience aggregate (passed/total) — derived, not authoritative.
        gateSummary: {
          passed,
          total,
          remaining: total - passed,
          productionReady: passed === total,
        },
        computedAt: new Date().toISOString(),
        // Always-present disclaimer — testnet is NEVER production-authorized.
        disclaimer:
          "MTQΣ testnet honest status. NOT PRODUCTION-AUTHORIZED. " +
          "All 11 §25.5 validation gates must pass governance review before " +
          "any mainnet authorization. isProductionAuthorized is always false on testnet.",
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rl.remaining),
          // Honest status can change at any tick — never cache.
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        protocol: "MTQΣ",
        module: "honest-status",
        status: "error",
        error: e instanceof Error ? e.message : "Honest status unavailable",
        computedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
