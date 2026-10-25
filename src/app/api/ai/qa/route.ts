// POST /api/ai/qa
//
// Body: { question: string } (max 500 chars; control chars stripped).
// Returns a 3-5 sentence answer about the MTQΣ Master Monetary Architecture
// v1.0, citing §-numbers, generated via the 5-provider fallback chain
// (Groq → OpenRouter → NVIDIA → Gemini → HuggingFace) using the authoritative
// TS constants from src/lib/mtq/blueprint.ts as context.
//
// If AI_QA_ENABLED=false → HTTP 503 { model: "disabled" }.
// If every provider errors / has no key → returns a deterministic fallback
// answer (model: "fallback").
//
// Rate-limited at 5 req/IP/min (RATE_LIMITS.ai) — every hit burns a token,
// so this is stricter than /api/health.

import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/blueprint-qa";
import { AI_QA_ENABLED } from "@/lib/ai/keys";
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
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }
  if (!AI_QA_ENABLED) {
    return NextResponse.json(
      { error: "AI feature disabled", model: "disabled" },
      {
        status: 503,
        headers: { "X-RateLimit-Remaining": String(rl.remaining) },
      },
    );
  }
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body or invalid JSON → answerQuestion handles null/undefined.
      body = {};
    }
    const question = typeof body?.question === "string" ? body.question : "";
    const result = await answerQuestion(question);
    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    });
  } catch (e) {
    // [P2-class fix] no exception detail in public responses.
    console.error("[api/ai/qa] unavailable", {
      errorType: e instanceof Error ? e.name : typeof e,
    });
    return NextResponse.json(
      { error: "AI QA service unavailable", model: "error" },
      {
        status: 500,
        headers: { "X-RateLimit-Remaining": String(rl.remaining) },
      },
    );
  }
}
