import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { generateImplementationStatusReport } from "@/lib/implementation-status-report";

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
  const report = generateImplementationStatusReport();
  return NextResponse.json(
    { report, generatedAt: new Date().toISOString() },
    { status: 200, headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
  );
}
