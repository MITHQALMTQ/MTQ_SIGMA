// MTQΣ — AI Model Fallback Chain
//
// When one AI provider fails (geo-block, rate limit, network error, model
// deprecated), automatically try the next provider in the chain. This ensures
// the AI features (briefing, QA, risk signals, screen) are always functional
// regardless of which provider is available.
//
// Fallback order (optimized for cost + reliability):
//   1. Groq (fastest, free, but geo-blocked in some regions)
//   2. OpenRouter (multi-model gateway, region-agnostic)
//   3. NVIDIA (enterprise-grade, US-focused)
//   4. Gemini (Google, good but geo-blocked in EU)
//   5. HuggingFace (inference API, always available but lower quality)
//   6. Fallback-rules (deterministic, always works, no AI)

export type AIModelProvider = "groq" | "openrouter" | "nvidia" | "gemini" | "huggingface" | "fallback";

export interface AIModelConfig {
  provider: AIModelProvider;
  model: string;
  apiKey: string;
  endpoint: string;
  maxTokens: number;
  temperature: number;
}

export interface AIModelResult {
  provider: AIModelProvider;
  model: string;
  content: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

// The fallback chain — tried in order until one succeeds
export const MODEL_CHAIN: AIModelConfig[] = [
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY ?? "",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.7,
  },
  {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.7,
  },
  {
    provider: "nvidia",
    model: "meta/llama-3.3-70b-instruct",
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.7,
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash-001",
    apiKey: process.env.GEMINI_API_KEY ?? "",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    maxTokens: 1024,
    temperature: 0.7,
  },
  {
    provider: "huggingface",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    apiKey: process.env.HUGGINGFACE_API_KEY ?? "",
    endpoint: "https://api-inference.huggingface.co/models",
    maxTokens: 1024,
    temperature: 0.7,
  },
];

/**
 * Try each model in the fallback chain until one succeeds.
 * Returns the first successful result, or a fallback-rules result if all fail.
 */
export async function callWithFallback(
  messages: Array<{ role: string; content: string }>,
  options?: { maxTokens?: number; temperature?: number },
): Promise<AIModelResult> {
  const maxTokens = options?.maxTokens ?? 1024;
  const temperature = options?.temperature ?? 0.7;

  for (const config of MODEL_CHAIN) {
    if (!config.apiKey) continue; // skip if no key configured

    const start = Date.now();
    try {
      const content = await callModel(config, messages, maxTokens, temperature);
      if (content && content.length > 0) {
        return {
          provider: config.provider,
          model: config.model,
          content,
          success: true,
          latencyMs: Date.now() - start,
        };
      }
    } catch (e: any) {
      console.log(`[ai-fallback] ${config.provider} failed: ${e?.message?.slice(0, 100)}`);
      // Continue to next model
    }
  }

  // All models failed — return fallback
  return {
    provider: "fallback",
    model: "fallback-rules",
    content: "", // caller provides the fallback content
    success: false,
    error: "All AI providers failed",
    latencyMs: 0,
  };
}

async function callModel(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  if (config.provider === "gemini") {
    return callGemini(config, messages, maxTokens, temperature);
  }
  if (config.provider === "huggingface") {
    return callHuggingFace(config, messages, maxTokens, temperature);
  }

  // Groq, OpenRouter, NVIDIA all use OpenAI-compatible API
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.provider === "openrouter" ? { "HTTP-Referer": "https://mtq-sigma.vercel.app" } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${config.provider} HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const model = config.model;
  const url = `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callHuggingFace(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  _maxTokens: number,
  temperature: number,
): Promise<string> {
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const url = `${config.endpoint}/${config.model}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { temperature, max_new_tokens: _maxTokens, return_full_text: false },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }
  return "";
}

/**
 * Get the status of all AI providers (for monitoring/debugging).
 */
export function getProviderStatus(): Array<{ provider: string; configured: boolean; model: string }> {
  return MODEL_CHAIN.map((c) => ({
    provider: c.provider,
    configured: c.apiKey.length > 0,
    model: c.model,
  }));
}
