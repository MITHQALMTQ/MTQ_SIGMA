// GET /api/ai/status
//
// Task 47 — the consensus-layer status view: validated providers, the
// multi-model roster, catalog sync state (the downloaded model databases),
// and the most recent consensus runs with their per-vote attestations.

import { NextResponse } from "next/server";
import { getConsensusStatus } from "@/lib/ai/consensus";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const view = await getConsensusStatus();

  return NextResponse.json(
    {
      source: "MTQΣ AI Consensus Layer (Task 47)",
      fetchedAt: new Date().toISOString(),
      mode: "multi-provider consensus (all AI models vote)",
      providers: view.providers,
      roster: view.roster,
      defaults: view.defaults,
      catalog: view.catalog,
      recentRuns: view.recentRuns,
      policy: view.policy,
      note:
        "Free-tier providers only — NVIDIA ✅ · OpenRouter ✅ (live-validated 2026-11-06) · Google AI Studio key re-validated 2026-11-08 (AQ.… key authenticates; sandbox egress geo-blocked 400 — serves from supported regions e.g. Vercel US) · Groq 403 ❌ · HuggingFace 402-paywall ❌ removed. " +
        "Every AI feature fans out to a voter panel spanning all keyed providers; quorum = ≥ ceil(k/2) parsed votes. " +
        "AI output is ADVISORY ONLY — never writes engine state.",
    },
    {
      headers: { "X-RateLimit-Remaining": String(rl.remaining), "Cache-Control": "no-store" },
    },
  );
}
