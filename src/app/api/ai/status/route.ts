// GET /api/ai/status
//
// Returns the status of all AI providers and the fallback chain.

import { NextResponse } from "next/server";
import { getProviderStatus, MODEL_CHAIN } from "@/lib/ai/model-fallback";
import { hasKey, type AIProvider } from "@/lib/ai/keys";
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

  const providers = getProviderStatus();
  const keys = ["groq", "gemini", "huggingface", "nvidia", "openrouter"] as AIProvider[];

  return NextResponse.json({
    source: "MTQΣ AI Provider Status",
    fetchedAt: new Date().toISOString(),
    fallbackChain: MODEL_CHAIN.map((c, i) => ({
      priority: i + 1,
      provider: c.provider,
      model: c.model,
      configured: c.apiKey.length > 0,
      endpoint: c.endpoint,
    })),
    providers: keys.map((k) => ({
      provider: k,
      hasKey: hasKey(k),
    })),
    totalConfigured: providers.filter((p) => p.configured).length,
    totalProviders: providers.length,
    note: "When a provider fails, the system automatically falls back to the next. "
      + "If all fail, deterministic fallback-rules are used.",
  }, {
    headers: { "X-RateLimit-Remaining": String(rl.remaining), "Cache-Control": "no-store" },
  });
}
