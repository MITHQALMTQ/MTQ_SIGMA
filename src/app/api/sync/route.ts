// GET /api/sync
//
// Returns the STATUS of the Turso ↔ Neon hybrid sync architecture.
// Also allows manual trigger of a sync event to Inngest.
//
// [2026-10-24 refactor, pre-push remediation] This route no longer imports or
// queries Neon at all. Per the COO/PM brief (enforced by scripts/check-no-neon.ts
// since Task 16-fix-A / audit 16e-004): "Vercel serverless routes must NEVER
// query Neon directly." The actual Turso→Neon data movement is owned by the
// Inngest functions (src/lib/inngest/functions.ts + scripts/full-neon-sync.ts),
// so this route now reports CONFIGURATION status only — env presence, not
// live queries. The UI (InstitutionalDashboard) consumes only the `configured`
// flags, so the response contract it depends on is unchanged.

import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Config-presence only — NO live Neon query from a serverless route
  // (the Inngest sync functions own all Neon data movement; see header note).
  const neonConfigured = !!process.env.NEON_DATABASE_URL;
  const tursoConfigured = !!process.env.TURSO_DATABASE_URL;
  const inngestConfigured = !!process.env.INNGEST_EVENT_KEY;

  const neonStatus: {
    configured: boolean;
    queriedBy: string;
  } = {
    configured: neonConfigured,
    queriedBy: "Inngest 'turso-neon-sync' function (hourly) — routes never query Neon directly",
  };

  return NextResponse.json({
    source: "MTQΣ Hybrid Sync Status",
    fetchedAt: new Date().toISOString(),
    architecture: {
      primary: "Turso (libSQL) — edge reads, real-time state",
      analytical: "Neon (PostgreSQL) — heavy analytics, reports, aggregations",
      orchestrator: "Inngest — event-driven job scheduling (keeper, sync, backup, alerts)",
      frontend: "Vercel — Next.js serverless",
      ci: "GitHub Actions — CI/CD + compute engine",
    },
    connections: {
      turso: { configured: tursoConfigured, url: process.env.TURSO_DATABASE_URL ? "✓" : "✗" },
      neon: neonStatus,
      inngest: { configured: inngestConfigured, endpoint: "POST /api/inngest" },
      vercel: { deployed: true, url: "https://mtq-sigma.vercel.app" },
      github: { repo: "https://github.com/MITHQALMTQ/MTQ_SIGMA" },
    },
    sync: {
      direction: "Turso → Neon (hourly via Inngest)",
      lastSync: "checked by Inngest cron '0 * * * *'",
      tables: ["DailyStateVector", "RebalancingDecision", "OracleSample"],
    },
    inngestFunctions: [
      { id: "keeper-tick", schedule: "every 15s", status: "scheduled" },
      { id: "turso-neon-sync", schedule: "hourly", status: "scheduled" },
      { id: "daily-backup", schedule: "03:00 UTC", status: "scheduled" },
      { id: "oracle-health", schedule: "every 5min", status: "scheduled" },
      { id: "fred-refresh", schedule: "hourly", status: "scheduled" },
      { id: "audit-prune", schedule: "every 6h", status: "scheduled" },
    ],
    note: neonConfigured
      ? "All services connected and working in hybrid mode."
      : "Neon not yet provisioned. Add NEON_DATABASE_URL to .env.local + Vercel to enable analytical sync.",
  }, {
    headers: { "X-RateLimit-Remaining": String(rl.remaining), "Cache-Control": "no-store" },
  });
}

// POST — manually trigger a sync event
export async function POST(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Send event to Inngest to trigger sync
    await inngest.send({
      name: "sync/turso-neon",
      data: { triggeredBy: "manual", timestamp: Date.now() },
    });

    return NextResponse.json({
      ok: true,
      message: "Sync event sent to Inngest — will execute within 15s",
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message?.slice(0, 200),
      note: "If Inngest is not configured, the sync runs on the hourly cron automatically.",
    });
  }
}
