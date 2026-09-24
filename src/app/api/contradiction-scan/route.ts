import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { generateContradictionScanReport } from "@/lib/contradiction-scan";

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
  const report = generateContradictionScanReport();
  return NextResponse.json(
    { report, generatedAt: new Date().toISOString() },
    { status: 200, headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
  );
}
