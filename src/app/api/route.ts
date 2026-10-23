import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// [16a-013 P3 fix, Task 16-fix-A] Honest JSON index for the API root.
// Previously this was an undocumented "Hello, world!" stub with no dynamic
// export (would be prerendered static in a prod build) and is not part of
// the UI API reference. Now it identifies the service and points at the two
// primary introspection surfaces. TESTNET ONLY · SHADOW MODE — the full
// posture lives at /api/honest-status.
export async function GET() {
  return NextResponse.json({
    service: "MTQΣ Pilot Command Center API",
    status: "testnet-shadow",
    docs: "/api/health",
    metrics: "/api/metrics",
  });
}
