// POST /api/ai/screen
//
// Body: { text: string } (max 5000 chars).
// Returns named entities (PER/ORG/LOC/MISC) extracted by the Hugging Face
// Inference API + dbmdz/bert-large-cased-finetuned-conll03-english NER model
// (server-side). Output is labelled "AI-generated, informational only — not a
// substitute for OFAC/EU/UN sanctions list checks."
//
// This route is the ONLY /api/ai/* route that adds CORS headers — it may be
// called from external screening tools. CORS is restricted to an explicit
// origin whitelist (no more `Access-Control-Allow-Origin: *`). Requests from
// any other origin are rejected with HTTP 403.
//
// If AI_SCREEN_ENABLED=false → HTTP 503 { model: "disabled" }.
// If HF errors / no key / cold-start → returns regex-fallback entities
// (model: "fallback-regex").
//
// Rate-limited at 5 req/IP/min (RATE_LIMITS.ai) — every hit hits the Hugging
// Face Inference API = real cost.

import { NextResponse } from "next/server";
import { screenText } from "@/lib/ai/sanctions-screen";
import { AI_SCREEN_ENABLED } from "@/lib/ai/keys";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// CORS origin whitelist. Only these origins may call /api/ai/screen from a
// browser. Add new origins here (do NOT use "*").
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://mtqs.vercel.app", // production frontend (Vercel)
  "https://mtqs.pages.dev", // Cloudflare Pages fallback
  "http://localhost:3000", // local dev
]);

// Returns CORS headers reflecting the request Origin if it is whitelisted,
// otherwise null (caller should respond 403). Adds `Vary: Origin` so caches
// don't leak one origin's response to another.
function corsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const headers = corsHeaders(req);
  if (!headers) {
    // Non-whitelisted origin: refuse preflight so the browser never fires the
    // actual POST. Body intentionally empty.
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: Request) {
  // 1) CORS gate: reject non-whitelisted origins before any work / cost.
  const headers = corsHeaders(req);
  if (!headers) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 },
    );
  }

  // 2) Rate limit gate: 5 req/IP/min via Redis (or in-memory in dev).
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "ai");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: 60 },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  if (!AI_SCREEN_ENABLED) {
    return NextResponse.json(
      { error: "AI feature disabled", model: "disabled" },
      {
        status: 503,
        headers: { ...headers, "X-RateLimit-Remaining": String(rl.remaining) },
      },
    );
  }
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const text = typeof body?.text === "string" ? body.text : "";
    const result = await screenText(text);
    return NextResponse.json(result, {
      headers: { ...headers, "X-RateLimit-Remaining": String(rl.remaining) },
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), model: "error" },
      {
        status: 500,
        headers: { ...headers, "X-RateLimit-Remaining": String(rl.remaining) },
      },
    );
  }
}
