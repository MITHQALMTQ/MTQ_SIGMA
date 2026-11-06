// POST /api/ai/catalog-sync
//
// Task 47 — re-download both provider model catalogs ("the free databases")
// and upsert them into custom.db (AiModelCatalog). Idempotent; safe to call
// repeatedly. Each row carries the Task-47 probe provenance (WORKING status +
// measured latency) where available, and z.ai/zai-org models are recorded as
// EXCLUDED by owner policy (auditable, never routed).
//
// Rate-limited at the strict "ai" bucket — a sync makes 2 provider API calls.

import { NextResponse } from "next/server";
import { syncModelCatalogs } from "@/lib/ai/catalog";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "ai");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: 60 },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  try {
    const result = await syncModelCatalogs();
    return NextResponse.json(
      {
        ...result,
        note:
          "Provider model catalogs downloaded and persisted (AiModelCatalog). Rows are idempotent by '<provider>::<model>'. " +
          "Probe evidence (WORKING/latency) is preserved from the Task-47 live validation; z.ai models are EXCLUDED by owner policy.",
      },
      { headers: { "X-RateLimit-Remaining": String(rl.remaining), "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[api/ai/catalog-sync] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Catalog sync failed" }, { status: 502 });
  }
}
