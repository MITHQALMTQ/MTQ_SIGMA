import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  generateProtectedBackingCellReport,
  generateProtectedBackingEvidence,
  protectedBackingHonestState,
  PBC_REFERENCE_CELLS,
} from "@/lib/protected-backing-cell";

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
  const report = generateProtectedBackingCellReport();
  const evidence = generateProtectedBackingEvidence(PBC_REFERENCE_CELLS);
  const honestState = protectedBackingHonestState();
  return NextResponse.json(
    { report, evidence, honestState, referenceCells: PBC_REFERENCE_CELLS, generatedAt: new Date().toISOString() },
    { status: 200, headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
  );
}
