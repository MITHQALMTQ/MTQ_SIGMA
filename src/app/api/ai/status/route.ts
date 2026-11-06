// GET /api/ai/status
//
// Returns the live cross-vendor consensus board: every member (5 free
// open-source vendors + the platform bootstrap), its configuration state,
// health, sticky model, latency, and cooldown. Plus FRED data-member state
// and the degradation ladder explanation.
//
// The board is the operational truth for "is the consensus working" —
// /api/ai/briefing etc. attach their own member provenance per response.

import { NextResponse } from "next/server";
import { getBoard, MEMBER_REGISTRY } from "@/lib/ai/consensus";
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

  const board = getBoard();
  const active = board.filter((m) => m.configured && m.healthy).length;
  const configured = board.filter((m) => m.configured).length;
  const fredConfigured = Boolean(process.env.FRED_API_KEY);

  return NextResponse.json(
    {
      source: "MTQΣ AI Consensus Status",
      fetchedAt: new Date().toISOString(),
      engine: "cross-vendor consensus (parallel fan-out → agreement scoring → centroid synthesis)",
      board: board.map((m) => ({
        member: m.id,
        vendor: m.vendor,
        role: MEMBER_REGISTRY.find((d) => d.id === m.id)?.bootstrap
          ? "platform bootstrap"
          : "external vendor",
        model: m.model,
        configured: m.configured,
        healthy: m.healthy,
        latencyMs: m.latencyMs ?? null,
        cooldownMs: m.cooldownUntil ?? 0,
        lastError: m.lastError ?? null,
      })),
      dataMembers: {
        fred: {
          configured: fredConfigured,
          note: "FRED (Federal Reserve Economic Data) — official macro grounding context injected into consensus prompts",
        },
      },
      summary: {
        activeMembers: active,
        configuredMembers: configured,
        totalMembers: board.length,
        mode: active >= 2 ? "consensus" : active === 1 ? "single-source" : "unavailable (deterministic fallbacks active)",
      },
      note:
        "Every AI answer fans out to all healthy members in parallel; the centroid (highest mean pairwise agreement) " +
        "response is the consensus answer with full member provenance. Failed members enter a 10-minute cooldown. " +
        "Pasting a valid key into .env joins the consensus with zero code changes. AI output is advisory only.",
    },
    {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    },
  );
}
