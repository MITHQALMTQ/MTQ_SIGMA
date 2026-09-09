import { NextResponse } from "next/server";
import { isReady } from "@/lib/mtq/pilot-state";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = rateLimit(ip, "health");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rl.resetAt }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } });
  const checks = { engine: isReady(), db: false, timestamp: new Date().toISOString(), uptime: process.uptime(), version: "v3-source-ready" };
  try { await db.$queryRaw`SELECT 1`; checks.db = true; } catch { checks.db = false; }
  const healthy = checks.engine && checks.db;
  return NextResponse.json({ status: healthy ? "healthy" : "degraded", checks }, { status: healthy ? 200 : 503, headers: { "X-RateLimit-Remaining": String(rl.remaining) } });
}
